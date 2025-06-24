import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { globalState } from '../../core/services/GlobalState';
import type { IAgent } from '../../shared/interfaces/IAgent';

// 简单的 Agent 渲染器
class AgentRenderer {
  private graphics: PIXI.Graphics;

  constructor(stage: PIXI.Container) {
    this.graphics = new PIXI.Graphics();
    stage.addChild(this.graphics);
  }

  render(agents: IAgent[]) {
    this.graphics.clear();
    for (const agent of agents) {
      this.graphics.beginFill(0x99ff99);
      this.graphics.drawCircle(agent.x, agent.y, 10); // 假设半径为10
      this.graphics.endFill();
    }
  }

  destroy() {
    this.graphics.destroy();
  }
}

/**
 * 仿真视图组件
 * 负责使用 PIXI.js 渲染从 GlobalState 获取的世界状态。
 */
const SimulationView: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  // 初始化 PIXI App
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    const app = new PIXI.Application({
      width: canvasRef.current.clientWidth,
      height: canvasRef.current.clientHeight,
      backgroundColor: 0x1099bb,
      resizeTo: canvasRef.current,
      antialias: true,
    });
    appRef.current = app;
    canvasRef.current.appendChild(app.view as HTMLCanvasElement);

    const agentRenderer = new AgentRenderer(app.stage);
    
    // 使用 PIXI 的 Ticker 来创建渲染循环
    const ticker = PIXI.Ticker.shared;
    const renderLoop = () => {
        // 从 globalState 获取最新的 agents 状态
        const latestAgents = globalState.getState().worldState as IAgent[];
        agentRenderer.render(latestAgents);
    };
    ticker.add(renderLoop);

    return () => {
      ticker.remove(renderLoop);
      agentRenderer.destroy();
      app.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  return <div ref={canvasRef} className="simulation-canvas" />;
};

export default SimulationView;
