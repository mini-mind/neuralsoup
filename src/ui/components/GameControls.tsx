import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { globalEventBus } from '../../core/services/EventBus';
import { globalState } from '../../core/services/GlobalState';

/**
 * 游戏控制组件
 * 负责游戏的启动、暂停等。通过全局事件和状态与核心逻辑解耦。
 */
const GameControls: React.FC = () => {
  const { t } = useLanguage();
  const [isRunning, setIsRunning] = useState(globalState.getState().simulationRunning);

  useEffect(() => {
    // 订阅状态变更
    const unsubscribe = globalState.subscribe(state => {
      setIsRunning(state.simulationRunning);
    });
    return unsubscribe;
  }, []);

  const handleToggleSimulation = () => {
    // 发布事件，而不是直接调用函数
    if (isRunning) {
      globalEventBus.emit('ui:stop', {});
    } else {
      globalEventBus.emit('ui:start', {});
    }
  };

  return (
    <div className="game-controls">
      <button
        onClick={handleToggleSimulation}
        className="btn btn-primary"
        title={isRunning ? t('tooltip.pause') : t('tooltip.start')}
      >
        {isRunning ? '⏸' : '▶'}
      </button>
      {/* 其他控件可以按同样模式添加 */}
    </div>
  );
};

export default GameControls;
