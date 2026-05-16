import { AgentController } from '../engine/AgentController';
import { CollisionDetector } from '../engine/CollisionDetector';
import { VisionSystem } from '../engine/VisionSystem';
import { WorldManager } from '../engine/WorldManager';
import {
  createDefaultBrainGraph,
  validateBrainGraph,
  reconcileBrainGraphVisionCells,
  type BrainGraph
} from '../domain/brain';
import type { Agent, SimulationState, World } from '../types/simulation';
import type { BrainGraphRuntimeStatus } from '../types/brainGraphRuntime';
import {
  type SimulationControlMode,
  type WorldConfig,
  createEmptyWorldState,
  createInitialWorldStats,
  createSimulationStateSnapshot,
  createWorldConfig,
  createWorldSnapshot
} from '../domain/world';
import { aggregateAverageNeuralState, buildStatsSnapshot, type WorldState } from '../domain/world';

export interface SimulationSessionDependencies {
  visionSystem: VisionSystem;
  agentController: AgentController;
  worldManager: WorldManager;
  collisionDetector: CollisionDetector;
}

export interface SimulationSessionOptions {
  world?: Partial<WorldConfig>;
  initialControlMode?: SimulationControlMode;
}

export interface SimulationSessionInputState {
  turnLeft: boolean;
  moveForward: boolean;
  turnRight: boolean;
}

export class SimulationSession {
  private readonly visionSystem: VisionSystem;
  private readonly agentController: AgentController;
  private readonly worldManager: WorldManager;
  private readonly collisionDetector: CollisionDetector;
  private readonly config: WorldConfig;

  private currentControlMode: SimulationControlMode;
  private currentBrainGraph: BrainGraph;
  private keyboardInputState: SimulationSessionInputState = {
    turnLeft: false,
    moveForward: false,
    turnRight: false
  };
  private state: WorldState;

  constructor(
    dependencies: SimulationSessionDependencies,
    options: SimulationSessionOptions = {}
  ) {
    this.visionSystem = dependencies.visionSystem;
    this.agentController = dependencies.agentController;
    this.worldManager = dependencies.worldManager;
    this.collisionDetector = dependencies.collisionDetector;
    this.config = createWorldConfig({
      width: this.worldManager.width,
      height: this.worldManager.height,
      ...options.world
    });
    this.currentControlMode = options.initialControlMode ?? 'keyboard';
    this.currentBrainGraph = createDefaultBrainGraph(this.visionSystem.getVisionCells());
    this.state = createEmptyWorldState(this.config, this.worldManager.getWorldBounds());
  }

  public initialize(): void {
    this.state = createEmptyWorldState(this.config, this.worldManager.getWorldBounds());
    this.state.agents = this.worldManager.createAgents(this.config.mainAgentId);
    this.state.foods = this.worldManager.generateFood(this.state.agents);
    this.state.obstacles = this.worldManager.generateObstacles();

    for (const agent of this.state.agents) {
      this.visionSystem.initializeVisionCells(agent);
    }

    this.syncMainAgentBrainProgram();
  }

  public reset(): void {
    this.state = createEmptyWorldState(this.config, this.worldManager.getWorldBounds());
    this.state.stats = createInitialWorldStats();
    this.initialize();
    this.setControlMode(this.currentControlMode);
  }

  public step(deltaTime: number): SimulationState['stats'] {
    for (const agent of this.state.agents) {
      this.visionSystem.updateVisionCells(
        agent,
        this.state.agents,
        this.state.foods,
        this.state.obstacles
      );
      this.agentController.updateAgent(agent, deltaTime, {
        controlMode: this.getEffectiveControlMode(agent),
        keyboardInputState: this.keyboardInputState
      });
      this.worldManager.handleBoundaryCollision(agent);
    }

    this.worldManager.updateMovingObstacles(this.state.obstacles, deltaTime);

    const collisionResult = this.collisionDetector.handleCollisions(
      this.state.agents,
      this.state.foods,
      this.state.obstacles
    );

    this.state.foods = this.collisionDetector.removeFoods(
      this.state.foods,
      collisionResult.foodsToRemove
    );
    this.state.stats.totalRewards += collisionResult.totalRewards;
    this.state.stats.totalCollisions += collisionResult.totalCollisions;
    this.state.stats.averageNeuralState = aggregateAverageNeuralState(this.state.agents);

    return this.getStatsSnapshot();
  }

