import React from 'react';
import GameControls from './GameControls';

/**
 * 应用头部组件
 * 包含应用标题和游戏控制按钮
 */
const AppHeader: React.FC = () => {
  return (
    <div className="control-header">
      {/* 左半边：标题 */}
      <div className="header-left">
        <h1 className="app-title">NeuralSoup</h1>
      </div>

      {/* 右半边：游戏控制 */}
      <div className="header-right">
        <GameControls />
      </div>
    </div>
  );
};

export default AppHeader;
