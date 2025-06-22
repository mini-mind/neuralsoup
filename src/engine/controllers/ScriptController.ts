/**
 * 脚本控制器 - 处理智能体脚本执行逻辑
 */

import { Agent } from '../../types/simulation';

export class ScriptController {
  private rawScriptCode: string = '';
  private scriptEnvironment: any = null;
  private onFrameFunction: Function | null = null;
  private lastRewardCount: number = 0;
  
  // 添加用于存储脚本计算结果的变量
  private lastScriptOutput: number[] = [0, 0.3, 0, 0]; // [左转, 前进, 右转, 后退]

  /**
   * 设置脚本代码
   */
  public setScriptCode(code: string): void {
    this.rawScriptCode = code;
    this.scriptEnvironment = null;
    this.onFrameFunction = null;
  }

  /**
   * 应用脚本
   */
  public applyScript(): boolean {
    if (!this.rawScriptCode.trim()) {
      console.warn('脚本代码为空');
      return false;
    }
    
    try {
      // 创建沙盒环境
      const scriptScope: any = {
        console: console,
        Math: Math,
        Date: Date,
        JSON: JSON
      };
      
      // 修复：将函数定义语句改为赋值语句，让Function构造器能够正确处理
      const modifiedCode = this.rawScriptCode.replace(
        /function\s+onFrame\s*\(/g,
        'this.onFrame = function('
      );
      
      // 执行脚本（初始化阶段）
      const scriptFunction = new Function(...Object.keys(scriptScope), modifiedCode);
      scriptFunction.call(scriptScope, ...Object.values(scriptScope));
      
      // 提取onFrame函数
      if (typeof scriptScope.onFrame === 'function') {
        this.onFrameFunction = scriptScope.onFrame;
        this.scriptEnvironment = { scriptScope };
        console.log('脚本应用成功，onFrame函数已提取');
        return true;
      } else {
        console.warn('脚本中未找到onFrame函数');
        this.onFrameFunction = null;
        return false;
      }
      
    } catch (e) {
      console.error('脚本应用失败:', e);
      this.scriptEnvironment = null;
      this.onFrameFunction = null;
      return false;
    }
  }

  /**
   * 构建状态对象
   */
  private buildStateObject(agent: Agent): any {
    // 计算上一帧获得的奖励
    const currentReward = agent.totalReward;
    const lastFrameReward = currentReward - this.lastRewardCount;
    this.lastRewardCount = currentReward;
    
    return {
      vision: agent.visualInput, // n个单元格 × 3通道的数组
      reward: lastFrameReward    // 上一帧获得的奖励数值
    };
  }

  /**
   * 构建动作对象 - 用于计算模式（不直接应用动作）
   */
  private buildActionObjectForComputation(agent: Agent, deltaTime: number): any {
    return {
      move: (direction: [number, number, number, number?]) => {
        // direction = [前进, 左转, 右转, 后退] 强度数组（后退可选）
        const [forward, left, right, backward = 0] = direction.map(val => Math.max(0, Math.min(1, Number(val) || 0)));
        // 保存脚本计算结果而不是直接应用
        this.lastScriptOutput = [left, forward, right, backward];
      }
    };
  }

  /**
   * 构建agent对象 - 统一state和action
   */
  private buildAgentObjectForComputation(agent: Agent, deltaTime: number): any {
    const state = this.buildStateObject(agent);
    const action = this.buildActionObjectForComputation(agent, deltaTime);
    
    return {
      ...state,  // 展开state属性（vision, reward）
      move: action.move  // 添加move方法
    };
  }

  /**
   * 计算脚本输出结果 - 不直接应用动作，而是返回计算结果
   */
  public computeScriptOutput(agent: Agent, deltaTime: number): number[] {
    if (!this.onFrameFunction) {
      // 如果没有onFrame函数，返回温和的前进行为
      return [0, 0.3, 0, 0]; // [左转, 前进, 右转, 后退]
    }
    
    try {
      // 重置脚本输出
      this.lastScriptOutput = [0, 0.3, 0, 0];
      
      // 构建agent对象（统一state和action）
      const agentObj = this.buildAgentObjectForComputation(agent, deltaTime);
      
      // 调用onFrame函数（每帧调用）
      this.onFrameFunction.call(this.scriptEnvironment?.scriptScope || {}, agentObj);
      
      return [...this.lastScriptOutput]; // 返回拷贝
      
    } catch (e) {
      console.error('onFrame函数执行错误:', e);
      // 发生错误时返回温和的前进行为
      return [0, 0.2, 0, 0]; // [左转, 前进, 右转, 后退]
    }
  }

  /**
   * 更新脚本控制的智能体
   */
  public updateAgent(agent: Agent, deltaTime: number, applyActionCallback: (agent: Agent, output: number[], deltaTime: number) => void): void {
    const output = this.computeScriptOutput(agent, deltaTime);
    applyActionCallback(agent, output, deltaTime);
  }

  /**
   * 构建动作对象 - 用于直接应用模式
   */
  private buildActionObject(agent: Agent, deltaTime: number, applyActionCallback: (agent: Agent, output: number[], deltaTime: number) => void): any {
    return {
      move: (direction: [number, number, number, number?]) => {
        // direction = [前进, 左转, 右转, 后退] 强度数组（后退可选）
        const [forward, left, right, backward = 0] = direction.map(val => Math.max(0, Math.min(1, Number(val) || 0)));
        applyActionCallback(agent, [left, forward, right, backward], deltaTime);
      }
    };
  }

  /**
   * 构建agent对象 - 用于直接应用模式
   */
  private buildAgentObjectForDirectApplication(agent: Agent, deltaTime: number, applyActionCallback: (agent: Agent, output: number[], deltaTime: number) => void): any {
    const state = this.buildStateObject(agent);
    const action = this.buildActionObject(agent, deltaTime, applyActionCallback);
    
    return {
      ...state,  // 展开state属性（vision, reward）
      move: action.move  // 添加move方法
    };
  }
} 