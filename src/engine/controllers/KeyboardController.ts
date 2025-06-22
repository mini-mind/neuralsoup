/**
 * 键盘控制器 - 处理键盘输入和状态管理
 */

export class KeyboardController {
  private keyStates: { [key: string]: boolean } = {};
  
  // 缓存输入结果，避免每帧重复计算
  private cachedInputs: [number, number, number, number] = [0, 0, 0, 0];
  private hasAnyInput: boolean = false;
  private inputsDirty: boolean = false;

  constructor() {
    this.setupKeyboardControls();
  }

  /**
   * 设置键盘控制监听
   */
  private setupKeyboardControls(): void {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (!this.keyStates[key]) {
        this.keyStates[key] = true;
        this.inputsDirty = true; // 标记输入已变化
      }
    });
    
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (this.keyStates[key]) {
        this.keyStates[key] = false;
        this.inputsDirty = true; // 标记输入已变化
      }
    });
  }

  /**
   * 快速检查是否有任何键盘输入
   */
  public hasKeyboardInput(): boolean {
    if (this.inputsDirty) {
      this.updateCachedInputs();
    }
    return this.hasAnyInput;
  }

  /**
   * 获取键盘输入强度 - 4维控制：[左转, 前进, 右转, 后退]
   */
  public getKeyboardInputs(): [number, number, number, number] {
    if (this.inputsDirty) {
      this.updateCachedInputs();
    }
    return this.cachedInputs;
  }

  /**
   * 更新缓存的输入状态
   */
  private updateCachedInputs(): void {
    let turnLeft = 0;
    let moveForward = 0;
    let turnRight = 0;
    let moveBackward = 0;
    
    // 前进控制
    if (this.keyStates['arrowup'] || this.keyStates['w']) {
      moveForward = 1.0;
    }
    
    // 后退控制
    if (this.keyStates['arrowdown'] || this.keyStates['s']) {
      moveBackward = 1.0;
    }
    
    // 左转控制
    if (this.keyStates['arrowleft'] || this.keyStates['a']) {
      turnLeft = 1.0;
    }
    
    // 右转控制
    if (this.keyStates['arrowright'] || this.keyStates['d']) {
      turnRight = 1.0;
    }
    
    // 处理左右转同时按下的抵消逻辑
    if (turnLeft > 0 && turnRight > 0) {
      turnLeft = 0;
      turnRight = 0;
    }
    
    // 处理前进后退同时按下的抵消逻辑
    if (moveForward > 0 && moveBackward > 0) {
      moveForward = 0;
      moveBackward = 0;
    }
    
    // 更新缓存
    this.cachedInputs[0] = turnLeft;
    this.cachedInputs[1] = moveForward;
    this.cachedInputs[2] = turnRight;
    this.cachedInputs[3] = moveBackward;
    
    // 更新是否有输入的标志
    this.hasAnyInput = turnLeft > 0 || moveForward > 0 || turnRight > 0 || moveBackward > 0;
    
    // 清除脏标志
    this.inputsDirty = false;
  }
} 