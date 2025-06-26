import type { IAgent } from '../entities/types';

/**
 * 定义了"世界"的契约。
 * 世界是所有智能体和对象存在的环境。
 */
export interface IWorld {
  /**
   * 获取世界中的所有智能体。
   */
  getAgents(): IAgent[];

  /**
   * 向世界中添加一个智能体。
   * @param agent - 要添加的智能体。
   */
  addAgent(agent: IAgent): void;

  /**
   * 从世界中移除一个智能体。
   * @param agentId - 要移除的智能体的ID。
   */
  removeAgent(agentId: string): void;

  /**
   * 更新世界状态，推进一个时间步。
   */
  update(): void;
}

/**
 * 定义了可碰撞实体的契约。
 * 任何需要在物理世界中参与碰撞检测的实体都应实现此接口。
 */
export interface ICollidable {
  readonly id: string;
  x: number;
  y: number;
  angle: number; // 实体的朝向，以弧度表示
  radius: number;
  entityType: string; // 用于区分实体类型，例如 'agent', 'food', 'obstacle'
} 