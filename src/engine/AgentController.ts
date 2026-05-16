/**
 * 智能体控制器类
 * 负责处理不同类型的智能体控制逻辑
 */

import { Agent } from '../types/simulation';
import type { SimulationControlMode } from '../domain/world';
import {
  compileBrainGraph,
  createBrainProgramRuntimeState,
  stepBrainProgram,
  type BrainGraph,
  type BrainProgram,
  type BrainProgramRuntimeState
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

export type ScriptControlStatus =
  | { state: 'idle'; message: null }
  | { state: 'ready'; message: null }
  | { state: 'compile-error'; message: string }
  | { state: 'runtime-error'; message: string }
  | { state: 'invalid-output'; message: string };

export class AgentController {
  private brainPrograms: Map<number, BrainProgram> = new Map();
  private brainRuntimeStates: Map<number, BrainProgramRuntimeState> = new Map();
  private compiledScript: Function | null = null;
  private enablePlayerInputInScript: boolean = false;
  private scriptStatus: ScriptControlStatus = {
    state: 'idle',
    message: null
  };
  public onScriptStatusChange?: (status: ScriptControlStatus) => void;

  private updateScriptStatus(nextStatus: ScriptControlStatus): void {
    if (
      this.scriptStatus.state === nextStatus.state &&
      this.scriptStatus.message === nextStatus.message
    ) {
      return;
    }

    this.scriptStatus = nextStatus;
    this.onScriptStatusChange?.(this.scriptStatus);
  }

  public setBrainGraph(agentId: number, graph: BrainGraph): void {
    const program = compileBrainGraph(graph);
    this.brainPrograms.set(agentId, program);
    this.brainRuntimeStates.set(agentId, createBrainProgramRuntimeState(program));
  }

  /**
   * 设置脚本代码
   */
  public setScriptCode(code: string): void {
    try {
      this.compiledScript = new Function('inputs', code);
      this.updateScriptStatus({
        state: 'ready',
        message: null
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('脚本编译错误:', e);
      this.compiledScript = null;
      this.updateScriptStatus({
        state: 'compile-error',
        message
      });
    }
  }

  /**
   * 设置脚本模式下是否启用玩家输入
   */
  public setEnablePlayerInputInScript(enable: boolean): void {
    this.enablePlayerInputInScript = enable;
  }

  public getScriptStatus(): ScriptControlStatus {
    if (!this.compiledScript && this.scriptStatus.state === 'ready') {
      return {
        state: 'idle',
        message: null
      };
    }

    return this.scriptStatus;
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
      case 'script':
        this.updateScriptAgent(agent, deltaTime, keyboardInputs);
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
   * 更新脚本控制的智能体
   */
  private updateScriptAgent(
    agent: Agent,
    deltaTime: number,
    keyboardInputs: [number, number, number]
  ): void {
    // 检查是否启用玩家输入
    if (this.enablePlayerInputInScript) {
      const hasKeyboardInput = keyboardInputs[0] > 0 || keyboardInputs[1] > 0 || keyboardInputs[2] > 0;
      
      if (hasKeyboardInput) {
        this.applyAction(agent, keyboardInputs, deltaTime);
        return;
      }
    }
    
    if (!this.compiledScript) {
      this.applyAction(agent, [0, 0, 0], deltaTime);
      return;
    }
    
    try {
      const result = this.compiledScript(agent.visualInput);
      
      if (Array.isArray(result) && result.length === 3) {
        const clampedResult = result.map(val => Math.max(0, Math.min(1, Number(val) || 0)));
        this.updateScriptStatus({
          state: 'ready',
          message: null
        });
        this.applyAction(agent, clampedResult, deltaTime);
      } else {
        const message = '脚本返回值格式错误，应返回[左转, 前进, 右转]强度数组';
        console.warn(message);
        this.updateScriptStatus({
          state: 'invalid-output',
          message
        });
        this.applyAction(agent, [0, 0, 0], deltaTime);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('脚本执行错误:', e);
      this.updateScriptStatus({
        state: 'runtime-error',
        message
      });
      this.applyAction(agent, [0, 0, 0], deltaTime);
    }
  }

  /**
   * 更新SNN控制的智能体
   */
  private updateSNNAgent(
    agent: Agent,
    deltaTime: number,
    keyboardInputs: [number, number, number]
  ): void {
    const brainProgram = this.brainPrograms.get(agent.id);
    const runtimeState = this.brainRuntimeStates.get(agent.id);
    if (!brainProgram || !runtimeState) {
      return;
    }
    
    // 处理键盘输入 - 优先级高于神经网络
    const hasKeyboardInput = keyboardInputs[0] > 0 || keyboardInputs[1] > 0 || keyboardInputs[2] > 0;
    
    if (hasKeyboardInput) {
      this.applyAction(agent, keyboardInputs, deltaTime);
    } else {
      const result = stepBrainProgram(
        brainProgram,
        agent.visualInput,
        runtimeState,
        Date.now()
      );
      this.brainRuntimeStates.set(agent.id, result.runtimeState);
      this.applyAction(
        agent,
        [
          result.outputs['turn-left'],
          result.outputs['move-forward'],
          result.outputs['turn-right']
        ],
        deltaTime
      );
    }
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
    this.brainPrograms.clear();
    this.brainRuntimeStates.clear();
  }
} 
