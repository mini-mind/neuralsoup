import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { globalState } from "../../core/services/GlobalState";
import type { IAgent } from "../../shared/interfaces/IAgent";

/**
 * 统计显示组件
 * 负责在游戏区域显示实时统计信息，数据直接来源于GlobalState
 */
const StatsOverlay: React.FC = () => {
  const { t } = useLanguage();
  const [agents, setAgents] = useState<IAgent[]>([]);

  useEffect(() => {
    const unsubscribe = globalState.subscribe(state => {
      // 确保 worldState 是一个数组
      if (Array.isArray(state.worldState)) {
        setAgents(state.worldState);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <div className="game-stats-overlay">
      <div className="stat-item">
        <span className="stat-label">{t("stats.agentCount")}</span>
        <span className="stat-value">{agents.length}</span>
      </div>
      {/* 在这里可以添加更多的统计数据 */}
    </div>
  );
};

export default StatsOverlay;
