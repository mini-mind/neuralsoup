/**
 * 脚本控制器 - 处理智能体脚本执行逻辑
 */

import { Agent } from '../../types/simulation';

export class ScriptController {
  private rawScriptCode: string = '';
  private scriptEnvironment: any = null;
  private onFrameFunction: Function | null = null;
  private lastRewardCount: number = 0;

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
   * 更新脚本控制的智能体
   */
  public updateAgent(agent: Agent, deltaTime: number, applyActionCallback: (agent: Agent, output: number[], deltaTime: number) => void): void {
    if (!this.onFrameFunction) {
      // 如果没有onFrame函数，使用温和的前进行为
      applyActionCallback(agent, [0, 0.3, 0], deltaTime);
      return;
    }
    
    try {
      // 构建state对象
      const state = this.buildStateObject(agent);
      
      // 构建action对象
      const action = this.buildActionObject(agent, deltaTime, applyActionCallback);
      
      // 调用onFrame函数（每帧调用）
      this.onFrameFunction.call(this.scriptEnvironment?.scriptScope || {}, state, action);
      
    } catch (e) {
      console.error('onFrame函数执行错误:', e);
      // 发生错误时使用温和的前进行为
      applyActionCallback(agent, [0, 0.2, 0], deltaTime);
    }
  }

  /**
   * 构建状态对象
   */
  private buildStateObject(agent: Agent): any {
    // 检测是否获得了奖励（基于总奖励的增加）
    const gotReward = agent.totalReward > this.lastRewardCount;
    this.lastRewardCount = agent.totalReward;
    
    return {
      vision: agent.visualInput, // n个单元格 × 3通道的数组
      gotReward: gotReward       // 上一帧是否获得奖励
    };
  }

  /**
   * 构建动作对象
   */
  private buildActionObject(agent: Agent, deltaTime: number, applyActionCallback: (agent: Agent, output: number[], deltaTime: number) => void): any {
    return {
      move: (direction: [number, number, number]) => {
        // direction = [前进, 左转, 右转] 强度数组
        const [forward, left, right] = direction.map(val => Math.max(0, Math.min(1, Number(val) || 0)));
        applyActionCallback(agent, [left, forward, right], deltaTime);
      }
    };
  }
} 