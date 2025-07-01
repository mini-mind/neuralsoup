import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { globalState } from '../../core/services/GlobalState';
import { globalEventBus } from '../../core/services/EventBus';
import { AgentRenderer } from '../renderers/AgentRenderer';
import { WorldEntityRenderer } from '../renderers/WorldEntityRenderer';
import type { IAgent } from '../../core/entities/types';
import type { IWorld } from '../../core/world/types';

// 游戏视窗缩放配置
const GAME_CONFIG = {
  // 游戏世界的原始尺寸
  WORLD_WIDTH: 1600,
  WORLD_HEIGHT: 1200,
};

// 布局配置（从CSS变量中获取）
const LAYOUT_CONFIG = {
  HEADER_HEIGHT: 50, // 导航栏高度
  PADDING: 10, // 容器内边距
};

/**
 * 计算游戏视窗的稳定缩放参数
 * 基于浏览器窗口高度而非容器高度，确保稳定性
 * Canvas尺寸将被限制为实际游戏画面尺寸，父组件背景形成黑边
 */
interface ScaleResult {
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
}

function calculateStableGameViewportScale(containerWidth: number): ScaleResult {
  const { WORLD_WIDTH, WORLD_HEIGHT } = GAME_CONFIG;
  const { HEADER_HEIGHT, PADDING } = LAYOUT_CONFIG;

  // 使用稳定的窗口高度计算可用空间
  const windowHeight = document.body.clientHeight || window.innerHeight;
  const availableHeight = windowHeight - HEADER_HEIGHT - (PADDING * 2);
  const availableWidth = containerWidth - (PADDING * 2);

  // 防止无效输入
  if (availableWidth <= 0 || availableHeight <= 0) {
    return {
      scale: 0.1,
      canvasWidth: Math.max(100, WORLD_WIDTH * 0.1),
      canvasHeight: Math.max(100, WORLD_HEIGHT * 0.1)
    };
  }

  // 计算容器宽高比
  const containerAspectRatio = availableWidth / availableHeight;
  const worldAspectRatio = WORLD_WIDTH / WORLD_HEIGHT;
  
  let scale: number;
  let canvasWidth: number;
  let canvasHeight: number;

  if (containerAspectRatio >= worldAspectRatio) {
    // 容器偏宽（横向）：以高度为准进行缩放，左右自然形成黑边
    scale = availableHeight / WORLD_HEIGHT;
    canvasWidth = WORLD_WIDTH * scale;
    canvasHeight = WORLD_HEIGHT * scale; // 保持宽高比
  } else {
    // 容器偏窄（纵向）：以宽度为准进行缩放，上下自然形成黑边
    scale = availableWidth / WORLD_WIDTH;
    canvasWidth = WORLD_WIDTH * scale; // 保持宽高比
    canvasHeight = WORLD_HEIGHT * scale;
  }

  // 调试信息
  console.log('🎮 限制Canvas尺寸的缩放计算:', {
    window: `${window.innerWidth}x${windowHeight}`,
    available: `${availableWidth}x${availableHeight}`,
    world: `${WORLD_WIDTH}x${WORLD_HEIGHT}`,
    containerAspectRatio: containerAspectRatio.toFixed(2),
    worldAspectRatio: worldAspectRatio.toFixed(2),
    scale: scale.toFixed(3),
    canvas: `${canvasWidth.toFixed(1)}x${canvasHeight.toFixed(1)}`,
    strategy: containerAspectRatio >= worldAspectRatio ? '横向-限制宽度' : '纵向-限制高度'
  });

  return {
    scale,
    canvasWidth,
    canvasHeight
  };
}

/**
 * 仿真视图组件
 * 负责使用 PIXI.js 渲染从 GlobalState 获取的世界状态。
 */
const SimulationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const worldRef = useRef<IWorld | null>(null);

  // 初始化 PIXI App
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    const container = canvasRef.current;
    const containerWidth = container.clientWidth;

    // 使用稳定的缩放算法计算初始参数
    const scaleResult = calculateStableGameViewportScale(containerWidth);

    const app = new PIXI.Application({
      width: scaleResult.canvasWidth,
      height: scaleResult.canvasHeight,
      backgroundColor: getWorldBackgroundColor(),
      antialias: true,
      resolution: 1,
      autoDensity: false,
    });
    appRef.current = app;

    // 禁用PIXI的内部动画和平滑效果
    app.ticker.stop();

    container.appendChild(app.view as HTMLCanvasElement);

    // 设置缩放，无需偏移（Canvas尺寸已经是正确的）
    app.stage.scale.set(scaleResult.scale);
    app.stage.position.set(0, 0); // 不需要偏移，Canvas本身就是正确尺寸

    // 创建渲染层
    const worldEntityContainer = new PIXI.Container();
    const agentContainer = new PIXI.Container();

    app.stage.addChild(worldEntityContainer);
    app.stage.addChild(agentContainer);

    const agentRenderer = new AgentRenderer(agentContainer);
    const worldEntityRenderer = new WorldEntityRenderer(worldEntityContainer);

    // 使用自定义渲染循环
    let animationFrameId: number;
    const renderLoop = () => {
      // 从 globalState 获取最新的世界状态
      const state = globalState.getState();
      const latestAgents = state.worldState as IAgent[];

      // 渲染智能体
      agentRenderer.render(latestAgents);

      // 渲染世界实体（如果世界实例可用）
      if (worldRef.current) {
        const entities = worldRef.current.getEntities();
        worldEntityRenderer.render(entities);
      }

      // 手动渲染
      app.renderer.render(app.stage);

      // 继续下一帧
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    // 开始渲染循环
    renderLoop();

    // 监听世界变化事件
    const unsubscribeWorldChange = globalEventBus.on('world:changed', () => {
      // 更新背景颜色
      app.renderer.background.color = getWorldBackgroundColor();
    });

    // 简化的窗口尺寸变化处理
    const handleWindowResize = () => {
      if (!container || !app) return;

      try {
        const newContainerWidth = container.clientWidth;
        const newScaleResult = calculateStableGameViewportScale(newContainerWidth);

        // 更新渲染器尺寸
        app.renderer.resize(newScaleResult.canvasWidth, newScaleResult.canvasHeight);

        // 更新缩放，无需偏移
        app.stage.scale.set(newScaleResult.scale);
        app.stage.position.set(0, 0);

        console.log('🔄 窗口尺寸变化，重新缩放:', {
          newCanvasSize: `${newScaleResult.canvasWidth}x${newScaleResult.canvasHeight}`,
          scale: newScaleResult.scale.toFixed(3),
          strategy: '限制Canvas尺寸'
        });

        // 强制立即渲染
        app.renderer.render(app.stage);
      } catch (error) {
        console.error('窗口尺寸变化处理错误:', error);
      }
    };

    // 监听窗口尺寸变化
    window.addEventListener('resize', handleWindowResize);

    return () => {
      // 停止自定义渲染循环
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      agentRenderer.destroy();
      worldEntityRenderer.destroy();
      unsubscribeWorldChange();
      window.removeEventListener('resize', handleWindowResize);
      app.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  // 监听世界实例更新
  useEffect(() => {
    const unsubscribe = globalEventBus.on('world:instance', (event: any) => {
      worldRef.current = event.world;
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return <div ref={canvasRef} className="simulation-canvas" />;
};

/**
 * 根据当前选中的世界类型获取背景颜色
 */
function getWorldBackgroundColor(): number {
  const selectedWorld = globalState.getState().selectedWorld || 'luminous-garden';

  switch (selectedWorld) {
    case 'luminous-garden':
      return 0x1a1a2e; // 深蓝紫色
    case 'echo-chamber':
      return 0x000000; // 纯黑色
    case 'sentient-swarm':
      return 0x2d3748; // 深灰蓝色
    case 'chromatic-composer':
      return 0xf7fafc; // 浅灰白色
    case 'light-seeker':
      return 0x0f0f23; // 深蓝黑色，适合光球效果
    default:
      return 0x1a1a2e;
  }
}

export default SimulationCanvas;
