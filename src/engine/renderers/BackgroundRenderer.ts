/**
 * 背景渲染器 - 处理海洋噪声背景
 */

import * as PIXI from 'pixi.js';

export class BackgroundRenderer {
  private backgroundNoise!: PIXI.Graphics;
  private noiseGenerated: boolean = false;
  private worldWidth: number = 3000;
  private worldHeight: number = 3000;

  constructor(private container: PIXI.Container) {
    this.initializeBackground();
  }

  private initializeBackground(): void {
    this.backgroundNoise = new PIXI.Graphics();
    this.container.addChild(this.backgroundNoise);
  }

  /**
   * 生成海洋噪声背景
   */
  generateOceanNoise(): void {
    if (this.noiseGenerated) return;

    this.backgroundNoise.clear();
    
    // 绘制基础海洋颜色
    this.backgroundNoise.beginFill(0x1e3a8a, 0.3);
    this.backgroundNoise.drawRect(-this.worldWidth, -this.worldHeight, this.worldWidth * 2, this.worldHeight * 2);
    this.backgroundNoise.endFill();

    // 添加噪声纹理
    const noiseCount = 800;
    for (let i = 0; i < noiseCount; i++) {
      const x = (Math.random() - 0.5) * this.worldWidth * 2;
      const y = (Math.random() - 0.5) * this.worldHeight * 2;
      const size = Math.random() * 3 + 1;
      const alpha = Math.random() * 0.15 + 0.05;
      
      // 使用不同深度的蓝色
      const blueVariations = [0x2563eb, 0x1d4ed8, 0x1e40af, 0x1e3a8a];
      const color = blueVariations[Math.floor(Math.random() * blueVariations.length)];
      
      this.backgroundNoise.beginFill(color, alpha);
      this.backgroundNoise.drawCircle(x, y, size);
      this.backgroundNoise.endFill();
    }

    // 添加更大的波浪纹理
    const waveCount = 150;
    for (let i = 0; i < waveCount; i++) {
      const x = (Math.random() - 0.5) * this.worldWidth * 2;
      const y = (Math.random() - 0.5) * this.worldHeight * 2;
      const width = Math.random() * 15 + 5;
      const height = Math.random() * 3 + 1;
      const alpha = Math.random() * 0.1 + 0.02;
      
      this.backgroundNoise.beginFill(0x3b82f6, alpha);
      this.backgroundNoise.drawEllipse(x, y, width, height);
      this.backgroundNoise.endFill();
    }

    this.noiseGenerated = true;
  }

  /**
   * 设置世界尺寸
   */
  setWorldDimensions(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
    this.noiseGenerated = false;
  }

  /**
   * 重新生成噪声
   */
  regenerateNoise(): void {
    this.noiseGenerated = false;
    this.generateOceanNoise();
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    if (this.backgroundNoise && this.backgroundNoise.parent) {
      this.backgroundNoise.parent.removeChild(this.backgroundNoise);
    }
    this.backgroundNoise?.destroy();
  }
} 