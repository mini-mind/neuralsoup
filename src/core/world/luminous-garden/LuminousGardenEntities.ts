/**
 * 光影花园世界的实体实现
 * 简化版本：只有亮区和暗区，支持慢速随机游走
 */

import type { ILightPatch, IDarkMatter, IWorldEntity } from '../types';

/**
 * 光斑实体实现（亮区）
 * 给智能体持续补充健康值到最大
 */
export class LightPatch implements ILightPatch {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'light-patch' = 'light-patch';
  isActive: boolean = true;
  
  intensity: number;
  radius: number;
  energyRate: number; // 实际用作健康恢复率
  moveSpeed: number;
  targetX: number;
  targetY: number;
  
  private lastTargetUpdate: number = 0;
  private targetUpdateInterval: number = 45000; // 45秒更新一次目标，非常慢
  private worldWidth: number = 1600;
  private worldHeight: number = 1200;
  private isStationary: boolean = false; // 是否处于静止状态
  private stationaryDuration: number = 0; // 静止持续时间

  constructor(
    id: string,
    x: number,
    y: number,
    intensity: number = 0.8,
    radius: number = 60,
    energyRate: number = 15, // 健康恢复率
    moveSpeed: number = 1, // 极慢的移动速度
    worldWidth: number = 1600,
    worldHeight: number = 1200
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.intensity = intensity;
    this.radius = radius;
    this.energyRate = energyRate;
    this.moveSpeed = moveSpeed;
    this.targetX = x;
    this.targetY = y;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  update(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 定期更新目标位置或决定是否静止
    if (currentTime - this.lastTargetUpdate > this.targetUpdateInterval) {
      // 30%概率选择静止，70%概率移动
      if (Math.random() < 0.3) {
        this.isStationary = true;
        this.stationaryDuration = 15000 + Math.random() * 30000; // 静止15-45秒
      } else {
        this.isStationary = false;
        this.updateTarget();
      }
      this.lastTargetUpdate = currentTime;
    }
    
    // 处理静止状态
    if (this.isStationary) {
      this.stationaryDuration -= deltaTime * 1000; // deltaTime是秒，转换为毫秒
      if (this.stationaryDuration <= 0) {
        this.isStationary = false;
        this.updateTarget();
      }
      return; // 静止时不移动
    }
    
    // 极其缓慢移动到目标位置
    this.moveTowardsTarget(deltaTime);
  }

  private updateTarget(): void {
    // 在世界范围内选择新的随机目标，避免边界
    const margin = this.radius + 50;
    this.targetX = margin + Math.random() * (this.worldWidth - 2 * margin);
    this.targetY = margin + Math.random() * (this.worldHeight - 2 * margin);
  }

  private moveTowardsTarget(deltaTime: number): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 3) { // 更小的到达距离
      const moveDistance = this.moveSpeed * deltaTime;
      this.x += (dx / distance) * moveDistance;
      this.y += (dy / distance) * moveDistance;
    } else {
      // 到达目标，有概率立即选择新目标或保持静止
      if (Math.random() < 0.4) { // 40%概率立即选择新目标
        this.updateTarget();
      } else { // 60%概率保持静止一段时间
        this.isStationary = true;
        this.stationaryDuration = 10000 + Math.random() * 20000; // 静止10-30秒
      }
    }
  }

  checkCollision(other: IWorldEntity): boolean {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const otherRadius = (other as any).radius || 10;
    return distance < (this.radius + otherRadius);
  }
}

/**
 * 暗物质实体实现（暗区）
 * 持续扣除智能体健康值直到0
 */
export class DarkMatter implements IDarkMatter {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'dark-matter' = 'dark-matter';
  isActive: boolean = true;
  
  radius: number;
  drainRate: number; // 实际用作健康消耗率
  expansionRate: number; // 未使用，保持接口兼容
  
  targetX: number;
  targetY: number;
  moveSpeed: number;
  
  private lastTargetUpdate: number = 0;
  private targetUpdateInterval: number = 60000; // 60秒更新一次目标，比光斑更慢
  private worldWidth: number = 1600;
  private worldHeight: number = 1200;
  private isStationary: boolean = false; // 是否处于静止状态
  private stationaryDuration: number = 0; // 静止持续时间

  constructor(
    id: string,
    x: number,
    y: number,
    radius: number = 40,
    drainRate: number = 8, // 健康消耗率
    expansionRate: number = 0, // 不再使用扩张
    moveSpeed: number = 0.5, // 极其缓慢，比光斑更慢
    worldWidth: number = 1600,
    worldHeight: number = 1200
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.drainRate = drainRate;
    this.expansionRate = expansionRate;
    this.targetX = x;
    this.targetY = y;
    this.moveSpeed = moveSpeed;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  update(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 定期更新目标位置或决定是否静止
    if (currentTime - this.lastTargetUpdate > this.targetUpdateInterval) {
      // 40%概率选择静止，60%概率移动（暗区更倾向于静止）
      if (Math.random() < 0.4) {
        this.isStationary = true;
        this.stationaryDuration = 20000 + Math.random() * 40000; // 静止20-60秒
      } else {
        this.isStationary = false;
        this.updateTarget();
      }
      this.lastTargetUpdate = currentTime;
    }
    
    // 处理静止状态
    if (this.isStationary) {
      this.stationaryDuration -= deltaTime * 1000; // deltaTime是秒，转换为毫秒
      if (this.stationaryDuration <= 0) {
        this.isStationary = false;
        this.updateTarget();
      }
      return; // 静止时不移动
    }
    
    // 极其缓慢移动到目标位置
    this.moveTowardsTarget(deltaTime);
  }

  private updateTarget(): void {
    // 在世界范围内选择新的随机目标，避免边界
    const margin = this.radius + 50;
    this.targetX = margin + Math.random() * (this.worldWidth - 2 * margin);
    this.targetY = margin + Math.random() * (this.worldHeight - 2 * margin);
  }

  private moveTowardsTarget(deltaTime: number): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 3) { // 更小的到达距离
      const moveDistance = this.moveSpeed * deltaTime;
      this.x += (dx / distance) * moveDistance;
      this.y += (dy / distance) * moveDistance;
    } else {
      // 到达目标，有概率立即选择新目标或保持静止
      if (Math.random() < 0.3) { // 30%概率立即选择新目标
        this.updateTarget();
      } else { // 70%概率保持静止一段时间
        this.isStationary = true;
        this.stationaryDuration = 15000 + Math.random() * 30000; // 静止15-45秒
      }
    }
  }

  checkCollision(other: IWorldEntity): boolean {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const otherRadius = (other as any).radius || 10;
    return distance < (this.radius + otherRadius);
  }
}
