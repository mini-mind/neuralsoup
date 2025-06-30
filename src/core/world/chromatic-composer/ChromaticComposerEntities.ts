/**
 * 律动色域世界的实体实现
 */

import type { IColorPool, IRhythmNode, ICanvasTrace, IWorldEntity } from '../types';

/**
 * 色彩池实体实现
 */
export class ColorPool implements IColorPool {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'color-pool' = 'color-pool';
  isActive: boolean = true;
  
  color: string;
  radius: number;
  intensity: number;
  
  private pulsePhase: number = 0;

  constructor(
    id: string,
    x: number,
    y: number,
    color: string,
    radius: number = 30,
    intensity: number = 1.0
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;
    this.intensity = intensity;
  }

  update(deltaTime: number): void {
    // 色彩池的脉动效果
    this.pulsePhase += deltaTime * 0.002;
    this.intensity = 0.7 + 0.3 * Math.sin(this.pulsePhase);
  }

  /**
   * 获取当前的脉动半径
   */
  getPulseRadius(): number {
    return this.radius * (0.9 + 0.1 * Math.sin(this.pulsePhase * 2));
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
 * 节奏源实体实现
 */
export class RhythmNode implements IRhythmNode {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'rhythm-node' = 'rhythm-node';
  isActive: boolean = true;
  
  frequency: number; // BPM
  amplitude: number;
  phase: number;
  range: number;
  
  private lastBeat: number = 0;
  private beatInterval: number;

  constructor(
    id: string,
    x: number,
    y: number,
    frequency: number = 120, // 120 BPM
    amplitude: number = 1.0,
    range: number = 100
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.frequency = frequency;
    this.amplitude = amplitude;
    this.phase = 0;
    this.range = range;
    this.beatInterval = 60000 / frequency; // 毫秒
  }

  update(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 更新相位
    this.phase += (deltaTime * this.frequency) / 60;
    
    // 检查是否到了下一个节拍
    if (currentTime - this.lastBeat >= this.beatInterval) {
      this.lastBeat = currentTime;
      // 可以在这里触发节拍事件
    }
  }

  /**
   * 获取当前节拍强度 (0-1)
   */
  getCurrentBeatIntensity(): number {
    const beatPhase = (this.phase % 1);
    // 在节拍点附近强度最高
    const beatStrength = Math.max(0, 1 - Math.abs(beatPhase - 0.5) * 4);
    return this.amplitude * beatStrength;
  }

  /**
   * 检查指定位置是否在节拍影响范围内
   */
  isInRange(x: number, y: number): boolean {
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.range;
  }

  /**
   * 获取指定位置的节拍强度
   */
  getBeatStrength(x: number, y: number): number {
    if (!this.isInRange(x, y)) return 0;
    
    const dx = this.x - x;
    const dy = this.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const distanceRatio = 1 - (distance / this.range);
    
    return this.getCurrentBeatIntensity() * distanceRatio;
  }

  checkCollision(other: IWorldEntity): boolean {
    // 节拍源不参与物理碰撞
    return false;
  }
}

/**
 * 画布痕迹实体实现
 */
export class CanvasTrace implements ICanvasTrace {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'canvas-trace' = 'canvas-trace';
  isActive: boolean = true;
  
  color: string;
  opacity: number;
  width: number;
  fadeRate: number;
  points: Array<{ x: number; y: number; timestamp: number }>;
  
  private maxPoints: number = 50;
  private maxAge: number = 10000; // 10秒后开始淡化

  constructor(
    id: string,
    x: number,
    y: number,
    color: string,
    width: number = 3,
    fadeRate: number = 0.02
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.color = color;
    this.opacity = 1.0;
    this.width = width;
    this.fadeRate = fadeRate;
    this.points = [{ x, y, timestamp: Date.now() }];
  }

  update(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 移除过老的点
    this.points = this.points.filter(point => 
      currentTime - point.timestamp < this.maxAge
    );
    
    // 限制点的数量
    if (this.points.length > this.maxPoints) {
      this.points = this.points.slice(-this.maxPoints);
    }
    
    // 淡化效果
    this.opacity = Math.max(0, this.opacity - this.fadeRate * deltaTime);
    
    // 完全透明时失活
    if (this.opacity <= 0 || this.points.length === 0) {
      this.isActive = false;
    }
  }

  /**
   * 添加新的点
   */
  addPoint(x: number, y: number): void {
    this.points.push({ x, y, timestamp: Date.now() });
    this.x = x; // 更新当前位置
    this.y = y;
    
    // 重置透明度
    this.opacity = Math.min(1.0, this.opacity + 0.1);
  }

  /**
   * 获取路径的总长度
   */
  getPathLength(): number {
    if (this.points.length < 2) return 0;
    
    let length = 0;
    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i - 1];
      const curr = this.points[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    
    return length;
  }

  /**
   * 获取路径的复杂度（转向次数）
   */
  getPathComplexity(): number {
    if (this.points.length < 3) return 0;
    
    let turns = 0;
    for (let i = 2; i < this.points.length; i++) {
      const p1 = this.points[i - 2];
      const p2 = this.points[i - 1];
      const p3 = this.points[i];
      
      const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      const angleDiff = Math.abs(angle2 - angle1);
      
      if (angleDiff > Math.PI / 4) { // 45度以上的转向
        turns++;
      }
    }
    
    return turns;
  }

  checkCollision(other: IWorldEntity): boolean {
    // 画布痕迹不参与物理碰撞
    return false;
  }
}

/**
 * 艺术智能体 - 专门用于创作的智能体
 */
export class ArtisticAgent implements IWorldEntity {
  readonly id: string;
  x: number;
  y: number;
  entityType: 'artistic-agent' = 'artistic-agent';
  isActive: boolean = true;
  
  radius: number;
  currentColor: string;
  brushSize: number;
  creativity: number; // 创造力指数 (0-1)
  
  // 艺术状态
  isDrawing: boolean = false;
  currentTrace: CanvasTrace | null = null;
  
  // 移动参数
  velocity: { x: number; y: number } = { x: 0, y: 0 };
  maxSpeed: number = 20;
  
  // 艺术偏好
  preferredColors: string[] = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
  colorChangeRate: number = 0.01; // 颜色变化频率

  constructor(
    id: string,
    x: number,
    y: number,
    radius: number = 8,
    creativity: number = 0.5
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.creativity = creativity;
    this.currentColor = this.getRandomColor();
    this.brushSize = 2 + Math.random() * 4;
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
    
    // 随机改变颜色
    if (Math.random() < this.colorChangeRate) {
      this.currentColor = this.getRandomColor();
    }
    
    // 更新当前痕迹
    if (this.isDrawing && this.currentTrace) {
      this.currentTrace.addPoint(this.x, this.y);
    }
  }

  /**
   * 开始绘画
   */
  startDrawing(): CanvasTrace {
    this.isDrawing = true;
    this.currentTrace = new CanvasTrace(
      `trace_${this.id}_${Date.now()}`,
      this.x,
      this.y,
      this.currentColor,
      this.brushSize,
      0.01 + Math.random() * 0.02 // 随机淡化率
    );
    
    return this.currentTrace;
  }

  /**
   * 停止绘画
   */
  stopDrawing(): CanvasTrace | null {
    this.isDrawing = false;
    const trace = this.currentTrace;
    this.currentTrace = null;
    return trace;
  }

  /**
   * 响应节拍
   */
  respondToBeat(intensity: number): void {
    // 节拍强度影响移动和绘画行为
    if (intensity > 0.5) {
      // 强节拍时改变方向
      const angle = Math.random() * Math.PI * 2;
      this.velocity.x += Math.cos(angle) * intensity * 10;
      this.velocity.y += Math.sin(angle) * intensity * 10;
      
      // 可能开始或停止绘画
      if (Math.random() < intensity * this.creativity) {
        if (!this.isDrawing) {
          this.startDrawing();
        } else if (Math.random() < 0.3) {
          this.stopDrawing();
        }
      }
    }
  }

  /**
   * 接触色彩池时改变颜色
   */
  touchColorPool(color: string): void {
    this.currentColor = color;
    
    // 接触新颜色时可能开始新的绘画
    if (Math.random() < this.creativity) {
      if (this.isDrawing) {
        this.stopDrawing();
      }
      this.startDrawing();
    }
  }

  private getRandomColor(): string {
    return this.preferredColors[Math.floor(Math.random() * this.preferredColors.length)];
  }

  checkCollision(other: IWorldEntity): boolean {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const otherRadius = (other as any).radius || 10;
    return distance < (this.radius + otherRadius);
  }
}
