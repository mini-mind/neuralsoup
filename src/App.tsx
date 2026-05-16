import React, { useState, useCallback, useEffect, useRef } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import {
  createDefaultBrainGraph,
  reconcileBrainGraphVisionCells,
  validateBrainGraph,
  type BrainGraph
} from './domain/brain';
import type { SimulationControlMode } from './domain/world';
import type { SimulationLifecycleState } from './engine/SimulationEngine';
import type { BrainGraphRuntimeStatus } from './types/brainGraphRuntime';
import type { SimulationState } from './types/simulation';
import EditorToolbar from './components/editor/EditorToolbar';
import GraphEditorPanel from './components/editor/GraphEditorPanel';
import SettingsPanel from './components/editor/SettingsPanel';
import type { AgentParameters, EditorTab, SettingsSection } from './components/editor/types';
import './App.css';

const INITIAL_STATS: SimulationState['stats'] = {
  fps: 0,
  totalReward: 0,
  collisionCount: 0,
  neuralState: { motivation: 0, stress: 0, homeostasis: 0.5 }
};

const createAppliedBrainGraphStatus = (graph: BrainGraph): BrainGraphRuntimeStatus => ({
  state: 'applied',
  appliedGraph: graph,
  issues: [],
  message: null
});

const areAgentParametersEqual = (left: AgentParameters, right: AgentParameters): boolean => {
  return (
    left.visionCells === right.visionCells &&
    left.visionRange === right.visionRange &&
    left.visionAngle === right.visionAngle
  );
};

const isEditableOrInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  ) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest('button, input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
};

