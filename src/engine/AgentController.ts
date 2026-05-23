/**
 * 智能体控制器类
 * 负责处理不同类型的智能体控制逻辑
 */

import { Agent } from '../types/simulation';
import {
  type SimulationControlMode,
  type WorldControlCommand,
  type WorldActionOutputAdapter,
} from '../domain/world';
import {
  createAgentProgramRuntimeState,
  stepAgentProgram,
  type AgentWorldInputSignalMap,
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

  constructor(actionOutputAdapter: WorldActionOutputAdapter) {
    this.actionOutputAdapter = actionOutputAdapter;
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
    const keyboardInputs = this.getKeyboardInputs(context.keyboardInputState);

    switch (context.controlMode) {
      case 'snn':
        this.updateSNNAgent(agent, deltaTime, keyboardInputs);
        break;
      case 'keyboard':
        this.updateKeyboardAgent(agent, deltaTime, keyboardInputs);
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
    keyboardInputs: [number, number, number]
  ): void {
    this.applyLegacyActionVector(agent, keyboardInputs, deltaTime);
  }

  /**
   * 更新SNN控制的智能体
   */
  private updateSNNAgent(
    agent: Agent,
    deltaTime: number,
    keyboardInputs: [number, number, number]
  ): void {
    const agentProgram = this.agentPrograms.get(agent.id);
    const agentRuntimeState = this.agentRuntimeStates.get(agent.id);
    if (!agentProgram || !agentRuntimeState) {
      return;
    }

    const hasKeyboardInput = keyboardInputs[0] > 0 || keyboardInputs[1] > 0 || keyboardInputs[2] > 0;
    if (hasKeyboardInput) {
      this.applyLegacyActionVector(agent, keyboardInputs, deltaTime);
      return;
    }

    const sensoryInputs = this.createWorldInputSignalMap(agent);
    const result = stepAgentProgram(
      agentProgram,
      sensoryInputs,
      agentRuntimeState,
      deltaTime,
      Date.now()
    );
    this.agentRuntimeStates.set(agent.id, result.runtimeState);
    this.applyCommands(agent, this.actionOutputAdapter.resolve(result.outputSignals), deltaTime);
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
  private getKeyboardInputs(inputState: KeyboardInputState): [number, number, number] {
    let turnLeft = inputState.turnLeft ? 1.0 : 0;
    let moveForward = inputState.moveForward ? 1.0 : 0;
    let turnRight = inputState.turnRight ? 1.0 : 0;

    if (turnLeft > 0 && turnRight > 0) {
      turnLeft = 0;
      turnRight = 0;
    }
    
    return [turnLeft, moveForward, turnRight];
  }

  private createWorldInputSignalMap(agent: Agent): AgentWorldInputSignalMap {
    const sensoryInputs: AgentWorldInputSignalMap = {};
    const expectedVisualInputLength = agent.visionCells.length * 3;
    const hasLegacyVisualInput =
      agent.visualInput.length > 0 &&
      (agent.visionCells.length === 0 || agent.visualInput.length !== expectedVisualInputLength);

    if (hasLegacyVisualInput) {
      const visualCellCount = Math.floor(agent.visualInput.length / 3);
      for (let cellIndex = 0; cellIndex < visualCellCount; cellIndex += 1) {
        const baseIndex = cellIndex * 3;
        sensoryInputs[`vision.R.${cellIndex}`] = agent.visualInput[baseIndex] ?? 0;
        sensoryInputs[`vision.G.${cellIndex}`] = agent.visualInput[baseIndex + 1] ?? 0;
        sensoryInputs[`vision.B.${cellIndex}`] = agent.visualInput[baseIndex + 2] ?? 0;
      }
      return sensoryInputs;
    }

    for (const [cellIndex, cell] of agent.visionCells.entries()) {
      sensoryInputs[`vision.R.${cellIndex}`] = cell.color.r;
      sensoryInputs[`vision.G.${cellIndex}`] = cell.color.g;
      sensoryInputs[`vision.B.${cellIndex}`] = cell.color.b;
    }
    return sensoryInputs;
  }

  private applyLegacyActionVector(agent: Agent, output: [number, number, number], deltaTime: number): void {
    this.applyCommands(
      agent,
      [
        { kind: 'turn-left', value: output[0] },
        { kind: 'move-forward', value: output[1] },
        { kind: 'turn-right', value: output[2] },
      ],
      deltaTime
    );
  }

  /**
   * 应用动作到智能体
   */
  private applyCommands(agent: Agent, commands: WorldControlCommand[], deltaTime: number): void {
    const turnLeft = commands.find((command) => command.kind === 'turn-left')?.value ?? 0;
    const moveForward = commands.find((command) => command.kind === 'move-forward')?.value ?? 0;
    const turnRight = commands.find((command) => command.kind === 'turn-right')?.value ?? 0;
    
    // 转向
    const turnSpeed = 3.0;
    const turnThreshold = 0.3;
    
    if (turnLeft > turnThreshold) {
      agent.angle -= turnSpeed * turnLeft * deltaTime;
    }
    if (turnRight > turnThreshold) {
      agent.angle += turnSpeed * turnRight * deltaTime;
    }
    
    // 前进
    const maxSpeed = 60;
    const moveThreshold = 0.2;
    
    if (moveForward > moveThreshold) {
      const speed = maxSpeed * moveForward;
      agent.velocity.x = Math.cos(agent.angle) * speed;
      agent.velocity.y = Math.sin(agent.angle) * speed;
    } else {
      agent.velocity.x = 0;
      agent.velocity.y = 0;
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.agentPrograms.clear();
    this.agentRuntimeStates.clear();
  }
} 
