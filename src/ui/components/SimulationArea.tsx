import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import SimulationCanvas from '../views/SimulationCanvas';
import { globalEventBus } from '../../core/services/EventBus';
import { globalState } from '../../core/services/GlobalState';
import StatsOverlay from './StatsOverlay';
import GameControls from './GameControls';
import '../styles/game-area.css';

/**
 * 仿真区域组件
 * 该组件是仿真世界的主要显示区域。
 * 它包含了Canvas、统计信息浮层和游戏控制按钮。
 */
const SimulationArea: React.FC = () => {
  const { t } = useLanguage();
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
      <SimulationCanvas />
      <StatsOverlay />
      <div className="game-controls-container">
        <GameControls />
      </div>
    </div>
  );
};

export default SimulationArea; 