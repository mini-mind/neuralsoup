import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { SimulationEngine } from '../engine/SimulationEngine';

interface SimulationCanvasProps {
  isRunning: boolean;
  onStatsUpdate: (stats: any) => void;
  onEngineReady: (engine: SimulationEngine) => void;
  width: number;
  height: number;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  isRunning,
  onStatsUpdate,
  onEngineReady,
  width,
  height
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const app = appRef.current;
    const engine = engineRef.current;

    if (!app) {
      const newApp = new PIXI.Application({
        width: width,
        height: height,
        backgroundColor: 0x87CEEB, // 天空蓝背景
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      canvasRef.current.appendChild(newApp.view as HTMLCanvasElement);
      appRef.current = newApp;

      // 创建仿真引擎 - 设置一个更大的固定世界尺寸
      const fixedWorldWidth = 4000; // 示例：更大的世界宽度
      const fixedWorldHeight = 3000; // 示例：更大的世界高度
      const newEngine = new SimulationEngine(newApp, fixedWorldWidth, fixedWorldHeight);
      newEngine.onStatsUpdate = onStatsUpdate;
      engineRef.current = newEngine;
      newEngine.initialize();
      
      // 设置镜头跟随主智能体
      const mainAgent = newEngine.getMainAgent();
      if (mainAgent) {
        newEngine.setCameraTarget(mainAgent);
      }
      
      onEngineReady(newEngine);
    } else {
      // 如果已存在，则只更新渲染器尺寸，世界尺寸保持不变
      app.renderer.resize(width, height);
      // 不再调用 engine?.updateWorldDimensions(width, height); 因为世界尺寸是固定的
    }

    return () => {
      if (appRef.current && !canvasRef.current?.isConnected) {
        engineRef.current?.destroy();
        appRef.current?.destroy();
        appRef.current = null;
        engineRef.current = null;
      }
    };
  }, [width, height, onStatsUpdate, onEngineReady]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (isRunning) {
      engine.start();
    } else {
      engine.pause();
    }
  }, [isRunning]);

  return (
    <div 
      ref={canvasRef} 
      className="simulation-canvas"
      style={{ 
        width: '100vw', 
        height: '100vh', 
        overflow: 'hidden',
        position: 'relative'
      }}
    />
  );
};

export default SimulationCanvas; 