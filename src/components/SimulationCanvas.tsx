import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { SimulationEngine } from '../engine/SimulationEngine';

interface SimulationCanvasProps {
  isRunning: boolean;
  isScriptMode: boolean;
  scriptCode: string;
  enablePlayerInputInScript: boolean;
  onStatsUpdate: (stats: any) => void;
  onEngineReady: (engine: SimulationEngine) => void;
  width: number;
  height: number;
  enableFogOfWar?: boolean;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  isRunning,
  isScriptMode,
  scriptCode,
  enablePlayerInputInScript,
  onStatsUpdate,
  onEngineReady,
  width,
  height,
  enableFogOfWar = false
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
            return;
    }
    const app = appRef.current;
    const engine = engineRef.current;

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
      // 如果已存在，则只更新渲染器尺寸，世界尺寸保持不变
      console.log('Resizing existing app to:', width, height);
      app.renderer.resize(width, height);
      // 不再调用 engine?.updateWorldDimensions(width, height); 因为世界尺寸是固定的
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

  // 当控制模式或其他设置改变时，更新引擎配置
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // 仅设置脚本代码，不执行应用（应用由用户点击按钮触发）
    if (typeof (engine as any).setScriptCode === 'function') {
      (engine as any).setScriptCode(scriptCode);
    }

    // 设置手动控制开关
    if (typeof (engine as any).setEnablePlayerInputInScript === 'function') {
      (engine as any).setEnablePlayerInputInScript(enablePlayerInputInScript);
    }

    // 设置战争迷雾效果
    if (typeof (engine as any).setFogOfWar === 'function') {
      (engine as any).setFogOfWar(enableFogOfWar);
    }
  }, [scriptCode, enablePlayerInputInScript, enableFogOfWar]);

  // 当脚本模式改变时，设置控制模式
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // 直接设置控制模式：脚本模式或SNN模式
    if (typeof (engine as any).setControlMode === 'function') {
      (engine as any).setControlMode(isScriptMode ? 'script' : 'snn');
    } else {
      // 向后兼容：直接设置controlType
      const mainAgent = engine.getMainAgent();
      if (mainAgent) {
        mainAgent.controlType = isScriptMode ? 'script' : 'snn';
      }
    }
  }, [isScriptMode]);

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