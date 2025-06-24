import type { IBrain } from '../../shared/interfaces/IBrain';

/**
 * 一个使用用户提供的JavaScript脚本作为决策逻辑的大脑。
 */
export class JsScriptBrain implements IBrain {
  private onFrameFunction: ((state: any) => any) | null = null;
  private lastAction: any = { type: 'move', direction: 0, speed: 0.3 };

  constructor(scriptCode: string) {
    this.compileScript(scriptCode);
  }

  /**
   * 编译并初始化脚本。
   * @param scriptCode - 用户的脚本代码，应包含一个 onFrame(state) 函数。
   */
  private compileScript(scriptCode: string): void {
    if (!scriptCode.trim()) {
      console.warn('JsScriptBrain: 脚本代码为空。');
      return;
    }
    try {
      // 捕获 onFrame 函数
      let onFrame: any;
      const captureOnFrame = (fn: any) => {
        if (typeof fn === 'function') {
          onFrame = fn;
        }
      };

      // 创建一个安全的执行环境
      const scriptFunction = new Function('onFrame', scriptCode);
      scriptFunction(captureOnFrame);

      if (onFrame) {
        this.onFrameFunction = onFrame;
        console.log('JsScriptBrain: 脚本编译成功，onFrame函数已捕获。');
      } else {
        console.warn('JsScriptBrain: 脚本中未找到 onFrame 函数。');
        this.onFrameFunction = null;
      }
    } catch (e) {
      console.error('JsScriptBrain: 脚本编译失败:', e);
      this.onFrameFunction = null;
    }
  }

  /**
   * 运行脚本的 onFrame 函数来决定下一步动作。
   * @param state - 从传感器收集的当前环境状态。
   * @returns 由脚本决定的动作。
   */
  decide(state: any): any {
    if (!this.onFrameFunction) {
      // 如果脚本无效，返回一个默认的温和前进动作
      return this.lastAction;
    }

    try {
      let nextAction = this.lastAction;
      const actionProxy = {
        move: (direction: number, speed: number = 1) => {
          nextAction = { 
            type: 'move', 
            direction: Number(direction) || 0,
            speed: Math.max(0, Math.min(1, Number(speed) || 0)),
          };
        },
      };

      // 调用用户的 onFrame 函数，并传入状态和动作代理
      this.onFrameFunction({ ...state, ...actionProxy });
      
      this.lastAction = nextAction;
      return this.lastAction;

    } catch (e) {
      console.error('JsScriptBrain: onFrame函数执行错误:', e);
      // 发生错误时，返回上一次的动作
      return this.lastAction;
    }
  }
} 