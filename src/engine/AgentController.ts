/**
 * 智能体控制器类
 * 负责处理不同类型的智能体控制逻辑
 */

import { Agent } from '../types/simulation';
import { CorticalColumn } from './CorticalColumn';
import { KeyboardController } from './controllers/KeyboardController';
import { ScriptController } from './controllers/ScriptController';

export class AgentController {
  private corticalColumns: Map<number, CorticalColumn> = new Map();
  private keyboardController: KeyboardController;
  private scriptController: ScriptController;
  private enablePlayerInputInScript: boolean = false;

  constructor() {
    this.keyboardController = new KeyboardController();
    this.scriptController = new ScriptController();
  }

  /**
   * 创建皮质柱
   */
  public createCorticalColumn(agentId: number, visionCells: number = 36): void {
    if (!this.corticalColumns.has(agentId)) {
      const inputSize = visionCells * 3; // 视野格子数量 × 3个颜色通道
      const corticalColumn = new CorticalColumn({
        inputSize: inputSize,
        hiddenSizes: [128, 64, 32],
        outputSize: 3,
        dt: 0.01
      });
      this.corticalColumns.set(agentId, corticalColumn);
      console.log(`为智能体 ${agentId} 创建了皮质柱，视觉输入维度：${inputSize}`);
    }
  }

  /**
   * 更新皮质柱配置
   */
  public updateCorticalColumnConfiguration(agentId: number, visionCells: number): void {
    this.corticalColumns.delete(agentId);
    this.createCorticalColumn(agentId, visionCells);
  }

  /**
   * 设置脚本代码
   */
  public setScriptCode(code: string): void {
    this.scriptController.setScriptCode(code);
  }

  /**
   * 设置是否启用玩家输入覆盖
   */
  public setEnablePlayerInputInScript(enable: boolean): void {
    this.enablePlayerInputInScript = enable;
  }

  /**
   * 应用脚本
   */
  public applyScript(): boolean {
    return this.scriptController.applyScript();
  }

  /**
   * 更新智能体控制
   */
  public updateAgent(agent: Agent, deltaTime: number): void {
    switch (agent.controlType) {
      case 'snn':
        this.updateSNNAgent(agent, deltaTime);
        break;
      case 'script':
        this.updateScriptAgent(agent, deltaTime);
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
   * 更新脚本控制的智能体
   */
  private updateScriptAgent(agent: Agent, deltaTime: number): void {
    // 检查是否启用手动控制覆盖
    if (this.enablePlayerInputInScript) {
      const keyboardInputs = this.keyboardController.getKeyboardInputs();
      const hasKeyboardInput = keyboardInputs[0] > 0 || keyboardInputs[1] > 0 || keyboardInputs[2] > 0 || keyboardInputs[3] > 0;
      
      if (hasKeyboardInput) {
        this.applyAction(agent, keyboardInputs, deltaTime);
        return;
      }
    }
    
    this.scriptController.updateAgent(agent, deltaTime, this.applyAction.bind(this));
  }

  /**
   * 更新SNN控制的智能体
   */
  private updateSNNAgent(agent: Agent, deltaTime: number): void {
    const corticalColumn = this.corticalColumns.get(agent.id);
    if (!corticalColumn) return;
    
    // 应用神经状态调节到神经网络
    const synapticScaling = 0.8 + agent.motivation * 0.4;
    const thresholdAdjustment = (agent.stress - 0.5) * 10;
    corticalColumn.applyEmotionModulation(synapticScaling, thresholdAdjustment);
    
    // 检查手动控制覆盖（仅在启用时）
    if (this.enablePlayerInputInScript) {
      const keyboardInputs = this.keyboardController.getKeyboardInputs();
      const hasKeyboardInput = keyboardInputs[0] > 0 || keyboardInputs[1] > 0 || keyboardInputs[2] > 0 || keyboardInputs[3] > 0;
      
      if (hasKeyboardInput) {
        this.applyAction(agent, keyboardInputs, deltaTime);
        return;
      }
    }
    
    // 使用神经网络决策
    let output = [0, 0, 0];
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      const iterOutput = corticalColumn.forward(agent.visualInput);
      for (let j = 0; j < 3; j++) {
        output[j] += iterOutput[j];
      }
    }
    
    output = output.map(val => val / iterations);
    this.applyAction(agent, output, deltaTime);
  }

  /**
   * 更新随机游走的智能体
   */
  private updateRandomAgent(agent: Agent, deltaTime: number): void {
    if (Math.random() < 0.02) {
      agent.angle += (Math.random() - 0.5) * 0.5;
    }
    
    const speed = 40;
    agent.velocity.x = Math.cos(agent.angle) * speed;
    agent.velocity.y = Math.sin(agent.angle) * speed;
  }

  /**
   * 应用动作到智能体 - 支持4维控制
   */
  private applyAction(agent: Agent, output: number[], deltaTime: number): void {
    // 兼容3维和4维输入
    const [turnLeft, moveForward, turnRight, moveBackward = 0] = output;
    
    // 转向
    const turnSpeed = 3.0;
    const turnThreshold = 0.3;
    
    if (turnLeft > turnThreshold) {
      agent.angle -= turnSpeed * turnLeft * deltaTime;
    }
    if (turnRight > turnThreshold) {
      agent.angle += turnSpeed * turnRight * deltaTime;
    }
    
    // 移动（前进/后退）
    const maxSpeed = 60;
    const moveThreshold = 0.2;
    
    if (moveForward > moveThreshold) {
      const speed = maxSpeed * moveForward;
      agent.velocity.x = Math.cos(agent.angle) * speed;
      agent.velocity.y = Math.sin(agent.angle) * speed;
    } else if (moveBackward > moveThreshold) {
      // 后退：反方向运动
      const speed = maxSpeed * moveBackward;
      agent.velocity.x = -Math.cos(agent.angle) * speed;
      agent.velocity.y = -Math.sin(agent.angle) * speed;
    } else {
      agent.velocity.x = 0;
      agent.velocity.y = 0;
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.corticalColumns.clear();
  }
} 