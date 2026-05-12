import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { SimulationState } from '../types/simulation';

interface SimulationCanvasProps {
  onStatsUpdate: (stats: SimulationState['stats']) => void;
  onEngineReady: (engine: SimulationEngine) => void;
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

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    if (!appRef.current) {
      console.log('Creating new PIXI app with dimensions:', width, height);
      const newApp = new PIXI.Application({
        width: width,
        height: height,
        backgroundColor: 0x87CEEB, // 天空蓝背景
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      console.log('PIXI app created, canvas view:', newApp.view);
      console.log('Canvas container before append:', canvasRef.current);
      console.log('Canvas container children before:', canvasRef.current.children.length);
      
      canvasRef.current.appendChild(newApp.view as HTMLCanvasElement);
      appRef.current = newApp;
      
      console.log('Canvas element appended to DOM');
      console.log('Canvas container children after:', canvasRef.current.children.length);
      console.log('Canvas view dimensions:', (newApp.view as HTMLCanvasElement).width, (newApp.view as HTMLCanvasElement).height);
      console.log('Canvas view style:', (newApp.view as HTMLCanvasElement).style.cssText);

      // 创建仿真引擎 - 设置一个更大的固定世界尺寸
      const fixedWorldWidth = 3000;
      const fixedWorldHeight = 3000;
      console.log('Creating simulation engine with world size:', fixedWorldWidth, fixedWorldHeight);
      const newEngine = new SimulationEngine(newApp, fixedWorldWidth, fixedWorldHeight);
      newEngine.onStatsUpdate = onStatsUpdate;
      newEngine.onLifecycleChange = onLifecycleChange;
      engineRef.current = newEngine;
      newEngine.initialize();
      
      // 设置镜头跟随主智能体
      const mainAgent = newEngine.getMainAgent();
      if (mainAgent) {
        console.log('Setting camera target to main agent:', mainAgent.id);
        newEngine.setCameraTarget(mainAgent);
      }
      
      onEngineReady(newEngine);
      setIsEngineReady(true);
      setEngineInstanceId((prev) => prev + 1);
      console.log('Simulation engine initialized and ready');
    }

    return () => {
      if (appRef.current) {
        console.log('Cleaning up PIXI app and engine');
        engineRef.current?.destroy();
        appRef.current?.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
        engineRef.current = null;
        setIsEngineReady(false);
        setEngineInstanceId(0);
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
    />
  );
};

export default SimulationCanvas; 
