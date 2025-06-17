/**
 * 世界渲染器 - 使用PixiJS渲染仿真场景
 */

import * as PIXI from 'pixi.js';
import { World, Agent, Food, Obstacle, VisionCell } from '../types/simulation';

export class WorldRenderer {
  private app: PIXI.Application;
  private worldContainer: PIXI.Container;
  private agentContainer: PIXI.Container;
  private foodContainer: PIXI.Container;
  private obstacleContainer: PIXI.Container;
  private visionContainer: PIXI.Container;
  
  // 对象池
  private agentSprites: Map<number, PIXI.Graphics> = new Map();
  private foodSprites: Map<number, PIXI.Graphics> = new Map();
  private obstacleSprites: Map<number, PIXI.Graphics> = new Map();
  private visionSprites: Map<number, PIXI.Graphics[]> = new Map();
  private visionFanGraphics: PIXI.Graphics; // 重新添加：用于绘制大范围视野扇形
  
  // 镜头跟随参数
  private cameraTarget: Agent | null = null;
  private cameraLerpFactor = 1.0; // 提高响应速度，从0.3改为1.0 (立即跟随，用于调试)

  constructor(app: PIXI.Application) {
    this.app = app;
    this.initializeContainers();
  }

  private initializeContainers(): void {
    // 创建世界容器
    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);
    
    // 创建各层容器
    this.visionContainer = new PIXI.Container();
    this.foodContainer = new PIXI.Container();
    this.obstacleContainer = new PIXI.Container();
    this.agentContainer = new PIXI.Container();
    
    // 重新添加：初始化大范围视野扇形的Graphics对象，并添加到visionContainer
    this.visionFanGraphics = new PIXI.Graphics();
    this.visionContainer.addChild(this.visionFanGraphics);

