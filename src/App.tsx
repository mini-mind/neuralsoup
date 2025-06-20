import React, { useState, useCallback, useRef, useEffect } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import SNNTopologyEditor from './components/SNNTopologyEditor';
import AgentParametersModal, { AgentParameters } from './components/AgentParametersModal';
import { SimulationEngine } from './engine/SimulationEngine';
import './App.css';

type ControlMode = 'manual' | 'script' | 'snn';

const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [controlMode, setControlMode] = useState<ControlMode>('manual');
  const [enablePlayerInputInScript, setEnablePlayerInputInScript] = useState(false);
  const [scriptCode, setScriptCode] = useState(`// 脚本控制示例
// inputs: 视觉输入数组 (动态维度，取决于视野格子数量 × 3)
// 返回: [左转, 前进, 右转] 强度数组 (0-1)

// 获取视野格子数量
const cellCount = inputs.length / 3;
const cellsPerSection = Math.floor(cellCount / 3);

// 分析前方视野区域
const leftArea = inputs.slice(0, cellsPerSection * 3);                    // 左侧视野
const centerArea = inputs.slice(cellsPerSection * 3, cellsPerSection * 6); // 中央视野  
const rightArea = inputs.slice(cellsPerSection * 6);                       // 右侧视野

// 检测食物（绿色值高）
const leftFood = leftArea.filter((_, i) => i % 3 === 1).reduce((a, b) => a + b, 0);
const centerFood = centerArea.filter((_, i) => i % 3 === 1).reduce((a, b) => a + b, 0);
const rightFood = rightArea.filter((_, i) => i % 3 === 1).reduce((a, b) => a + b, 0);

// 简单的食物追踪逻辑
if (centerFood > 2) {
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
    neuralState: { motivation: 0, stress: 0, homeostasis: 0.5 }
  });
  
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth * 0.6);
  const [canvasHeight, setCanvasHeight] = useState(window.innerHeight);
  
  // 智能体参数状态
  const [showAgentParamsModal, setShowAgentParamsModal] = useState(false);
  const [agentParameters, setAgentParameters] = useState<AgentParameters>({
    visionCells: 36,
    visionRange: 250,
    visionAngle: 120
  });

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
      neuralState: { motivation: 0, stress: 0, homeostasis: 0.5 }
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
    
    // 获取并设置初始参数
    if (typeof (engine as any).getAgentParameters === 'function') {
      const initialParams = (engine as any).getAgentParameters();
      setAgentParameters(initialParams);
    }
  }, []);

  const handleAgentParametersApply = useCallback((params: AgentParameters) => {
    setAgentParameters(params);
    
    // 更新引擎参数
    if (engineRef.current && typeof (engineRef.current as any).updateAgentParameters === 'function') {
      (engineRef.current as any).updateAgentParameters(params);
    }
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
                  <li>{agentParameters.visionAngle}度前方视野</li>
                  <li>{agentParameters.visionCells}个感受格子</li>
                  <li>每格子RGB颜色输入</li>
                  <li>共{agentParameters.visionCells * 3}维输入向量</li>
                  <li>视野范围：{agentParameters.visionRange}像素</li>
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
                <h5>神经系统</h5>
                <ul>
                  <li>动机（多巴胺）：奖励预测误差</li>
                  <li>压力（去甲肾上腺素）：环境不确定性</li>
                  <li>稳态（血清素）：风险规避阈值</li>
                  <li>神经信号调节行为策略</li>
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
                <p><strong>输入参数:</strong> inputs ({agentParameters.visionCells * 3}维视觉数组)</p>
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
                width={window.innerWidth * 0.4} 
                height={window.innerHeight - 80}
                visionCells={agentParameters.visionCells}
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
            
            <button 
              onClick={() => setShowAgentParamsModal(true)}
              className="btn btn-secondary"
              title="智能体参数设置"
            >
              ⚙️
            </button>
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
              <option value="snn">模型控制</option>
            </select>
          </div>
        </div>

        {/* 动态内容区域 */}
        <div className={`content-area ${controlMode === 'snn' ? 'snn-mode' : ''}`}>
          {renderControlContent()}
        </div>
      </div>
      
      {/* 智能体参数设置模态框 */}
      <AgentParametersModal
        isOpen={showAgentParamsModal}
        onClose={() => setShowAgentParamsModal(false)}
        onApply={handleAgentParametersApply}
        currentParams={agentParameters}
      />
    </div>
  );
};

export default App; 