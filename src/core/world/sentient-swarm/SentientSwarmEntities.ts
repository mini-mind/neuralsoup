/**
 * 意识集群世界的实体实现
 */

import type { IResourcePatch, ISignalBeacon, IThreat, IWorldEntity } from '../types';

/**
 * 资源点实体实现
 */
export class ResourcePatch implements IResourcePatch {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'resource-patch' = 'resource-patch';
  isActive: boolean = true;
  
  resourceAmount: number;
  maxResource: number;
  regenerationRate: number;
  radius: number;
  
  private lastRegeneration: number = 0;
  private regenerationInterval: number = 1000; // 1秒再生一次

  constructor(
    id: string,
    x: number,
    y: number,
    maxResource: number = 100,
    radius: number = 25,
    regenerationRate: number = 2
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.maxResource = maxResource;
    this.resourceAmount = maxResource;
    this.radius = radius;
    this.regenerationRate = regenerationRate;
  }

  update(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 定期再生资源
    if (currentTime - this.lastRegeneration > this.regenerationInterval) {
      this.regenerateResource();
      this.lastRegeneration = currentTime;
    }
  }

  private regenerateResource(): void {
    if (this.resourceAmount < this.maxResource) {
      this.resourceAmount = Math.min(
        this.maxResource,
        this.resourceAmount + this.regenerationRate
      );
    }
  }

  /**
   * 消耗资源
   */
  consumeResource(amount: number): number {
    const consumed = Math.min(amount, this.resourceAmount);
    this.resourceAmount -= consumed;
    return consumed;
  }

  /**
   * 获取资源密度 (0-1)
   */
  getResourceDensity(): number {
    return this.resourceAmount / this.maxResource;
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
 * 信标实体实现
 */
export class SignalBeacon implements ISignalBeacon {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'signal-beacon' = 'signal-beacon';
  isActive: boolean = true;
  
  signalType: 'food' | 'danger' | 'neutral';
  intensity: number;
  range: number;
  duration: number;
  createdBy: string;
  
  private createdAt: number;

  constructor(
    id: string,
    x: number,
    y: number,
    signalType: 'food' | 'danger' | 'neutral',
    intensity: number = 1.0,
    range: number = 80,
    duration: number = 5000, // 5秒持续时间
    createdBy: string = ''
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.signalType = signalType;
    this.intensity = intensity;
    this.range = range;
    this.duration = duration;
    this.createdBy = createdBy;
    this.createdAt = Date.now();
  }

  update(deltaTime: number): void {
    const currentTime = Date.now();
    const age = currentTime - this.createdAt;
    
    // 信号强度随时间衰减
    this.intensity = Math.max(0, 1 - age / this.duration);
    
    // 信号过期后失活
    if (age >= this.duration) {
      this.isActive = false;
    }
  }

  /**
   * 检查指定位置是否在信号范围内
   */
  isInRange(x: number, y: number): boolean {
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.range;
  }

  /**
   * 获取指定位置的信号强度
   */
  getSignalStrength(x: number, y: number): number {
    if (!this.isInRange(x, y)) return 0;
    
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const distanceRatio = 1 - (distance / this.range);
    
    return this.intensity * distanceRatio;
  }

  checkCollision(other: IWorldEntity): boolean {
    // 信标不参与物理碰撞
    return false;
  }
}

/**
 * 威胁实体实现
 */
export class Threat implements IThreat {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'threat' = 'threat';
  isActive: boolean = true;
  
  moveSpeed: number;
  detectionRange: number;
  damage: number;
  radius: number;
  targetX: number;
  targetY: number;
  
  private lastTargetUpdate: number = 0;
  private targetUpdateInterval: number = 2000; // 2秒更新一次目标
  private huntingTarget: string | null = null; // 正在追捕的目标ID

  constructor(
    id: string,
    x: number,
    y: number,
    moveSpeed: number = 30,
    detectionRange: number = 100,
    damage: number = 20,
    radius: number = 15
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.moveSpeed = moveSpeed;
    this.detectionRange = detectionRange;
    this.damage = damage;
    this.radius = radius;
    this.targetX = x;
    this.targetY = y;
  }

  update(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 定期更新目标位置
    if (currentTime - this.lastTargetUpdate > this.targetUpdateInterval) {
      this.updateTarget();
      this.lastTargetUpdate = currentTime;
    }
    
    // 向目标位置移动
    this.moveTowardsTarget(deltaTime);
  }

  private updateTarget(): void {
    // 简单的随机移动模式
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 100;
    
    this.targetX = this.x + Math.cos(angle) * distance;
    this.targetY = this.y + Math.sin(angle) * distance;
  }

  private moveTowardsTarget(deltaTime: number): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) {
      const moveDistance = this.moveSpeed * deltaTime;
      this.x += (dx / distance) * moveDistance;
      this.y += (dy / distance) * moveDistance;
    }
  }

  /**
   * 设置追捕目标
   */
  setHuntingTarget(agentId: string, agentX: number, agentY: number): void {
    this.huntingTarget = agentId;
    this.targetX = agentX;
    this.targetY = agentY;
  }

