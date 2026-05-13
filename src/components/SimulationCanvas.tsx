import React, { useRef, useEffect } from 'react';
import * as PIXI from '../engine/pixi';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { SimulationState } from '../types/simulation';

interface SimulationCanvasProps {
  onStatsUpdate: (stats: SimulationState['stats']) => void;
  onEngineReady: (engine: SimulationEngine | null) => void;
  onLifecycleChange: (state: 'idle' | 'running' | 'paused') => void;
  width: number;
  height: number;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  onStatsUpdate,
  onEngineReady,
  onLifecycleChange,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const [isEngineReady, setIsEngineReady] = React.useState(false);
  const [engineInstanceId, setEngineInstanceId] = React.useState(0);
  const [renderError, setRenderError] = React.useState<string | null>(null);

  useEffect(() => {
    const container = canvasRef.current;

    if (!container) {
      return;
    }

    const cleanupInitialization = ({
      app,
      engine,
      appendedView,
      errorMessage,
    }: {
      app: PIXI.Application | null;
      engine: SimulationEngine | null;
      appendedView: HTMLCanvasElement | null;
      errorMessage: string | null;
    }): void => {
      const view = appendedView ?? (app?.view as HTMLCanvasElement | undefined) ?? null;

      if (engine) {
        try {
          engine.destroy();
        } catch (cleanupError) {
          console.error('Failed to destroy simulation engine during cleanup:', cleanupError);
        }
      }

      if (view?.parentNode) {
        try {
          view.parentNode.removeChild(view);
        } catch (cleanupError) {
          console.error('Failed to remove PIXI canvas during cleanup:', cleanupError);
        }
      }

      if (app) {
        try {
          app.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch (cleanupError) {
          console.error('Failed to destroy PIXI application during cleanup:', cleanupError);
        }
      }

      engineRef.current = null;
      appRef.current = null;
      setIsEngineReady(false);
      setEngineInstanceId(0);
      setRenderError(errorMessage);

      try {
        onEngineReady(null);
      } catch (cleanupError) {
        console.error('Failed to clear simulation engine during cleanup:', cleanupError);
      }

      try {
        onLifecycleChange('idle');
      } catch (cleanupError) {
        console.error('Failed to notify idle lifecycle state during cleanup:', cleanupError);
      }
    };

    if (!appRef.current) {
      console.log('Creating new PIXI app with dimensions:', width, height);
      let newApp: PIXI.Application | null = null;
      let newEngine: SimulationEngine | null = null;
      let appendedView: HTMLCanvasElement | null = null;
      setRenderError(null);

      try {
        newApp = new PIXI.Application({
          width: width,
          height: height,
          backgroundColor: 0x87CEEB, // 天空蓝背景
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        console.log('PIXI app created, canvas view:', newApp.view);
        console.log('Canvas container before append:', container);
        console.log('Canvas container children before:', container.children.length);

        appendedView = newApp.view as HTMLCanvasElement;
        container.appendChild(appendedView);

        console.log('Canvas element appended to DOM');
        console.log('Canvas container children after:', container.children.length);
        console.log('Canvas view dimensions:', appendedView.width, appendedView.height);
        console.log('Canvas view style:', appendedView.style.cssText);

        // 创建仿真引擎 - 设置一个更大的固定世界尺寸
        const fixedWorldWidth = 3000;
        const fixedWorldHeight = 3000;
        console.log('Creating simulation engine with world size:', fixedWorldWidth, fixedWorldHeight);
        newEngine = new SimulationEngine(newApp, fixedWorldWidth, fixedWorldHeight);
        newEngine.onStatsUpdate = onStatsUpdate;
        newEngine.onLifecycleChange = onLifecycleChange;
        newEngine.initialize();

        // 设置镜头跟随主智能体
        const mainAgent = newEngine.getMainAgent();
        if (mainAgent) {
          console.log('Setting camera target to main agent:', mainAgent.id);
          newEngine.setCameraTarget(mainAgent);
        }

        appRef.current = newApp;
        engineRef.current = newEngine;
        onEngineReady(newEngine);
        setIsEngineReady(true);
        setEngineInstanceId((prev) => prev + 1);
        console.log('Simulation engine initialized and ready');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Pixi renderer error';
        console.error('Failed to initialize simulation canvas:', error);
        cleanupInitialization({
          app: newApp,
          engine: newEngine,
          appendedView,
          errorMessage: message,
        });
        return;
      }
    }

    return () => {
      if (appRef.current || engineRef.current) {
        console.log('Cleaning up PIXI app and engine');
        cleanupInitialization({
          app: appRef.current,
          engine: engineRef.current,
          appendedView: (appRef.current?.view as HTMLCanvasElement | undefined) ?? null,
          errorMessage: null,
        });
      }
    };
  }, [onEngineReady]);

  useEffect(() => {
    if (!appRef.current) {
      return;
    }

    console.log('Resizing existing app to:', width, height);
    appRef.current.renderer.resize(width, height);
  }, [width, height]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.onStatsUpdate = onStatsUpdate;
    }
  }, [onStatsUpdate]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.onLifecycleChange = onLifecycleChange;
      onLifecycleChange(engineRef.current.getLifecycleState());
    }
  }, [onLifecycleChange]);

  return (
    <div 
      ref={canvasRef} 
      className="simulation-canvas"
      data-testid="simulation-canvas"
      data-engine-ready={isEngineReady ? 'true' : 'false'}
      data-engine-instance-id={String(engineInstanceId)}
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {renderError && (
        <div
          data-testid="simulation-render-error"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: '#0f172a',
            color: '#e2e8f0',
            textAlign: 'center',
            lineHeight: 1.6
          }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>渲染初始化失败</div>
            <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
              当前浏览器环境未能初始化 Pixi 渲染器，请确认已启用 WebGL/Canvas 加速，或更换浏览器后重试。
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{renderError}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationCanvas; 
