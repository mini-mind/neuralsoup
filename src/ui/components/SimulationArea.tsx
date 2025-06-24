import React, { useState, useEffect } from 'react';
import SimulationCanvas from '../views/SimulationCanvas';
import { globalEventBus } from '../../core/services/EventBus';
import { globalState } from '../../core/services/GlobalState';

/**
 * 仿真展示区组件
 * 包含仿真画布和底部的控制按钮、FPS统计
 */
const SimulationArea: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [fps, setFps] = useState(60);

  useEffect(() => {
    // 监听仿真状态变化
    const unsubscribe = globalState.subscribe((state) => {
      setIsRunning(state.simulationRunning || false);
    });

    // 模拟FPS更新（实际应该从仿真循环中获取）
    const fpsInterval = setInterval(() => {
      setFps(Math.floor(Math.random() * 10) + 55); // 55-65 FPS范围的模拟数据
    }, 100);

    return () => {
      unsubscribe();
      clearInterval(fpsInterval);
    };
  }, []);

  const handlePlayPause = () => {
    if (isRunning) {
      globalEventBus.emit('ui:stop', {});
    } else {
      globalEventBus.emit('ui:start', {});
    }
  };

  return (
    <div className="simulation-area">
      <div className="simulation-canvas">
        <SimulationCanvas />
      </div>
      
      <div className="simulation-controls">
        <div className="control-left">
          <button
            className={`control-button ${isRunning ? '' : 'paused'}`}
            onClick={handlePlayPause}
            title={isRunning ? '暂停仿真' : '开始仿真'}
          >
            {isRunning ? '⏸' : '▶'}
          </button>
        </div>
        
        <div className="fps-counter">
          FPS: {fps}
        </div>
      </div>
    </div>
  );
};

export default SimulationArea; 