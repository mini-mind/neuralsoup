/**
 * 世界渲染器 - 使用PixiJS渲染仿真场景
 * 重构为使用模块化渲染器组件
 */

import * as PIXI from 'pixi.js';
import { World, Agent } from '../types/simulation';
import { BackgroundRenderer } from './renderers/BackgroundRenderer';
import { AgentRenderer } from './renderers/AgentRenderer';
import { FoodRenderer } from './renderers/FoodRenderer';
import { ObstacleRenderer } from './renderers/ObstacleRenderer';
import { VisionRenderer } from './renderers/VisionRenderer';

export class WorldRenderer {
  private app: PIXI.Application;
  private worldContainer!: PIXI.Container;
  private backgroundContainer!: PIXI.Container;
  private agentContainer!: PIXI.Container;
  private foodContainer!: PIXI.Container;
  private obstacleContainer!: PIXI.Container;
  private visionContainer!: PIXI.Container;
  private fogOverlay!: PIXI.Graphics;
  
  // 模块化渲染器
  private backgroundRenderer!: BackgroundRenderer;
  private agentRenderer!: AgentRenderer;
  private foodRenderer!: FoodRenderer;
  private obstacleRenderer!: ObstacleRenderer;
  private visionRenderer!: VisionRenderer;
  
  // 镜头跟随参数
  private cameraTarget: Agent | null = null;
  private cameraLerpFactor = 1.0;
  
  // 世界尺寸
  private worldWidth: number = 3000;
  private worldHeight: number = 3000;
  
  // 移动端缩放
  private mobileScale: number = 1.0;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.initializeContainers();
    this.initializeRenderers();
  }

  private initializeContainers(): void {
    // 创建世界容器
    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);
    
    // 创建各层容器
    this.backgroundContainer = new PIXI.Container();
    this.visionContainer = new PIXI.Container();
    this.foodContainer = new PIXI.Container();
    this.obstacleContainer = new PIXI.Container();
    this.agentContainer = new PIXI.Container();
    
    // 战争迷雾层放在stage顶层，不受世界变换影响
    this.fogOverlay = new PIXI.Graphics();

    // 按层级顺序添加到世界容器
    this.worldContainer.addChild(this.backgroundContainer);
    this.worldContainer.addChild(this.visionContainer);
    this.worldContainer.addChild(this.foodContainer);
    this.worldContainer.addChild(this.obstacleContainer);
    this.worldContainer.addChild(this.agentContainer);
    
    // 将战争迷雾层添加到stage顶层
    this.app.stage.addChild(this.fogOverlay);
  }

  private initializeRenderers(): void {
    this.backgroundRenderer = new BackgroundRenderer(this.backgroundContainer);
    this.agentRenderer = new AgentRenderer(this.agentContainer);
    this.foodRenderer = new FoodRenderer(this.foodContainer);
    this.obstacleRenderer = new ObstacleRenderer(this.obstacleContainer);
    this.visionRenderer = new VisionRenderer(this.visionContainer, this.fogOverlay, this.app);
  }

  public setCameraTarget(agent: Agent | null): void {
    this.cameraTarget = agent;
    
    if (agent) {
      const screenWidth = this.app.screen.width;
      const screenHeight = this.app.screen.height;
      
      this.worldContainer.pivot.set(agent.x, agent.y);
      this.worldContainer.x = screenWidth / 2;
      this.worldContainer.y = screenHeight / 2;
      this.worldContainer.rotation = -agent.angle - Math.PI / 2; 
      this.worldContainer.scale.set(this.mobileScale);
    }
  }

  public setMobileScale(scale: number): void {
    this.mobileScale = scale;
    this.worldContainer.scale.set(scale);
    console.log('Applied mobile scale to world container:', scale);
  }

  public renderWorld(world: World): void {
    // 渲染背景
    this.backgroundRenderer.render();
    
    // 更新镜头位置
    this.updateCamera();

    // 渲染各个元素
    const mainAgent = world.agents.find(agent => agent.id === 0);
    this.visionRenderer.render(mainAgent, world.visionRange, world.visionAngle, this.worldWidth, this.worldHeight);
    this.agentRenderer.render(world.agents, world.visionAngle);
    this.foodRenderer.render(world.foods);
    this.obstacleRenderer.render(world.obstacles);
  }

  private updateCamera(): void {
    if (!this.cameraTarget) return;

    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // 目标pivot点 (智能体的世界坐标)
    const targetPivotX = this.cameraTarget.x;
    const targetPivotY = this.cameraTarget.y;

    // 平滑插值pivot点
    this.worldContainer.pivot.x += (targetPivotX - this.worldContainer.pivot.x) * this.cameraLerpFactor;
    this.worldContainer.pivot.y += (targetPivotY - this.worldContainer.pivot.y) * this.cameraLerpFactor;

    // 目标旋转角度，使智能体朝向屏幕上方
    let targetRotation = -this.cameraTarget.angle - Math.PI / 2;

    // 平滑插值旋转 (处理角度的周期性)
    let shortestAngle = (targetRotation - this.worldContainer.rotation + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    this.worldContainer.rotation += shortestAngle * this.cameraLerpFactor;

    // 将世界容器固定在屏幕中心，保持移动端缩放
    this.worldContainer.x = screenWidth / 2;
    this.worldContainer.y = screenHeight / 2;
    this.worldContainer.scale.set(this.mobileScale);
  }

  public setWorldDimensions(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
    this.backgroundRenderer.setWorldDimensions(width, height);
  }

  public setFogOfWar(enabled: boolean): void {
    this.visionRenderer.setFogOfWar(enabled);
  }

  public regenerateNoise(): void {
    this.backgroundRenderer.regenerateNoise();
  }

  public destroy(): void {
    // 添加空指针检查，防止重复销毁
    if (this.backgroundRenderer) {
      this.backgroundRenderer.destroy();
      this.backgroundRenderer = null as any;
    }
    if (this.agentRenderer) {
      this.agentRenderer.destroy();
      this.agentRenderer = null as any;
    }
    if (this.foodRenderer) {
      this.foodRenderer.destroy();
      this.foodRenderer = null as any;
    }
    if (this.obstacleRenderer) {
      this.obstacleRenderer.destroy();
      this.obstacleRenderer = null as any;
    }
    if (this.visionRenderer) {
      this.visionRenderer.destroy();
      this.visionRenderer = null as any;
    }
    
    if (this.worldContainer && this.app.stage) {
      this.app.stage.removeChild(this.worldContainer);
      this.worldContainer.destroy({ children: true });
      this.worldContainer = null as any;
    }
    
    // 清理stage上的战争迷雾层
    if (this.fogOverlay && this.app.stage) {
      this.app.stage.removeChild(this.fogOverlay);
      this.fogOverlay.destroy();
      this.fogOverlay = null as any;
    }
  }
} 