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

  // 脚本版本管理
  const [savedScripts, setSavedScripts] = useState<{[key: string]: string}>(() => {
    const saved = localStorage.getItem('neuralSoup_savedScripts');
    return saved ? JSON.parse(saved) : {
      '智能觅食者': `// 智能觅食者 - 高级AI行为脚本
// 具备视觉感知、奖励学习和适应性行为

let stepCount = 0;
let rewardHistory = [];
let explorationMode = true;
let lastRewardTime = 0;
let avoidanceTimer = 0;

function onFrame(agent) {
  stepCount++;
  
  // 分析视觉输入
  const vision = agent.vision || [];
  const frontVision = vision.slice(0, 12); // 前方视野
  const leftVision = vision.slice(12, 24); // 左侧视野  
  const rightVision = vision.slice(24, 36); // 右侧视野
  
  // 计算视野中的食物密度
  let frontFood = 0, leftFood = 0, rightFood = 0;
  for(let i = 0; i < 12; i += 3) {
    if(frontVision[i+1] > 0.5) frontFood++; // 绿色通道表示食物
    if(leftVision[i+1] > 0.5) leftFood++;
    if(rightVision[i+1] > 0.5) rightFood++;
  }
  
  // 计算障碍物威胁
  let frontThreat = 0;
  for(let i = 0; i < 12; i += 3) {
    if(frontVision[i] > 0.5 || frontVision[i+2] > 0.5) frontThreat++; // 红/蓝色表示障碍
  }
  
  // 奖励学习机制
  if(agent.reward > 0) {
    rewardHistory.push(stepCount);
    lastRewardTime = stepCount;
    explorationMode = false; // 进入利用模式
    console.log('获得奖励:', agent.reward, '开始利用模式');
  }
  
  // 模式切换：如果太久没有获得奖励，切换到探索模式
  if(stepCount - lastRewardTime > 200) {
    explorationMode = true;
  }
  
  // 避障行为
  if(frontThreat > 2 || avoidanceTimer > 0) {
    avoidanceTimer = Math.max(0, avoidanceTimer - 1);
    if(avoidanceTimer === 0) avoidanceTimer = 30; // 避障30步
    
    // 选择威胁较小的方向
    if(leftFood > rightFood) {
      agent.move([0.2, 0.8, 0, 0]); // 左转避障
    } else {
      agent.move([0.2, 0, 0.8, 0]); // 右转避障  
    }
    return;
  }
  
  // 智能觅食行为
  if(!explorationMode && (frontFood > 0 || leftFood > 0 || rightFood > 0)) {
    // 利用模式：朝向食物最多的方向
    if(frontFood >= Math.max(leftFood, rightFood)) {
      agent.move([1.0, 0, 0, 0]); // 直接前进
    } else if(leftFood > rightFood) {
      agent.move([0.6, 0.6, 0, 0]); // 左转前进
    } else {
      agent.move([0.6, 0, 0.6, 0]); // 右转前进
    }
  } else {
    // 探索模式：螺旋搜索或随机游走
    if(explorationMode) {
      const spiralPhase = (stepCount % 100) / 100;
      const turnStrength = Math.sin(spiralPhase * Math.PI * 2) * 0.3;
      agent.move([0.7, Math.max(0, turnStrength), Math.max(0, -turnStrength), 0]);
    } else {
      // 基础前进
      agent.move([0.8, 0, 0, 0]);
    }
  }
  
  // 每100步输出状态
  if(stepCount % 100 === 0) {
    console.log('步数:', stepCount, '模式:', explorationMode ? '探索' : '利用', 
               '奖励次数:', rewardHistory.length);
  }
}`
    };
  });
  
  const [currentScriptName, setCurrentScriptName] = useState('智能觅食者');
  const [showNewScriptDialog, setShowNewScriptDialog] = useState(false);
  const [newScriptName, setNewScriptName] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editScriptName, setEditScriptName] = useState('');
  const [editAction, setEditAction] = useState<'rename' | 'delete'>('rename');

  const engineRef = useRef<SimulationEngine | null>(null);

  // 初始化默认脚本
  useEffect(() => {
    if (savedScripts['智能觅食者'] && !onFrameCode.includes('智能觅食者')) {
      setOnFrameCode(savedScripts['智能觅食者']);
    }
  }, [savedScripts]);

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

  // 保存当前脚本到选中项
  const saveToCurrentScript = useCallback(() => {
    const newSavedScripts = { ...savedScripts, [currentScriptName]: onFrameCode };
    setSavedScripts(newSavedScripts);
    localStorage.setItem('neuralSoup_savedScripts', JSON.stringify(newSavedScripts));
    console.log('脚本已保存到:', currentScriptName);
  }, [onFrameCode, savedScripts, currentScriptName]);

  // 加载脚本
  const loadScript = useCallback((scriptName: string) => {
    if(savedScripts[scriptName]) {
      setCurrentScriptName(scriptName);
      setOnFrameCode(savedScripts[scriptName]);
      setIsScriptApplied(false); // 重置应用状态
      console.log('脚本已加载:', scriptName);
    }
  }, [savedScripts]);

  // 创建新脚本
  const createNewScript = useCallback(() => {
    if(!newScriptName.trim()) {
      alert('请输入脚本名称');
      return;
    }
    
    // 检查名称是否已存在
    if(savedScripts[newScriptName]) {
      alert('脚本名称已存在，请使用其他名称');
      return;
    }
    
    const templateCode = `// ${newScriptName}
// 自定义智能体行为脚本
// 
// 使用说明：
// 1. 此脚本会在点击"应用"按钮时执行一次进行初始化
// 2. 之后每帧都会调用 onFrame(agent) 函数
// 3. 通过 agent 对象控制智能体行为和获取环境信息

// 全局变量区域 - 用于存储状态信息
let stepCount = 0;        // 步数计数器
let lastReward = 0;       // 上次获得的奖励
let totalReward = 0;      // 累计奖励

/**
 * 每帧调用的主函数
 * @param {Object} agent - 智能体对象，包含以下属性和方法：
 * 
 * 属性：
 * - agent.vision: number[] - 视觉数据数组
 *   格式：[r1,g1,b1, r2,g2,b2, ...] RGB值范围0-1
 *   前12个值(0-11)：前方视野 4×3通道
 *   中12个值(12-23)：左侧视野 4×3通道  
 *   后12个值(24-35)：右侧视野 4×3通道
 *   颜色含义：绿色=食物，红色/蓝色=障碍物，黑色=空地
 * 
 * - agent.reward: number - 当前帧获得的奖励值
 *   正值表示获得奖励（如吃到食物），负值表示惩罚（如撞墙）
 * 
 * 方法：
 * - agent.move([前进, 左转, 右转, 后退]): void
 *   参数：四个浮点数，范围0-1，表示各方向的移动强度
 *   例：agent.move([0.8, 0, 0, 0]) 表示以0.8的速度前进
 *   例：agent.move([0.5, 0.3, 0, 0]) 表示边前进边左转
 */
function onFrame(agent) {
  stepCount++;
  
  // 记录奖励信息
  if (agent.reward !== 0) {
    lastReward = agent.reward;
    totalReward += agent.reward;
    console.log(\`步数 \${stepCount}: 获得奖励 \${agent.reward}, 累计奖励 \${totalReward}\`);
  }
  
  // 分析视觉信息
  const vision = agent.vision || [];
  
  // 检测前方是否有食物（绿色通道 > 0.5）
  let frontFood = 0;
  for(let i = 1; i < 12; i += 3) {  // 每3个为一组，取绿色通道
    if(vision[i] > 0.5) frontFood++;
  }
  
  // 检测前方是否有障碍物（红色或蓝色通道 > 0.5）
  let frontObstacle = 0;
  for(let i = 0; i < 12; i += 3) {
    if(vision[i] > 0.5 || vision[i+2] > 0.5) frontObstacle++;
  }
  
  // 决策逻辑示例
  if (frontObstacle > 2) {
    // 前方有障碍物，随机转向
    const turnDirection = Math.random() > 0.5 ? [0.2, 0.8, 0, 0] : [0.2, 0, 0.8, 0];
    agent.move(turnDirection);
    console.log(\`步数 \${stepCount}: 检测到障碍物，转向避障\`);
  } else if (frontFood > 0) {
    // 前方有食物，加速前进
    agent.move([1.0, 0, 0, 0]);
    console.log(\`步数 \${stepCount}: 发现食物，全速前进\`);
  } else {
    // 正常前进
    agent.move([0.6, 0, 0, 0]);
  }
  
  // 每50步输出一次状态信息
  if (stepCount % 50 === 0) {
    console.log(\`=== 状态报告 (步数: \${stepCount}) ===\`);
    console.log(\`累计奖励: \${totalReward}\`);
    console.log(\`前方食物数量: \${frontFood}\`);
    console.log(\`前方障碍物数量: \${frontObstacle}\`);
  }
}

// 脚本初始化完成
console.log(\`脚本 "\${newScriptName}" 已加载，开始智能体控制\`);`;

    // 创建新脚本并保存
    const newSavedScripts = { ...savedScripts, [newScriptName]: templateCode };
    setSavedScripts(newSavedScripts);
    localStorage.setItem('neuralSoup_savedScripts', JSON.stringify(newSavedScripts));
    
    // 关闭对话框
    setShowNewScriptDialog(false);
    setNewScriptName('');
    
    // 使用 setTimeout 确保状态更新完成后再切换
    setTimeout(() => {
      setCurrentScriptName(newScriptName);
      setOnFrameCode(templateCode);
      setIsScriptApplied(false);
      console.log('新脚本已创建并切换:', newScriptName);
    }, 0);
  }, [newScriptName, savedScripts]);

  // 删除脚本
  const deleteScript = useCallback((scriptName: string) => {
    if (Object.keys(savedScripts).length <= 1) {
      alert('至少需要保留一个脚本');
      return;
    }
    
    if (!confirm(`确定要删除脚本"${scriptName}"吗？此操作不可撤销。`)) {
      return;
    }
    
    const newSavedScripts = { ...savedScripts };
    delete newSavedScripts[scriptName];
    setSavedScripts(newSavedScripts);
    localStorage.setItem('neuralSoup_savedScripts', JSON.stringify(newSavedScripts));
    
    // 如果删除的是当前脚本，切换到第一个可用脚本
    if (currentScriptName === scriptName) {
      const firstScript = Object.keys(newSavedScripts)[0];
      setCurrentScriptName(firstScript);
      setOnFrameCode(newSavedScripts[firstScript]);
      setIsScriptApplied(false);
    }
    
    console.log('脚本已删除:', scriptName);
  }, [savedScripts, currentScriptName]);

  // 重命名脚本
  const renameScript = useCallback((oldName: string, newName: string) => {
    if (!newName.trim()) {
      alert('请输入新的脚本名称');
      return;
    }
    
    if (newName === oldName) {
      return; // 名称未改变
    }
    
    if (savedScripts[newName]) {
      alert('脚本名称已存在，请使用其他名称');
      return;
    }
    
    const newSavedScripts = { ...savedScripts };
    newSavedScripts[newName] = newSavedScripts[oldName];
    delete newSavedScripts[oldName];
    setSavedScripts(newSavedScripts);
    localStorage.setItem('neuralSoup_savedScripts', JSON.stringify(newSavedScripts));
    
    // 如果重命名的是当前脚本，更新当前脚本名
    if (currentScriptName === oldName) {
      setCurrentScriptName(newName);
    }
    
    console.log('脚本已重命名:', oldName, '->', newName);
  }, [savedScripts, currentScriptName]);

  // 处理编辑对话框
  const handleEditScript = useCallback((action: 'rename' | 'delete') => {
    setEditAction(action);
    setEditScriptName(action === 'rename' ? currentScriptName : '');
    setShowEditDialog(true);
  }, [currentScriptName]);

  // 执行编辑操作
  const executeEditAction = useCallback(() => {
    if (editAction === 'delete') {
      deleteScript(currentScriptName);
    } else if (editAction === 'rename') {
      renameScript(currentScriptName, editScriptName);
    }
    setShowEditDialog(false);
    setEditScriptName('');
  }, [editAction, currentScriptName, editScriptName, deleteScript, renameScript]);

  // 应用脚本（同时保存到当前选中项）
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
      // 先保存代码到当前选中的脚本
      saveToCurrentScript();
      
      // 然后应用脚本
      if (typeof (engineRef.current as any).setScriptCode === 'function') {
        (engineRef.current as any).setScriptCode(onFrameCode);
      }
      
      if (typeof (engineRef.current as any).applyScript === 'function') {
        const success = (engineRef.current as any).applyScript();
        
        if (success) {
          setIsScriptMode(true);
          setIsScriptApplied(true);
          console.log('脚本已成功应用并保存到:', currentScriptName);
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
  }, [onFrameCode, saveToCurrentScript, currentScriptName]);

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
        {/* 脚本版本管理区域 */}
        <div className="script-manager">
          <div className="script-manager-header">
            <h4>脚本管理</h4>
            <div className="script-controls">
              <select 
                value={currentScriptName} 
                onChange={(e) => loadScript(e.target.value)}
                className="script-selector"
              >
                {Object.keys(savedScripts).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button 
                onClick={() => setShowNewScriptDialog(true)}
                className="btn btn-secondary btn-small btn-icon"
                title="创建新脚本"
              >
                +
              </button>
              <button 
                onClick={() => handleEditScript('rename')}
                className="btn btn-secondary btn-small btn-icon"
                title="重命名当前脚本"
              >
                ✎
              </button>
              <button 
                onClick={() => handleEditScript('delete')}
                className="btn btn-secondary btn-small btn-icon"
                title="删除当前脚本"
                disabled={Object.keys(savedScripts).length <= 1}
              >
                ×
              </button>
              <button 
                onClick={handleApplyScript}
                className={`btn ${isScriptApplied ? 'btn-success' : 'btn-apply'} btn-small`}
                title={isScriptApplied ? '脚本已应用并保存' : '应用脚本并保存到当前选项'}
              >
                {isScriptApplied ? '✓ 已应用' : '应用'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="onframe-section">
          <CodeEditor
            value={onFrameCode}
            onChange={setOnFrameCode}
            placeholder={t('placeholder.code-editor')}
          />
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
                手动
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

      {/* 新脚本创建对话框 */}      
      {showNewScriptDialog && (
        <div className="new-script-dialog">
          <div className="new-script-dialog-content">
            <h3>创建新脚本</h3>
            <input
              type="text"
              value={newScriptName}
              onChange={(e) => setNewScriptName(e.target.value)}
              placeholder="请输入脚本名称"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  createNewScript();
                } else if (e.key === 'Escape') {
                  setShowNewScriptDialog(false);
                  setNewScriptName('');
                }
              }}
              autoFocus
            />
            <div className="new-script-dialog-actions">
              <button 
                onClick={() => {
                  setShowNewScriptDialog(false);
                  setNewScriptName('');
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button 
                onClick={createNewScript}
                className="btn btn-primary"
                disabled={!newScriptName.trim()}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑脚本对话框 */}
      {showEditDialog && (
        <div className="new-script-dialog">
          <div className="new-script-dialog-content">
            <h3>{editAction === 'rename' ? '重命名脚本' : '删除脚本'}</h3>
            {editAction === 'rename' ? (
              <input
                type="text"
                value={editScriptName}
                onChange={(e) => setEditScriptName(e.target.value)}
                placeholder="请输入新的脚本名称"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    executeEditAction();
                  } else if (e.key === 'Escape') {
                    setShowEditDialog(false);
                    setEditScriptName('');
                  }
                }}
                autoFocus
              />
            ) : (
              <p>确定要删除脚本 "<strong>{currentScriptName}</strong>" 吗？</p>
            )}
            <div className="new-script-dialog-actions">
              <button 
                onClick={() => {
                  setShowEditDialog(false);
                  setEditScriptName('');
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button 
                onClick={executeEditAction}
                className={`btn ${editAction === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                disabled={editAction === 'rename' && !editScriptName.trim()}
              >
                {editAction === 'rename' ? '重命名' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App; 