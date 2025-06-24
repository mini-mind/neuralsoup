import type { ISensor } from '../../shared/interfaces/ISensor';
import type { IWorld } from '../../shared/interfaces/IWorld';
import type { IAgent } from '../../shared/interfaces/IAgent';
import type { ICollidable } from '../../shared/interfaces/ICollidable';

/**
 * 视觉传感器，为智能体提供环境的视觉信息。
 */
export class VisionSensor implements ISensor {
  private visionRange: number;
  private visionAngle: number; // 弧度
  private visionCells: number;

  constructor(config: { range?: number; angle?: number; cells?: number } = {}) {
    this.visionRange = config.range ?? 250;
    this.visionAngle = config.angle ? (config.angle * Math.PI) / 180 : (Math.PI * 2) / 3; // 默认120度
    this.visionCells = config.cells ?? 36;
  }

  /**
   * 从世界中读取视觉数据。
   * @param world - 当前的世界实例。
   * @param agent - 拥有该传感器的智能体实例。
   * @returns 一个代表视觉输入的数组，通常是每个视觉细胞的[R, G, B]值。
   */
  read(world: IWorld, agent: IAgent): number[] {
    const allEntities = world.getAgents() as ICollidable[]; // 在未来，这里应该包含所有可碰撞物体
    const visibleEntities = allEntities.filter(entity => {
      if (entity.id === agent.id) return false;

      const dx = entity.x - agent.x;
      const dy = entity.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.visionRange + entity.radius) return false;

      const angleToEntity = Math.atan2(dy, dx);
      // @ts-ignore // IAgent现在有angle属性，但TS可能没更新
      const relativeAngle = this.normalizeAngle(angleToEntity - agent.angle);
      
      return Math.abs(relativeAngle) <= this.visionAngle / 2;
    });

    // 此处简化处理：仅返回可见实体的数量
    // 完整的实现会像旧的VisionSystem一样计算每个cell的颜色
    return [visibleEntities.length];
  }

  /**
   * 将角度归一化到 [-PI, PI] 范围。
   * @param angle - 要归一化的角度 (弧度)。
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
} 