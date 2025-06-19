/**
 * 重构后的仿真引擎核心类
 * 基于PixiJS的浮游生物智能体仿真系统
 * 使用模块化组件管理不同功能
 */

import * as PIXI from 'pixi.js';
import { Agent, Food, Obstacle, SimulationState } from '../types/simulation';
import { WorldRenderer } from './WorldRenderer';
import { VisionSystem } from './VisionSystem';
import { AgentController } from './AgentController';
import { WorldManager } from './WorldManager';
import { CollisionDetector } from './CollisionDetector';

export class SimulationEngineRefactored {
  // 核心系统
  private app: PIXI.Application;
  private renderer: WorldRenderer;
  private visionSystem: VisionSystem;
  private agentController: AgentController;
  private worldManager: WorldManager;
  private collisionDetector: CollisionDetector;
  
  // 运行状态
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private gameLoopRunning: boolean = false;
  private lastTime: number = 0;
  private fps: number = 0;
  private simulationTime: number = 0;
  private frameCount: number = 0;
  
  // 游戏实体
  private agents: Agent[] = [];
  private foods: Food[] = [];
  private obstacles: Obstacle[] = [];
  
  // 主控智能体ID
  private mainAgentId: number = 0;
  
  // 统计数据
  private stats = {
    totalRewards: 0,
    totalCollisions: 0,
    averageEmotionState: { pleasure: 0, arousal: 0 }
  };

  // 回调函数
  public onStatsUpdate?: (stats: any) => void;

  constructor(app: PIXI.Application, initialWidth: number = 1600, initialHeight: number = 1200) {
    this.app = app;
    
    // 初始化各个系统
    this.renderer = new WorldRenderer(app);
    this.visionSystem = new VisionSystem();
    this.agentController = new AgentController();
    this.worldManager = new WorldManager(initialWidth, initialHeight);
    this.collisionDetector = new CollisionDetector();
  }

  /**
   * 更新世界尺寸
   */
  public updateWorldDimensions(newWidth: number, newHeight: number): void {
    this.worldManager.updateDimensions(newWidth, newHeight);
  }

  /**
   * 设置脚本代码
   */
  public setScriptCode(code: string): void {
    this.agentController.setScriptCode(code);
  }

  /**
   * 设置脚本模式下是否启用玩家输入
   */
  public setEnablePlayerInputInScript(enable: boolean): void {
    this.agentController.setEnablePlayerInputInScript(enable);
  }

  /**
   * 初始化仿真系统
   */
  initialize(): void {
    console.log('初始化重构版仿真系统...');
    
    // 设置渲染器的世界尺寸
    this.renderer.setWorldDimensions(this.worldManager.width, this.worldManager.height);
    
    // 创建游戏世界
    this.agents = this.worldManager.createAgents();
    this.foods = this.worldManager.generateFood(this.agents);
    this.obstacles = this.worldManager.generateObstacles();
    
    // 初始化智能体
    for (const agent of this.agents) {
      this.visionSystem.initializeVisionCells(agent);
      
      // 为SNN控制的智能体创建神经网络
      if (agent.controlType === 'snn') {
        this.agentController.createCorticalColumn(agent.id);
        console.log('Created SNN agent:', agent.id, 'at position:', agent.x, agent.y);
      }
    }
    
    // 设置镜头跟随主智能体
    const mainAgent = this.getMainAgent();
    if (mainAgent) {
      this.setCameraTarget(mainAgent);
    }
    
    this.renderWorld();
    console.log(`重构版仿真系统初始化完成: ${this.agents.length}个智能体`);
  }

  /**
   * 启动仿真
   */
  start(): void {
    console.log('启动重构版仿真...');
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    if (!this.gameLoopRunning) {
      this.gameLoopRunning = true;
      this.gameLoop();
    }
  }

  /**
   * 暂停仿真
   */
  pause(): void {
    console.log('暂停仿真...');
    this.isPaused = true;
  }

