import { AgentController } from '../engine/AgentController';
import { CollisionDetector } from '../engine/CollisionDetector';
import { VisionSystem } from '../engine/VisionSystem';
import { WorldManager } from '../engine/WorldManager';
import {
  compileAgentIR,
  createDefaultAgentIR,
  reconcileAgentIRVisionCells,
  summarizeAgentIR,
  type AgentIR,
} from '../domain/brain';
import {
  compileBrainDefinition,
  createAgentIRFromLegacyGraph,
  createLegacyGraphBridgeFromAgent,
  GraphIRValidationError,
  validateGraphIRDocument,
  type BodyDefinition,
  type GraphIRDocument,
  type GraphIRValidationIssue,
} from '../domain/brain/compat';
import type { Agent, SimulationState, World } from '../types/simulation';
import type { GraphIRRuntimeActivitySnapshot, GraphIRRuntimeStatus } from '../types/graphIRRuntime';
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
  private currentAgentIR: AgentIR;
  private graphIRRuntimeStatus: GraphIRRuntimeStatus;
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
    this.currentAgentIR = createDefaultAgentIR(this.visionSystem.getVisionCells(), '默认 Agent');
    this.graphIRRuntimeStatus = this.createAppliedGraphIRRuntimeStatus(this.currentAgentIR);
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

  // Legacy compat entry for tests and transitional GraphIR callers.
  public setLegacyGraphIRDocument(document: GraphIRDocument, body?: BodyDefinition): GraphIRRuntimeStatus {
    const mainAgent = this.getMainAgent();
    const visionCells = mainAgent?.visionCells.length ?? this.visionSystem.getVisionCells();
    const nextAgent = reconcileAgentIRVisionCells(
      createAgentIRFromLegacyGraph(
        this.currentAgentIR.metadata.name,
        document,
        body,
        undefined,
        this.currentAgentIR.metadata
      ),
      visionCells
    );
    const compatBridge = createLegacyGraphBridgeFromAgent(nextAgent);
    const reconciledDocument = compatBridge.document;
    const reconciledBody = compatBridge.body;
    const issues = validateGraphIRDocument(reconciledDocument);

    if (issues.length > 0) {
      return this.setInvalidGraphIRRuntimeStatus(issues);
    }

    try {
      compileBrainDefinition(reconciledDocument, reconciledBody);
      this.applyAgentIR(nextAgent, mainAgent);
    } catch (error) {
      if (error instanceof GraphIRValidationError) {
        return this.setInvalidGraphIRRuntimeStatus(error.issues);
      }

      return this.setInvalidGraphIRRuntimeStatus([
        {
          code: 'runtime-binding-error',
          message: error instanceof Error ? error.message : 'Unknown GraphIR runtime binding failure.',
        },
      ]);
    }

    return this.setAppliedGraphIRRuntimeStatus(this.currentAgentIR);
  }

  // Backward-compatible alias; do not introduce new production callers.
  public setGraphIRDocument(document: GraphIRDocument, body?: BodyDefinition): GraphIRRuntimeStatus {
    return this.setLegacyGraphIRDocument(document, body);
  }

  public setAgentIR(agent: AgentIR): GraphIRRuntimeStatus {
    const mainAgent = this.getMainAgent();

    try {
      createLegacyGraphBridgeFromAgent(agent);
      this.applyAgentIR(agent, mainAgent);
    } catch (error) {
      if (error instanceof GraphIRValidationError) {
        return this.setInvalidGraphIRRuntimeStatus(error.issues);
      }

      return this.setInvalidGraphIRRuntimeStatus([
        {
          code: 'runtime-binding-error',
          message: error instanceof Error ? error.message : 'Unknown AgentIR runtime binding failure.',
        },
      ]);
    }

    return this.setAppliedGraphIRRuntimeStatus(agent);
  }

  public getMainAgentControlMode(): SimulationControlMode {
    return this.currentControlMode;
  }

  public getAgentControlMode(agentId: number): SimulationControlMode | null {
    const agent = this.state.agents.find((candidate) => candidate.id === agentId);
    return agent ? this.getEffectiveControlMode(agent) : null;
  }

  public getCurrentLegacyGraphIRDocument(): GraphIRDocument {
    return createLegacyGraphBridgeFromAgent(this.currentAgentIR).document;
  }

  public getCurrentGraphIRDocument(): GraphIRDocument {
    return this.getCurrentLegacyGraphIRDocument();
  }

  public getCurrentAgentIR(): AgentIR {
    return this.currentAgentIR;
  }

  public getGraphIRRuntimeStatus(): GraphIRRuntimeStatus {
    return this.graphIRRuntimeStatus;
  }

  public getGraphIRRuntimeActivitySnapshot(): GraphIRRuntimeActivitySnapshot {
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

  public getMutableState(): WorldState {
    return this.state;
  }

  private getEffectiveControlMode(agent: Agent): SimulationControlMode {
    return agent.id === this.config.mainAgentId ? this.currentControlMode : 'random';
  }

  private syncMainAgentProgram(mainAgent: Agent | null = this.getMainAgent()): void {
    if (!mainAgent) {
      return;
    }

    const nextAgent = reconcileAgentIRVisionCells(this.currentAgentIR, mainAgent.visionCells.length);
    this.applyAgentIR(nextAgent, mainAgent);
    this.setAppliedGraphIRRuntimeStatus(nextAgent);
  }

  private applyAgentIR(
    agent: AgentIR,
    mainAgent: Agent | null
  ): void {
    const compiledProgram = compileAgentIR(agent);

    if (mainAgent) {
      this.agentController.installAgentProgram(mainAgent.id, compiledProgram);
    }

    this.currentAgentIR = agent;
  }

  private createAppliedGraphIRRuntimeStatus(agent: AgentIR): GraphIRRuntimeStatus {
    return {
      state: 'applied',
      appliedSummary: summarizeAgentIR(agent),
      issues: [],
      message: null,
    };
  }

  private setAppliedGraphIRRuntimeStatus(agent: AgentIR): GraphIRRuntimeStatus {
    this.graphIRRuntimeStatus = this.createAppliedGraphIRRuntimeStatus(agent);
    return this.graphIRRuntimeStatus;
  }

  private setInvalidGraphIRRuntimeStatus(issues: GraphIRValidationIssue[]): GraphIRRuntimeStatus {
    this.graphIRRuntimeStatus = {
      state: 'invalid',
      appliedSummary: summarizeAgentIR(this.currentAgentIR),
      issues,
      message: issues.map((issue) => issue.message).join(' | '),
    };
    return this.graphIRRuntimeStatus;
  }
}
