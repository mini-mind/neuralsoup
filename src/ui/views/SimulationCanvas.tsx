import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { globalState } from '../../core/services/GlobalState';
import { globalEventBus } from '../../core/services/EventBus';
import { AgentRenderer } from '../renderers/AgentRenderer';
import { WorldEntityRenderer } from '../renderers/WorldEntityRenderer';
import type { IAgent } from '../../core/entities/types';
import type { IWorld } from '../../core/world/types';

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

    const app = new PIXI.Application({
      width: canvasRef.current.clientWidth,
      height: canvasRef.current.clientHeight,
      backgroundColor: getWorldBackgroundColor(),
      resizeTo: canvasRef.current,
      antialias: true,
    });
    appRef.current = app;
    canvasRef.current.appendChild(app.view as HTMLCanvasElement);

    // 创建渲染层
    const worldEntityContainer = new PIXI.Container();
    const agentContainer = new PIXI.Container();

    app.stage.addChild(worldEntityContainer);
    app.stage.addChild(agentContainer);

    const agentRenderer = new AgentRenderer(agentContainer);
    const worldEntityRenderer = new WorldEntityRenderer(worldEntityContainer);

    // 使用 PIXI 的 Ticker 来创建渲染循环
    const ticker = PIXI.Ticker.shared;
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
    };
    ticker.add(renderLoop);

    // 监听世界变化事件
    const unsubscribeWorldChange = globalEventBus.on('world:changed', () => {
      // 更新背景颜色
      app.renderer.backgroundColor = getWorldBackgroundColor();
    });

    return () => {
      ticker.remove(renderLoop);
      agentRenderer.destroy();
      worldEntityRenderer.destroy();
      unsubscribeWorldChange();
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
    default:
      return 0x1a1a2e;
  }
}

export default SimulationCanvas;
