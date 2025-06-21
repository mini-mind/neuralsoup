import React, { useState, useCallback, useRef, useEffect } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
// 移除SNN编辑器导入，因为要隐藏模型控制功能
// import SNNTopologyEditor from './components/SNNTopologyEditor';
import AgentParametersModal, { AgentParameters } from './components/AgentParametersModal';
import AgentParametersPanel from './components/AgentParametersPanel';
import TabPanel from './components/TabPanel';
import CodeEditor from './components/CodeEditor';
import { SimulationEngine } from './engine/SimulationEngine';
import './App.css';

const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // 默认使用SNN控制模式（智能体自主行为）
  const [isScriptMode, setIsScriptMode] = useState(false);
  const [enableManualOverride, setEnableManualOverride] = useState(false);

  
  // 拖拽分割条状态
  const [gameAreaWidth, setGameAreaWidth] = useState(60); // 百分比
  const [isDragging, setIsDragging] = useState(false);
  
  // onFrame函数代码
  const [onFrameCode, setOnFrameCode] = useState(`// 实现每帧的智能体控制逻辑
// 这段代码会在点击"应用脚本"时执行一次进行初始化
// 之后每帧只调用onFrame函数

// 全局变量（在脚本应用时初始化一次）
let stepCount = 0;
let memory = {};
let lastDirection = 0;

// state: 主智能体的感受器数据
//   - vision: number[] - 视觉数据 (n个单元格 × 3通道 RGB)
//   - gotReward: boolean - 上一帧是否获得奖励
// action: 效应器控制对象
//   - move(direction): void - 移动函数，direction为[前进, 左转, 右转]的强度数组

function onFrame(state, action) {
  stepCount++; // 记录步数
  
  // 示例：简单的前进行为
  action.move([0.5, 0, 0]); // 50%速度前进
  
  // 示例：检测奖励
  if (state.gotReward) {
    console.log('获得奖励！步数:', stepCount);
    if (!memory.totalReward) memory.totalReward = 0;
    memory.totalReward++;
  }
  
  // 示例：基于视觉的简单反应
  // const avgRed = state.vision.filter((_, i) => i % 3 === 0).reduce((a, b) => a + b) / (state.vision.length / 3);
  // if (avgRed > 0.5) {
  //   action.move([0, 0.3, 0]); // 看到红色时左转
  // }
  
  return null;
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
    const newWidth = window.innerWidth * (gameAreaWidth / 100);
    const newHeight = window.innerHeight;
    setCanvasWidth(newWidth);
    setCanvasHeight(newHeight);
  }, [gameAreaWidth]);

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

  // 应用脚本
  const handleApplyScript = useCallback(() => {
    if (!onFrameCode.trim()) {
      alert('请先编写onFrame函数代码');
      return;
    }
    
    if (!engineRef.current) {
      alert('仿真引擎未就绪');
      return;
    }
    
    try {
      // 先设置脚本代码
      if (typeof (engineRef.current as any).setScriptCode === 'function') {
        (engineRef.current as any).setScriptCode(onFrameCode);
      }
      
      // 然后应用脚本（执行初始化）
      if (typeof (engineRef.current as any).applyScript === 'function') {
        const success = (engineRef.current as any).applyScript();
        
        if (success) {
          // 脚本应用成功，切换到脚本模式
          setIsScriptMode(true);
          console.log('脚本已成功应用并切换到脚本模式');
        } else {
          alert('脚本应用失败：未找到onFrame函数或脚本执行出错');
        }
      } else {
        alert('引擎不支持脚本应用功能');
      }
      
    } catch (e) {
      alert('脚本应用失败：' + (e as Error).message);
    }
  }, [onFrameCode]);

  // 拖拽处理函数
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newWidth = (e.clientX / window.innerWidth) * 100;
      setGameAreaWidth(Math.max(30, Math.min(80, newWidth))); // 限制在30%-80%之间
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // 拖动结束后强制重绘，即使在暂停状态
    if (engineRef.current && typeof (engineRef.current as any).forceRender === 'function') {
      (engineRef.current as any).forceRender();
    }
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  // 创建标签页内容
  const scriptTabContent = (
    <div className="script-tab-content">
      <div className="script-control">
        <div className="onframe-section">
          <CodeEditor
            value={onFrameCode}
            onChange={setOnFrameCode}
            placeholder="编写onFrame函数代码..."
          />
        </div>
        <div className="script-actions">
          <button 
            onClick={handleApplyScript}
            className="btn btn-apply"
            title="应用脚本"
          >
            ✓ 应用脚本
          </button>
        </div>
      </div>
    </div>
  );

  const agentParamsTabContent = (
    <div className="agent-params-tab-content">
      <AgentParametersPanel
        currentParams={agentParameters}
        onApply={handleAgentParametersApply}
      />
    </div>
  );

  const tabs = [
    {
      id: 'script',
      label: '脚本编辑',
      content: scriptTabContent
    },
    {
      id: 'agent-params',
      label: '智能体参数',
      content: agentParamsTabContent
    }
  ];

  return (
    <div className="app">
      {/* 左侧游戏区域 */}
      <div className="game-area" style={{ width: `${gameAreaWidth}%` }}>
        <SimulationCanvas 
          width={canvasWidth}
          height={canvasHeight}
          isRunning={isRunning && !isPaused}
          isScriptMode={isScriptMode}
          scriptCode={onFrameCode}
          enablePlayerInputInScript={enableManualOverride}
          onStatsUpdate={handleStatsUpdate}
          onEngineReady={handleEngineReady}
          enableFogOfWar={true}
        />
        
        {/* 游戏区域统计指标 */}
        <div className="game-stats-overlay">
          <div className="stat-item">
            <span className="stat-label">FPS</span>
            <span className="stat-value">{stats.fps.toFixed(1)}</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">奖励</span>
            <span className="stat-value positive">{formatNumber(stats.totalReward)}</span>
          </div>
        </div>
      </div>
      
      {/* 拖拽分割条 */}
      <div 
        className={`resize-handle ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="resize-indicator">
          <div className="resize-line"></div>
          <div className="resize-line"></div>
          <div className="resize-line"></div>
        </div>
      </div>
      
      {/* 右侧控制区域 */}
      <div className="control-area" style={{ width: `${100 - gameAreaWidth}%` }}>
        {/* 新的顶部布局 */}
        <div className="control-header">
          {/* 左半边：标题 */}
          <div className="header-left">
            <h1 className="app-title">NeuralSoup</h1>
          </div>
          
          <div className="header-right">
            <div className="game-controls">
              <button 
                onClick={handleStartPause}
                className="btn btn-primary"
                title={isRunning ? (isPaused ? '继续' : '暂停') : '开始'}
              >
                {isRunning ? (isPaused ? '▶' : '⏸') : '▶'}
              </button>
              
              <button 
                onClick={() => setEnableManualOverride(!enableManualOverride)}
                className={`btn ${enableManualOverride ? 'btn-warning' : 'btn-secondary'}`}
                title={enableManualOverride ? "关闭手动控制" : "启用手动控制 (WASD/方向键: W↑前进 S↓后退 A←左转 D→右转)"}
              >
                🎮
              </button>
            </div>
          </div>
        </div>

        {/* 标签页内容区域 */}
        <div className="content-area">
          <TabPanel tabs={tabs} defaultActiveTab="script" />
        </div>
      </div>
      
      {/* 智能体参数设置模态框 - 保留用于后向兼容 */}
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