const App: React.FC = () => {
  const [runState, setRunState] = useState<SimulationLifecycleState>('idle');
  const [requestedLifecycleState, setRequestedLifecycleState] = useState<SimulationLifecycleState>('idle');
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<SimulationState['stats']>(INITIAL_STATS);
  const [brainGraph, setBrainGraph] = useState<BrainGraph>(() => createDefaultBrainGraph(36));
  const [brainGraphRuntimeStatus, setBrainGraphRuntimeStatus] = useState<BrainGraphRuntimeStatus>(() =>
    createAppliedBrainGraphStatus(createDefaultBrainGraph(36))
  );
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth * 0.6);
  const [canvasHeight, setCanvasHeight] = useState(window.innerHeight);
  const [agentParameters, setAgentParameters] = useState<AgentParameters>({
    visionCells: 36,
    visionRange: 250,
    visionAngle: 120
  });
  const [draftAgentParameters, setDraftAgentParameters] = useState<AgentParameters>({
    visionCells: 36,
    visionRange: 250,
    visionAngle: 120
  });
  const [editorTab, setEditorTab] = useState<EditorTab>('graph');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('agent-parameters');
  const requestedLifecycleStateRef = useRef<SimulationLifecycleState>('idle');
  const brainGraphIssues = validateBrainGraph(brainGraph);
  const installedBrainGraph = brainGraphRuntimeStatus.appliedGraph;

  const calculateCanvasDimensions = useCallback(() => {
    setCanvasWidth(window.innerWidth * 0.6);
    setCanvasHeight(window.innerHeight);
  }, []);

  useEffect(() => {
    calculateCanvasDimensions();
    window.addEventListener('resize', calculateCanvasDimensions);
    return () => {
      window.removeEventListener('resize', calculateCanvasDimensions);
    };
  }, [calculateCanvasDimensions]);

  const setLifecycleRequest = useCallback((nextState: SimulationLifecycleState) => {
    requestedLifecycleStateRef.current = nextState;
    setRequestedLifecycleState(nextState);
  }, []);

  const handleStartPause = useCallback(() => {
    if (
      requestedLifecycleStateRef.current === 'idle' ||
      requestedLifecycleStateRef.current === 'paused'
    ) {
      setLifecycleRequest('running');
      return;
    }

    setLifecycleRequest('paused');
  }, [setLifecycleRequest]);

  const handleReset = useCallback(() => {
    setStats(INITIAL_STATS);
    setLifecycleRequest('idle');
    setResetToken((current) => current + 1);
  }, [setLifecycleRequest]);

  const handleStatsUpdate = useCallback((newStats: SimulationState['stats']) => {
    setStats(newStats);
  }, []);

  const handleLifecycleChange = useCallback((nextState: SimulationLifecycleState) => {
    setRunState(nextState);
  }, []);

  useEffect(() => {
    const handleLifecycleHotkey = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableOrInteractiveTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      handleStartPause();
    };

    window.addEventListener('keydown', handleLifecycleHotkey);

    return () => {
      window.removeEventListener('keydown', handleLifecycleHotkey);
    };
  }, [handleStartPause]);

  const handleAgentParametersApply = useCallback((params: AgentParameters) => {
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
    setBrainGraph((current) => reconcileBrainGraphVisionCells(current, params.visionCells));
    setBrainGraphRuntimeStatus((current) =>
      current.state === 'applied'
        ? createAppliedBrainGraphStatus(reconcileBrainGraphVisionCells(current.appliedGraph, params.visionCells))
        : current
    );
  }, []);

  const handleAgentParametersChange = useCallback((params: AgentParameters) => {
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
  }, []);

  useEffect(() => {
    setDraftAgentParameters(agentParameters);
  }, [agentParameters]);

  const handleBrainGraphChange = useCallback((nextGraph: BrainGraph) => {
    setBrainGraph(nextGraph);
  }, []);

  const handleBrainGraphRuntimeStatusChange = useCallback((nextStatus: BrainGraphRuntimeStatus) => {
    setBrainGraphRuntimeStatus(nextStatus);
  }, []);

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };
  const applyDraftAgentParameters = useCallback(() => {
    handleAgentParametersApply(draftAgentParameters);
  }, [draftAgentParameters, handleAgentParametersApply]);

  const resetDraftAgentParameters = useCallback(() => {
    setDraftAgentParameters({
      visionCells: 36,
      visionRange: 250,
      visionAngle: 120
    });
  }, []);

  return (
    <div className="app" data-testid="app-shell">
      <div className="game-area" data-testid="simulation-panel">
        <SimulationCanvas
          width={canvasWidth}
          height={canvasHeight}
          controlMode={'snn' as Extract<SimulationControlMode, 'keyboard' | 'snn'>}
          brainGraph={brainGraph}
          agentParameters={agentParameters}
          requestedLifecycleState={requestedLifecycleState}
          resetToken={resetToken}
          onStatsUpdate={handleStatsUpdate}
          onLifecycleChange={handleLifecycleChange}
          onAgentParametersChange={handleAgentParametersChange}
          onBrainGraphStatusChange={handleBrainGraphRuntimeStatusChange}
        />
        <div className="game-stats-overlay">
          <div className="game-stat-chip">
            <span className="game-stat-key">FPS</span>
            <span className="game-stat-value" data-testid="fps-value">{stats.fps.toFixed(1)}</span>
          </div>
          <div className="game-stat-chip">
            <span className="game-stat-key">Reward</span>
            <span className="game-stat-value positive" data-testid="reward-value">{formatNumber(stats.totalReward)}</span>
          </div>
        </div>
      </div>

      <div className="control-area" data-testid="control-panel">
        <EditorToolbar
          editorTab={editorTab}
          runState={runState}
          onEditorTabChange={setEditorTab}
          onStartPause={handleStartPause}
          onReset={handleReset}
        />

        <div className="diagnostic-strip diagnostic-strip-hidden" data-testid="app-diagnostics" aria-hidden="true">
          <span data-testid="simulation-run-state">{runState}</span>
          <span data-testid="control-mode-value">snn</span>
          <span data-testid="editor-tab-value">{editorTab}</span>
          <span data-testid="settings-section-value">{settingsSection}</span>
          <span data-testid="vision-cells-value">{agentParameters.visionCells}</span>
          <span data-testid="vision-range-value">{agentParameters.visionRange}</span>
          <span data-testid="vision-angle-value">{agentParameters.visionAngle}</span>
          <span data-testid="brain-graph-validation-count">{brainGraphIssues.length}</span>
          <span data-testid="brain-graph-runtime-state">{brainGraphRuntimeStatus.state}</span>
          <span data-testid="brain-graph-runtime-validation-count">{brainGraphRuntimeStatus.issues.length}</span>
          <span data-testid="brain-graph-runtime-message">{brainGraphRuntimeStatus.message ?? ''}</span>
          <span data-testid="brain-graph-installed-input-count">{installedBrainGraph.inputs.length}</span>
          <span data-testid="brain-graph-installed-synapse-count">{installedBrainGraph.synapses.length}</span>
        </div>

        <div className={`content-area ${editorTab === 'graph' ? 'snn-mode' : 'settings-mode'}`}>
          <GraphEditorPanel
            isActive={editorTab === 'graph'}
            graph={brainGraph}
            visionCells={agentParameters.visionCells}
            runtimeStatus={brainGraphRuntimeStatus}
            onGraphChange={handleBrainGraphChange}
          />
          <div
            className={`content-panel settings-control ${editorTab === 'settings' ? 'is-active' : 'is-hidden'}`}
            aria-hidden={editorTab !== 'settings'}
          >
            <SettingsPanel
              agentParameters={agentParameters}
              draftAgentParameters={draftAgentParameters}
              settingsSection={settingsSection}
              onSettingsSectionChange={setSettingsSection}
              onDraftAgentParametersChange={setDraftAgentParameters}
              onApply={applyDraftAgentParameters}
              onResetDefaults={resetDraftAgentParameters}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
