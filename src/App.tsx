import React, { useState, useCallback, useRef, useEffect } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
// 移除SNN编辑器导入，因为要隐藏模型控制功能
// import SNNTopologyEditor from './components/SNNTopologyEditor';
import AgentParametersModal, { AgentParameters } from './components/AgentParametersModal';
import CodeEditor from './components/CodeEditor';
import { SimulationEngine } from './engine/SimulationEngine';
import './App.css';

// 支持两种模式：手动控制(manual)和脚本控制(script)
type ControlMode = 'manual' | 'script';

// 版本信息接口
interface ScriptVersion {
  id: string;
  name: string;
  timestamp: number;
  lifecycleFunctions: LifecycleFunctions;
}

// 生命周期函数接口
interface LifecycleFunctions {
  onStart: string;
  onUpdate: string;
  onCollision: string;
  onReward: string;
}

interface LifecycleConfig {
  key: keyof LifecycleFunctions;
  title: string;
  icon: string;
  description: string;
  tooltip: string;
}

const lifecycleConfigs: LifecycleConfig[] = [
  {
    key: 'onStart',
    title: '初始化',
    icon: '🚀',
    description: 'function onStart()',
    tooltip: '智能体启动时执行一次的初始化函数\n\n参数：无\n返回值：无\n\n用途：初始化全局变量、设置初始状态、配置智能体行为参数等。'
  },
  {
    key: 'onUpdate',
    title: '主控制',
    icon: '🎮',
    description: 'function controlAgent(inputs): [number, number, number]',
    tooltip: '每帧执行的主要控制逻辑函数\n\n参数：\n• inputs: number[] - 视觉输入数组，长度为 visionCells × 3\n\n返回值：\n• [leftTurn, forward, rightTurn] - 三元素数组\n• 每个值范围 0-1，表示对应动作的强度\n\n用途：根据视觉输入计算智能体的移动控制指令。'
  },
  {
    key: 'onCollision',
    title: '碰撞处理',
    icon: '💥',
    description: 'function handleCollision()',
    tooltip: '智能体与障碍物碰撞时触发的处理函数\n\n参数：无\n返回值：无\n\n用途：记录碰撞信息、调整行为策略、更新内部状态等碰撞响应逻辑。'
  },
  {
    key: 'onReward',
    title: '奖励处理',
    icon: '🎁',
    description: 'function handleReward(rewardValue)',
    tooltip: '智能体获得奖励时触发的处理函数\n\n参数：\n• rewardValue: number - 获得的奖励数值\n\n返回值：无\n\n用途：记录奖励信息、强化成功行为、更新学习策略等奖励响应逻辑。'
  }
];

