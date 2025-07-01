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

  // 推荐的宽高比范围
  ASPECT_RATIO: {
    MIN: 1.0,  // 最窄比例 (1:1)
    MAX: 2.5,  // 最宽比例 (2.5:1)
    IDEAL: 1.33 // 理想比例 (4:3)
  }
};

/**
 * 计算游戏视窗的缩放参数
 * 实现以中心为锚点的智能缩放算法
 */
interface ScaleResult {
  scale: number;
  offsetX: number;
  offsetY: number;
  scaledWidth: number;
  scaledHeight: number;
}

function calculateGameViewportScale(containerWidth: number, containerHeight: number): ScaleResult {
  const { WORLD_WIDTH, WORLD_HEIGHT, ASPECT_RATIO } = GAME_CONFIG;

  // 防止无效输入
  if (containerWidth <= 0 || containerHeight <= 0) {
    return {
      scale: 0.1,
      offsetX: 0,
      offsetY: 0,
      scaledWidth: WORLD_WIDTH * 0.1,
      scaledHeight: WORLD_HEIGHT * 0.1
    };
  }

  // 简化策略：固定根据高度计算缩放比例
  const scale = containerHeight / WORLD_HEIGHT;

  // 计算缩放后的游戏世界尺寸
  const scaledWidth = WORLD_WIDTH * scale;
  const scaledHeight = WORLD_HEIGHT * scale; // 这个应该等于 containerHeight

  // 计算容器的宽高比
  const containerAspectRatio = containerWidth / containerHeight;
  const scaledAspectRatio = scaledWidth / scaledHeight;

  let offsetX: number;
  let offsetY: number;

  // 垂直方向：游戏高度总是填满容器高度
  offsetY = 0;

  // 水平方向：根据宽度情况决定
  if (containerWidth >= scaledWidth) {
    // 容器足够宽：游戏视野扩展，居中显示
    offsetX = (containerWidth - scaledWidth) / 2;
  } else {
    // 容器太窄：需要裁剪游戏视野，但这种情况下我们仍然居中
    offsetX = (containerWidth - scaledWidth) / 2;
  }

  // 检查是否需要黑边（当宽高比超出合理范围时）
  const needsBlackBars = containerAspectRatio > ASPECT_RATIO.MAX || containerAspectRatio < ASPECT_RATIO.MIN;

  // 调试信息（开发环境）
  console.log('🎮 简化缩放计算:', {
    container: `${containerWidth}x${containerHeight}`,
    world: `${WORLD_WIDTH}x${WORLD_HEIGHT}`,
    scale: scale.toFixed(3),
    scaled: `${scaledWidth.toFixed(1)}x${scaledHeight.toFixed(1)}`,
    offset: `${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}`,
    containerAspectRatio: containerAspectRatio.toFixed(2),
    needsBlackBars,
    strategy: '固定高度缩放'
  });

  return {
    scale,
    offsetX,
    offsetY,
    scaledWidth,
    scaledHeight
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
    const containerHeight = container.clientHeight;

    const app = new PIXI.Application({
      width: containerWidth,
      height: containerHeight,
      backgroundColor: getWorldBackgroundColor(),
      antialias: true,
      resolution: 1,
      autoDensity: false,
    });
    appRef.current = app;

    // 禁用PIXI的内部动画和平滑效果
    app.ticker.stop();

    container.appendChild(app.view as HTMLCanvasElement);

    // 使用新的缩放算法计算初始缩放参数
    const initialScale = calculateGameViewportScale(containerWidth, containerHeight);

    // 立即设置缩放和位置，无平滑过渡，以中心为锚点
    app.stage.scale.x = initialScale.scale;
    app.stage.scale.y = initialScale.scale;
    app.stage.position.x = initialScale.offsetX;
    app.stage.position.y = initialScale.offsetY;

    // 创建渲染层
    const worldEntityContainer = new PIXI.Container();
    const agentContainer = new PIXI.Container();

    app.stage.addChild(worldEntityContainer);
    app.stage.addChild(agentContainer);

    const agentRenderer = new AgentRenderer(agentContainer);
    const worldEntityRenderer = new WorldEntityRenderer(worldEntityContainer);

    // 使用自定义渲染循环，避免PIXI内部的平滑效果
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
      app.renderer.backgroundColor = getWorldBackgroundColor();
    });

    // 终极稳定方案：完全绕过PIXI的尺寸检测
    // 直接跟踪DOM容器尺寸，不依赖PIXI的screen属性
    let lastContainerWidth = containerWidth;
    let lastContainerHeight = containerHeight;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!container || !app || entries.length === 0) return;

      try {
        const entry = entries[0];
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;

        // 验证尺寸有效性
        if (newWidth <= 0 || newHeight <= 0) {
          console.warn('无效的容器尺寸:', { newWidth, newHeight });
          return;
        }

        // 使用我们自己的尺寸跟踪，完全不依赖PIXI的screen属性
        const widthDelta = Math.abs(lastContainerWidth - newWidth);
        const heightDelta = Math.abs(lastContainerHeight - newHeight);

        const widthChanged = widthDelta > 1;
        const heightChanged = heightDelta > 10; // 严格的高度变化阈值

        console.log('🎯 终极方案 - 绕过PIXI:', {
          from: `${lastContainerWidth}x${lastContainerHeight}`,
          to: `${newWidth}x${newHeight}`,
          widthDelta: widthDelta.toFixed(1),
          heightDelta: heightDelta.toFixed(1),
          widthChanged,
          heightChanged,
          strategy: '直接DOM跟踪'
        });

        // 总是更新渲染器尺寸
        if (widthChanged || heightChanged) {
          app.renderer.resize(newWidth, newHeight);
        }

        // 处理高度变化：重新缩放
        if (heightChanged) {
          lastContainerHeight = newHeight; // 更新我们的高度记录

          // 重新计算缩放比例（基于新高度）
          const newScale = newHeight / GAME_CONFIG.WORLD_HEIGHT;
          const scaledWidth = GAME_CONFIG.WORLD_WIDTH * newScale;
          const newOffsetX = (newWidth - scaledWidth) / 2;
          const newOffsetY = 0; // 始终填满高度

          // 更新缩放和位置
          app.stage.scale.set(newScale);
          app.stage.position.set(newOffsetX, newOffsetY);

          console.log('� 高度变化，重新缩放:', {
            newHeight,
            newScale: newScale.toFixed(3),
            strategy: '固定高度缩放'
          });
        } else if (widthChanged) {
          lastContainerWidth = newWidth; // 更新我们的宽度记录

          // 处理宽度变化：保持缩放不变，只调整水平偏移
          const currentScale = app.stage.scale.x;
          const scaledWidth = GAME_CONFIG.WORLD_WIDTH * currentScale;
          const newOffsetX = (newWidth - scaledWidth) / 2;

          // 只更新X位置，保持Y位置和缩放不变
          app.stage.position.x = newOffsetX;

          console.log('↔️ 宽度变化，调整视野:', {
            newWidth,
            newOffsetX: newOffsetX.toFixed(1),
            preservedScale: currentScale.toFixed(3),
            strategy: '保持缩放不变'
          });
        }

        // 强制立即渲染
        if (widthChanged || heightChanged) {
          app.renderer.render(app.stage);
        }
      } catch (error) {
        console.error('缩放调整过程中发生错误:', error);
      }
    });

    resizeObserver.observe(container);

    return () => {
      // 停止自定义渲染循环
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      agentRenderer.destroy();
      worldEntityRenderer.destroy();
      unsubscribeWorldChange();
      resizeObserver.disconnect();
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
