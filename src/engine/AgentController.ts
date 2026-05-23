/**
 * 智能体控制器类
 * 负责处理不同类型的智能体控制逻辑
 */

import { Agent } from '../types/simulation';
import type { SimulationControlMode } from '../domain/world';
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

const ACTION_TARGET_TO_INDEX = {
  'action.turn-left': 0,
  'action.move-forward': 1,
  'action.turn-right': 2,
} as const satisfies Record<string, 0 | 1 | 2>;
type SupportedActionTarget = keyof typeof ACTION_TARGET_TO_INDEX;

const isSupportedActionTarget = (target: string): target is SupportedActionTarget =>
  target in ACTION_TARGET_TO_INDEX;

const resolveWorldActionOutput = (outputsByTarget: Record<string, number>): [number, number, number] => {
  const actionVector: [number, number, number] = [0, 0, 0];

  for (const [target, value] of Object.entries(outputsByTarget)) {
    if (!isSupportedActionTarget(target)) {
      continue;
    }

    const actionIndex = ACTION_TARGET_TO_INDEX[target];
    actionVector[actionIndex] = value;
  }

  return actionVector;
};

export class AgentController {
  private agentPrograms: Map<number, AgentProgram> = new Map();
  private agentRuntimeStates: Map<number, AgentProgramRuntimeState> = new Map();

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
    this.applyAction(agent, keyboardInputs, deltaTime);
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
      this.applyAction(agent, keyboardInputs, deltaTime);
      return;
    }

    const result = stepAgentProgram(
      agentProgram,
      agent.visualInput,
      agentRuntimeState,
      deltaTime,
      Date.now()
    );
    this.agentRuntimeStates.set(agent.id, result.runtimeState);
    this.applyAction(agent, resolveWorldActionOutput(result.outputsByTarget), deltaTime);
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

  /**
   * 应用动作到智能体
   */
  private applyAction(agent: Agent, output: number[], deltaTime: number): void {
    const [turnLeft, moveForward, turnRight] = output;
    
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
