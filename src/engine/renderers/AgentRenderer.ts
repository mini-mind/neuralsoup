/**
 * 智能体渲染器 - 负责渲染智能体
 */

import * as PIXI from 'pixi.js';
import { Agent } from '../../types/simulation';

export class AgentRenderer {
  private agentContainer: PIXI.Container;
  private agentSprites: Map<number, PIXI.Graphics> = new Map();

  constructor(agentContainer: PIXI.Container) {
    this.agentContainer = agentContainer;
  }

  /**
   * 渲染所有智能体
   */
  public render(agents: Agent[], visionAngle: number): void {
    // 清理不存在的智能体精灵
    for (const [id, sprite] of this.agentSprites) {
      if (!agents.find(agent => agent.id === id)) {
        this.agentContainer.removeChild(sprite);
        this.agentSprites.delete(id);
      }
    }

    // 渲染每个智能体
    for (const agent of agents) {
      let sprite = this.agentSprites.get(agent.id);
      
      if (!sprite) {
        sprite = new PIXI.Graphics();
        this.agentContainer.addChild(sprite);
        this.agentSprites.set(agent.id, sprite);
      }
      
      this.drawAgent(sprite, agent, visionAngle);
    }
  }

  /**
   * 绘制单个智能体
   */
  private drawAgent(graphics: PIXI.Graphics, agent: Agent, visionAngle: number): void {
    graphics.clear();
    
    // 智能体基础颜色（蓝色）- 简化颜色计算
    let agentColor = 0x3498DB; // 基础蓝色
    
    // 根据神经状态微调颜色（可选）
    if (agent.motivation > 0.1) {
      agentColor = 0x52C4F0; // 稍微亮一点的蓝色（高动机时）
    }

    // 绘制智能体身体（圆形）
    const agentRadius = 15; // 固定半径
    graphics.beginFill(agentColor, 0.8);
    graphics.drawCircle(agent.x, agent.y, agentRadius);
    graphics.endFill();

    // 绘制方向指示器（三角形）
    const triangleSize = agentRadius * 0.8;
    const tipX = agent.x + Math.cos(agent.angle) * triangleSize;
    const tipY = agent.y + Math.sin(agent.angle) * triangleSize;
    
    const leftX = agent.x + Math.cos(agent.angle + 2.5) * (triangleSize * 0.5);
    const leftY = agent.y + Math.sin(agent.angle + 2.5) * (triangleSize * 0.5);
    
    const rightX = agent.x + Math.cos(agent.angle - 2.5) * (triangleSize * 0.5);
    const rightY = agent.y + Math.sin(agent.angle - 2.5) * (triangleSize * 0.5);

    graphics.beginFill(0xFFFFFF, 0.9);
    graphics.drawPolygon([tipX, tipY, leftX, leftY, rightX, rightY]);
    graphics.endFill();

    // 主智能体额外标识
    if (agent.id === 0) {
      graphics.lineStyle(2, 0xFFD700, 0.8); // 金色边框
      graphics.drawCircle(agent.x, agent.y, agentRadius + 3);
      graphics.lineStyle(0); // 重置线条样式
    }

    // 移除速度指示器 - 这是导致多余辅助线的原因
    // 速度指示器在正常情况下不需要显示，三角形方向指示器已经足够表示智能体朝向
    // 如果需要调试速度，可以在特定调试模式下重新启用
    
    // 设置精灵位置（虽然已在绘制时使用了世界坐标）
    graphics.x = 0;
    graphics.y = 0;
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    for (const sprite of this.agentSprites.values()) {
      sprite.destroy();
    }
    this.agentSprites.clear();
  }
} 