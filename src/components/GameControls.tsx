import React from "react";
import { useLanguage } from "../contexts/LanguageContext";

interface GameControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  enableManualOverride: boolean;
  onStartPause: () => void;
  onManualOverrideToggle: () => void;
}

/**
 * 游戏控制组件
 * 负责游戏的启动、暂停、手动控制等功能
 */
const GameControls: React.FC<GameControlsProps> = ({
  isRunning,
  isPaused,
  enableManualOverride,
  onStartPause,
  onManualOverrideToggle,
}) => {
  const { t } = useLanguage();

  return (
    <div className="game-controls">
      <button
        onClick={onStartPause}
        className="btn btn-primary"
        title={
          isRunning
            ? isPaused
              ? t("tooltip.resume")
              : t("tooltip.pause")
            : t("tooltip.start")
        }
      >
        {isRunning ? (isPaused ? "▶" : "⏸") : "▶"}
      </button>

      <button
        onClick={onManualOverrideToggle}
        className={`btn ${enableManualOverride ? "btn-warning" : "btn-secondary"}`}
        title={
          enableManualOverride
            ? t("tooltip.manual-control-on")
            : t("tooltip.manual-control-off")
        }
      >
        手动
      </button>
    </div>
  );
};

export default GameControls;
