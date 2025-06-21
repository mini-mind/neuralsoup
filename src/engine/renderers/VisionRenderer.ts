/**
 * 视野渲染器 - 负责渲染视野扇形和战争迷雾
 */

import * as PIXI from 'pixi.js';
import { Agent } from '../../types/simulation';

export class VisionRenderer {
  private visionContainer: PIXI.Container;
  private visionFanGraphics: PIXI.Graphics;
  private fogOfWarEnabled: boolean = false;
  private fogOverlay: PIXI.Graphics;

  constructor(visionContainer: PIXI.Container, fogOverlay: PIXI.Graphics) {
    this.visionContainer = visionContainer;
    this.fogOverlay = fogOverlay;
    
    // 初始化视野扇形的Graphics对象
    this.visionFanGraphics = new PIXI.Graphics();
    this.visionContainer.addChild(this.visionFanGraphics);
  }

  /**
   * 设置战争迷雾效果
   */
  public setFogOfWar(enabled: boolean): void {
    this.fogOfWarEnabled = enabled;
  }

  /**
   * 渲染视野效果
   */
  public render(mainAgent: Agent | undefined, visionRange: number, visionAngle: number, worldWidth: number, worldHeight: number): void {
    // 渲染大范围视野扇形 (透明实线)
    if (mainAgent) {
      this.renderVisionFan(mainAgent, visionRange, visionAngle);
      this.renderFogOfWar(mainAgent, visionRange, visionAngle, worldWidth, worldHeight);
    }
  }

  /**
   * 渲染视野扇形
   */
  private renderVisionFan(mainAgent: Agent, visionRange: number, visionAngle: number): void {
    this.visionFanGraphics.clear();
    this.visionFanGraphics.lineStyle(2, 0xFFFFFF, 0.15); // 透明实线，颜色和透明度可调
    
    const startAngle = mainAgent.angle - visionAngle / 2;
    const endAngle = mainAgent.angle + visionAngle / 2;
    
    // 确保绘制是基于世界坐标的，且跟随主智能体
    this.visionFanGraphics.moveTo(mainAgent.x, mainAgent.y); // 从智能体中心开始
    this.visionFanGraphics.arc(mainAgent.x, mainAgent.y, visionRange, startAngle, endAngle, false);
    this.visionFanGraphics.lineTo(mainAgent.x, mainAgent.y); // 回到智能体中心，形成闭合扇形
    this.visionFanGraphics.endFill(); // endFill也用于闭合路径，即使没有填充
  }

  /**
   * 渲染战争迷雾效果
   */
  private renderFogOfWar(mainAgent: Agent, visionRange: number, visionAngle: number, worldWidth: number, worldHeight: number): void {
    if (!this.fogOfWarEnabled || !mainAgent) {
      this.fogOverlay.clear();
      return;
    }

    this.fogOverlay.clear();

    // 创建整个世界的迷雾覆盖
    this.fogOverlay.beginFill(0x000000, 0.7); // 黑色半透明迷雾
    this.fogOverlay.drawRect(0, 0, worldWidth, worldHeight);
    this.fogOverlay.endFill();

    // 在智能体视野范围内挖出一个洞（无迷雾区域）
    this.fogOverlay.beginHole();
    
    const startAngle = mainAgent.angle - visionAngle / 2;
    const endAngle = mainAgent.angle + visionAngle / 2;
    
    // 绘制视野扇形作为"洞"，创建无迷雾区域
    this.fogOverlay.moveTo(mainAgent.x, mainAgent.y);
    this.fogOverlay.arc(mainAgent.x, mainAgent.y, visionRange, startAngle, endAngle, false);
    this.fogOverlay.lineTo(mainAgent.x, mainAgent.y);
    
    this.fogOverlay.endHole();
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.visionFanGraphics.destroy();
    this.fogOverlay.destroy();
  }
}