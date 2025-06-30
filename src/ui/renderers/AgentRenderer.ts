/**
 * 智能体渲染器 - 负责渲染智能体
 */

import * as PIXI from "pixi.js";
import type { IAgent } from "../../core/entities/types";

export class AgentRenderer {
  private agentContainer: PIXI.Container;
  private agentSprites: Map<number, PIXI.Graphics> = new Map();

  constructor(agentContainer: PIXI.Container) {
    this.agentContainer = agentContainer;
  }

  /**
   * 渲染所有智能体
   */
  public render(agents: IAgent[], visionAngle: number = 60): void {
    // 清理不存在的智能体精灵
    for (const [id, sprite] of this.agentSprites) {
      if (!agents.find((agent) => (typeof agent.id === 'string' ? parseInt(agent.id) || 0 : agent.id) === id)) {
        this.agentContainer.removeChild(sprite);
        this.agentSprites.delete(id);
      }
    }

    // 渲染每个智能体
    for (const agent of agents) {
      const agentIdNum = typeof agent.id === 'string' ? parseInt(agent.id) || 0 : agent.id;
      let sprite = this.agentSprites.get(agentIdNum);

      if (!sprite) {
        sprite = new PIXI.Graphics();
        this.agentContainer.addChild(sprite);
        this.agentSprites.set(agentIdNum, sprite);
      }

      this.drawAgent(sprite, agent, visionAngle);
    }
  }

  /**
   * 绘制单个智能体
   */
  private drawAgent(
    graphics: PIXI.Graphics,
    agent: IAgent,
    visionAngle: number,
  ): void {
    graphics.clear();

    const agentRadius = 12; // 固定半径
    const agentAny = agent as any;
    
    // 检查是否是主agent
    const isMainAgent = agent.id === '0' || agent.id === 'main' || 
                       (typeof agent.id === 'number' && agent.id === 0);

    // 绘制主agent的视觉范围
    if (isMainAgent) {
      this.drawVisionRange(graphics, agent.x, agent.y);
    }

    if (isMainAgent) {
      // 主agent - 红色带描边
      graphics.beginFill(0xff5722, 0.9); // 橙红色
      graphics.drawCircle(agent.x, agent.y, agentRadius);
      graphics.endFill();
      
      // 简单的金色边框
      graphics.lineStyle(2, 0xffc107, 1.0);
      graphics.drawCircle(agent.x, agent.y, agentRadius);
      graphics.lineStyle(0);
      
      // 绘制8方向视觉分区线
      this.drawVisionDirections(graphics, agent.x, agent.y, agentRadius);
    } else {
      // 野生agent - 基础蓝色
      let agentColor = 0x2196f3; // 默认蓝色
      let borderColor = 0x1976d2;
      
      // 如果正在朝亮区移动，改变颜色
      if (agentAny.targetDirection !== undefined) {
        agentColor = 0x4caf50; // 绿色表示趋光
        borderColor = 0x388e3c;
      }
      
      graphics.beginFill(agentColor, 0.8);
      graphics.drawCircle(agent.x, agent.y, agentRadius);
      graphics.endFill();
      
      // 边框
      graphics.lineStyle(1, borderColor, 0.9);
      graphics.drawCircle(agent.x, agent.y, agentRadius);
      graphics.lineStyle(0);
      
      // 绘制趋光指示
      if (agentAny.targetDirection !== undefined) {
        this.drawLightSeekingIndicator(graphics, agent.x, agent.y, agentAny.targetDirection, agentRadius);
      }
    }

    // 简单的方向指示（小白点）
    const indicatorX = agent.x + Math.cos(agent.angle) * (agentRadius * 0.6);
    const indicatorY = agent.y + Math.sin(agent.angle) * (agentRadius * 0.6);
    graphics.beginFill(0xffffff, 0.9);
    graphics.drawCircle(indicatorX, indicatorY, 3);
    graphics.endFill();

    // 绘制健康条（如果agent有健康属性）
    if (agentAny.health !== undefined && agentAny.maxHealth !== undefined) {
      this.drawHealthBar(graphics, agent.x, agent.y - agentRadius - 8, agentAny.health, agentAny.maxHealth);
    }

    // 移除速度指示器 - 这是导致多余辅助线的原因
    // 速度指示器在正常情况下不需要显示，三角形方向指示器已经足够表示智能体朝向
    // 如果需要调试速度，可以在特定调试模式下重新启用

    // 设置精灵位置（虽然已在绘制时使用了世界坐标）
    graphics.x = 0;
    graphics.y = 0;
  }

