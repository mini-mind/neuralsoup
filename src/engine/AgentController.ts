/**
 * 智能体控制器类
 * 负责处理不同类型的智能体控制逻辑
 */

import { Agent } from '../types/simulation';
import { CorticalColumn } from './CorticalColumn';

export class AgentController {
  private corticalColumns: Map<number, CorticalColumn> = new Map();
  private keyStates: { [key: string]: boolean } = {};
  private compiledScript: Function | null = null;
  private enablePlayerInputInScript: boolean = false;

  constructor() {
    this.setupKeyboardControls();
  }

  /**
   * 设置键盘控制监听
   */
  private setupKeyboardControls(): void {
    window.addEventListener('keydown', (e) => {
      this.keyStates[e.key.toLowerCase()] = true;
    });
    
    window.addEventListener('keyup', (e) => {
      this.keyStates[e.key.toLowerCase()] = false;
    });
  }

  /**
   * 为SNN智能体创建皮质柱
   */
  public createCorticalColumn(agentId: number, visionCells: number = 36): void {
    const inputSize = visionCells * 3; // 视野格子数量 × 3个颜色通道
    this.corticalColumns.set(agentId, new CorticalColumn({
      inputSize: inputSize,
      hiddenSizes: [128, 64, 32],
      outputSize: 3,
      dt: 0.01
    }));
  }

  /**
   * 更新智能体的皮质柱配置
   */
  public updateCorticalColumnConfiguration(agentId: number, visionCells: number): void {
    // 删除旧的皮质柱
    if (this.corticalColumns.has(agentId)) {
      this.corticalColumns.delete(agentId);
    }
    
    // 创建新的皮质柱
    this.createCorticalColumn(agentId, visionCells);
  }

  /**
   * 设置脚本代码
   */
  public setScriptCode(code: string): void {
    try {
      this.compiledScript = new Function('inputs', code);
    } catch (e) {
      console.error('脚本编译错误:', e);
      this.compiledScript = null;
    }
  }

  /**
   * 设置脚本模式下是否启用玩家输入
   */
  public setEnablePlayerInputInScript(enable: boolean): void {
    this.enablePlayerInputInScript = enable;
  }

  /**
   * 更新智能体控制
   */
  public updateAgent(agent: Agent, deltaTime: number): void {
    switch (agent.controlType) {
      case 'snn':
        this.updateSNNAgent(agent, deltaTime);
        break;
      case 'keyboard':
        this.updateKeyboardAgent(agent, deltaTime);
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
   * 更新键盘控制的智能体
   */
  private updateKeyboardAgent(agent: Agent, deltaTime: number): void {
    const keyboardInputs = this.getKeyboardInputs();
    this.applyAction(agent, keyboardInputs, deltaTime);
  }

  /**
   * 更新脚本控制的智能体
   */
  private updateScriptAgent(agent: Agent, deltaTime: number): void {
    // 检查是否启用玩家输入
    if (this.enablePlayerInputInScript) {
      const keyboardInputs = this.getKeyboardInputs();
      const hasKeyboardInput = keyboardInputs[0] > 0 || keyboardInputs[1] > 0 || keyboardInputs[2] > 0;
      
      if (hasKeyboardInput) {
        this.applyAction(agent, keyboardInputs, deltaTime);
        return;
      }
    }
    
    if (!this.compiledScript) {
      // 如果脚本无效，使用随机游走
      const randomOutput = [
        (Math.random() - 0.5) * 0.2,
        0.3,
        (Math.random() - 0.5) * 0.2
      ];
      this.applyAction(agent, randomOutput, deltaTime);
      return;
    }
    
    try {
      const result = this.compiledScript(agent.visualInput);
      
      if (Array.isArray(result) && result.length === 3) {
        const clampedResult = result.map(val => Math.max(0, Math.min(1, Number(val) || 0)));
        this.applyAction(agent, clampedResult, deltaTime);
      } else {
        console.warn('脚本返回值格式错误，应返回[左转, 前进, 右转]强度数组');
        this.applyAction(agent, [0, 0.2, 0], deltaTime);
      }
    } catch (e) {
      console.error('脚本执行错误:', e);
      this.applyAction(agent, [0, 0.2, 0], deltaTime);
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
    
    // 处理键盘输入 - 优先级高于神经网络
    const keyboardInputs = this.getKeyboardInputs();
    const hasKeyboardInput = keyboardInputs[0] > 0 || keyboardInputs[1] > 0 || keyboardInputs[2] > 0;
    
    if (hasKeyboardInput) {
      this.applyAction(agent, keyboardInputs, deltaTime);
    } else {
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
   * 获取键盘输入强度
   */
  private getKeyboardInputs(): [number, number, number] {
    let turnLeft = 0;
    let moveForward = 0;
    let turnRight = 0;
    
    if (this.keyStates['arrowup'] || this.keyStates['w']) {
      moveForward = 1.0;
    }
    
    if (this.keyStates['arrowleft'] || this.keyStates['a']) {
      turnLeft = 1.0;
    }
    
    if (this.keyStates['arrowright'] || this.keyStates['d']) {
      turnRight = 1.0;
    }
    
    // 处理A和D同时按下的抵消逻辑
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
    this.corticalColumns.clear();
  }
} 