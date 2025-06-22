/**
 * 视野渲染器 - 负责渲染视野扇形和战争迷雾
 */

import * as PIXI from "pixi.js";
import { Agent } from "../../types/simulation";

export class VisionRenderer {
  private visionContainer: PIXI.Container;
  private visionFanGraphics: PIXI.Graphics;
  private fogOfWarEnabled: boolean = false;
  private fogOverlay: PIXI.Graphics;
  private app: PIXI.Application;

  constructor(
    visionContainer: PIXI.Container,
    fogOverlay: PIXI.Graphics,
    app: PIXI.Application,
  ) {
    this.visionContainer = visionContainer;
    this.fogOverlay = fogOverlay;
    this.app = app;

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
  public render(
    mainAgent: Agent | undefined,
    visionRange: number,
    visionAngle: number,
    worldWidth: number,
    worldHeight: number,
  ): void {
    // 清理之前的渲染内容
    this.visionFanGraphics.clear();
    this.fogOverlay.clear();

    // 渲染大范围视野扇形 (透明实线)
    if (mainAgent) {
      this.renderVisionFan(mainAgent, visionRange, visionAngle);
      this.renderFogOfWar(mainAgent, visionRange, visionAngle);
    }
  }

  /**
   * 渲染视野扇形
   */
  private renderVisionFan(
    mainAgent: Agent,
    visionRange: number,
    visionAngle: number,
  ): void {
    this.visionFanGraphics.lineStyle(2, 0xffffff, 0.15); // 透明实线，颜色和透明度可调

    const startAngle = mainAgent.angle - visionAngle / 2;
    const endAngle = mainAgent.angle + visionAngle / 2;

    // 确保绘制是基于世界坐标的，且跟随主智能体
    this.visionFanGraphics.moveTo(mainAgent.x, mainAgent.y); // 从智能体中心开始
    this.visionFanGraphics.arc(
      mainAgent.x,
      mainAgent.y,
      visionRange,
      startAngle,
      endAngle,
      false,
    );
    this.visionFanGraphics.lineTo(mainAgent.x, mainAgent.y); // 回到智能体中心，形成闭合扇形
    this.visionFanGraphics.endFill(); // endFill也用于闭合路径，即使没有填充
  }

  /**
   * 渲染战争迷雾效果 - 覆盖整个屏幕，在视野范围内挖洞
   */
  private renderFogOfWar(
    mainAgent: Agent,
    visionRange: number,
    visionAngle: number,
  ): void {
    if (!this.fogOfWarEnabled || !mainAgent) {
      return;
    }

    // 获取屏幕尺寸
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // 战争迷雾现在在stage坐标系中，直接覆盖整个屏幕
    this.fogOverlay.beginFill(0x000000, 0.8); // 黑色半透明迷雾
    this.fogOverlay.drawRect(0, 0, screenWidth, screenHeight);
    this.fogOverlay.endFill();

    // 计算agent在屏幕坐标系中的位置
    // 由于worldContainer有变换，需要将世界坐标转换为屏幕坐标
    const worldContainer = this.app.stage.children.find(
      (child) => child !== this.fogOverlay,
    ) as PIXI.Container;
    if (worldContainer) {
      const worldPoint = new PIXI.Point(mainAgent.x, mainAgent.y);
      const screenPoint = worldContainer.toGlobal(worldPoint);

      // 计算视野在屏幕坐标系中的方向
      // 由于世界旋转了，需要计算实际的视野方向
      const worldRotation = worldContainer.rotation;
      const actualStartAngle =
        mainAgent.angle - visionAngle / 2 + worldRotation;
      const actualEndAngle = mainAgent.angle + visionAngle / 2 + worldRotation;

      // 计算视野范围在屏幕坐标系中的实际大小
      const screenScale = worldContainer.scale.x; // 假设x和y缩放相同
      const screenVisionRange = visionRange * screenScale;

      // 在智能体视野范围内挖出一个洞（无迷雾区域）
      this.fogOverlay.beginHole();

      // 绘制视野扇形作为"洞"，在屏幕坐标系中
      this.fogOverlay.moveTo(screenPoint.x, screenPoint.y);
      this.fogOverlay.arc(
        screenPoint.x,
        screenPoint.y,
        screenVisionRange,
        actualStartAngle,
        actualEndAngle,
        false,
      );
      this.fogOverlay.lineTo(screenPoint.x, screenPoint.y);

      this.fogOverlay.endHole();
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.visionFanGraphics.destroy();
    this.fogOverlay.destroy();
  }
}
