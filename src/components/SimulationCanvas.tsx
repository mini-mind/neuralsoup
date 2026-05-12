import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { SimulationState } from '../types/simulation';

interface SimulationCanvasProps {
  onStatsUpdate: (stats: SimulationState['stats']) => void;
  onEngineReady: (engine: SimulationEngine) => void;
  width: number;
  height: number;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  onStatsUpdate,
  onEngineReady,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const app = appRef.current;

    if (!app) {
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
      engineRef.current = newEngine;
      newEngine.initialize();
      
      // 设置镜头跟随主智能体
      const mainAgent = newEngine.getMainAgent();
      if (mainAgent) {
        console.log('Setting camera target to main agent:', mainAgent.id);
        newEngine.setCameraTarget(mainAgent);
      }
      
      onEngineReady(newEngine);
      console.log('Simulation engine initialized and ready');
    } else {
      // 已存在时只更新视口尺寸，仿真世界尺寸保持固定。
      console.log('Resizing existing app to:', width, height);
      app.renderer.resize(width, height);
    }

    return () => {
      if (appRef.current && !canvasRef.current?.isConnected) {
        console.log('Cleaning up PIXI app and engine');
        engineRef.current?.destroy();
        appRef.current?.destroy();
        appRef.current = null;
        engineRef.current = null;
      }
    };
  }, [width, height, onStatsUpdate, onEngineReady]);

  return (
    <div 
      ref={canvasRef} 
      className="simulation-canvas"
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
