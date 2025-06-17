import React, { useState } from 'react';
import './ControlPanel.css';

interface ControlPanelProps {
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
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

const ControlPanel: React.FC<ControlPanelProps> = ({
  isRunning,
  isPaused,
  onStart,
  onPause,
  onReset,
  stats
}) => {
  const [showHelp, setShowHelp] = useState(false);

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <div className="control-panel">
      <div className="panel-header">
        <h3>DYNN 仿真控制台</h3>
        <button 
          className="help-btn"
          onClick={() => setShowHelp(!showHelp)}
          title="帮助"
        >
          ?
        </button>
      </div>

      {showHelp && (
        <div className="help-popup">
          <div className="help-content">
            <h4>控制说明</h4>
            <p><strong>键盘控制（主智能体）：</strong></p>
            <ul>
              <li>W / ↑ : 前进</li>
              <li>A / ← : 左转</li>
              <li>D / → : 右转</li>
            </ul>
            
            <h4>视觉系统</h4>
            <p><strong>120度视野，36个感受格子</strong></p>
            <ul>
              <li>绿色：食物</li>
              <li>黑色：障碍物</li>
              <li>蓝色：其他智能体</li>
              <li>天空蓝：背景</li>
            </ul>
            <p>每个格子显示该方向最近元素的颜色，并应用邻域模糊效果</p>
          </div>
        </div>
      )}
      
      <div className="control-section">
        <div className="control-buttons">
          <button 
            onClick={onStart}
            disabled={isRunning && !isPaused}
            className="btn btn-start"
            title={isRunning ? '继续' : '开始'}
          >
            {isRunning ? '▶' : '▶'}
          </button>
          
          <button 
            onClick={onPause}
            disabled={!isRunning}
            className="btn btn-pause"
            title={isPaused ? '继续' : '暂停'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>
          
          <button 
            onClick={onReset}
            className="btn btn-reset"
            title="重置"
          >
            ⏹
          </button>
        </div>

        <div className="status-info">
          <span className={`status-indicator ${
            isRunning 
              ? (isPaused ? 'paused' : 'running') 
              : 'stopped'
          }`}>
            {isRunning 
              ? (isPaused ? '已暂停' : '运行中') 
              : '已停止'}
          </span>
        </div>
      </div>

      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">FPS</span>
            <span className="stat-value">{stats.fps.toFixed(1)}</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">奖励</span>
            <span className="stat-value positive">{formatNumber(stats.totalReward)}</span>
          </div>
        </div>

        <div className="emotion-section">
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
    </div>
  );
};

export default ControlPanel; 