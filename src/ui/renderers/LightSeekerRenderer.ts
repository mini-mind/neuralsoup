/**
 * 追光者世界渲染器
 * 负责渲染光球
 */

import * as PIXI from 'pixi.js';
import type { LightSeekerWorld } from '../../core/world/light-seeker/LightSeekerWorld';
import type { ILightOrb } from '../../core/world/types';

export class LightSeekerRenderer {
  private graphics: PIXI.Graphics;
  private world: LightSeekerWorld | null = null;

  constructor(graphics: PIXI.Graphics) {
    this.graphics = graphics;
  }

  setWorld(world: LightSeekerWorld): void {
    this.world = world;
  }

  render(): void {
    if (!this.world) return;

    this.graphics.clear();

    // 渲染光球
    this.renderLightOrbs();
  }

  private renderLightOrbs(): void {
    if (!this.world) return;

    const lightOrbs = this.world.getLightOrbs();
    
    for (const orb of lightOrbs.values()) {
      this.renderLightOrb(orb);
    }
  }

  private renderLightOrb(orb: ILightOrb): void {
    const graphics = this.graphics;

    // 绘制影响范围（半透明圆圈）
    graphics.beginFill(0xffff00, 0.1 * orb.intensity); // 黄色，透明度基于强度
    graphics.drawCircle(orb.x, orb.y, orb.influenceRadius);
    graphics.endFill();

    // 绘制影响范围边界
    graphics.lineStyle(1, 0xffff00, 0.3 * orb.intensity);
    graphics.drawCircle(orb.x, orb.y, orb.influenceRadius);
    graphics.lineStyle(0);

    // 绘制光球本体（渐变效果）
    const coreRadius = orb.radius;
    const glowRadius = orb.radius * 1.5;

    // 外层光晕
    graphics.beginFill(0xffff00, 0.3 * orb.intensity);
    graphics.drawCircle(orb.x, orb.y, glowRadius);
    graphics.endFill();

    // 中层光晕
    graphics.beginFill(0xffff00, 0.6 * orb.intensity);
    graphics.drawCircle(orb.x, orb.y, coreRadius * 1.2);
    graphics.endFill();

    // 核心
    graphics.beginFill(0xffffff, 0.9 * orb.intensity);
    graphics.drawCircle(orb.x, orb.y, coreRadius);
    graphics.endFill();

    // 绘制移动方向指示（如果正在移动）
    const state = orb.getState();
    if (state.isMoving) {
      const dx = state.target.x - state.position.x;
      const dy = state.target.y - state.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 5) {
        const arrowLength = 30;
        const endX = orb.x + (dx / distance) * arrowLength;
        const endY = orb.y + (dy / distance) * arrowLength;

        graphics.lineStyle(2, 0xffffff, 0.7);
        graphics.moveTo(orb.x, orb.y);
        graphics.lineTo(endX, endY);

        // 箭头头部
        const arrowHeadSize = 8;
        const angle = Math.atan2(dy, dx);
        graphics.lineTo(
          endX - arrowHeadSize * Math.cos(angle - Math.PI / 6),
          endY - arrowHeadSize * Math.sin(angle - Math.PI / 6)
        );
        graphics.moveTo(endX, endY);
        graphics.lineTo(
          endX - arrowHeadSize * Math.cos(angle + Math.PI / 6),
          endY - arrowHeadSize * Math.sin(angle + Math.PI / 6)
        );
        graphics.lineStyle(0);
      }
    }
  }



  /**
   * 获取渲染统计信息
   */
  getRenderStats(): {
    lightOrbCount: number;
    totalLightSources: number;
  } {
    if (!this.world) {
      return {
        lightOrbCount: 0,
        totalLightSources: 0
      };
    }

    const lightOrbs = this.world.getLightOrbs();

    return {
      lightOrbCount: lightOrbs.size,
      totalLightSources: lightOrbs.size
    };
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.world = null;
  }
}
