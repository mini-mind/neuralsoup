import type { IWorld, ICollidable } from '../world/types';

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