import React from "react";
import { useLanguage } from "../contexts/LanguageContext";

interface StatsData {
  fps: number;
  totalReward: number;
  collisionCount: number;
  neuralState: { motivation: number; stress: number; homeostasis: number };
}

interface StatsOverlayProps {
  stats: StatsData;
}

/**
 * 统计显示组件
 * 负责在游戏区域显示实时统计信息
 */
const StatsOverlay: React.FC<StatsOverlayProps> = ({ stats }) => {
  const { t } = useLanguage();

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <div className="game-stats-overlay">
      <div className="stat-item">
        <span className="stat-label">{t("stats.fps")}</span>
        <span className="stat-value">{stats.fps.toFixed(1)}</span>
      </div>

      <div className="stat-item">
        <span className="stat-label">{t("stats.reward")}</span>
        <span className="stat-value positive">
          {formatNumber(stats.totalReward)}
        </span>
      </div>
    </div>
  );
};

export default StatsOverlay;
