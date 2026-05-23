import { AgentController } from '../engine/AgentController';
import { CollisionDetector } from '../engine/CollisionDetector';
import { VisionSystem } from '../engine/VisionSystem';
import { WorldManager } from '../engine/WorldManager';
import {
  AgentValidationError,
  compileAgentIR,
  createDefaultAgentIR,
  reconcileAgentIRVisionCells,
  summarizeCompiledAgentProgram,
  type AgentValidationIssue,
  type AgentIR,
  type WorldRegistry,
} from '../domain/brain';
import type { Agent, SimulationState, World } from '../types/simulation';
import type { AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from '../types/agentRuntime';
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
  worldRegistry: WorldRegistry;
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
  private readonly worldRegistry: WorldRegistry;
  private readonly config: WorldConfig;

  private currentControlMode: SimulationControlMode;
  private currentAgentIR: AgentIR;
  private agentRuntimeStatus: AgentRuntimeStatus;
  private lastAppliedSummary: AgentRuntimeStatus['appliedSummary'];
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
    this.worldRegistry = dependencies.worldRegistry;
    this.config = createWorldConfig({
      width: this.worldManager.width,
      height: this.worldManager.height,
      ...options.world
    });
    this.currentControlMode = options.initialControlMode ?? 'keyboard';
    this.currentAgentIR = createDefaultAgentIR(this.visionSystem.getVisionCells(), '默认 Agent');
    this.agentRuntimeStatus = this.createAppliedAgentRuntimeStatus(this.currentAgentIR);
    this.lastAppliedSummary = this.agentRuntimeStatus.appliedSummary;
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

    this.syncMainAgentProgram();
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
      this.syncMainAgentProgram(mainAgent);
    }
  }

  public setControlMode(newMode: SimulationControlMode): void {
    this.currentControlMode = newMode;
    const mainAgent = this.getMainAgent();

    if (!mainAgent) {
      return;
    }

    if (newMode === 'snn') {
      this.syncMainAgentProgram(mainAgent);
    }
  }

  public getControlMode(): SimulationControlMode {
    return this.currentControlMode;
  }

  public setKeyboardInputState(nextState: SimulationSessionInputState): void {
    this.keyboardInputState = { ...nextState };
  }

  public setAgentIR(agent: AgentIR): AgentRuntimeStatus {
    const mainAgent = this.getMainAgent();

    try {
      const compiledProgram = this.applyAgentIR(agent, mainAgent);
      return this.setAppliedAgentRuntimeStatusFromProgram(compiledProgram);
    } catch (error) {
      if (error instanceof AgentValidationError) {
        return this.setInvalidAgentRuntimeStatus(error.issues);
      }

      return this.setInvalidAgentRuntimeStatus([
        {
          code: 'runtime-binding-error',
          message: error instanceof Error ? error.message : 'Unknown AgentIR runtime binding failure.',
        },
      ]);
    }

  }

  public getMainAgentControlMode(): SimulationControlMode {
    return this.currentControlMode;
  }

  public getAgentControlMode(agentId: number): SimulationControlMode | null {
    const agent = this.state.agents.find((candidate) => candidate.id === agentId);
    return agent ? this.getEffectiveControlMode(agent) : null;
  }

  public getCurrentAgentIR(): AgentIR {
    return this.currentAgentIR;
  }

  public getVisionCellCount(): number {
    return this.visionSystem.getVisionCells();
  }

  public getAgentRuntimeStatus(): AgentRuntimeStatus {
    return this.agentRuntimeStatus;
  }

  public getAgentRuntimeActivitySnapshot(): AgentRuntimeActivitySnapshot {
    const mainAgent = this.getMainAgent();
    if (!mainAgent) {
      return { activeNodeIds: [] };
    }

    return {
      activeNodeIds: this.agentController.getActiveLeafNodeIds(mainAgent.id),
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

  private getEffectiveControlMode(agent: Agent): SimulationControlMode {
    return agent.id === this.config.mainAgentId ? this.currentControlMode : 'random';
  }

  private syncMainAgentProgram(mainAgent: Agent | null = this.getMainAgent()): void {
    if (!mainAgent) {
      return;
    }

    const nextAgent = reconcileAgentIRVisionCells(this.currentAgentIR, mainAgent.visionCells.length, this.worldRegistry);
    const compiledProgram = this.applyAgentIR(nextAgent, mainAgent);
    this.setAppliedAgentRuntimeStatusFromProgram(compiledProgram);
  }

  private applyAgentIR(
    agent: AgentIR,
    mainAgent: Agent | null
  ): ReturnType<typeof compileAgentIR> {
    const compiledProgram = compileAgentIR(agent, this.worldRegistry);

    if (mainAgent) {
      this.agentController.installAgentProgram(mainAgent.id, compiledProgram);
    }

    this.currentAgentIR = agent;
    return compiledProgram;
  }

  private createAppliedAgentRuntimeStatus(agent: AgentIR): AgentRuntimeStatus {
    const compiledProgram = compileAgentIR(agent, this.worldRegistry);
    return {
      state: 'applied',
      appliedSummary: summarizeCompiledAgentProgram(compiledProgram),
      issues: [],
      message: null,
    };
  }

  private createAppliedAgentRuntimeStatusFromProgram(compiledProgram: ReturnType<typeof compileAgentIR>): AgentRuntimeStatus {
    return {
      state: 'applied',
      appliedSummary: summarizeCompiledAgentProgram(compiledProgram),
      issues: [],
      message: null,
    };
  }

  private setAppliedAgentRuntimeStatusFromProgram(compiledProgram: ReturnType<typeof compileAgentIR>): AgentRuntimeStatus {
    this.agentRuntimeStatus = this.createAppliedAgentRuntimeStatusFromProgram(compiledProgram);
    this.lastAppliedSummary = this.agentRuntimeStatus.appliedSummary;
    return this.agentRuntimeStatus;
  }

  private setInvalidAgentRuntimeStatus(issues: AgentValidationIssue[]): AgentRuntimeStatus {
    this.agentRuntimeStatus = {
      state: 'invalid',
      appliedSummary: this.lastAppliedSummary,
      issues,
      message: issues.map((issue) => issue.message).join(' | '),
    };
    return this.agentRuntimeStatus;
  }
}
