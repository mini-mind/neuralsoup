/**
 * 回声洞穴世界的实体实现
 */

import type { IWall, IFood, IMufflingZone, IWorldEntity } from '../types';

/**
 * 墙壁实体实现
 */
export class Wall implements IWall {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'wall' = 'wall';
  isActive: boolean = true;
  
  width: number;
  height: number;
  reflectivity: number;

  constructor(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    reflectivity: number = 0.8
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.reflectivity = reflectivity;
  }

  update(deltaTime: number): void {
    // 墙壁通常是静态的，不需要更新
  }

  checkCollision(other: IWorldEntity): boolean {
    const otherRadius = (other as any).radius || 10;
    
    // 检查圆形与矩形的碰撞
    const closestX = Math.max(this.x, Math.min(other.x, this.x + this.width));
    const closestY = Math.max(this.y, Math.min(other.y, this.y + this.height));
    
    const dx = other.x - closestX;
    const dy = other.y - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < otherRadius;
  }

  /**
   * 计算声波反射
   */
  reflectSound(sourceX: number, sourceY: number, intensity: number): { x: number; y: number; intensity: number } | null {
    // 简化的声波反射计算
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    
    const dx = centerX - sourceX;
    const dy = centerY - sourceY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 200) return null; // 超出反射范围
    
    const reflectedIntensity = intensity * this.reflectivity * (1 - distance / 200);
    
    return {
      x: centerX,
      y: centerY,
      intensity: reflectedIntensity
    };
  }
}

/**
 * 食物实体实现
 */
export class Food implements IFood {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'food' = 'food';
  isActive: boolean = true;
  
  nutritionValue: number;
  radius: number;
  echoSignature: string;
  isConsumed: boolean = false;

  constructor(
    id: string,
    x: number,
    y: number,
    nutritionValue: number = 30,
    radius: number = 12,
    echoSignature: string = 'food'
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.nutritionValue = nutritionValue;
    this.radius = radius;
    this.echoSignature = echoSignature;
  }

  update(deltaTime: number): void {
    if (this.isConsumed) {
      this.isActive = false;
    }
  }

  consume(): number {
    if (!this.isConsumed) {
      this.isConsumed = true;
      this.isActive = false;
      return this.nutritionValue;
    }
    return 0;
  }

  checkCollision(other: IWorldEntity): boolean {
    if (this.isConsumed) return false;
    
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const otherRadius = (other as any).radius || 10;
    return distance < (this.radius + otherRadius);
  }

  /**
   * 生成回声信号
   */
  generateEcho(sourceX: number, sourceY: number, intensity: number): { signature: string; intensity: number; distance: number } | null {
    const dx = this.x - sourceX;
    const dy = this.y - sourceY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 150) return null; // 超出回声范围
    
    const echoIntensity = intensity * (1 - distance / 150) * 0.6; // 食物的回声较弱
    
    return {
      signature: this.echoSignature,
      intensity: echoIntensity,
      distance: distance
    };
  }
}

/**
 * 消音区域实体实现
 */
export class MufflingZone implements IMufflingZone {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'muffling-zone' = 'muffling-zone';
  isActive: boolean = true;
  
  radius: number;
  absorptionRate: number;

  constructor(
    id: string,
    x: number,
    y: number,
    radius: number = 40,
    absorptionRate: number = 0.7
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.absorptionRate = absorptionRate;
  }

  update(deltaTime: number): void {
    // 消音区域可能会有轻微的脉动效果
    this.radius = this.radius * (0.98 + 0.04 * Math.sin(Date.now() * 0.001));
  }

  checkCollision(other: IWorldEntity): boolean {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const otherRadius = (other as any).radius || 10;
    return distance < (this.radius + otherRadius);
  }

  /**
   * 吸收声波
   */
  absorbSound(sourceX: number, sourceY: number, intensity: number): number {
    const dx = this.x - sourceX;
    const dy = this.y - sourceY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > this.radius) return intensity; // 不在消音区域内
    
    const absorptionFactor = 1 - (this.absorptionRate * (1 - distance / this.radius));
    return intensity * absorptionFactor;
  }
}

/**
 * 声波实体 - 用于可视化声纳效果
 */
export class SoundWave implements IWorldEntity {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'sound-wave' = 'sound-wave';
  isActive: boolean = true;
  
  radius: number;
  intensity: number;
  maxRadius: number;
  expansionSpeed: number;
  sourceId: string;

  constructor(
    id: string,
    x: number,
    y: number,
    intensity: number = 1.0,
    maxRadius: number = 100,
    expansionSpeed: number = 50,
    sourceId: string = ''
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.intensity = intensity;
    this.maxRadius = maxRadius;
    this.expansionSpeed = expansionSpeed;
    this.sourceId = sourceId;
  }

  update(deltaTime: number): void {
    this.radius += this.expansionSpeed * deltaTime;
    
    // 随着扩散，强度衰减
    this.intensity *= 0.98;
    
    if (this.radius >= this.maxRadius || this.intensity < 0.1) {
      this.isActive = false;
    }
  }

  checkCollision(other: IWorldEntity): boolean {
    // 声波不参与物理碰撞
    return false;
  }
}