  /**
   * 绘制主agent的视觉范围
   */
  private drawVisionRange(graphics: PIXI.Graphics, x: number, y: number): void {
    const visionRange = 120; // 与LuminousGardenWorld中的范围一致
    
    // 绘制视觉范围圆形
    graphics.lineStyle(1, 0xffffff, 0.3);
    graphics.drawCircle(x, y, visionRange);
    graphics.lineStyle(0);
    
    // 绘制半透明填充
    graphics.beginFill(0xffffff, 0.05);
    graphics.drawCircle(x, y, visionRange);
    graphics.endFill();
  }

  /**
   * 绘制主agent的8方向视觉分区线
   */
  private drawVisionDirections(graphics: PIXI.Graphics, x: number, y: number, agentRadius: number): void {
    const visionRange = 120;
    const directions = [
      0,           // 0度（右）
      Math.PI / 4, // 45度
      Math.PI / 2, // 90度（上）
      3 * Math.PI / 4, // 135度
      Math.PI,     // 180度（左）
      5 * Math.PI / 4, // 225度
      3 * Math.PI / 2, // 270度（下）
      7 * Math.PI / 4  // 315度
    ];

    graphics.lineStyle(1, 0xffeb3b, 0.4); // 黄色分区线
    
    directions.forEach(angle => {
      const endX = x + Math.cos(angle) * visionRange;
      const endY = y + Math.sin(angle) * visionRange;
      
      graphics.moveTo(x, y);
      graphics.lineTo(endX, endY);
    });
    
    graphics.lineStyle(0);
  }

  /**
   * 绘制野生agent的趋光指示
   */
  private drawLightSeekingIndicator(graphics: PIXI.Graphics, x: number, y: number, targetDirection: number, agentRadius: number): void {
    const indicatorLength = agentRadius + 8;
    const endX = x + Math.cos(targetDirection) * indicatorLength;
    const endY = y + Math.sin(targetDirection) * indicatorLength;
    
    // 绘制指向亮区的箭头
    graphics.lineStyle(2, 0xffeb3b, 0.8); // 黄色箭头
    graphics.moveTo(x, y);
    graphics.lineTo(endX, endY);
    
    // 绘制箭头头部
    const arrowSize = 4;
    const arrowAngle1 = targetDirection + Math.PI * 0.8;
    const arrowAngle2 = targetDirection - Math.PI * 0.8;
    
    graphics.moveTo(endX, endY);
    graphics.lineTo(endX + Math.cos(arrowAngle1) * arrowSize, endY + Math.sin(arrowAngle1) * arrowSize);
    graphics.moveTo(endX, endY);
    graphics.lineTo(endX + Math.cos(arrowAngle2) * arrowSize, endY + Math.sin(arrowAngle2) * arrowSize);
    
    graphics.lineStyle(0);
  }

  /**
   * 绘制健康条
   */
  private drawHealthBar(graphics: PIXI.Graphics, x: number, y: number, health: number, maxHealth: number): void {
    const barWidth = 20;
    const barHeight = 4;
    const healthRatio = Math.max(0, health / maxHealth);
    
    // 背景（黑色）
    graphics.beginFill(0x000000, 0.8);
    graphics.drawRect(x - barWidth / 2, y, barWidth, barHeight);
    graphics.endFill();
    
    // 健康条（绿到红渐变）
    let healthColor = 0x4caf50; // 绿色
    if (healthRatio < 0.5) {
      healthColor = healthRatio < 0.25 ? 0xf44336 : 0xff9800; // 红色或橙色
    }
    
    graphics.beginFill(healthColor, 0.9);
    graphics.drawRect(x - barWidth / 2, y, barWidth * healthRatio, barHeight);
    graphics.endFill();
    
    // 边框（白色）
    graphics.lineStyle(1, 0xffffff, 0.8);
    graphics.drawRect(x - barWidth / 2, y, barWidth, barHeight);
    graphics.lineStyle(0);
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
