import React, { useState, useCallback, useRef, useEffect } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import SNNTopologyEditor from './components/SNNTopologyEditor';
import { SimulationEngine } from './engine/SimulationEngine';
import './App.css';

type ControlMode = 'manual' | 'script' | 'snn';

const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>('manual');
  const [enablePlayerInputInScript, setEnablePlayerInputInScript] = useState(false);
  const [scriptCode, setScriptCode] = useState(`// 脚本控制示例
// inputs: 视觉输入数组 (108维)
// 返回: [左转, 前进, 右转] 强度数组 (0-1)

// 分析前方视野区域
const leftArea = inputs.slice(0, 36);   // 左侧视野
const centerArea = inputs.slice(36, 72); // 中央视野  
const rightArea = inputs.slice(72, 108); // 右侧视野

// 检测食物（绿色值高）
const leftFood = leftArea.filter((_, i) => i % 3 === 1).reduce((a, b) => a + b, 0);
const centerFood = centerArea.filter((_, i) => i % 3 === 1).reduce((a, b) => a + b, 0);
const rightFood = rightArea.filter((_, i) => i % 3 === 1).reduce((a, b) => a + b, 0);

// 简单的食物追踪逻辑
if (centerFood > 5) {
  return [0, 1, 0]; // 前方有食物，直接前进
} else if (leftFood > rightFood) {
  return [0.8, 0.6, 0]; // 左侧食物多，左转前进
} else if (rightFood > leftFood) {
  return [0, 0.6, 0.8]; // 右侧食物多，右转前进
} else {
  return [0.2, 0.8, 0.2]; // 没找到食物，缓慢前进并轻微摆动
}`);
  
  const [stats, setStats] = useState({
    fps: 0,
    totalReward: 0,
    collisionCount: 0,
    emotionState: { pleasure: 1, arousal: 1 }
  });
  
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth * 0.6);
  const [canvasHeight, setCanvasHeight] = useState(window.innerHeight);

  const engineRef = useRef<SimulationEngine | null>(null);

  // 计算画布尺寸
  const calculateCanvasDimensions = useCallback(() => {
    const newWidth = window.innerWidth * 0.6;
    const newHeight = window.innerHeight;
    setCanvasWidth(newWidth);
    setCanvasHeight(newHeight);
  }, []);

  useEffect(() => {
    calculateCanvasDimensions();
    window.addEventListener('resize', calculateCanvasDimensions);
    return () => {
      window.removeEventListener('resize', calculateCanvasDimensions);
    };
  }, [calculateCanvasDimensions]);

  const handleStartPause = useCallback(() => {
    if (!isRunning) {
      // 开始运行
      setIsRunning(true);
      setIsPaused(false);
      if (engineRef.current) {
        engineRef.current.start();
      }
    } else if (isPaused) {
      // 从暂停状态恢复
      setIsPaused(false);
      if (engineRef.current) {
        (engineRef.current as any).resume();
      }
    } else {
      // 暂停
      setIsPaused(true);
      if (engineRef.current) {
        engineRef.current.pause();
      }
    }
  }, [isRunning, isPaused]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setStats({
      fps: 0,
      totalReward: 0,
      collisionCount: 0,
      emotionState: { pleasure: 1, arousal: 1 }
    });
    if (engineRef.current) {
      engineRef.current.reset();
    }
  }, []);

  const handleStatsUpdate = useCallback((newStats: any) => {
    setStats(newStats);
  }, []);

  const handleEngineReady = useCallback((engine: SimulationEngine) => {
    engineRef.current = engine;
  }, []);

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const renderControlContent = () => {
    switch (controlMode) {
      case 'manual':
        return (
          <div className="manual-control">
            <h4>手动控制说明</h4>
            <div className="control-instructions">
              <div className="instruction-section">
                <h5>键盘控制</h5>
                <ul>
                  <li><kbd>W</kbd> 或 <kbd>↑</kbd> - 前进</li>
                  <li><kbd>A</kbd> 或 <kbd>←</kbd> - 左转</li>
                  <li><kbd>D</kbd> 或 <kbd>→</kbd> - 右转</li>
                  <li>支持多键同时按下（如W+A边前进边左转）</li>
                  <li>A+D同时按下会抵消转向</li>
                </ul>
              </div>
              
              <div className="instruction-section">
                <h5>视觉系统</h5>
                <ul>
                  <li>120度前方视野</li>
                  <li>36个感受格子</li>
                  <li>每格子RGB颜色输入</li>
                  <li>共108维输入向量</li>
                </ul>
              </div>
              
              <div className="instruction-section">
                <h5>环境元素</h5>
                <ul>
                  <li>🟢 绿色：食物（正奖励）</li>
                  <li>⚫ 黑色：移动障碍物</li>
                  <li>⚪ 灰色：静止障碍物</li>
                  <li>🔵 蓝色：其他智能体</li>
                </ul>
              </div>
              
              <div className="instruction-section">
                <h5>情绪系统</h5>
                <ul>
                  <li>愉悦度：食物奖励增加</li>
                  <li>唤醒度：碰撞刺激增加</li>
                  <li>情绪影响智能体行为</li>
                </ul>
              </div>
            </div>
          </div>
        );
        
      case 'script':
        return (
          <div className="script-control">
            <div className="script-header">
              <h4>脚本控制</h4>
              <div className="script-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enablePlayerInputInScript}
                    onChange={(e) => setEnablePlayerInputInScript(e.target.checked)}
                  />
                  启用玩家控制信号
                </label>
              </div>
            </div>
            <div className="script-editor">
              <textarea
                value={scriptCode}
                onChange={(e) => setScriptCode(e.target.value)}
                placeholder="输入JavaScript控制脚本..."
                className="script-textarea"
              />
              <div className="script-info">
                <p><strong>输入参数:</strong> inputs (108维视觉数组)</p>
                <p><strong>返回值:</strong> [左转, 前进, 右转] 强度数组 (0-1)</p>
                <p><strong>玩家控制:</strong> {enablePlayerInputInScript ? 'W/A/D键可覆盖脚本输出' : '仅脚本控制'}</p>
                <button className="btn-small" onClick={() => {
                  try {
                    new Function('inputs', scriptCode);
                    alert('脚本语法检查通过！');
                  } catch (e) {
                    alert('脚本语法错误：' + (e as Error).message);
                  }
                }}>
                  语法检查
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'snn':
        return (
          <div className="snn-control">
            <SNNTopologyEditor 
              width={window.innerWidth * 0.4 - 40} 
              height={window.innerHeight - 80}
            />
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="app">
      {/* 左侧游戏区域 */}
      <div className="game-area">
        <SimulationCanvas 
          width={canvasWidth}
          height={canvasHeight}
          isRunning={isRunning && !isPaused}
          controlMode={controlMode}
          scriptCode={scriptCode}
          enablePlayerInputInScript={enablePlayerInputInScript}
          onStatsUpdate={handleStatsUpdate}
          onEngineReady={handleEngineReady}
        />
      </div>
      
      {/* 右侧控制区域 */}
      <div className="control-area">
        {/* 统一控制行：FPS、奖励、按钮、情绪、控制方式 */}
        <div className="unified-control-row">
          <div className="stats-section">
            <div className="stat-item">
              <span className="stat-label">FPS</span>
              <span className="stat-value">{stats.fps.toFixed(1)}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">奖励</span>
              <span className="stat-value positive">{formatNumber(stats.totalReward)}</span>
            </div>
          </div>
          
          <div className="control-buttons">
            <button 
              onClick={handleStartPause}
              className="btn btn-primary"
              title={isRunning ? (isPaused ? '继续' : '暂停') : '开始'}
            >
              {isRunning ? (isPaused ? '▶' : '⏸') : '▶'}
            </button>
            
            <button 
              onClick={handleReset}
              className="btn btn-secondary"
              title="重置"
            >
              ⏹
            </button>
          </div>
          
          <div className="emotion-values">
            <div className="emotion-item">
              <span className="emotion-label">愉悦</span>
              <span className="emotion-value">{stats.emotionState.pleasure.toFixed(1)}x</span>
            </div>
            
            <div className="emotion-item">
              <span className="emotion-label">唤醒</span>
              <span className="emotion-value">{stats.emotionState.arousal.toFixed(1)}x</span>
            </div>
          </div>
          
          <div className="control-mode-selector">
            <label>控制方式：</label>
            <select 
              value={controlMode} 
              onChange={(e) => setControlMode(e.target.value as ControlMode)}
              className="mode-select"
            >
              <option value="manual">手动控制</option>
              <option value="script">脚本控制</option>
              <option value="snn">SNN控制</option>
            </select>
          </div>
        </div>

        {/* 动态内容区域 */}
        <div className="content-area">
          {renderControlContent()}
        </div>
      </div>
    </div>
  );
};

export default App; 