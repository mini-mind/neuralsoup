import type { IWorld } from './IWorld';
import type { IAgent } from './IAgent';

/**
 * 定义了"执行器"的契约。
 */
export interface IEffector {
  /**
   * 在世界中执行一个动作。
   * @param action - 由大脑决定的动作。
   * @param world - 当前的世界实例。
   * @param agent - 执行该动作的智能体实例。
   */
  execute(action: any, world: IWorld, agent: IAgent): void;
} 