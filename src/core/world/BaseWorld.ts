/**
 * 抽象世界基类
 * 提供所有世界类型的通用功能
 */

import type { IWorld, IWorldEntity } from './types';
import type { IAgent } from '../entities/types';

export abstract class BaseWorld implements IWorld {
  protected agents: Map<string, IAgent> = new Map();
  protected entities: Map<string, IWorldEntity> = new Map();
  protected worldWidth: number;
  protected worldHeight: number;
  protected worldType: string;

  constructor(width: number, height: number, worldType: string) {
    this.worldWidth = width;
    this.worldHeight = height;
    this.worldType = worldType;
  }

  // === 基础世界管理方法 ===

  getAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  getEntities(): IWorldEntity[] {
    return Array.from(this.entities.values());
  }

  addAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  addEntity(entity: IWorldEntity): void {
    this.entities.set(entity.id, entity);
  }

  removeAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  removeEntity(entityId: string): void {
    this.entities.delete(entityId);
  }

  getWorldType(): string {
    return this.worldType;
  }

  getDimensions(): { width: number; height: number } {
    return { width: this.worldWidth, height: this.worldHeight };
  }

  setDimensions(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  // === 抽象方法 - 子类必须实现 ===

  /**
   * 初始化世界特定的实体
   */
  abstract initializeWorld(): void;

  /**
   * 更新世界特定的逻辑
   */
  abstract updateWorldLogic(deltaTime: number): void;

  /**
   * 处理智能体与世界实体的交互
   */
  abstract handleAgentInteractions(agent: IAgent): void;

  // === 通用更新逻辑 ===

  update(): void {
    const deltaTime = 0.5; // 大幅降低时间步长，从1减到0.5

    // 更新所有实体
    for (const entity of this.entities.values()) {
      if (entity.isActive) {
        entity.update(deltaTime);
      }
    }

    // 更新所有智能体
    for (const agent of this.agents.values()) {
      agent.update(this);
      this.handleAgentInteractions(agent);
      this.handleBoundary(agent);
    }

    // 更新世界特定逻辑，传递deltaTime
    this.updateWorldLogic(deltaTime);

    // 清理非活跃实体
    this.cleanupInactiveEntities();
  }

  // === 通用辅助方法 ===

  /**
   * 处理智能体的边界（环绕式世界）
   */
  protected handleBoundary(agent: any): void {
    if (typeof agent.x === 'number' && typeof agent.y === 'number') {
      agent.x = ((agent.x % this.worldWidth) + this.worldWidth) % this.worldWidth;
      agent.y = ((agent.y % this.worldHeight) + this.worldHeight) % this.worldHeight;
    }
  }

  /**
   * 清理非活跃的实体
   */
  protected cleanupInactiveEntities(): void {
    for (const [id, entity] of this.entities.entries()) {
      if (!entity.isActive) {
        this.entities.delete(id);
      }
    }
  }

  /**
   * 检查两个实体是否发生碰撞
   */
  protected checkCollision(entity1: IWorldEntity, entity2: IWorldEntity): boolean {
    const dx = entity1.x - entity2.x;
    const dy = entity1.y - entity2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 简单的圆形碰撞检测
    const radius1 = (entity1 as any).radius || 10;
    const radius2 = (entity2 as any).radius || 10;
    
    return distance < (radius1 + radius2);
  }

  /**
   * 获取指定位置附近的实体
   */
  protected getEntitiesNear(x: number, y: number, radius: number, entityType?: string): IWorldEntity[] {
    const nearbyEntities: IWorldEntity[] = [];
    
    for (const entity of this.entities.values()) {
      if (entityType && entity.entityType !== entityType) {
        continue;
      }
      
      const dx = entity.x - x;
      const dy = entity.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= radius) {
        nearbyEntities.push(entity);
      }
    }
    
    return nearbyEntities;
  }

  /**
   * 在指定范围内生成随机位置
   */
  protected getRandomPosition(): { x: number; y: number } {
    return {
      x: Math.random() * this.worldWidth,
      y: Math.random() * this.worldHeight
    };
  }

  /**
   * 生成唯一ID
   */
  protected generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