    // 按层级顺序添加（视野在最底层）
    this.worldContainer.addChild(this.visionContainer);
    this.worldContainer.addChild(this.foodContainer);
    this.worldContainer.addChild(this.obstacleContainer);
    this.worldContainer.addChild(this.agentContainer);
  }

  setCameraTarget(agent: Agent | null): void {
    this.cameraTarget = agent;
    
    // 如果设置了新目标，立即定位镜头到目标位置
    if (agent) {
      const screenWidth = this.app.screen.width;
      const screenHeight = this.app.screen.height;
      
      // 将世界容器的中心（pivot）设置到智能体的位置
      this.worldContainer.pivot.set(agent.x, agent.y);
      
      // 将世界容器的左上角设置到屏幕中心，这样pivot点（智能体）就显示在屏幕中心
      this.worldContainer.x = screenWidth / 2;
      this.worldContainer.y = screenHeight / 2;
      
      // 立即设置旋转，使智能体朝向屏幕上方
      this.worldContainer.rotation = -agent.angle - Math.PI / 2; 
    }
  }

  renderWorld(world: World): void {
    // 更新镜头位置
    this.updateCamera();

    // 渲染大范围视野扇形 (透明实线)
    const mainAgent = world.agents.find(agent => agent.controlType === 'snn');
    if (mainAgent) {
      this.visionFanGraphics.clear();
      this.visionFanGraphics.lineStyle(2, 0xFFFFFF, 0.15); // 透明实线，颜色和透明度可调 (更透明)
      
      const startAngle = mainAgent.angle - world.visionAngle / 2;
      const endAngle = mainAgent.angle + world.visionAngle / 2;
      
      // 确保绘制是基于世界坐标的，且跟随主智能体
      this.visionFanGraphics.moveTo(mainAgent.x, mainAgent.y); // 从智能体中心开始
      this.visionFanGraphics.arc(mainAgent.x, mainAgent.y, world.visionRange, startAngle, endAngle, false);
      this.visionFanGraphics.lineTo(mainAgent.x, mainAgent.y); // 回到智能体中心，形成闭合扇形
      this.visionFanGraphics.endFill(); // endFill也用于闭合路径，即使没有填充
    }
    
    // 渲染各个元素
    this.renderAgents(world.agents, world.visionAngle);
    this.renderFoods(world.foods);
    this.renderObstacles(world.obstacles);
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
    // PixiJS 0度是右，顺时针为正。智能体角度0度是右，逆时针为正。
    // 因此，需要将智能体角度取反，并加上90度（Math.PI/2）的偏移量。
    let targetRotation = -this.cameraTarget.angle - Math.PI / 2;

    // 平滑插值旋转 (处理角度的周期性)
    let shortestAngle = (targetRotation - this.worldContainer.rotation + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    this.worldContainer.rotation += shortestAngle * this.cameraLerpFactor;

    // 将世界容器固定在屏幕中心。其pivot点（即智能体）将显示在屏幕中心。
    this.worldContainer.x = screenWidth / 2;
    this.worldContainer.y = screenHeight / 2;

    // 调试日志
    if (this.app.ticker.count % 60 === 0) { // 大约每秒一次
      console.log('Camera Update Debug:', {
        targetAgentPos: { x: this.cameraTarget.x, y: this.cameraTarget.y },
        worldContainerPivot: { x: this.worldContainer.pivot.x, y: this.worldContainer.pivot.y },
        worldContainerPos: { x: this.worldContainer.x, y: this.worldContainer.y },
        worldContainerRotation: this.worldContainer.rotation,
        targetRotation: targetRotation,
        screenWidth: screenWidth,
        screenHeight: screenHeight
      });
    }
  }

  private renderAgents(agents: Agent[], visionAngle: number): void {
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

  private drawAgent(graphics: PIXI.Graphics, agent: Agent, visionAngle: number): void {
    graphics.clear();
    
    // 智能体基础颜色（蓝色）- 简化颜色计算
    let agentColor = 0x3498DB; // 基础蓝色
    
    // 根据情绪状态微调颜色（可选）
    if (agent.pleasure > 0.1) {
      agentColor = 0x52C4F0; // 稍微亮一点的蓝色（愉悦时）
    }
    if (agent.arousal > 0.7) {
      agentColor = 0x2E86AB; // 稍微深一点的蓝色（高唤醒时）
    }
    
    // 绘制智能体身体 - 增大尺寸
    graphics.beginFill(agentColor, 0.9);
    graphics.drawCircle(0, 0, 15); // 从10增加到15
    graphics.endFill();
    
    // 绘制朝向指示器 - 根据智能体的实际角度绘制
    graphics.lineStyle(3, 0xFFFFFF, 0.9);
    graphics.moveTo(0, 0);
    
    // 对于主控智能体，朝向指示器始终朝上（因为世界会旋转）
    // 对于其他智能体，需要计算相对于主控智能体的朝向
    if (agent.controlType === 'snn') {
      // 主控智能体始终朝上
      graphics.lineTo(0, -20);
    } else {
      // 其他智能体显示相对于世界坐标系的朝向
      // 由于世界容器会旋转，需要抵消这个旋转来显示正确的朝向
      const adjustedAngle = agent.angle + this.worldContainer.rotation;
      graphics.lineTo(Math.cos(adjustedAngle) * 20, Math.sin(adjustedAngle) * 20);
    }
    graphics.lineStyle(0); // 重置线条样式
    
    // 如果是主控智能体，添加特殊标记
    if (agent.controlType === 'snn') {
      graphics.lineStyle(3, 0xFFD700, 1.0); // 金色边框，更粗更明显
      graphics.drawCircle(0, 0, 18); // 稍微大一点的边框
      graphics.lineStyle(0); // 重置线条样式
      
      // 添加额外的内圈标识
      graphics.lineStyle(1, 0xFFFFFF, 0.6);
      graphics.drawCircle(0, 0, 12);
      graphics.lineStyle(0);
    }
    
    // 绘制主控智能体的环绕式视野格子
    if (agent.controlType === 'snn' && agent.visionCells && agent.visionCells.length > 0) {
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
    
    // 设置位置
    graphics.position.set(agent.x, agent.y);
    // 智能体精灵的旋转应抵消世界容器的旋转，使其在屏幕上看起来始终朝上
    // 智能体本身的朝向由其内部的指示器绘制，而不是通过旋转整个精灵来表示
    graphics.rotation = -this.worldContainer.rotation; // 将精灵自身旋转设置为抵消世界容器的旋转

    // 调试日志：仅对主智能体打印其全局位置
    if (agent.controlType === 'snn' && this.app.ticker.count % 60 === 0) {
      const globalPos = graphics.getGlobalPosition();
      console.log('Main Agent Global Position:', { id: agent.id, x: globalPos.x, y: globalPos.y });
    }
  }

  private renderFoods(foods: Food[]): void {
    // 清理不存在的食物精灵
    for (const [id, sprite] of this.foodSprites) {
      if (!foods.find(food => food.id === id)) {
        this.foodContainer.removeChild(sprite);
        this.foodSprites.delete(id);
      }
    }

    // 渲染每个食物
    for (const food of foods) {
      let sprite = this.foodSprites.get(food.id);
      
      if (!sprite) {
        sprite = new PIXI.Graphics();
        this.foodContainer.addChild(sprite);
        this.foodSprites.set(food.id, sprite);
      }
      
      this.drawFood(sprite, food);
    }
  }

  private drawFood(graphics: PIXI.Graphics, food: Food): void {
    graphics.clear();
    graphics.beginFill(0x00FF00); // 绿色
    graphics.drawCircle(0, 0, food.radius);
    graphics.endFill();
    
    // 添加光泽效果
    graphics.beginFill(0x88FF88, 0.6);
    graphics.drawCircle(-2, -2, food.radius * 0.4);
    graphics.endFill();
    
    graphics.position.set(food.x, food.y);
  }

  private renderObstacles(obstacles: Obstacle[]): void {
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

  private drawObstacle(graphics: PIXI.Graphics, obstacle: Obstacle): void {
    graphics.clear();
    
    // 障碍物为黑色
    const color = 0x000000;
    
    graphics.beginFill(color);
    // 绘制方形障碍物，中心点在 (0,0)，尺寸为 obstacle.radius * 2
    graphics.drawRect(-obstacle.radius, -obstacle.radius, obstacle.radius * 2, obstacle.radius * 2);
    graphics.endFill();
    
    // 移除移动障碍物相关的渲染（例如运动指示）
    // if (obstacle.isMoving && obstacle.velocity) {
    //   graphics.lineStyle(2, 0x666666);
    //   const speed = Math.sqrt(obstacle.velocity.x ** 2 + obstacle.velocity.y ** 2);
    //   if (speed > 0) {
    //     graphics.moveTo(0, 0);
    //     graphics.lineTo(obstacle.velocity.x * 50, obstacle.velocity.y * 50);
    //   }
    // }
    
    graphics.position.set(obstacle.x, obstacle.y);
  }

  destroy(): void {
    // 清理所有容器和精灵
    this.agentSprites.clear();
    this.foodSprites.clear();
    this.obstacleSprites.clear();
    this.visionSprites.clear();
    
    if (this.worldContainer) {
      this.app.stage.removeChild(this.worldContainer);
      this.worldContainer.destroy({ children: true });
    }
  }
} 