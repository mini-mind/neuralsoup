import React, { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { SimulationEngine } from '../engine/SimulationEngine';

type ControlMode = 'manual' | 'script' | 'snn';

interface SimulationCanvasProps {
  isRunning: boolean;
  controlMode: ControlMode;
  scriptCode: string;
  enablePlayerInputInScript: boolean;
  onStatsUpdate: (stats: any) => void;
  onEngineReady: (engine: SimulationEngine) => void;
  width: number;
  height: number;
}

const SimulationCanvas: React.FC<SimulationCanvasProps> = ({
  isRunning,
  controlMode,
  scriptCode,
  enablePlayerInputInScript,
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
      console.log('Canvas ref not available');
      return;
    }

    console.log('Canvas ref available, initializing PIXI app');
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

  // 移除自动启动/暂停逻辑，由App.tsx直接控制

  // 当控制模式或脚本代码改变时，更新引擎
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // 先设置脚本代码（无论控制模式如何）
    if (typeof (engine as any).setScriptCode === 'function') {
      (engine as any).setScriptCode(scriptCode);
    }

    // 设置脚本模式下的玩家输入开关
    if (typeof (engine as any).setEnablePlayerInputInScript === 'function') {
      (engine as any).setEnablePlayerInputInScript(enablePlayerInputInScript);
    }

    // 使用新的setControlMode方法进行平滑切换
    if (typeof (engine as any).setControlMode === 'function') {
      switch (controlMode) {
        case 'manual':
          (engine as any).setControlMode('keyboard');
          break;
        case 'script':
          (engine as any).setControlMode('script');
          break;
        case 'snn':
          (engine as any).setControlMode('snn');
          break;
      }
    } else {
      // 向后兼容：直接设置controlType
      const mainAgent = engine.getMainAgent();
      if (mainAgent) {
        switch (controlMode) {
          case 'manual':
            mainAgent.controlType = 'keyboard';
            break;
          case 'script':
            mainAgent.controlType = 'script';
            break;
          case 'snn':
            mainAgent.controlType = 'snn';
            break;
        }
      }
    }
  }, [controlMode, scriptCode, enablePlayerInputInScript]);

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