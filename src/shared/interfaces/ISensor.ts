import type { IWorld } from './IWorld';
import type { IAgent } from './IAgent';

/**
 * 定义了"传感器"的契约。
 */
export interface ISensor {
  /**
   * 从世界中读取数据。
   * @param world - 当前的世界实例。
   * @param agent - 拥有该传感器的智能体实例。
   * @returns 传感器读取到的状态信息。
   */
  read(world: IWorld, agent: IAgent): any;
} 