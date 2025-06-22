import React, { useState, useCallback, useRef, useEffect } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
// 移除SNN编辑器导入，因为要隐藏模型控制功能
// import SNNTopologyEditor from './components/SNNTopologyEditor';
import AgentParametersModal, { AgentParameters } from './components/AgentParametersModal';
import AgentParametersPanel from './components/AgentParametersPanel';
import TabPanel from './components/TabPanel';
import CodeEditor from './components/CodeEditor';
import SettingsPanel from './components/SettingsPanel';
import { useLanguage } from './contexts/LanguageContext';
import { SimulationEngine } from './engine/SimulationEngine';
import './App.css';

const App: React.FC = () => {
  const { t } = useLanguage();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // 默认使用SNN控制模式（智能体自主行为）
  const [isScriptMode, setIsScriptMode] = useState(false);
  const [enableManualOverride, setEnableManualOverride] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mobileFullscreenTab, setMobileFullscreenTab] = useState<string | null>(null);
  const [isScriptApplied, setIsScriptApplied] = useState(false); // 脚本应用状态

  
  // 拖拽分割条状态
  const [gameAreaWidth, setGameAreaWidth] = useState(60); // 百分比
  const [isDragging, setIsDragging] = useState(false);
  
  // onFrame函数代码
  const [onFrameCode, setOnFrameCode] = useState(`// 智能体控制脚本 - 极简示例
// 这段代码在点击"应用脚本"时执行一次进行初始化
// 之后每帧调用onFrame函数

// 全局变量
let stepCount = 0;

// agent: 智能体对象，包含：
//   - vision: number[] - 视觉数据 (n个单元格 × 3通道 RGB)
//   - reward: number - 上一帧获得的奖励数值
//   - move(direction): void - 移动函数，direction为[前进, 左转, 右转, 后退]

function onFrame(agent) {
  stepCount++;
  
  // 基础行为：前进
  agent.move([0.6, 0, 0, 0]); // [前进0.6, 左转0, 右转0, 后退0]
  
  // 获得奖励时加速
  if (agent.reward > 0) {
    console.log('获得奖励:', agent.reward);
    agent.move([1.0, 0, 0, 0]); // 全速前进
  }
  
  // 每100步随机转向
  if (stepCount % 100 === 0) {
    const turn = Math.random() > 0.5 ? [0.3, 0.5, 0, 0] : [0.3, 0, 0.5, 0];
    agent.move(turn); // [前进, 左转, 右转, 后退]
  }
}`)
  
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
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // 移动端：垂直布局，使用全宽和60%高度
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight * 0.6; // 60%高度给游戏区域
      setCanvasWidth(newWidth);
      setCanvasHeight(newHeight);
    } else {
      // 桌面端：水平布局，使用百分比宽度和全高度
      const newWidth = window.innerWidth * (gameAreaWidth / 100);
      const newHeight = window.innerHeight;
      setCanvasWidth(newWidth);
      setCanvasHeight(newHeight);
    }
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
          setIsScriptApplied(true);
          console.log('脚本已成功应用并切换到脚本模式');
        } else {
          setIsScriptApplied(false);
          alert('脚本应用失败：未找到onFrame函数或脚本执行出错');
        }
      } else {
        setIsScriptApplied(false);
        alert('引擎不支持脚本应用功能');
      }
      
    } catch (e) {
      setIsScriptApplied(false);
      alert('脚本应用失败：' + (e as Error).message);
    }
  }, [onFrameCode]);

  // 监听脚本代码变化，重置应用状态
  useEffect(() => {
    setIsScriptApplied(false);
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

  // 检查是否为移动端
  const isMobile = window.innerWidth <= 768;

  // 创建标签页内容
  const scriptTabContent = (
    <div className="script-tab-content">
      <div className="script-control">
        <div className="onframe-section">
          <CodeEditor
            value={onFrameCode}
            onChange={setOnFrameCode}
            placeholder={t('placeholder.code-editor')}
          />
        </div>
        <div className="script-actions">
          <button 
            onClick={handleApplyScript}
            className={`btn ${isScriptApplied ? 'btn-success' : 'btn-apply'}`}
            title={isScriptApplied ? '脚本已应用' : t('tooltip.apply-script')}
          >
            {isScriptApplied ? '✓ 已应用' : t('btn.apply-script')}
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
      label: t('tab.script'),
      content: scriptTabContent
    },
    {
      id: 'agent-params',
      label: t('tab.agent-params'),
      content: agentParamsTabContent
    }
  ];

  return (
    <div className={`app ${isMobile && mobileFullscreenTab ? 'mobile-fullscreen' : ''}`}>
      {/* 左侧游戏区域 - 在移动端全屏模式下隐藏 */}
      {!(isMobile && mobileFullscreenTab) && (
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
              <span className="stat-label">{t('stats.fps')}</span>
              <span className="stat-value">{stats.fps.toFixed(1)}</span>
            </div>
            
            <div className="stat-item">
              <span className="stat-label">{t('stats.reward')}</span>
              <span className="stat-value positive">{formatNumber(stats.totalReward)}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* 拖拽分割条 - 在移动端全屏模式下隐藏 */}
      {!(isMobile && mobileFullscreenTab) && (
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
      )}
      
      {/* 右侧控制区域 */}
      <div 
        className="control-area" 
        style={{ 
          width: isMobile && mobileFullscreenTab ? '100%' : `${100 - gameAreaWidth}%` 
        }}
      >
        {/* 新的顶部布局 - 在移动端全屏模式下隐藏 */}
        {!(isMobile && mobileFullscreenTab) && (
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
                title={isRunning ? (isPaused ? t('tooltip.resume') : t('tooltip.pause')) : t('tooltip.start')}
              >
                {isRunning ? (isPaused ? '▶' : '⏸') : '▶'}
              </button>
              
              <button 
                onClick={() => setEnableManualOverride(!enableManualOverride)}
                className={`btn ${enableManualOverride ? 'btn-warning' : 'btn-secondary'}`}
                title={enableManualOverride ? t('tooltip.manual-control-on') : t('tooltip.manual-control-off')}
              >
                🎮
              </button>
            </div>
          </div>
        </div>
        )}

        {/* 标签页内容区域 - 移动端正常模式下只显示标签页头部，不显示内容 */}
        <div className="content-area">
          <TabPanel 
            tabs={tabs} 
            defaultActiveTab="script" 
            showSettingsButton={true}
            onSettingsClick={() => setShowSettingsModal(true)}
            isMobile={isMobile}
            mobileFullscreenTab={mobileFullscreenTab}
            onMobileTabClick={setMobileFullscreenTab}
            onMobileCollapseClick={() => setMobileFullscreenTab(null)}
            showContentInMobileNormalMode={false}
            collapseText={t('mobile.collapse')}
          />
        </div>
      </div>
      
      {/* 智能体参数设置模态框 - 保留用于后向兼容 */}
      <AgentParametersModal
        isOpen={showAgentParamsModal}
        onClose={() => setShowAgentParamsModal(false)}
        onApply={handleAgentParametersApply}
        currentParams={agentParameters}
      />

      {/* 设置模态框 */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('settings.title')}</h3>
              <button 
                className="modal-close-btn"
                onClick={() => setShowSettingsModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <SettingsPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App; 