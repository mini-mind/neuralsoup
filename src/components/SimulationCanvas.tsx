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
      
      // 检测是否为移动端，并计算适当的分辨率
      const isMobile = window.innerWidth <= 768;
      let resolution = window.devicePixelRatio || 1;
      
      // 移动端使用较低的分辨率以提升性能，同时增加世界缩放
      if (isMobile) {
        resolution = Math.min(resolution, 2); // 限制移动端分辨率
      }
      
      const newApp = new PIXI.Application({
        width: width,
        height: height,
        backgroundColor: 0x87CEEB, // 天空蓝背景
        antialias: true,
        resolution: resolution,
        autoDensity: true,
      });

      console.log('PIXI app created, canvas view:', newApp.view);
      console.log('Canvas container before append:', canvasRef.current);
      console.log('Canvas container children before:', canvasRef.current.children.length);
      
      canvasRef.current.appendChild(newApp.view as HTMLCanvasElement);
      appRef.current = newApp;
      
      // 设置canvas样式以确保正确缩放和居中
      const canvasElement = newApp.view as HTMLCanvasElement;
      canvasElement.style.width = '100%';
      canvasElement.style.height = '100%';
      canvasElement.style.objectFit = 'contain';
      canvasElement.style.display = 'block';
      
      console.log('Canvas element appended to DOM');
      console.log('Canvas container children after:', canvasRef.current.children.length);
      console.log('Canvas view dimensions:', canvasElement.width, canvasElement.height);
      console.log('Canvas view style:', canvasElement.style.cssText);

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
        
        // 移动端应用额外的缩放，确保视野完整显示
        if (isMobile && typeof (newEngine as any).setMobileScale === 'function') {
          // 根据实际视野范围计算合适的缩放比例
          const agentParams = newEngine.getAgentParameters();
          const visionRange = agentParams.visionRange;
          const screenMin = Math.min(width, height);
          const optimalScale = Math.min(1.0, screenMin / (visionRange * 2.2)); // 2.2倍视野范围作为参考
          (newEngine as any).setMobileScale(optimalScale);
          console.log('Applied mobile scale:', optimalScale, 'for vision range:', visionRange);
        }
      }
      
      onEngineReady(newEngine);
      console.log('Simulation engine initialized and ready');
    } else {
      // 如果已存在，则只更新渲染器尺寸，世界尺寸保持不变
      console.log('Resizing existing app to:', width, height);
      app.renderer.resize(width, height);
      
             // 移动端重新计算缩放
       const isMobile = window.innerWidth <= 768;
       if (isMobile && engineRef.current && typeof (engineRef.current as any).setMobileScale === 'function') {
         const agentParams = engineRef.current.getAgentParameters();
         const visionRange = agentParams.visionRange;
         const screenMin = Math.min(width, height);
         const optimalScale = Math.min(1.0, screenMin / (visionRange * 2.2));
         (engineRef.current as any).setMobileScale(optimalScale);
         console.log('Updated mobile scale on resize:', optimalScale, 'for vision range:', visionRange);
       }
      // 不再调用 engine?.updateWorldDimensions(width, height); 因为世界尺寸是固定的
    }

    return () => {
      if (appRef.current && !canvasRef.current?.isConnected) {
        console.log('Cleaning up PIXI app and engine');
        // 添加安全检查，防止重复销毁
        if (engineRef.current) {
          try {
            engineRef.current.destroy();
          } catch (error) {
            console.warn('Error destroying engine:', error);
          }
          engineRef.current = null;
        }
        if (appRef.current) {
          try {
            appRef.current.destroy();
          } catch (error) {
            console.warn('Error destroying PIXI app:', error);
          }
          appRef.current = null;
        }
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

  // 添加resize监听，确保canvas在容器尺寸变化时正确调整
  useEffect(() => {
    if (!canvasRef.current || !appRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: containerWidth, height: containerHeight } = entry.contentRect;
        if (appRef.current && containerWidth > 0 && containerHeight > 0) {
          console.log('Container resized to:', containerWidth, containerHeight);
          appRef.current.renderer.resize(containerWidth, containerHeight);
          
                     // 移动端重新计算缩放
           const isMobile = window.innerWidth <= 768;
           if (isMobile && engineRef.current && typeof (engineRef.current as any).setMobileScale === 'function') {
             const agentParams = engineRef.current.getAgentParameters();
             const visionRange = agentParams.visionRange;
             const screenMin = Math.min(containerWidth, containerHeight);
             const optimalScale = Math.min(1.0, screenMin / (visionRange * 2.2));
             (engineRef.current as any).setMobileScale(optimalScale);
           }
          
          // 强制重绘
          if (engineRef.current && typeof (engineRef.current as any).forceRender === 'function') {
            (engineRef.current as any).forceRender();
          }
        }
      }
    });

    resizeObserver.observe(canvasRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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