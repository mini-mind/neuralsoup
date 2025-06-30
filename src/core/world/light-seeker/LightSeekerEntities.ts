/**
 * 追光者世界的实体类
 */

import type { IWorldEntity } from '../types';

/**
 * 光球实体
 * 大型光源，随机缓慢移动，为智能体提供光强度信号
 */
export class LightOrb implements IWorldEntity {
  readonly id: string;
  x: number;
  y: number;
  readonly entityType: 'light-orb' = 'light-orb';
  isActive: boolean = true;
  
  readonly radius: number;
  readonly intensity: number; // 光强度 0-1
  readonly influenceRadius: number; // 影响范围
  
  // 移动相关属性
  private targetX: number;
  private targetY: number;
  private moveSpeed: number;
  private isStationary: boolean = false;
  private stationaryDuration: number = 0;
  private lastTargetUpdate: number = 0;
  private targetUpdateInterval: number;

  constructor(
    id: string,
    x: number,
    y: number,
    radius: number,
    intensity: number,
    influenceRadius: number
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.intensity = intensity;
    this.influenceRadius = influenceRadius;
    
    // 初始化移动参数
    this.targetX = x;
    this.targetY = y;
    this.moveSpeed = 2 + Math.random() * 4; // 移动速度 2-6（更慢）
    this.targetUpdateInterval = 15000 + Math.random() * 20000; // 15-35秒更新目标（更长间隔）
    
    // 立即选择第一个目标
    this.updateTarget();
  }

  update(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 处理静止状态
    if (this.isStationary) {
      this.stationaryDuration -= deltaTime * 1000; // 转换为毫秒
      if (this.stationaryDuration <= 0) {
        this.isStationary = false;
        this.updateTarget();
      }
      return;
    }
    
    // 检查是否需要更新目标
    if (currentTime - this.lastTargetUpdate > this.targetUpdateInterval) {
      if (Math.random() < 0.3) { // 30%概率保持静止
        this.isStationary = true;
        this.stationaryDuration = 5000 + Math.random() * 10000; // 静止5-15秒
      } else {
        this.updateTarget();
      }
    }
    
    // 朝目标移动
    this.moveTowardsTarget(deltaTime);
  }

  private updateTarget(): void {
    // 在世界范围内选择随机目标，但不要离当前位置太远
    const maxDistance = 200;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * maxDistance;
    
    this.targetX = this.x + Math.cos(angle) * distance;
    this.targetY = this.y + Math.sin(angle) * distance;
    
    // 确保目标在合理范围内（假设世界大小为1600x1200）
    this.targetX = Math.max(this.radius, Math.min(1600 - this.radius, this.targetX));
    this.targetY = Math.max(this.radius, Math.min(1200 - this.radius, this.targetY));
    
    this.lastTargetUpdate = Date.now();
    this.targetUpdateInterval = 8000 + Math.random() * 12000; // 重新随机化间隔
  }

  private moveTowardsTarget(deltaTime: number): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) { // 到达距离阈值
      const moveDistance = this.moveSpeed * deltaTime;
      this.x += (dx / distance) * moveDistance;
      this.y += (dy / distance) * moveDistance;
    } else {
      // 到达目标，有概率立即选择新目标或保持静止
      if (Math.random() < 0.4) { // 40%概率立即选择新目标
        this.updateTarget();
      } else { // 60%概率保持静止一段时间
        this.isStationary = true;
        this.stationaryDuration = 3000 + Math.random() * 7000; // 静止3-10秒
      }
    }
  }

  /**
   * 获取在指定位置的光强度
   */
  getLightIntensityAt(x: number, y: number): number {
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > this.influenceRadius) {
      return 0;
    }
    
    // 使用平方反比定律，但添加最小距离避免无穷大
    const minDistance = this.radius;
    const effectiveDistance = Math.max(distance, minDistance);
    const falloff = 1 - (effectiveDistance / this.influenceRadius);
    
    return this.intensity * Math.max(0, falloff);
  }

  /**
   * 检查指定位置是否在光球的影响范围内
   */
  isInInfluenceRange(x: number, y: number): boolean {
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.influenceRadius;
  }

  /**
   * 获取光球的当前状态信息
   */
  getState(): {
    position: { x: number; y: number };
    target: { x: number; y: number };
    isMoving: boolean;
    intensity: number;
    influenceRadius: number;
  } {
    return {
      position: { x: this.x, y: this.y },
      target: { x: this.targetX, y: this.targetY },
      isMoving: !this.isStationary,
      intensity: this.intensity,
      influenceRadius: this.influenceRadius
    };
  }
}
