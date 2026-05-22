import React, { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import {
  createAgentIRFromLegacyGraph,
  createLegacyGraphBridgeFromAgent,
  createAgentPackage,
  createDefaultBodyDefinition,
  createDefaultGraphIRDocument,
  getBodyVisionCellCount,
  type AgentIR,
  type AgentPackage,
  type BrainPackage,
  type BodyDefinition,
  reconcileGraphIRDocumentVisionCells,
  summarizeGraphIRDocument,
  validateGraphIRDocument,
  type GraphIRDocument,
} from './domain/brain';
import type { SimulationControlMode } from './domain/world';
import type { SimulationLifecycleState } from './engine/SimulationEngine';
import type { GraphIRRuntimeActivitySnapshot, GraphIRRuntimeStatus } from './types/graphIRRuntime';
import type { SimulationState } from './types/simulation';
import BrainLibraryModal from './components/editor/BrainLibraryModal';
import EditorToolbar from './components/editor/EditorToolbar';
import GraphEditorPanel from './components/editor/GraphEditorPanel';
import { isEditableOrInteractiveTarget } from './components/editor/graph/isEditableOrInteractiveTarget';
import SettingsPanel from './components/editor/SettingsPanel';
import type { AgentParameters, EditorTab, GraphPathItem, SettingsSection } from './components/editor/types';
import type { GraphDocumentChangeOptions } from './components/hooks/useSNNTopologyState';
import {
  createBrainLibraryItem,
  deleteBrainLibraryItem,
  duplicateBrainLibraryItem,
  isBrainPackage,
  isAgentPackage,
  loadBrainLibraryWithStatus,
  renameBrainLibraryItem,
  saveBrainLibrary,
  upsertBrainLibraryItemDefinition,
} from './storage/brainLibraryStorage';
import './App.css';

declare global {
  interface Window {
    __NEURALSOUP_TEST_API__?: {
      injectValidDraftOnly: () => void;
      injectInvalidGraphDraft: () => void;
      getRuntimeActiveNodeIds: () => string[];
    };
  }
}

const INITIAL_STATS: SimulationState['stats'] = {
  fps: 0,
  totalReward: 0,
  collisionCount: 0,
  neuralState: { motivation: 0, stress: 0, homeostasis: 0.5 }
};
const STACKED_LAYOUT_BREAKPOINT = 768;
const SPLIT_DIVIDER_SIZE = 8;
const MIN_PANEL_SIZE = 280;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const clampSplitRatio = (containerSize: number, ratio: number): number => {
  if (containerSize <= MIN_PANEL_SIZE * 2 + SPLIT_DIVIDER_SIZE) {
    return 0.5;
  }

  const minRatio = MIN_PANEL_SIZE / containerSize;
  const maxRatio = (containerSize - MIN_PANEL_SIZE - SPLIT_DIVIDER_SIZE) / containerSize;
  return clamp(ratio, minRatio, maxRatio);
};

const createInitialGraphIRRuntimeStatus = (document: GraphIRDocument): GraphIRRuntimeStatus => ({
  state: 'applied',
  appliedDocument: document,
  appliedSummary: summarizeGraphIRDocument(document),
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

const App: React.FC = () => {
  const initialBrainLibraryLoad = useRef(loadBrainLibraryWithStatus()).current;
  const initialGraphDocument = createDefaultGraphIRDocument(36);
  const initialBodyDefinition = createDefaultBodyDefinition(36);
  const initialAgentDocument = createAgentIRFromLegacyGraph('当前 Agent', initialGraphDocument, initialBodyDefinition);
  const isE2ETestMode = import.meta.env.MODE === 'test' || import.meta.env.VITE_E2E === 'true';
  const [runState, setRunState] = useState<SimulationLifecycleState>('idle');
  const [requestedLifecycleState, setRequestedLifecycleState] = useState<SimulationLifecycleState>('idle');
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<SimulationState['stats']>(INITIAL_STATS);
  const [activeAgentDocument, setActiveAgentDocument] = useState<AgentIR>(() => initialAgentDocument);
  const [graphDocument, setGraphDocument] = useState<GraphIRDocument>(() => initialGraphDocument);
  const [runtimeGraphDocument, setRuntimeGraphDocument] = useState<GraphIRDocument>(() =>
    initialGraphDocument
  );
  const [runtimeBodyDefinition, setRuntimeBodyDefinition] = useState<BodyDefinition>(() =>
    initialBodyDefinition
  );
  const [graphIRRuntimeStatus, setGraphIRRuntimeStatus] = useState<GraphIRRuntimeStatus>(() =>
    createInitialGraphIRRuntimeStatus(initialGraphDocument)
  );
  const [graphIRRuntimeActivity, setGraphIRRuntimeActivity] = useState<GraphIRRuntimeActivitySnapshot>({
    activeNodeIds: []
  });
  const [brainLibrary, setBrainLibrary] = useState<AgentPackage[]>(() => initialBrainLibraryLoad.brains);
  const [activeBrainId, setActiveBrainId] = useState<string | null>(null);
  const [isBrainLibraryOpen, setIsBrainLibraryOpen] = useState(false);
  const [brainLibraryStatusMessage, setBrainLibraryStatusMessage] = useState<string | null>(
    initialBrainLibraryLoad.status.message
  );
  const [canvasWidth, setCanvasWidth] = useState(1);
  const [canvasHeight, setCanvasHeight] = useState(1);
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
  const [splitRatio, setSplitRatio] = useState(0.6);
  const [isStackedLayout, setIsStackedLayout] = useState<boolean>(() => (
    typeof window !== 'undefined' ? window.innerWidth <= STACKED_LAYOUT_BREAKPOINT : false
  ));
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('graph');
  const [graphPath, setGraphPath] = useState<GraphPathItem[]>([{ id: 'root', label: 'root' }]);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('agent-parameters');
  const requestedLifecycleStateRef = useRef<SimulationLifecycleState>('idle');
  const graphIRIssues = validateGraphIRDocument(graphDocument);
  const graphDocumentRef = useRef(graphDocument);
  const graphPathNavigateRef = useRef<(pathId: string) => void>(() => {});
  const appRef = useRef<HTMLDivElement | null>(null);
  const simulationPanelRef = useRef<HTMLDivElement | null>(null);
  const installedGraphSummary = graphIRRuntimeStatus.appliedSummary;

  useEffect(() => {
    try {
      saveBrainLibrary(brainLibrary);
      setBrainLibraryStatusMessage((currentMessage) =>
        currentMessage?.startsWith('Brain Library 保存失败') ? null : currentMessage
      );
    } catch (error) {
      setBrainLibraryStatusMessage(error instanceof Error ? error.message : 'Brain Library 保存失败。');
    }
  }, [brainLibrary]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${STACKED_LAYOUT_BREAKPOINT}px)`);
    const updateLayoutMode = (event?: MediaQueryListEvent) => {
      setIsStackedLayout(event ? event.matches : mediaQuery.matches);
    };

    updateLayoutMode();
    mediaQuery.addEventListener('change', updateLayoutMode);
    return () => {
      mediaQuery.removeEventListener('change', updateLayoutMode);
    };
  }, []);

  useEffect(() => {
    const container = simulationPanelRef.current;
    if (!container) {
      return;
    }

    const updateCanvasDimensions = () => {
      const rect = container.getBoundingClientRect();
      setCanvasWidth((current) => {
        const nextWidth = Math.max(1, Math.floor(rect.width));
        return current === nextWidth ? current : nextWidth;
      });
      setCanvasHeight((current) => {
        const nextHeight = Math.max(1, Math.floor(rect.height));
        return current === nextHeight ? current : nextHeight;
      });
    };

    updateCanvasDimensions();
    const observer = new ResizeObserver(updateCanvasDimensions);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

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

  const resetRuntimeForBrainSwitch = useCallback(() => {
    setStats(INITIAL_STATS);
    setGraphIRRuntimeActivity({ activeNodeIds: [] });
    setLifecycleRequest('idle');
    setResetToken((current) => current + 1);
  }, [setLifecycleRequest]);

  const handleStatsUpdate = useCallback((newStats: SimulationState['stats']) => {
    setStats(newStats);
  }, []);

  const handleLifecycleChange = useCallback((nextState: SimulationLifecycleState) => {
    setRunState(nextState);
  }, []);

  const updateGraphDocument = useCallback(
    (
      nextDocument: GraphIRDocument,
      installToRuntime: boolean = true,
      persistActiveBrain: boolean = true
    ) => {
      const nextAgentDocument = createAgentIRFromLegacyGraph(
        activeAgentDocument.metadata.name,
        nextDocument,
        runtimeBodyDefinition,
        undefined,
        activeAgentDocument.metadata
      );
      graphDocumentRef.current = nextDocument;
      setActiveAgentDocument(nextAgentDocument);
      setGraphDocument(nextDocument);
      setBrainLibrary((currentLibrary) =>
        persistActiveBrain && activeBrainId
          ? upsertBrainLibraryItemDefinition(currentLibrary, activeBrainId, nextDocument, runtimeBodyDefinition)
          : currentLibrary
      );
      if (installToRuntime) {
        setRuntimeGraphDocument(nextDocument);
      }
    },
    [activeAgentDocument, activeBrainId, runtimeBodyDefinition]
  );

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
    const nextBodyDefinition = createDefaultBodyDefinition(params.visionCells);
    const nextDocument = reconcileGraphIRDocumentVisionCells(graphDocumentRef.current, params.visionCells);
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
    updateGraphDocument(nextDocument, true, false);
    setRuntimeBodyDefinition(nextBodyDefinition);
    setActiveAgentDocument((current) =>
      createAgentIRFromLegacyGraph(current.metadata.name, nextDocument, nextBodyDefinition, undefined, current.metadata)
    );
    setBrainLibrary((currentLibrary) =>
      activeBrainId
        ? upsertBrainLibraryItemDefinition(
            currentLibrary,
            activeBrainId,
            nextDocument,
            nextBodyDefinition
          )
        : currentLibrary
    );
  }, [activeBrainId, updateGraphDocument]);

  const handleAgentParametersChange = useCallback((params: AgentParameters) => {
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
  }, []);

  useEffect(() => {
    setDraftAgentParameters(agentParameters);
  }, [agentParameters]);

  useEffect(() => {
    graphDocumentRef.current = graphDocument;
  }, [graphDocument]);

  const handleGraphDocumentChange = useCallback((
    nextDocument: GraphIRDocument,
    options?: GraphDocumentChangeOptions
  ) => {
    updateGraphDocument(nextDocument, options?.installToRuntime ?? true);
  }, [updateGraphDocument]);

  const handleGraphIRRuntimeStatusChange = useCallback((nextStatus: GraphIRRuntimeStatus) => {
    setGraphIRRuntimeStatus(nextStatus);
  }, []);

  const handleGraphIRRuntimeActivityChange = useCallback((nextSnapshot: GraphIRRuntimeActivitySnapshot) => {
    setGraphIRRuntimeActivity(nextSnapshot);
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

  const handleGraphPathNavigate = useCallback((pathId: string) => {
    graphPathNavigateRef.current(pathId);
  }, []);

  const handleCreateBrainFromCurrent = useCallback((name: string) => {
    const nextBrain = createBrainLibraryItem(name, graphDocumentRef.current);
    setBrainLibrary((currentLibrary) => [...currentLibrary, nextBrain]);
    setActiveBrainId(nextBrain.metadata.id);
  }, []);

  const confirmUnsavedBrainReplacement = useCallback((): boolean => {
    if (activeBrainId) {
      return true;
    }

    return window.confirm('当前 Brain 尚未保存到库。继续会切换当前编辑内容，是否继续？');
  }, [activeBrainId]);

  const handleSelectBrain = useCallback((brainId: string) => {
    if (!confirmUnsavedBrainReplacement()) {
      return;
    }

    const selectedBrain = brainLibrary.find((brain) => brain.metadata.id === brainId);
    if (!selectedBrain) {
      return;
    }

    const bridge = createLegacyGraphBridgeFromAgent(selectedBrain.agent);
    const bodyVisionCells = getBodyVisionCellCount(bridge.body);
    resetRuntimeForBrainSwitch();
    setActiveBrainId(selectedBrain.metadata.id);
    setActiveAgentDocument(selectedBrain.agent);
    updateGraphDocument(bridge.document, true, false);
    setRuntimeBodyDefinition(bridge.body);
    setAgentParameters((current) =>
      current.visionCells === bodyVisionCells ? current : { ...current, visionCells: bodyVisionCells }
    );
    setEditorTab('graph');
    graphPathNavigateRef.current('root');
  }, [brainLibrary, confirmUnsavedBrainReplacement, resetRuntimeForBrainSwitch, updateGraphDocument]);

  const handleImportBrain = useCallback((name: string, payload: BrainPackage | AgentPackage) => {
    const nextBrain = isAgentPackage(payload)
      ? payload
      : isBrainPackage(payload)
        ? createAgentPackage(payload.metadata.name || name, payload.definition, {
            id: payload.metadata.id,
            createdAt: payload.metadata.createdAt,
            updatedAt: payload.metadata.updatedAt,
            description: payload.metadata.description,
            tags: payload.metadata.tags,
            body: payload.body,
            layout: payload.layout,
          })
        : null;
    if (!nextBrain) {
      throw new Error('导入内容不是有效的 AgentPackage 或 BrainPackage。');
    }
    if (!confirmUnsavedBrainReplacement()) {
      return;
    }

    const bridge = createLegacyGraphBridgeFromAgent(nextBrain.agent);
    resetRuntimeForBrainSwitch();
    setBrainLibrary((currentLibrary) => [...currentLibrary, nextBrain]);
    setActiveBrainId(nextBrain.metadata.id);
    setActiveAgentDocument(nextBrain.agent);
    updateGraphDocument(bridge.document, true, false);
    setRuntimeBodyDefinition(bridge.body);
    setAgentParameters((current) => {
      const bodyVisionCells = getBodyVisionCellCount(bridge.body);
      return current.visionCells === bodyVisionCells ? current : { ...current, visionCells: bodyVisionCells };
    });
    setEditorTab('graph');
    graphPathNavigateRef.current('root');
  }, [confirmUnsavedBrainReplacement, resetRuntimeForBrainSwitch, updateGraphDocument]);

  const handleExportBrain = useCallback((brainId: string) => {
    const selectedBrain = brainLibrary.find((brain) => brain.metadata.id === brainId);
    if (!selectedBrain) {
      return;
    }

    const blob = new Blob([JSON.stringify(selectedBrain, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedBrain.metadata.name || selectedBrain.metadata.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [brainLibrary]);

  const handleRenameBrain = useCallback((brainId: string, name: string) => {
    setBrainLibrary((currentLibrary) => renameBrainLibraryItem(currentLibrary, brainId, name));
  }, []);

  const handleDeleteBrain = useCallback((brainId: string) => {
    setBrainLibrary((currentLibrary) => deleteBrainLibraryItem(currentLibrary, brainId));
    setActiveBrainId((currentId) => (currentId === brainId ? null : currentId));
  }, []);

  const handleDuplicateBrain = useCallback((brainId: string) => {
    setBrainLibrary((currentLibrary) => duplicateBrainLibraryItem(currentLibrary, brainId));
  }, []);

  const updateSplitRatioFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const appElement = appRef.current;
    if (!appElement) {
      return;
    }

    const rect = appElement.getBoundingClientRect();
    const containerSize = isStackedLayout ? rect.height : rect.width;
    if (containerSize <= 0) {
      return;
    }

    const pointerOffset = isStackedLayout ? clientY - rect.top : clientX - rect.left;
    setSplitRatio(clampSplitRatio(containerSize, pointerOffset / containerSize));
  }, [isStackedLayout]);

  const handleSplitPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const divider = event.currentTarget;
    divider.setPointerCapture(event.pointerId);
    setIsResizingSplit(true);
    updateSplitRatioFromClientPoint(event.clientX, event.clientY);

    const nextCursor = isStackedLayout ? 'row-resize' : 'col-resize';
    document.body.style.cursor = nextCursor;
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateSplitRatioFromClientPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const finishResize = () => {
      setIsResizingSplit(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);
  }, [isStackedLayout, updateSplitRatioFromClientPoint]);

  const handleSplitKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const appElement = appRef.current;
    if (!appElement) {
      return;
    }

    const containerSize = isStackedLayout ? appElement.clientHeight : appElement.clientWidth;
    const step = 0.04;
    let nextRatio: number | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        if (!isStackedLayout) {
          nextRatio = splitRatio - step;
        }
        break;
      case 'ArrowRight':
        if (!isStackedLayout) {
          nextRatio = splitRatio + step;
        }
        break;
      case 'ArrowUp':
        if (isStackedLayout) {
          nextRatio = splitRatio - step;
        }
        break;
      case 'ArrowDown':
        if (isStackedLayout) {
          nextRatio = splitRatio + step;
        }
        break;
      case 'Home':
        nextRatio = 0;
        break;
      case 'End':
        nextRatio = 1;
        break;
      default:
        break;
    }

    if (nextRatio == null) {
      return;
    }

    event.preventDefault();
    setSplitRatio(clampSplitRatio(containerSize, nextRatio));
  }, [isStackedLayout, splitRatio]);

  const dividerHalfSize = SPLIT_DIVIDER_SIZE / 2;
  const gamePanePercent = splitRatio * 100;
  const controlPanePercent = 100 - gamePanePercent;
  const gameAreaStyle: CSSProperties = {
    flexBasis: `calc(${gamePanePercent}% - ${dividerHalfSize}px)`
  };
  const controlAreaStyle: CSSProperties = {
    flexBasis: `calc(${controlPanePercent}% - ${dividerHalfSize}px)`
  };

  useEffect(() => {
    if (!isE2ETestMode) {
      delete window.__NEURALSOUP_TEST_API__;
      return;
    }

    window.__NEURALSOUP_TEST_API__ = {
      injectValidDraftOnly: () => {
        const current = graphDocumentRef.current;
        if (current.root.links.some((link) => link.id === 'test-valid-draft-link-vision-R-0-neuron-2')) {
          return;
        }

        updateGraphDocument(
          {
            ...current,
            root: {
              ...current.root,
              links: [
                ...current.root.links,
                {
                  id: 'test-valid-draft-link-vision-R-0-neuron-2',
                  from: {
                    nodeId: 'vision-R-0',
                    portId: 'out'
                  },
                  to: {
                    nodeId: 'neuron-2',
                    portId: 'dendrite'
                  },
                  weight: 1
                }
              ]
            }
          },
          false
        );
      },
      injectInvalidGraphDraft: () => {
        const current = graphDocumentRef.current;
        const [firstLink, ...remainingLinks] = current.root.links;
        if (!firstLink) {
          return;
        }

        updateGraphDocument({
          ...current,
          root: {
            ...current.root,
            links: [firstLink, { ...firstLink, id: `${firstLink.id}-duplicate` }, ...remainingLinks]
          }
        });
      },
      getRuntimeActiveNodeIds: () => [...graphIRRuntimeActivity.activeNodeIds]
    };

    return () => {
      delete window.__NEURALSOUP_TEST_API__;
    };
  }, [graphIRRuntimeActivity.activeNodeIds, isE2ETestMode, updateGraphDocument]);

  return (
    <div
      ref={appRef}
      className={`app ${isStackedLayout ? 'app-stacked' : 'app-split'} ${isResizingSplit ? 'is-resizing' : ''}`}
      data-testid="app-shell"
    >
      <div
        ref={simulationPanelRef}
        className="game-area"
        data-testid="simulation-panel"
        style={gameAreaStyle}
      >
        <SimulationCanvas
          width={canvasWidth}
          height={canvasHeight}
          controlMode={'snn' as Extract<SimulationControlMode, 'keyboard' | 'snn'>}
          graphDocument={runtimeGraphDocument}
          bodyDefinition={runtimeBodyDefinition}
          agentParameters={agentParameters}
          requestedLifecycleState={requestedLifecycleState}
          resetToken={resetToken}
          onStatsUpdate={handleStatsUpdate}
          onLifecycleChange={handleLifecycleChange}
          onAgentParametersChange={handleAgentParametersChange}
          onGraphIRStatusChange={handleGraphIRRuntimeStatusChange}
          onGraphIRActivityChange={handleGraphIRRuntimeActivityChange}
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

      <div
        className={`app-splitter ${isStackedLayout ? 'app-splitter-stacked' : 'app-splitter-inline'}`}
        data-testid="app-splitter"
        role="separator"
        aria-label="调整游戏区和编辑区大小"
        aria-orientation={isStackedLayout ? 'horizontal' : 'vertical'}
        tabIndex={0}
        onPointerDown={handleSplitPointerDown}
        onKeyDown={handleSplitKeyDown}
      />

      <div className="control-area" data-testid="control-panel" style={controlAreaStyle}>
        <EditorToolbar
          editorTab={editorTab}
          graphPath={graphPath}
          runState={runState}
          onBrainLibraryOpen={() => setIsBrainLibraryOpen(true)}
          onEditorTabChange={setEditorTab}
          onGraphPathNavigate={handleGraphPathNavigate}
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
          <span data-testid="graph-ir-validation-count">{graphIRIssues.length}</span>
          <span data-testid="graph-ir-runtime-state">{graphIRRuntimeStatus.state}</span>
          <span data-testid="graph-ir-runtime-validation-count">{graphIRRuntimeStatus.issues.length}</span>
          <span data-testid="graph-ir-runtime-message">{graphIRRuntimeStatus.message ?? ''}</span>
          <span data-testid="graph-ir-installed-input-count">{installedGraphSummary.inputSignalCount}</span>
          <span data-testid="graph-ir-installed-neuron-count">{installedGraphSummary.neuronCount}</span>
          <span data-testid="graph-ir-installed-output-count">{installedGraphSummary.outputSignalCount}</span>
          <span data-testid="graph-ir-installed-link-count">{installedGraphSummary.leafLinkCount}</span>
        </div>

        <div className={`content-area ${editorTab === 'graph' ? 'snn-mode' : 'settings-mode'}`}>
          <GraphEditorPanel
            isActive={editorTab === 'graph'}
            document={graphDocument}
            visionCells={agentParameters.visionCells}
            runtimeStatus={graphIRRuntimeStatus}
            runtimeActivity={graphIRRuntimeActivity}
            onDocumentChange={handleGraphDocumentChange}
            onGraphPathChange={setGraphPath}
            onGraphPathNavigateRegister={(navigate) => {
              graphPathNavigateRef.current = navigate;
            }}
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
        <BrainLibraryModal
          activeBrainId={activeBrainId}
          brains={brainLibrary}
          isOpen={isBrainLibraryOpen}
          statusMessage={brainLibraryStatusMessage}
          onClose={() => setIsBrainLibraryOpen(false)}
          onCreateFromCurrent={handleCreateBrainFromCurrent}
          onSelectBrain={handleSelectBrain}
          onRenameBrain={handleRenameBrain}
          onDeleteBrain={handleDeleteBrain}
          onDuplicateBrain={handleDuplicateBrain}
          onExportBrain={handleExportBrain}
          onImportBrain={handleImportBrain}
        />
      </div>
    </div>
  );
};

export default App;
