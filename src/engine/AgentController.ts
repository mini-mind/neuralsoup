/**
 * 智能体控制器类
 * 负责处理不同类型的智能体控制逻辑
 */

import { Agent } from '../types/simulation';
import {
  type SimulationControlMode,
  type WorldControlCommand,
  type WorldActionOutputAdapter,
  type MovementWorldControlBindings,
  type WorldInputSignalProvider,
  type WorldControlCommandApplier,
} from '../domain/world';
import {
  createAgentProgramRuntimeState,
  stepAgentProgram,
  type AgentProgram,
  type AgentProgramRuntimeState,
} from '../domain/brain';

export interface KeyboardInputState {
  turnLeft: boolean;
  moveForward: boolean;
  turnRight: boolean;
}

export interface AgentUpdateContext {
  controlMode: SimulationControlMode;
  keyboardInputState: KeyboardInputState;
}

export class AgentController {
  private agentPrograms: Map<number, AgentProgram> = new Map();
  private agentRuntimeStates: Map<number, AgentProgramRuntimeState> = new Map();
  private readonly actionOutputAdapter: WorldActionOutputAdapter;
  private readonly inputSignalProvider: WorldInputSignalProvider;
  private readonly controlCommandApplier: WorldControlCommandApplier;
  private readonly keyboardBindings: MovementWorldControlBindings;

  constructor(
    actionOutputAdapter: WorldActionOutputAdapter,
    inputSignalProvider: WorldInputSignalProvider,
    controlCommandApplier: WorldControlCommandApplier,
    keyboardBindings: MovementWorldControlBindings
  ) {
    this.actionOutputAdapter = actionOutputAdapter;
    this.inputSignalProvider = inputSignalProvider;
    this.controlCommandApplier = controlCommandApplier;
    this.keyboardBindings = keyboardBindings;
  }

  public installAgentProgram(agentId: number, program: AgentProgram): void {
    this.agentPrograms.set(agentId, program);
    this.agentRuntimeStates.set(agentId, createAgentProgramRuntimeState(program));
  }

  public getActiveLeafNodeIds(agentId: number): string[] {
    const agentRuntimeState = this.agentRuntimeStates.get(agentId);
    if (agentRuntimeState) {
      return [...agentRuntimeState.activeLeafNodeIds];
    }
    return [];
  }

  /**
   * 更新智能体控制
   */
  public updateAgent(agent: Agent, deltaTime: number, context: AgentUpdateContext): void {
    const keyboardCommands = this.getKeyboardCommands(context.keyboardInputState);

    switch (context.controlMode) {
      case 'snn':
        this.updateSNNAgent(agent, deltaTime, keyboardCommands);
        break;
      case 'keyboard':
        this.updateKeyboardAgent(agent, deltaTime, keyboardCommands);
        break;
      case 'random':
        this.updateRandomAgent(agent, deltaTime);
        break;
    }

    // 应用物理运动
    agent.x += agent.velocity.x * deltaTime;
    agent.y += agent.velocity.y * deltaTime;

    // 神经状态衰减
    agent.motivation *= 0.99;
    agent.stress = Math.max(0.1, agent.stress * 0.995);
    agent.homeostasis = 0.5 + (agent.homeostasis - 0.5) * 0.98; // 向稳态平衡值回归
  }

  /**
   * 更新键盘控制的智能体
   */
  private updateKeyboardAgent(
    agent: Agent,
    deltaTime: number,
    keyboardCommands: WorldControlCommand[]
  ): void {
    this.controlCommandApplier.apply(agent, keyboardCommands, deltaTime);
  }

  /**
   * 更新SNN控制的智能体
   */
  private updateSNNAgent(
    agent: Agent,
    deltaTime: number,
    keyboardCommands: WorldControlCommand[]
  ): void {
    const agentProgram = this.agentPrograms.get(agent.id);
    const agentRuntimeState = this.agentRuntimeStates.get(agent.id);
    if (!agentProgram || !agentRuntimeState) {
      return;
    }

    if (keyboardCommands.length > 0) {
      this.controlCommandApplier.apply(agent, keyboardCommands, deltaTime);
      return;
    }

    const sensoryInputs = this.inputSignalProvider.resolve(agent);
    const result = stepAgentProgram(
      agentProgram,
      sensoryInputs,
      agentRuntimeState,
      deltaTime,
      Date.now()
    );
    this.agentRuntimeStates.set(agent.id, result.runtimeState);
    this.controlCommandApplier.apply(
      agent,
      this.actionOutputAdapter.resolve(result.outputSignals),
      deltaTime
    );
  }

  /**
   * 更新随机游走的智能体
   */
  private updateRandomAgent(agent: Agent, _deltaTime: number): void {
    if (Math.random() < 0.02) {
      agent.angle += (Math.random() - 0.5) * 0.5;
    }
    
    const speed = 40;
    agent.velocity.x = Math.cos(agent.angle) * speed;
    agent.velocity.y = Math.sin(agent.angle) * speed;
  }

  /**
   * 获取键盘输入强度
   */
  private getKeyboardCommands(inputState: KeyboardInputState): WorldControlCommand[] {
    let turnLeft = inputState.turnLeft ? 1.0 : 0;
    let moveForward = inputState.moveForward ? 1.0 : 0;
    let turnRight = inputState.turnRight ? 1.0 : 0;

    if (turnLeft > 0 && turnRight > 0) {
      turnLeft = 0;
      turnRight = 0;
    }
    
    return [
      { kind: this.keyboardBindings.turnLeft, value: turnLeft },
      { kind: this.keyboardBindings.moveForward, value: moveForward },
      { kind: this.keyboardBindings.turnRight, value: turnRight },
    ].filter((command) => command.value > 0);
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.agentPrograms.clear();
    this.agentRuntimeStates.clear();
  }
} 
