/**
 * 碰撞系统
 * 负责检测实体间的碰撞并发布事件。
 */

import type { ICollidable } from '../../../shared/interfaces/ICollidable';
import type { EventBus } from '../../services/EventBus';

export class CollisionSystem {
  private eventBus: EventBus<any>;

  constructor(eventBus: EventBus<any>) {
    this.eventBus = eventBus;
  }

  /**
   * 更新并检测所有提供的实体之间的碰撞。
   * @param entities - 一个包含所有可碰撞实体的数组。
   */
  update(entities: ICollidable[]): void {
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i];
        const entityB = entities[j];

        if (this.areColliding(entityA, entityB)) {
          this.eventBus.emit('collision', {
            entityA,
            entityB,
          });
        }
      }
    }
  }

  /**
   * 检查两个实体是否碰撞。
   * @param a - 第一个实体。
   * @param b - 第二个实体。
   * @returns 如果实体碰撞则返回 true，否则返回 false。
   */
  private areColliding(a: ICollidable, b: ICollidable): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < a.radius + b.radius;
  }
}
