import React, { useState, useCallback, useRef, useEffect } from "react";
import SimulationCanvas from "./components/SimulationCanvas";
import AgentParametersModal, {
  AgentParameters,
} from "./components/AgentParametersModal";
import AgentParametersPanel from "./components/AgentParametersPanel";
import TabPanel from "./components/TabPanel";
import SettingsPanel from "./components/SettingsPanel";
import AppHeader from "./components/AppHeader";
import StatsOverlay from "./components/StatsOverlay";
import ScriptEditArea from "./components/ScriptEditArea";
import ResizeHandle from "./components/ResizeHandle";
import { useLanguage } from "./contexts/LanguageContext";
import { SimulationEngine } from "./engine/SimulationEngine";
import { useScriptState } from "./hooks/useScriptState";
import "./App.css";

const App: React.FC = () => {
  const { t } = useLanguage();
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // 默认使用SNN控制模式（智能体自主行为）
  const [isScriptMode, setIsScriptMode] = useState(false);
  const [enableManualOverride, setEnableManualOverride] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mobileFullscreenTab, setMobileFullscreenTab] = useState<string | null>(
    null,
  );

  // 使用脚本状态管理hook
  const {
    onFrameCode,
    isScriptApplied,
    savedScripts,
    currentScriptName,
    setOnFrameCode,
    setEngineRef,
    handleApplyScript,
    handleScriptChange,
  } = useScriptState();

  // 拖拽分割条状态
  const [gameAreaWidth, setGameAreaWidth] = useState(60); // 百分比
  const [isDragging, setIsDragging] = useState(false);

  const [stats, setStats] = useState({
    fps: 0,
    totalReward: 0,
    collisionCount: 0,
    neuralState: { motivation: 0, stress: 0, homeostasis: 0.5 },
  });

  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth * 0.6);
  const [canvasHeight, setCanvasHeight] = useState(window.innerHeight);

  // 智能体参数状态
  const [showAgentParamsModal, setShowAgentParamsModal] = useState(false);
  const [agentParameters, setAgentParameters] = useState<AgentParameters>({
    visionCells: 36,
    visionRange: 250,
    visionAngle: 120,
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
    window.addEventListener("resize", calculateCanvasDimensions);
    return () => {
      window.removeEventListener("resize", calculateCanvasDimensions);
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

  const handleEngineReady = useCallback(
    (engine: SimulationEngine) => {
      engineRef.current = engine;
      setEngineRef(engine);

      // 获取并设置初始参数
      if (typeof (engine as any).getAgentParameters === "function") {
        const initialParams = (engine as any).getAgentParameters();
        setAgentParameters(initialParams);
      }
    },
    [setEngineRef],
  );

  const handleAgentParametersApply = useCallback((params: AgentParameters) => {
    setAgentParameters(params);

    // 更新引擎参数
    if (
      engineRef.current &&
      typeof (engineRef.current as any).updateAgentParameters === "function"
    ) {
      (engineRef.current as any).updateAgentParameters(params);
    }
  }, []);

  // 自定义脚本应用处理 - 结合脚本模式
  const customApplyScript = useCallback(() => {
    handleApplyScript();
    setIsScriptMode(true);
  }, [handleApplyScript]);

  // 拖拽处理函数
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const newWidth = (e.clientX / window.innerWidth) * 100;
        setGameAreaWidth(Math.max(30, Math.min(80, newWidth))); // 限制在30%-80%之间
      }
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // 拖动结束后强制重绘，即使在暂停状态
    if (
      engineRef.current &&
      typeof (engineRef.current as any).forceRender === "function"
    ) {
      (engineRef.current as any).forceRender();
    }
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
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
    <ScriptEditArea
      currentScriptName={currentScriptName}
      savedScripts={savedScripts}
      onFrameCode={onFrameCode}
      isScriptApplied={isScriptApplied}
      onScriptChange={handleScriptChange}
      onCodeChange={setOnFrameCode}
      onScriptApply={customApplyScript}
    />
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
      id: "script",
      label: t("tab.script"),
      content: scriptTabContent,
    },
    {
      id: "agent-params",
      label: t("tab.agent-params"),
      content: agentParamsTabContent,
    },
  ];
  return (
    <div
      className={`app ${isMobile && mobileFullscreenTab ? "mobile-fullscreen" : ""}`}
    >
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
          <StatsOverlay stats={stats} />
        </div>
      )}

      {/* 拖拽分割条 - 在移动端全屏模式下隐藏 */}
      {!(isMobile && mobileFullscreenTab) && (
        <ResizeHandle isDragging={isDragging} onMouseDown={handleMouseDown} />
      )}

      {/* 右侧控制区域 */}
      <div
        className="control-area"
        style={{
          width:
            isMobile && mobileFullscreenTab
              ? "100%"
              : `${100 - gameAreaWidth}%`,
        }}
      >
        {/* 新的顶部布局 - 在移动端全屏模式下隐藏 */}
        {!(isMobile && mobileFullscreenTab) && (
          <AppHeader
            isRunning={isRunning}
            isPaused={isPaused}
            enableManualOverride={enableManualOverride}
            onStartPause={handleStartPause}
            onManualOverrideToggle={() =>
              setEnableManualOverride(!enableManualOverride)
            }
          />
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
            collapseText={t("mobile.collapse")}
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
        <div
          className="modal-overlay"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="modal-content settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{t("settings.title")}</h3>
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
