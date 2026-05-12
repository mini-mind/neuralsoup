import React, { useState, useCallback, useEffect } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import SNNTopologyEditor from './components/SNNTopologyEditor';
import AgentParametersModal, { AgentParameters } from './components/AgentParametersModal';
import { SimulationEngine } from './engine/SimulationEngine';
import type { SimulationState } from './types/simulation';
import './App.css';

type ControlMode = 'manual' | 'script' | 'snn';

const mapControlModeToEngine = (mode: ControlMode): 'keyboard' | 'script' | 'snn' => {
  switch (mode) {
    case 'manual':
      return 'keyboard';
    case 'script':
      return 'script';
    case 'snn':
      return 'snn';
  }
};

const App: React.FC = () => {
  const [runState, setRunState] = useState<'idle' | 'running' | 'paused'>('idle');
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
  const [engine, setEngine] = useState<SimulationEngine | null>(null);

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

  useEffect(() => {
    if (!engine) {
      return;
    }

    engine.setScriptCode(scriptCode);
    engine.setEnablePlayerInputInScript(enablePlayerInputInScript);
    engine.setControlMode(mapControlModeToEngine(controlMode));
  }, [engine, controlMode, scriptCode, enablePlayerInputInScript]);

  const handleStartPause = useCallback(() => {
    if (!engine) {
      return;
    }

    if (runState === 'idle') {
      engine.start();
    } else if (runState === 'paused') {
      engine.resume();
    } else {
      engine.pause();
    }
  }, [engine, runState]);

  const handleReset = useCallback(() => {
    setStats({
      fps: 0,
      totalReward: 0,
      collisionCount: 0,
      neuralState: { motivation: 0, stress: 0, homeostasis: 0.5 }
    });
    if (engine) {
      engine.reset();
    }
  }, [engine]);

  const handleStatsUpdate = useCallback((newStats: SimulationState['stats']) => {
    setStats(newStats);
  }, []);

  const handleEngineReady = useCallback((engine: SimulationEngine) => {
    setEngine(engine);
    setAgentParameters(engine.getAgentParameters());
    setRunState(engine.getLifecycleState());
  }, []);

  const handleAgentParametersApply = useCallback((params: AgentParameters) => {
    setAgentParameters(params);

    if (engine) {
      engine.updateAgentParameters(params);
    }
  }, [engine]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const renderControlContent = () => {
    switch (controlMode) {
      case 'manual':
        return (
          <div className="manual-control" data-testid="manual-control-panel">
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
          <div className="script-control" data-testid="script-control-panel">
            <div className="script-header">
              <h4>脚本控制</h4>
              <div className="script-options">
                <label className="checkbox-label" htmlFor="script-player-override">
                  <input
                    id="script-player-override"
                    data-testid="script-player-override"
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
                data-testid="script-code-input"
                value={scriptCode}
                onChange={(e) => setScriptCode(e.target.value)}
                placeholder="输入JavaScript控制脚本..."
                className="script-textarea"
              />
              <div className="script-info">
                <p><strong>输入参数:</strong> inputs ({agentParameters.visionCells * 3}维视觉数组)</p>
                <p><strong>返回值:</strong> [左转, 前进, 右转] 强度数组 (0-1)</p>
                <p><strong>玩家控制:</strong> {enablePlayerInputInScript ? 'W/A/D键可覆盖脚本输出' : '仅脚本控制'}</p>
                <button
                  className="btn-small"
                  data-testid="script-syntax-check"
                  onClick={() => {
                  try {
                    new Function('inputs', scriptCode);
                    alert('脚本语法检查通过！');
                  } catch (e) {
                    alert('脚本语法错误：' + (e as Error).message);
                  }
                }}
                >
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
    <div className="app" data-testid="app-shell">
      {/* 左侧游戏区域 */}
      <div className="game-area" data-testid="simulation-panel">
        <SimulationCanvas 
          width={canvasWidth}
          height={canvasHeight}
          onStatsUpdate={handleStatsUpdate}
          onEngineReady={handleEngineReady}
          onLifecycleChange={setRunState}
        />
      </div>
      
      {/* 右侧控制区域 */}
      <div className="control-area" data-testid="control-panel">
        {/* 统一控制行：FPS、奖励、按钮、情绪、控制方式 */}
        <div className="unified-control-row">
          <div className="stats-section">
            <div className="stat-item">
              <span className="stat-label">FPS</span>
              <span className="stat-value" data-testid="fps-value">{stats.fps.toFixed(1)}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">奖励</span>
              <span className="stat-value positive" data-testid="reward-value">{formatNumber(stats.totalReward)}</span>
            </div>
          </div>
          
          <div className="control-buttons">
            <button 
              onClick={handleStartPause}
              className="btn btn-primary"
              title={runState === 'idle' ? '开始' : runState === 'paused' ? '继续' : '暂停'}
              aria-label={runState === 'idle' ? '开始' : runState === 'paused' ? '继续' : '暂停'}
              data-testid="start-pause-button"
            >
              {runState === 'running' ? '⏸' : '▶'}
            </button>
            
            <button 
              onClick={handleReset}
              className="btn btn-secondary"
              title="重置"
              aria-label="重置"
              data-testid="reset-button"
            >
              ⏹
            </button>
            
            <button 
              onClick={() => setShowAgentParamsModal(true)}
              className="btn btn-secondary"
              title="智能体参数设置"
              aria-label="智能体参数设置"
              data-testid="agent-params-button"
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
              data-testid="control-mode-select"
            >
              <option value="manual">手动控制</option>
              <option value="script">脚本控制</option>
              <option value="snn">拓扑沙盒</option>
            </select>
          </div>
        </div>

        <div className="diagnostic-strip" data-testid="app-diagnostics">
          <span data-testid="simulation-run-state">{runState}</span>
          <span data-testid="control-mode-value">{controlMode}</span>
          <span data-testid="vision-cells-value">{agentParameters.visionCells}</span>
          <span data-testid="vision-range-value">{agentParameters.visionRange}</span>
          <span data-testid="vision-angle-value">{agentParameters.visionAngle}</span>
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
