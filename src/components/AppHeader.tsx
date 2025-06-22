import React from "react";
import GameControls from "./GameControls";

interface AppHeaderProps {
  isRunning: boolean;
  isPaused: boolean;
  enableManualOverride: boolean;
  onStartPause: () => void;
  onManualOverrideToggle: () => void;
}

/**
 * 应用头部组件
 * 包含应用标题和游戏控制按钮
 */
const AppHeader: React.FC<AppHeaderProps> = ({
  isRunning,
  isPaused,
  enableManualOverride,
  onStartPause,
  onManualOverrideToggle,
}) => {
  return (
    <div className="control-header">
      {/* 左半边：标题 */}
      <div className="header-left">
        <h1 className="app-title">NeuralSoup</h1>
      </div>

      {/* 右半边：游戏控制 */}
      <div className="header-right">
        <GameControls
          isRunning={isRunning}
          isPaused={isPaused}
          enableManualOverride={enableManualOverride}
          onStartPause={onStartPause}
          onManualOverrideToggle={onManualOverrideToggle}
        />
      </div>
    </div>
  );
};

export default AppHeader;