  /**
   * 检查是否能检测到指定位置的智能体
   */
  canDetect(x: number, y: number): boolean {
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.detectionRange;
  }

  /**
   * 攻击指定目标
   */
  attack(targetId: string): number {
    if (this.huntingTarget === targetId) {
      return this.damage;
    }
    return 0;
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
 * 群体智能体实体 - 共享同一个SNN的多个个体
 */
export class SwarmAgent implements IWorldEntity {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'swarm-agent' = 'swarm-agent';
  isActive: boolean = true;
  
  radius: number;
  energy: number;
  maxEnergy: number;
  swarmId: string; // 所属群体ID
  role: 'explorer' | 'gatherer' | 'guard' | 'neutral';
  
  // 群体行为参数
  separationRadius: number = 20;
  alignmentRadius: number = 40;
  cohesionRadius: number = 60;
  
  // 移动参数
  velocity: { x: number; y: number } = { x: 0, y: 0 };
  maxSpeed: number = 25;

  constructor(
    id: string,
    x: number,
    y: number,
    swarmId: string,
    radius: number = 8,
    maxEnergy: number = 100
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.swarmId = swarmId;
    this.radius = radius;
    this.maxEnergy = maxEnergy;
    this.energy = maxEnergy;
    this.role = 'neutral';
  }

  update(deltaTime: number): void {
    // 应用速度
    this.x += this.velocity.x * deltaTime;
    this.y += this.velocity.y * deltaTime;
    
    // 限制最大速度
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    if (speed > this.maxSpeed) {
      this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
      this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
    }
    
    // 消耗能量
    this.energy = Math.max(0, this.energy - 0.1 * deltaTime);
    
    // 能量耗尽时失活
    if (this.energy <= 0) {
      this.isActive = false;
    }
  }

  /**
   * 应用群体行为力
   */
  applySwarmForces(neighbors: SwarmAgent[]): void {
    const separation = this.calculateSeparation(neighbors);
    const alignment = this.calculateAlignment(neighbors);
    const cohesion = this.calculateCohesion(neighbors);
    
    // 权重
    const separationWeight = 1.5;
    const alignmentWeight = 1.0;
    const cohesionWeight = 1.0;
    
    this.velocity.x += separation.x * separationWeight + 
                      alignment.x * alignmentWeight + 
                      cohesion.x * cohesionWeight;
    this.velocity.y += separation.y * separationWeight + 
                      alignment.y * alignmentWeight + 
                      cohesion.y * cohesionWeight;
  }

  private calculateSeparation(neighbors: SwarmAgent[]): { x: number; y: number } {
    let steer = { x: 0, y: 0 };
    let count = 0;
    
    for (const neighbor of neighbors) {
      const distance = this.distanceTo(neighbor);
      if (distance > 0 && distance < this.separationRadius) {
        const diff = {
          x: this.x - neighbor.x,
          y: this.y - neighbor.y
        };
        const magnitude = Math.sqrt(diff.x ** 2 + diff.y ** 2);
        if (magnitude > 0) {
          diff.x /= magnitude;
          diff.y /= magnitude;
          diff.x /= distance; // 距离越近，力越大
          diff.y /= distance;
          steer.x += diff.x;
          steer.y += diff.y;
          count++;
        }
      }
    }
    
    if (count > 0) {
      steer.x /= count;
      steer.y /= count;
    }
    
    return steer;
  }

  private calculateAlignment(neighbors: SwarmAgent[]): { x: number; y: number } {
    let avgVelocity = { x: 0, y: 0 };
    let count = 0;
    
    for (const neighbor of neighbors) {
      const distance = this.distanceTo(neighbor);
      if (distance > 0 && distance < this.alignmentRadius) {
        avgVelocity.x += neighbor.velocity.x;
        avgVelocity.y += neighbor.velocity.y;
        count++;
      }
    }
    
    if (count > 0) {
      avgVelocity.x /= count;
      avgVelocity.y /= count;
      
      // 转换为转向力
      avgVelocity.x -= this.velocity.x;
      avgVelocity.y -= this.velocity.y;
    }
    
    return avgVelocity;
  }

  private calculateCohesion(neighbors: SwarmAgent[]): { x: number; y: number } {
    let centerOfMass = { x: 0, y: 0 };
    let count = 0;
    
    for (const neighbor of neighbors) {
      const distance = this.distanceTo(neighbor);
      if (distance > 0 && distance < this.cohesionRadius) {
        centerOfMass.x += neighbor.x;
        centerOfMass.y += neighbor.y;
        count++;
      }
    }
    
    if (count > 0) {
      centerOfMass.x /= count;
      centerOfMass.y /= count;
      
      // 转换为转向力
      return {
        x: (centerOfMass.x - this.x) * 0.01,
        y: (centerOfMass.y - this.y) * 0.01
      };
    }
    
    return { x: 0, y: 0 };
  }

  private distanceTo(other: SwarmAgent): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  checkCollision(other: IWorldEntity): boolean {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const otherRadius = (other as any).radius || 10;
    return distance < (this.radius + otherRadius);
  }
}
