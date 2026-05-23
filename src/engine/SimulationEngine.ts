/**
 * 仿真引擎核心类 - 重构版本
 * 基于PixiJS的浮游生物智能体仿真系统
 * 使用模块化组件管理不同功能
 */

import * as PIXI from './pixi';
import type { SimulationState } from '../types/simulation';
import { WorldRenderer } from './WorldRenderer';
import { VisionSystem } from './VisionSystem';
import { AgentController } from './AgentController';
import { WorldManager } from './WorldManager';
import { CollisionDetector } from './CollisionDetector';
import { SimulationSession } from '../runtime/SimulationSession';
import { type SimulationControlMode } from '../domain/world';
import type { AgentIR } from '../domain/brain';
import type { AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from '../types/agentRuntime';
import {
  VISION_ACTION_HOST_PROFILE,
  type HostRuntimeProfile,
} from '../host';

export type SimulationLifecycleState = 'idle' | 'running' | 'paused';

export class SimulationEngine {
  // 核心系统
  private renderer: WorldRenderer;
  private visionSystem: VisionSystem;
  private agentController: AgentController;
  private worldManager: WorldManager;
  private collisionDetector: CollisionDetector;
  private session: SimulationSession;
  
  // 运行状态
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private gameLoopRunning: boolean = false;
  private lastTime: number = 0;
  private fps: number = 0;
  private simulationTime: number = 0;
  private frameCount: number = 0;
  private keyboardInputState = {
    turnLeft: false,
    moveForward: false,
    turnRight: false
  };
  
  // 主控智能体ID
  private readonly mainAgentId: number = 0;
  private currentControlMode: SimulationControlMode = 'keyboard';

  // 回调函数
  public onStatsUpdate?: (stats: SimulationState['stats']) => void;
  public onLifecycleChange?: (state: SimulationLifecycleState) => void;
  public onAgentRuntimeStatusChange?: (status: AgentRuntimeStatus) => void;
  public onAgentRuntimeActivityChange?: (snapshot: AgentRuntimeActivitySnapshot) => void;

  constructor(
    app: PIXI.Application,
    hostProfile: HostRuntimeProfile = VISION_ACTION_HOST_PROFILE,
    initialWidth: number = 1600,
    initialHeight: number = 1200
  ) {
    // 初始化各个系统
    this.renderer = new WorldRenderer(app);
    this.visionSystem = new VisionSystem();
    this.agentController = new AgentController(
      hostProfile.createOutputAdapter(),
      hostProfile.createInputSignalProvider(),
      hostProfile.createCommandApplier(),
      hostProfile.movementBindings
    );
    this.worldManager = new WorldManager(initialWidth, initialHeight);
    this.collisionDetector = new CollisionDetector();
    this.session = new SimulationSession(
      {
        visionSystem: this.visionSystem,
        agentController: this.agentController,
        worldManager: this.worldManager,
        collisionDetector: this.collisionDetector,
        worldRegistry: hostProfile.worldRegistry,
        createInitialAgentIR: (visionCells) => hostProfile.createSeedAgentIR(visionCells, '默认 Agent'),
        reconcileAgentIRToWorld: hostProfile.reconcileAgentIR,
      },
      {
        world: {
          width: initialWidth,
          height: initialHeight,
          mainAgentId: this.mainAgentId
        },
        initialControlMode: this.currentControlMode
      }
    );
  }

  public setAgentIR(agent: AgentIR): AgentRuntimeStatus {
    const status = this.session.setAgentIR(agent);
    this.emitAgentRuntimeStatus(status);
    this.emitAgentRuntimeActivity(this.getAgentRuntimeActivitySnapshot());
    return status;
  }

  public setKeyboardInputKey(key: string, isPressed: boolean): void {
    switch (key) {
      case 'a':
      case 'arrowleft':
        this.keyboardInputState.turnLeft = isPressed;
        break;
      case 'w':
      case 'arrowup':
        this.keyboardInputState.moveForward = isPressed;
        break;
      case 'd':
      case 'arrowright':
        this.keyboardInputState.turnRight = isPressed;
        break;
      default:
        return;
    }

    this.session.setKeyboardInputState(this.keyboardInputState);
  }

  /**
   * 更新智能体参数配置
   */
  public updateAgentParameters(params: {
    visionCells?: number;
    visionRange?: number;
    visionAngle?: number;
  }): void {
    this.session.updateAgentParameters(params);
    this.emitAgentRuntimeStatus(this.getAgentRuntimeStatus());
    this.emitAgentRuntimeActivity(this.getAgentRuntimeActivitySnapshot());
    // 立即重新渲染世界，确保即使在暂停状态下也能看到变化
    this.renderWorld();
  }

  /**
   * 获取当前智能体参数配置
   */
  public getAgentParameters(): {
    visionCells: number;
    visionRange: number;
    visionAngle: number;
  } {
    const runtimeConfig = this.session.getRuntimeConfigSnapshot();
    return {
      visionCells: runtimeConfig.visionCells,
      visionRange: runtimeConfig.visionRange,
      visionAngle: Math.round((runtimeConfig.visionAngle * 180) / Math.PI) // 转换为度数
    };
  }

  public getAgentRuntimeStatus(): AgentRuntimeStatus {
    return this.session.getAgentRuntimeStatus();
  }

  public getAgentRuntimeActivitySnapshot(): AgentRuntimeActivitySnapshot {
    return this.session.getAgentRuntimeActivitySnapshot();
  }

  /**
   * 初始化仿真系统
   */
  initialize(): void {
    // 设置渲染器的世界尺寸
    this.renderer.setWorldDimensions(this.worldManager.width, this.worldManager.height);
    this.session.initialize();
    this.emitAgentRuntimeStatus(this.getAgentRuntimeStatus());
    this.emitAgentRuntimeActivity(this.getAgentRuntimeActivitySnapshot());
    this.setCameraTarget(this.mainAgentId);
    
    this.renderWorld();
    this.emitLifecycleChange();
  }

  /**
   * 启动仿真
   */
  start(): void {
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.emitLifecycleChange();
    if (!this.gameLoopRunning) {
      this.gameLoopRunning = true;
      this.gameLoop();
    }
  }

  /**
   * 暂停仿真
   */
  pause(): void {
    this.isPaused = true;
    this.emitLifecycleChange();
  }

  /**
   * 恢复仿真
   */
  resume(): void {
    this.isPaused = false;
    this.lastTime = performance.now();
    this.emitLifecycleChange();
  }

  /**
   * 停止仿真
   */
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.gameLoopRunning = false;
    this.emitLifecycleChange();
  }

  /**
   * 重置仿真
   */
  reset(): void {
    this.stop();
    this.simulationTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    this.keyboardInputState = {
      turnLeft: false,
      moveForward: false,
      turnRight: false
    };
    this.session.reset();
    this.session.setKeyboardInputState(this.keyboardInputState);
    this.setControlMode(this.currentControlMode);
    this.setCameraTarget(this.mainAgentId);
    this.emitAgentRuntimeStatus(this.getAgentRuntimeStatus());
    this.emitAgentRuntimeActivity(this.getAgentRuntimeActivitySnapshot());
    this.renderWorld();
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
      
      const stats = this.session.step(deltaTime);
      this.simulationTime += deltaTime;
      this.frameCount++;
      
      if (this.frameCount % 60 === 0) {
        this.fps = Math.round(1 / deltaTime);
      }

      this.onStatsUpdate?.({
        ...stats,
        fps: this.fps
      });
      this.emitAgentRuntimeActivity(this.getAgentRuntimeActivitySnapshot());
    } else if (this.isPaused) {
      this.lastTime = currentTime;
    }

    // 始终进行渲染
    this.renderWorld();
    requestAnimationFrame(this.gameLoop);
  };

  /**
   * 渲染世界
   */
  private renderWorld(): void {
    this.renderer.renderWorld(this.session.getWorldSnapshot());
  }

  /**
   * 设置镜头跟随目标
   */
  setCameraTarget(agentId: number | null): void {
    this.renderer.setCameraTargetAgentId(agentId);
  }

  /**
   * 设置控制模式
   */
  public setControlMode(newMode: SimulationControlMode): void {
    this.currentControlMode = newMode;
    this.session.setControlMode(newMode);
    this.emitAgentRuntimeStatus(this.getAgentRuntimeStatus());
    this.emitAgentRuntimeActivity(this.getAgentRuntimeActivitySnapshot());
  }

  public getLifecycleState(): SimulationLifecycleState {
    if (!this.isRunning) {
      return 'idle';
    }

    return this.isPaused ? 'paused' : 'running';
  }

  private emitAgentRuntimeStatus(status: AgentRuntimeStatus): void {
    this.onAgentRuntimeStatusChange?.(status);
  }

  private emitAgentRuntimeActivity(snapshot: AgentRuntimeActivitySnapshot): void {
    this.onAgentRuntimeActivityChange?.(snapshot);
  }

  private emitLifecycleChange(): void {
    this.onLifecycleChange?.(this.getLifecycleState());
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
