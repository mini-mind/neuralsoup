/**
 * 键盘控制器 - 处理键盘输入和状态管理
 */

export class KeyboardController {
  private keyStates: { [key: string]: boolean } = {};

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
   * 获取键盘输入强度 - 4维控制：[左转, 前进, 右转, 后退]
   */
  public getKeyboardInputs(): [number, number, number, number] {
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
    
    return [turnLeft, moveForward, turnRight, moveBackward];
  }
} 