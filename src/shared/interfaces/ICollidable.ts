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