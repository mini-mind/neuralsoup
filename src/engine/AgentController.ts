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
  
  // 添加性能优化变量
  private lastKeyboardCheckTime: number = 0;
  private keyboardCheckInterval: number = 16; // 约60fps时检查键盘输入
  private hasRecentKeyboardInput: boolean = false;

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
    // 更新键盘输入检查（减少检查频率）
    const currentTime = performance.now();
    if (this.enablePlayerInputInScript && currentTime - this.lastKeyboardCheckTime > this.keyboardCheckInterval) {
      this.hasRecentKeyboardInput = this.keyboardController.hasKeyboardInput();
      this.lastKeyboardCheckTime = currentTime;
    }
    
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
    // 先获取脚本计算结果
    const scriptOutput = this.scriptController.computeScriptOutput(agent, deltaTime);
    
    // 检查是否启用手动控制覆盖
    if (this.enablePlayerInputInScript && this.hasRecentKeyboardInput) {
      const keyboardInputs = this.keyboardController.getKeyboardInputs();
      
      // 用手动控制结果覆盖脚本结果的对应维度
      // scriptOutput: [左转, 前进, 右转] (3维)
      // keyboardInputs: [左转, 前进, 右转, 后退] (4维)
      const finalOutput = [...scriptOutput]; // 复制脚本结果作为基础
      
      // 覆盖左转/右转（互斥操作）
      if (keyboardInputs[0] > 0) { // 手动左转
        finalOutput[0] = keyboardInputs[0];
        finalOutput[2] = 0; // 取消右转
      } else if (keyboardInputs[2] > 0) { // 手动右转
        finalOutput[2] = keyboardInputs[2];
        finalOutput[0] = 0; // 取消左转
      }
      
      // 前进/后退的抵消计算（加减运算）
      let netForward = finalOutput[1]; // 脚本的前进值
      
      if (keyboardInputs[1] > 0) { // 手动前进
        // 如果脚本和手动都是前进，取较大值
        netForward = Math.max(netForward, keyboardInputs[1]);
      } else if (keyboardInputs[3] > 0) { // 手动后退
        // 手动后退应该减少前进速度，实现抵消效果
        netForward = netForward - keyboardInputs[3];
      }
      
      // 限制在合理范围内
      finalOutput[1] = Math.max(-1.0, Math.min(1.0, netForward));
      
      // 应用最终的混合结果
      this.applyAction(agent, finalOutput, deltaTime);
    } else {
      // 没有手动控制覆盖，直接应用脚本结果
      this.applyAction(agent, scriptOutput, deltaTime);
    }
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
    
    // 使用神经网络决策
    let snnOutput = [0, 0, 0];
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      const iterOutput = corticalColumn.forward(agent.visualInput);
      for (let j = 0; j < 3; j++) {
        snnOutput[j] += iterOutput[j];
      }
    }
    
    snnOutput = snnOutput.map(val => val / iterations);
    
    // 检查手动控制覆盖（仅在启用时）
    if (this.enablePlayerInputInScript && this.hasRecentKeyboardInput) {
      const keyboardInputs = this.keyboardController.getKeyboardInputs();
      
      // 用手动控制结果覆盖SNN结果的对应维度
      // snnOutput: [左转, 前进, 右转] (3维)
      // keyboardInputs: [左转, 前进, 右转, 后退] (4维)
      const finalOutput = [...snnOutput]; // 复制SNN结果作为基础
      
      // 覆盖左转/右转（互斥操作）
      if (keyboardInputs[0] > 0) { // 手动左转
        finalOutput[0] = keyboardInputs[0];
        finalOutput[2] = 0; // 取消右转
      } else if (keyboardInputs[2] > 0) { // 手动右转
        finalOutput[2] = keyboardInputs[2];
        finalOutput[0] = 0; // 取消左转
      }
      
      // 前进/后退的抵消计算（加减运算）
      let netForward = finalOutput[1]; // SNN的前进值
      
      if (keyboardInputs[1] > 0) { // 手动前进
        // 如果SNN和手动都是前进，取较大值
        netForward = Math.max(netForward, keyboardInputs[1]);
      } else if (keyboardInputs[3] > 0) { // 手动后退
        // 手动后退应该减少前进速度，实现抵消效果
        netForward = netForward - keyboardInputs[3];
      }
      
      // 限制在合理范围内
      finalOutput[1] = Math.max(-1.0, Math.min(1.0, netForward));
      
      // 应用最终的混合结果
      this.applyAction(agent, finalOutput, deltaTime);
    } else {
      // 没有手动控制覆盖，直接应用SNN结果
      this.applyAction(agent, snnOutput, deltaTime);
    }
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
   * 应用动作到智能体 - 支持3维和4维控制，支持负值前进（表示后退）
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
    
    // 支持负值前进（表示后退）
    if (Math.abs(moveForward) > moveThreshold) {
      const speed = maxSpeed * Math.abs(moveForward);
      const direction = moveForward >= 0 ? 1 : -1; // 正值前进，负值后退
      agent.velocity.x = Math.cos(agent.angle) * speed * direction;
      agent.velocity.y = Math.sin(agent.angle) * speed * direction;
    } else if (moveBackward > moveThreshold) {
      // 保持向后兼容：4维输入的后退维度
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