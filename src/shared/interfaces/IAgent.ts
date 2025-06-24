import type { IBrain } from './IBrain';
import type { ISensor } from './ISensor';
import type { IEffector } from './IEffector';
import type { IWorld } from './IWorld';
import type { ICollidable } from './ICollidable';

/**
 * 定义了"智能体"的契约。
 * 智能体是环境中的自主实体，拥有大脑、传感器和执行器。
 * 它同时也是一个可碰撞的实体。
 */
export interface IAgent extends ICollidable {
  readonly id: string;
  readonly brain: IBrain;
  readonly sensors: ISensor[];
  readonly effectors: IEffector[];

  /**
   * 更新智能体的状态，通常在一个仿真时间步中调用。
   * @param world - 当前的世界实例。
   */
  update(world: IWorld): void;
} 