  public updateAgentParameters(params: {
    visionCells?: number;
    visionRange?: number;
    visionAngle?: number;
  }): void {
    this.visionSystem.updateConfiguration(params);
    const mainAgent = this.getMainAgent();
    const didVisionCellCountChange = params.visionCells !== undefined;

    for (const agent of this.state.agents) {
      this.visionSystem.initializeVisionCells(agent);
    }

    if (didVisionCellCountChange && mainAgent) {
      this.currentBrainGraph = this.reconcileBrainGraph(mainAgent.visionCells.length);
      this.syncMainAgentBrainProgram(mainAgent);
    }
  }

  public setControlMode(newMode: SimulationControlMode): void {
    this.currentControlMode = newMode;
    const mainAgent = this.getMainAgent();

    if (!mainAgent) {
      return;
    }

    if (newMode === 'snn') {
      this.syncMainAgentBrainProgram(mainAgent);
    }
  }

  public getControlMode(): SimulationControlMode {
    return this.currentControlMode;
  }

  public setKeyboardInputState(nextState: SimulationSessionInputState): void {
    this.keyboardInputState = { ...nextState };
  }

  public setBrainGraph(graph: BrainGraph): BrainGraphRuntimeStatus {
    const mainAgent = this.getMainAgent();
    const visionCells = mainAgent?.visionCells.length ?? this.visionSystem.getVisionCells();
    const reconciledGraph = this.reconcileBrainGraph(visionCells, graph);
    const issues = validateBrainGraph(reconciledGraph);

    if (issues.length > 0) {
      return {
        state: 'invalid',
        appliedGraph: this.currentBrainGraph,
        issues,
        message: issues.map((issue) => issue.message).join(' | ')
      } satisfies BrainGraphRuntimeStatus;
    }

    this.currentBrainGraph = reconciledGraph;
    this.syncMainAgentBrainProgram(mainAgent);
    return {
      state: 'applied',
      appliedGraph: this.currentBrainGraph,
      issues: [],
      message: null
    } satisfies BrainGraphRuntimeStatus;
  }

  public getMainAgentControlMode(): SimulationControlMode {
    return this.currentControlMode;
  }

  public getAgentControlMode(agentId: number): SimulationControlMode | null {
    const agent = this.state.agents.find((candidate) => candidate.id === agentId);
    return agent ? this.getEffectiveControlMode(agent) : null;
  }

  public getCurrentBrainGraph(): BrainGraph {
    return this.currentBrainGraph;
  }

  public getBrainGraphRuntimeStatus(): BrainGraphRuntimeStatus {
    return {
      state: 'applied',
      appliedGraph: this.currentBrainGraph,
      issues: [],
      message: null
    };
  }

  public isMainAgentBrainProgramConfigured(): boolean {
    return Boolean(this.getMainAgent());
  }

  public getMainAgent(): Agent | null {
    return this.state.agents.find((agent) => agent.id === this.config.mainAgentId) ?? null;
  }

  public getStatsSnapshot(fps: number = 0): SimulationState['stats'] {
    this.state.stats.averageNeuralState = aggregateAverageNeuralState(this.state.agents);
    return buildStatsSnapshot(this.state, fps);
  }

  public getWorldSnapshot(): World {
    return createWorldSnapshot(this.state, {
      range: this.visionSystem.getVisionRange(),
      angle: this.visionSystem.getVisionAngle()
    });
  }

  public getSimulationStateSnapshot(fps: number = 0): SimulationState {
    this.state.stats.averageNeuralState = aggregateAverageNeuralState(this.state.agents);
    return createSimulationStateSnapshot(this.state, fps);
  }

  public getState(): Readonly<WorldState> {
    return this.state;
  }

  public getMutableState(): WorldState {
    return this.state;
  }

  private getEffectiveControlMode(agent: Agent): SimulationControlMode {
    return agent.id === this.config.mainAgentId ? this.currentControlMode : 'random';
  }

  private syncMainAgentBrainProgram(mainAgent: Agent | null = this.getMainAgent()): void {
    if (!mainAgent) {
      return;
    }

    const graph = this.reconcileBrainGraph(mainAgent.visionCells.length);
    this.currentBrainGraph = graph;
    this.agentController.setBrainGraph(mainAgent.id, graph);
  }

  private reconcileBrainGraph(visionCells: number, graph: BrainGraph = this.currentBrainGraph): BrainGraph {
    return reconcileBrainGraphVisionCells(graph, visionCells);
  }
}
