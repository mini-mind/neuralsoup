/**
 * 定义了智能体"大脑"的契约。
 */
export interface IBrain {
  /**
   * 根据当前状态决定下一步的动作。
   * @param state - 从传感器收集的当前环境状态。
   * @returns 一个或多个供执行器执行的动作。
   */
  decide(state: any): any;
} 