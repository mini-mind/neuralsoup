import React, { useState, useCallback, useRef, useEffect } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import ControlPanel from './components/ControlPanel';
import { SimulationEngine } from './engine/SimulationEngine';
import './App.css';

const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState({
    fps: 0,
    totalReward: 0,
    collisionCount: 0,
    emotionState: { pleasure: 0, arousal: 0 }
  });
  const [isPanelOpen, setIsPanelOpen] = useState(true); // 默认展开面板
  
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth);
  const [canvasHeight, setCanvasHeight] = useState(window.innerHeight);

  const engineRef = useRef<SimulationEngine | null>(null);

  // 计算画布尺寸
  const calculateCanvasDimensions = useCallback(() => {
    // 画布始终占满整个视口，面板将浮动在其上方
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    setCanvasWidth(newWidth);
    setCanvasHeight(newHeight);
  }, []); // 移除对 isPanelOpen 的依赖

  useEffect(() => {
    calculateCanvasDimensions(); // 首次渲染时计算
    window.addEventListener('resize', calculateCanvasDimensions);
    return () => {
      window.removeEventListener('resize', calculateCanvasDimensions);
    };
  }, [calculateCanvasDimensions]);

  const handleStart = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(!isPaused);
    if (engineRef.current) {
      engineRef.current.pause();
    }
  }, [isPaused]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setStats({
      fps: 0,
      totalReward: 0,
      collisionCount: 0,
      emotionState: { pleasure: 0, arousal: 0 }
    });
    if (engineRef.current) {
      engineRef.current.reset();
    }
  }, []);

  const handleStatsUpdate = useCallback((newStats: any) => {
    setStats(newStats);
  }, []);

  const handleEngineReady = useCallback((engine: SimulationEngine) => {
    engineRef.current = engine;
  }, []);

  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev);
  }, []);

  return (
    <div className="app">
      {/* 顶部标题，仅在小屏幕显示 */}
      <div className="app-header">
        <h1>DYNN - 浮游生物智能体仿真</h1>
        <p>基于脉冲神经网络的具身智能体在2D环境中的学习与适应</p>
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          键盘控制：W/↑前进，A/←左转，D/→右转 | 蓝色智能体为主控，其他为随机游走
        </p>
      </div>

      {/* 仿真画布区域 */}
      <SimulationCanvas 
        width={canvasWidth}
        height={canvasHeight}
        isRunning={isRunning && !isPaused}
        onStatsUpdate={handleStatsUpdate}
        onEngineReady={handleEngineReady}
      />
      
      {/* 浮动控制面板切换按钮 */}
      <button className={`panel-toggle-btn ${isPanelOpen ? 'panel-open' : 'panel-closed'}`} onClick={togglePanel}>
        {isPanelOpen ? '❯' : '❮'} {/* 箭头方向修正：展开时向右，收起时向左 */}
      </button>

      {/* 浮动控制面板 */}
      <div className={`control-panel-container ${isPanelOpen ? 'open' : 'closed'}`}>
        <div className="control-panel-content">
          <ControlPanel 
            isRunning={isRunning}
            isPaused={isPaused}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
            stats={stats}
          />
        </div>
      </div>
    </div>
  );
};

export default App; 