const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // 默认使用手动控制模式
  const [controlMode, setControlMode] = useState<ControlMode>('manual');
  const [enablePlayerInputOverride, setEnablePlayerInputOverride] = useState(true);
  // 脚本应用状态
  const [isScriptApplied, setIsScriptApplied] = useState(false);
  
  // 折叠状态
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // 版本控制状态
  const [scriptVersions, setScriptVersions] = useState<ScriptVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string>('');
  
  // 拖拽分割条状态
  const [gameAreaWidth, setGameAreaWidth] = useState(60); // 百分比
  const [isDragging, setIsDragging] = useState(false);
  
  // 生命周期函数代码
  const [lifecycleFunctions, setLifecycleFunctions] = useState<LifecycleFunctions>({
    onStart: `// 智能体启动时执行（仅一次）
// 可在此初始化全局变量
let memory = {};
let stepCount = 0;
let lastDirection = 0;`,
    
    onUpdate: `// 每帧执行的主控制逻辑
// inputs: 视觉输入数组 (${36 * 3}维)
// 返回: [左转, 前进, 右转] 强度 (0-1)

stepCount++;

// 手动控制模板 - 返回全零让玩家键盘控制
return [0, 0, 0];`,
    
    onCollision: `// 碰撞时执行
// 记录碰撞，调整行为策略
if (!memory.collisionCount) memory.collisionCount = 0;
memory.collisionCount++;`,
    
    onReward: `// 获得奖励时执行
// rewardValue: 奖励数值
// 记录成功行为，强化学习
if (!memory.totalReward) memory.totalReward = 0;
memory.totalReward += rewardValue;`
  });
  
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

  // 应用脚本
  const handleApplyScript = useCallback(() => {
    try {
      // 组合所有生命周期函数为完整脚本
      const fullScript = `
${lifecycleFunctions.onStart}

function controlAgent(inputs) {
  ${lifecycleFunctions.onUpdate}
}

function handleCollision() {
  ${lifecycleFunctions.onCollision}
}

function handleReward(rewardValue) {
  ${lifecycleFunctions.onReward}
}
`;
      
      // 验证脚本语法
      new Function('inputs', fullScript);
      
      // 切换到脚本模式并标记为已应用
      setControlMode('script');
      setIsScriptApplied(true);
      
      console.log('脚本已应用:', fullScript);
    } catch (e) {
      alert('脚本语法错误，无法应用：' + (e as Error).message);
    }
  }, [lifecycleFunctions]);

  // 更新生命周期函数
  const updateLifecycleFunction = useCallback((name: keyof LifecycleFunctions, code: string) => {
    setLifecycleFunctions(prev => ({
      ...prev,
      [name]: code
    }));
  }, []);

  // 切换折叠状态
  const toggleCollapse = useCallback((sectionKey: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  }, []);

  // 处理tooltip显示位置
  const handleTooltipShow = useCallback((event: React.MouseEvent<HTMLSpanElement>) => {
    const tooltip = event.currentTarget.parentElement?.querySelector('.tooltip') as HTMLElement;
    if (tooltip) {
      const rect = event.currentTarget.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // 计算最佳位置
      let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
      let top = rect.top - tooltipRect.height - 12;
      
      // 防止左右溢出
      if (left < 10) left = 10;
      if (left + tooltipRect.width > viewportWidth - 10) {
        left = viewportWidth - tooltipRect.width - 10;
      }
      
      // 防止上下溢出
      if (top < 10) {
        top = rect.bottom + 12;
        // 调整箭头方向
        const arrow = tooltip.querySelector('::after') as HTMLElement;
        if (arrow) {
          tooltip.style.setProperty('--arrow-direction', 'up');
        }
      }
      
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }
  }, []);

  // 版本控制函数
  const saveCurrentVersion = useCallback(() => {
    const versionName = prompt('请输入版本名称:', `版本 ${scriptVersions.length + 1}`);
    if (versionName) {
      const newVersion: ScriptVersion = {
        id: Date.now().toString(),
        name: versionName,
        timestamp: Date.now(),
        lifecycleFunctions: { ...lifecycleFunctions }
      };
      setScriptVersions(prev => [...prev, newVersion]);
      setCurrentVersionId(newVersion.id);
    }
  }, [lifecycleFunctions, scriptVersions.length]);

  const loadVersion = useCallback((versionId: string) => {
    const version = scriptVersions.find(v => v.id === versionId);
    if (version) {
      setLifecycleFunctions(version.lifecycleFunctions);
      setCurrentVersionId(versionId);
      setIsScriptApplied(false); // 需要重新应用
    }
  }, [scriptVersions]);

  const deleteVersion = useCallback((versionId: string) => {
    if (confirm('确定要删除这个版本吗？')) {
      setScriptVersions(prev => prev.filter(v => v.id !== versionId));
      if (currentVersionId === versionId) {
        setCurrentVersionId('');
      }
    }
  }, [currentVersionId]);

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

  // 构建用于引擎的完整脚本代码
  const getFullScriptCode = useCallback(() => {
    return `
${lifecycleFunctions.onStart}

function controlAgent(inputs) {
  ${lifecycleFunctions.onUpdate}
}

function handleCollision() {
  ${lifecycleFunctions.onCollision}
}

function handleReward(rewardValue) {
  ${lifecycleFunctions.onReward}
}
`;
  }, [lifecycleFunctions]);

  return (
    <div className="app">
      {/* 左侧游戏区域 */}
      <div className="game-area" style={{ width: `${gameAreaWidth}%` }}>
        <SimulationCanvas 
          width={canvasWidth}
          height={canvasHeight}
          isRunning={isRunning && !isPaused}
          controlMode={controlMode}
          scriptCode={getFullScriptCode()}
          enablePlayerInputInScript={enablePlayerInputOverride}
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
          {/* 左半边：标题和游戏控制 */}
          <div className="header-left">
            <h1 className="app-title">NeuralSoup</h1>
            <div className="game-controls">
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
          </div>
          
          {/* 右半边：版本控制 */}
          <div className="header-right">
            <div className="version-control">
              <select 
                value={currentVersionId}
                onChange={(e) => loadVersion(e.target.value)}
                className="version-select"
                title="选择版本"
              >
                <option value="">当前版本</option>
                {scriptVersions.map(version => (
                  <option key={version.id} value={version.id}>
                    {version.name}
                  </option>
                ))}
              </select>
              
              <button 
                onClick={saveCurrentVersion}
                className="btn btn-save"
                title="保存当前版本"
              >
                💾
              </button>
              
              <button 
                onClick={handleApplyScript}
                className="btn btn-apply"
                title="应用脚本"
              >
                ✓
              </button>
            </div>
          </div>
        </div>

        {/* 脚本选项 */}
        <div className="script-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enablePlayerInputOverride}
              onChange={(e) => setEnablePlayerInputOverride(e.target.checked)}
            />
            启用玩家输入覆盖
          </label>
          <span className="option-desc">
            {enablePlayerInputOverride ? 'W/A/D键可覆盖脚本输出' : '纯脚本控制'}
          </span>
        </div>

        {/* 生命周期编辑器 */}
        <div className="content-area">
          <div className="script-control">
            <div className="lifecycle-editors">
              {lifecycleConfigs.map((config) => {
                const isCollapsed = collapsedSections.has(config.key);
                return (
                  <div key={config.key} className="lifecycle-section">
                    <div className="lifecycle-header">
                      <div className="lifecycle-title">
                        <h5>
                          {config.icon} {config.title}
                        </h5>
                        <span className="lifecycle-desc">{config.description}</span>
                      </div>
                      <div className="lifecycle-controls">
                        <div className="tooltip-container">
                          <span 
                            className="help-icon"
                            onMouseEnter={handleTooltipShow}
                          >
                            ?
                          </span>
                          <div className="tooltip">{config.tooltip}</div>
                        </div>
                        <button 
                          className="collapse-btn"
                          onClick={() => toggleCollapse(config.key)}
                          title={isCollapsed ? '展开' : '收起'}
                        >
                          {isCollapsed ? '▼' : '▲'}
                        </button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <CodeEditor
                        value={lifecycleFunctions[config.key]}
                        onChange={(value) => updateLifecycleFunction(config.key, value)}
                        placeholder={`${config.title}代码...`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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