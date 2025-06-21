/**
 * 障碍物渲染器 - 负责渲染障碍物
 */

import * as PIXI from 'pixi.js';
import { Obstacle } from '../../types/simulation';

export class ObstacleRenderer {
  private obstacleContainer: PIXI.Container;
  private obstacleSprites: Map<number, PIXI.Graphics> = new Map();

  constructor(obstacleContainer: PIXI.Container) {
    this.obstacleContainer = obstacleContainer;
  }

  /**
   * 渲染所有障碍物
   */
  public render(obstacles: Obstacle[]): void {
    // 清理不存在的障碍物精灵
    for (const [id, sprite] of this.obstacleSprites) {
      if (!obstacles.find(obstacle => obstacle.id === id)) {
        this.obstacleContainer.removeChild(sprite);
        this.obstacleSprites.delete(id);
      }
    }

    // 渲染每个障碍物
    for (const obstacle of obstacles) {
      let sprite = this.obstacleSprites.get(obstacle.id);
      
      if (!sprite) {
        sprite = new PIXI.Graphics();
        this.obstacleContainer.addChild(sprite);
        this.obstacleSprites.set(obstacle.id, sprite);
      }
      
      this.drawObstacle(sprite, obstacle);
    }
  }

  /**
   * 绘制单个障碍物
   */
  private drawObstacle(graphics: PIXI.Graphics, obstacle: Obstacle): void {
    graphics.clear();
    
    // 根据移动状态设定颜色
    const obstacleColor = obstacle.isMoving ? 0xE74C3C : 0x8E44AD; // 移动障碍物为红色，静态为紫色
    
    // 绘制障碍物（圆形）
    graphics.beginFill(obstacleColor, 0.8);
    graphics.drawCircle(obstacle.x, obstacle.y, obstacle.radius);
    graphics.endFill();
    
    // 绘制边框
    graphics.lineStyle(2, 0xFFFFFF, 0.5);
    graphics.drawCircle(obstacle.x, obstacle.y, obstacle.radius);
    graphics.lineStyle(0); // 重置线条样式
    
    // 移除方向指示器 - 用户设计中不需要这个功能，保持简洁
    
    // 设置精灵位置
    graphics.x = 0;
    graphics.y = 0;
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    for (const sprite of this.obstacleSprites.values()) {
      sprite.destroy();
    }
    this.obstacleSprites.clear();
  }
} 