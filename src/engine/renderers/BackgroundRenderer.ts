/**
 * 背景渲染器 - 负责渲染网格表格式背景
 */

import * as PIXI from 'pixi.js';

export class BackgroundRenderer {
  private backgroundContainer: PIXI.Container;
  private backgroundGrid: PIXI.Graphics;
  private gridGenerated: boolean = false;
  private worldWidth: number = 3000;
  private worldHeight: number = 3000;

  constructor(backgroundContainer: PIXI.Container) {
    this.backgroundContainer = backgroundContainer;
    this.backgroundGrid = new PIXI.Graphics();
    this.backgroundContainer.addChild(this.backgroundGrid);
  }

  /**
   * 设置世界尺寸
   */
  public setWorldDimensions(width: number, height: number): void {
    if (this.worldWidth !== width || this.worldHeight !== height) {
      this.worldWidth = width;
      this.worldHeight = height;
      this.gridGenerated = false; // 标记需要重新生成
    }
  }

  /**
   * 渲染背景
   */
  public render(): void {
    this.generateGridBackground();
  }

  /**
   * 生成网格表格式背景
   */
  private generateGridBackground(): void {
    if (this.gridGenerated) return;

    this.backgroundGrid.clear();
    
    // 网格参数
    const gridSize = 40; // 网格单元大小，更小的格子
    const lineWidth = 1; // 网格线宽度
    const lineColor = 0x4A90E2; // 中等蓝色网格线
    const lineAlpha = 0.2; // 网格线透明度，更淡一些
    
    // 基础背景色 - 天空蓝
    const baseColor = 0x87CEEB;
    
    // 先填充基础背景
    this.backgroundGrid.beginFill(baseColor, 1.0);
    this.backgroundGrid.drawRect(0, 0, this.worldWidth, this.worldHeight);
    this.backgroundGrid.endFill();
    
    // 绘制网格线条
    this.backgroundGrid.lineStyle(lineWidth, lineColor, lineAlpha);
    
    // 绘制垂直网格线
    for (let x = 0; x <= this.worldWidth; x += gridSize) {
      this.backgroundGrid.moveTo(x, 0);
      this.backgroundGrid.lineTo(x, this.worldHeight);
    }
    
    // 绘制水平网格线
    for (let y = 0; y <= this.worldHeight; y += gridSize) {
      this.backgroundGrid.moveTo(0, y);
      this.backgroundGrid.lineTo(this.worldWidth, y);
    }
    
    // 添加细微的色彩变化，让每个网格格子略有不同
    const colsCount = Math.ceil(this.worldWidth / gridSize);
    const rowsCount = Math.ceil(this.worldHeight / gridSize);
    
    for (let col = 0; col < colsCount; col++) {
      for (let row = 0; row < rowsCount; row++) {
        const x = col * gridSize;
        const y = row * gridSize;
        
        // 生成极细微的颜色变化，创造表格纹理效果
        const variation = (Math.sin((col + row) * 0.5) + 1) * 3; // 0-6的细微变化
        const cellColor = baseColor + Math.floor(variation) * 0x020202; // 非常轻微的RGB调整
        
        // 以极低的透明度填充格子，创造表格纹理
        this.backgroundGrid.beginFill(cellColor, 0.05);
        this.backgroundGrid.drawRect(x, y, gridSize, gridSize);
        this.backgroundGrid.endFill();
      }
    }
    
    this.gridGenerated = true;
    console.log(`网格背景已生成: ${colsCount} × ${rowsCount} 网格`);
  }

  /**
   * 强制重新生成网格
   */
  public regenerateNoise(): void {
    this.gridGenerated = false;
    this.generateGridBackground();
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    this.backgroundGrid.destroy();
  }
} 