  /**
   * 恢复仿真
   */
  resume(): void {
    console.log('恢复仿真...');
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  /**
   * 停止仿真
   */
  stop(): void {
    console.log('停止仿真...');
    this.isRunning = false;
    this.isPaused = false;
    this.gameLoopRunning = false;
  }

  /**
   * 重置仿真
   */
  reset(): void {
    this.stop();
    this.simulationTime = 0;
    this.frameCount = 0;
    this.stats = {
      totalRewards: 0,
      totalCollisions: 0,
      averageEmotionState: { pleasure: 0, arousal: 0 }
    };
    
    this.agents = [];
    this.foods = [];
    this.obstacles = [];
    this.initialize();
  }

  /**
   * 游戏主循环
   */
  private gameLoop = (): void => {
    if (!this.gameLoopRunning) return;

    const currentTime = performance.now();
    
    if (this.isRunning && !this.isPaused) {
      const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.033);
      this.lastTime = currentTime;
      
      this.updateSimulation(deltaTime);
      this.simulationTime += deltaTime;
      this.frameCount++;
      
      if (this.frameCount % 60 === 0) {
        this.fps = Math.round(1 / deltaTime);
      }
    } else if (this.isPaused) {
      this.lastTime = currentTime;
    }

    // 始终进行渲染
    this.renderWorld();
    requestAnimationFrame(this.gameLoop);
  };

  /**
   * 更新仿真状态
   */
  private updateSimulation(deltaTime: number): void {
    // 更新智能体
    for (const agent of this.agents) {
      // 更新视觉系统
      this.visionSystem.updateVisionCells(agent, this.agents, this.foods, this.obstacles);
      
      // 更新智能体控制
      this.agentController.updateAgent(agent, deltaTime);
      
      // 处理边界碰撞
      this.worldManager.handleBoundaryCollision(agent);
    }

    // 更新移动障碍物
    this.worldManager.updateMovingObstacles(this.obstacles, deltaTime);

    // 处理碰撞
    const collisionResult = this.collisionDetector.handleCollisions(this.agents, this.foods, this.obstacles);
    
    // 移除被吃掉的食物
    this.foods = this.collisionDetector.removeFoods(this.foods, collisionResult.foodsToRemove);
    
    // 更新统计数据
    this.stats.totalRewards += collisionResult.totalRewards;
    this.stats.totalCollisions += collisionResult.totalCollisions;
    this.updateStats();
  }

  /**
   * 渲染世界
   */
  private renderWorld(): void {
    this.renderer.renderWorld({
      width: this.worldManager.width,
      height: this.worldManager.height,
      wallThickness: 0,
      agents: this.agents,
      foods: this.foods,
      obstacles: this.obstacles,
      visionRange: this.visionSystem.visionRange,
      visionAngle: this.visionSystem.visionAngle
    });
  }

  /**
   * 更新统计数据
   */
  private updateStats(): void {
    let totalPleasure = 0;
    let totalArousal = 0;
    
    for (const agent of this.agents) {
      totalPleasure += agent.pleasure;
      totalArousal += agent.arousal;
    }
    
    this.stats.averageEmotionState = {
      pleasure: this.agents.length > 0 ? totalPleasure / this.agents.length : 0,
      arousal: this.agents.length > 0 ? totalArousal / this.agents.length : 0
    };

    // 触发统计更新回调
    if (this.onStatsUpdate) {
      this.onStatsUpdate({
        fps: this.fps,
        totalReward: this.stats.totalRewards,
        collisionCount: this.stats.totalCollisions,
        emotionState: this.stats.averageEmotionState
      });
    }
  }

  /**
   * 获取主智能体
   */
  getMainAgent(): Agent | null {
    return this.agents.find(agent => agent.id === this.mainAgentId) || null;
  }

  /**
   * 设置镜头跟随目标
   */
  setCameraTarget(agent: Agent | null): void {
    this.renderer.setCameraTarget(agent);
  }

  /**
   * 获取仿真状态
   */
  getState(): SimulationState {
    return {
      agents: this.agents,
      foods: this.foods,
      obstacles: this.obstacles,
      worldBounds: {
        x: 0,
        y: 0,
        width: this.worldManager.width,
        height: this.worldManager.height
      },
      stats: {
        fps: this.fps,
        totalReward: this.stats.totalRewards,
        collisionCount: this.stats.totalCollisions,
        emotionState: this.stats.averageEmotionState
      }
    };
  }

  /**
   * 设置控制模式
   */
  public setControlMode(newMode: 'snn' | 'random' | 'keyboard' | 'script'): void {
    const mainAgent = this.getMainAgent();
    if (mainAgent) {
      mainAgent.controlType = newMode;
      console.log(`Control mode changed to: ${newMode}`);
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stop();
    this.agentController.destroy();
    this.renderer.destroy();
  }
} 