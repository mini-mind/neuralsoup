import React from 'react';
import './StatsPanel.css';

interface StatsPanelProps {
  stats: {
    fps: number;
    totalReward: number;
    collisionCount: number;
    emotionState: {
      pleasure: number;
      arousal: number;
    };
  };
}

const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => {
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <div className="stats-panel">
      <h3>仿真统计</h3>
      
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">FPS</span>
          <span className="stat-value">{stats.fps.toFixed(1)}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">主智能体</span>
          <span className="stat-value">SNN控制</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">总奖励</span>
          <span className="stat-value positive">{formatNumber(stats.totalReward)}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">总碰撞</span>
          <span className="stat-value negative">{formatNumber(stats.collisionCount)}</span>
        </div>
      </div>

      <div className="emotion-stats">
        <h4>主智能体情绪状态</h4>
        
        <div className="emotion-bar-container">
          <div className="emotion-bar">
            <span className="emotion-label">愉悦度</span>
            <div className="bar-track">
              <div 
                className="bar-fill pleasure" 
                style={{ width: `${Math.max(0, (stats.emotionState.pleasure + 1) * 50)}%` }}
              />
            </div>
            <span className="emotion-value">
              {stats.emotionState.pleasure.toFixed(2)}
            </span>
          </div>
          
          <div className="emotion-bar">
            <span className="emotion-label">唤醒度</span>
            <div className="bar-track">
              <div 
                className="bar-fill arousal" 
                style={{ width: `${stats.emotionState.arousal * 100}%` }}
              />
            </div>
            <span className="emotion-value">
              {stats.emotionState.arousal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="vision-info">
        <h4>视觉系统</h4>
        <p>120度视野，8个感受格子</p>
        <p>每格子RGB颜色输入，共24维</p>
      </div>
    </div>
  );
};

export default StatsPanel; 