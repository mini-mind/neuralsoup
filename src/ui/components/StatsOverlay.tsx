import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

/**
 * 统计显示组件
 * 负责在游戏区域显示实时FPS统计信息
 */
const StatsOverlay: React.FC = () => {
  const { t } = useLanguage();
  const [fps, setFps] = useState<number>(60);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    const updateFPS = () => {
      frameCountRef.current++;
      const currentTime = performance.now();
      
      // 每秒更新一次FPS
      if (currentTime - lastTimeRef.current >= 1000) {
        const calculatedFPS = Math.round((frameCountRef.current * 1000) / (currentTime - lastTimeRef.current));
        setFps(calculatedFPS);
        frameCountRef.current = 0;
        lastTimeRef.current = currentTime;
      }
      
      requestAnimationFrame(updateFPS);
    };

    const animationId = requestAnimationFrame(updateFPS);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="game-stats-overlay">
      <div className="stat-item">
        <span className="stat-label">{t("stats.fps")}</span>
        <span className="stat-value">{fps}</span>
      </div>
    </div>
  );
};

export default StatsOverlay;
