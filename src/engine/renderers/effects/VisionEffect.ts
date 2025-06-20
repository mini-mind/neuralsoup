/**
 * 视觉效果系统 - 负责渲染智能体的视野效果
 */

import * as PIXI from 'pixi.js';
import { Agent, World } from '../../../types/simulation';

export class VisionEffect {
  private visionFanGraphics: PIXI.Graphics;

  constructor(visionContainer: PIXI.Container) {
    this.visionFanGraphics = new PIXI.Graphics();
    visionContainer.addChild(this.visionFanGraphics);
  }

  /**
   * 渲染主智能体的视野扇形
   */
  public renderVisionFan(world: World): void {
    const mainAgent = world.agents.find(agent => agent.id === 0);
    if (!mainAgent) return;

    this.visionFanGraphics.clear();
    this.visionFanGraphics.lineStyle(2, 0xFFFFFF, 0.15); // 透明实线

    const startAngle = mainAgent.angle - world.visionAngle / 2;
    const endAngle = mainAgent.angle + world.visionAngle / 2;

    // 绘制视野扇形
    this.visionFanGraphics.moveTo(mainAgent.x, mainAgent.y); // 从智能体中心开始
    this.visionFanGraphics.arc(mainAgent.x, mainAgent.y, world.visionRange, startAngle, endAngle, false);
    this.visionFanGraphics.lineTo(mainAgent.x, mainAgent.y); // 回到智能体中心，形成闭合扇形
    this.visionFanGraphics.endFill();
  }

  /**
   * 为智能体绘制视觉格子
   */
  public drawVisionCells(graphics: PIXI.Graphics, agent: Agent, visionAngle: number, worldRotation: number): void {
    // 绘制主控智能体的环绕式视野格子
    if (agent.id === 0 && agent.visionCells && agent.visionCells.length > 0) {
      const agentRadius = 15; // 智能体半径
      const visionRingRadius = 22; // 视野环的半径，比智能体大一些
      const cellCount = agent.visionCells.length;
      const angleStep = visionAngle / cellCount; // 每个格子的角度范围
      const cellArcLength = visionRingRadius * angleStep; // 弧长
      const cellWidth = Math.max(cellArcLength * 0.8, 8); // 弯曲矩形的宽度，基于弧长
      const cellHeight = 8; // 弯曲矩形的径向厚度

      for (let i = 0; i < agent.visionCells.length; i++) {
        const cell = agent.visionCells[i];
        const color = (Math.floor(cell.color.r * 255) << 16) | 
                      (Math.floor(cell.color.g * 255) << 8) | 
                      Math.floor(cell.color.b * 255);
        
        // 计算每个视野格子的中心角度
        const startAngle = -visionAngle / 2;
        const cellCenterAngle = startAngle + i * angleStep + angleStep / 2;
        
        // 绘制弯曲的矩形（扇形段）
        graphics.beginFill(color, 0.9);
        
        // 计算扇形的起始和结束角度
        const segmentStartAngle = cellCenterAngle - angleStep / 2;
        const segmentEndAngle = cellCenterAngle + angleStep / 2;
        
        // 绘制扇形段（弯曲矩形）
        // 外圆弧
        graphics.moveTo(
          Math.sin(segmentStartAngle) * (visionRingRadius + cellHeight / 2),
          -Math.cos(segmentStartAngle) * (visionRingRadius + cellHeight / 2)
        );
        graphics.arc(0, 0, visionRingRadius + cellHeight / 2, 
                    -Math.PI / 2 + segmentStartAngle, 
                    -Math.PI / 2 + segmentEndAngle, false);
        
        // 右侧连接线
        graphics.lineTo(
          Math.sin(segmentEndAngle) * (visionRingRadius - cellHeight / 2),
          -Math.cos(segmentEndAngle) * (visionRingRadius - cellHeight / 2)
        );
        
        // 内圆弧
        graphics.arc(0, 0, visionRingRadius - cellHeight / 2, 
                    -Math.PI / 2 + segmentEndAngle, 
                    -Math.PI / 2 + segmentStartAngle, true);
        
        // 左侧连接线（闭合路径）
        graphics.closePath();
        graphics.endFill();
      }
    }
  }
} 