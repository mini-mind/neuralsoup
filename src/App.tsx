import React, { useState, useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import {
  createDefaultAgentIR,
  deriveAgentIRVisionCellCount,
  reconcileAgentIRVisionCells,
  summarizeAgentIR,
  validateAgentIR,
  type AgentIR,
} from './domain/brain';
import type { SimulationControlMode } from './domain/world';
import type { SimulationLifecycleState } from './engine/SimulationEngine';
import type { AgentDraftStatus, AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from './types/agentRuntime';
import type { SimulationState } from './types/simulation';
import BrainLibraryModal from './components/editor/BrainLibraryModal';
import EditorToolbar from './components/editor/EditorToolbar';
import GraphEditorPanel from './components/editor/GraphEditorPanel';
import { isEditableOrInteractiveTarget } from './components/editor/graph/isEditableOrInteractiveTarget';
import SettingsPanel from './components/editor/SettingsPanel';
import type { AgentParameters, EditorTab, GraphPathItem, SettingsSection } from './components/editor/types';
import type { GraphDocumentChangeOptions } from './components/hooks/useSNNTopologyState';
import {
  type BrainLibraryRecord,
  createBrainLibraryItemFromAgent,
  deleteBrainLibraryItem,
  duplicateBrainLibraryItem,
  encodeBrainLibraryRecord,
  loadBrainLibraryWithStatus,
  normalizeImportedAgentPackage,
  renameBrainLibraryItem,
  saveBrainLibrary,
  upsertBrainLibraryItemAgent,
} from './storage/brainLibraryStorage';
import './App.css';

declare global {
  interface Window {
    __NEURALSOUP_TEST_API__?: {
      injectValidDraftOnly: () => void;
      injectInvalidGraphDraft: () => void;
      getRuntimeActiveNodeIds: () => string[];
      getGraphPathIds: () => string[];
      getActiveAgentId: () => string;
      getDraftAgentId: () => string;
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

const createInitialAgentRuntimeStatus = (agent: AgentIR): AgentRuntimeStatus => ({
  state: 'applied',
  appliedSummary: summarizeAgentIR(agent),
  issues: [],
  message: null,
});

const createAgentDraftStatus = (draftAgent: AgentIR): AgentDraftStatus => {
  const summary = summarizeAgentIR(draftAgent);
  const validationIssues = validateAgentIR(draftAgent);

  if (validationIssues.length > 0) {
    return {
      state: 'invalid',
      issues: validationIssues,
      message: validationIssues.map((issue) => issue.message).join(' | '),
      summary,
    };
  }

  return {
    state: 'structurally-valid',
    issues: [],
    message: null,
    summary,
  };
};

const areAgentParametersEqual = (left: AgentParameters, right: AgentParameters): boolean => {
  return (
    left.visionCells === right.visionCells &&
    left.visionRange === right.visionRange &&
    left.visionAngle === right.visionAngle
  );
};

const areGraphPathsEqual = (left: GraphPathItem[], right: GraphPathItem[]): boolean =>
  left.length === right.length &&
  left.every((item, index) => item.id === right[index]?.id && item.label === right[index]?.label);

const normalizeAgentForCompare = (agent: AgentIR): AgentIR => ({
  ...agent,
  metadata: {
    ...agent.metadata,
    updatedAt: '',
  },
});

const areAgentsEquivalent = (left: AgentIR, right: AgentIR): boolean =>
  JSON.stringify(normalizeAgentForCompare(left)) === JSON.stringify(normalizeAgentForCompare(right));

const serializeBrainLibrarySnapshot = (brains: BrainLibraryRecord[]): string =>
  JSON.stringify(brains);

const ROOT_GRAPH_PATH: GraphPathItem[] = [{ id: 'root', label: 'root' }];

const applyBrainRecordToEditorState = (
  brain: BrainLibraryRecord,
  options: {
    resetGraphEditorSession: () => void;
    resetRuntimeForBrainSwitch: () => void;
    setIsBrainLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setActiveBrainId: React.Dispatch<React.SetStateAction<string | null>>;
    setActiveAgentDocument: React.Dispatch<React.SetStateAction<AgentIR>>;
    setDraftAgentDocument: React.Dispatch<React.SetStateAction<AgentIR>>;
    setDraftGraphStatusOverride: React.Dispatch<React.SetStateAction<AgentDraftStatus | null>>;
    setAgentParameters: React.Dispatch<React.SetStateAction<AgentParameters>>;
    setEditorTab: React.Dispatch<React.SetStateAction<EditorTab>>;
  }
): void => {
  const bodyVisionCells = deriveAgentIRVisionCellCount(brain.agent);
  options.resetGraphEditorSession();
  options.resetRuntimeForBrainSwitch();
  options.setIsBrainLibraryOpen(true);
  options.setActiveBrainId(brain.agent.metadata.id);
  options.setActiveAgentDocument(brain.agent);
  options.setDraftAgentDocument(brain.agent);
  options.setDraftGraphStatusOverride(null);
  options.setAgentParameters((current) =>
    current.visionCells === bodyVisionCells ? current : { ...current, visionCells: bodyVisionCells }
  );
  options.setEditorTab((currentTab) => (currentTab === 'graph' ? 'graph' : currentTab));
};

const applyBrainRecordIdentityToCurrentState = (
  brain: BrainLibraryRecord,
  options: {
    setActiveBrainId: React.Dispatch<React.SetStateAction<string | null>>;
    setActiveAgentDocument: React.Dispatch<React.SetStateAction<AgentIR>>;
    setDraftAgentDocument: React.Dispatch<React.SetStateAction<AgentIR>>;
    setDraftGraphStatusOverride: React.Dispatch<React.SetStateAction<AgentDraftStatus | null>>;
  }
): void => {
  options.setActiveBrainId(brain.agent.metadata.id);
  options.setActiveAgentDocument(brain.agent);
  options.setDraftAgentDocument(brain.agent);
  options.setDraftGraphStatusOverride(null);
};

const App: React.FC = () => {
  const initialBrainLibraryLoad = useRef(loadBrainLibraryWithStatus()).current;
  const initialAgentDocument = createDefaultAgentIR(36, '当前 Agent');
  const isE2ETestMode = import.meta.env.MODE === 'test' || import.meta.env.VITE_E2E === 'true';
  const [runState, setRunState] = useState<SimulationLifecycleState>('idle');
  const [requestedLifecycleState, setRequestedLifecycleState] = useState<SimulationLifecycleState>('idle');
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<SimulationState['stats']>(INITIAL_STATS);
  const [activeAgentDocument, setActiveAgentDocument] = useState<AgentIR>(() => initialAgentDocument);
  const [draftAgentDocument, setDraftAgentDocument] = useState<AgentIR>(() => initialAgentDocument);
  const [draftGraphStatusOverride, setDraftGraphStatusOverride] = useState<AgentDraftStatus | null>(null);
  const [agentRuntimeStatus, setAgentRuntimeStatus] = useState<AgentRuntimeStatus>(() =>
    createInitialAgentRuntimeStatus(initialAgentDocument)
  );
  const [agentRuntimeActivity, setAgentRuntimeActivity] = useState<AgentRuntimeActivitySnapshot>({
    activeNodeIds: []
  });
  const [brainLibrary, setBrainLibrary] = useState<BrainLibraryRecord[]>(() => initialBrainLibraryLoad.brains);
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
  const [graphPath, setGraphPath] = useState<GraphPathItem[]>(ROOT_GRAPH_PATH);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('agent-parameters');
  const [graphEditorSessionKey, setGraphEditorSessionKey] = useState(0);
  const requestedLifecycleStateRef = useRef<SimulationLifecycleState>('idle');
  const draftAgentDocumentRef = useRef(draftAgentDocument);
  const agentDraftStatus = useMemo<AgentDraftStatus>(
    () => draftGraphStatusOverride ?? createAgentDraftStatus(draftAgentDocument),
    [draftAgentDocument, draftGraphStatusOverride]
  );
  const activeAgentDocumentRef = useRef(activeAgentDocument);
  const graphPathNavigateRef = useRef<(pathId: string) => void>(() => {});
  const graphPathSessionKeyRef = useRef(0);
  const appRef = useRef<HTMLDivElement | null>(null);
  const simulationPanelRef = useRef<HTMLDivElement | null>(null);
  const persistedBrainLibrarySnapshotRef = useRef(serializeBrainLibrarySnapshot(initialBrainLibraryLoad.brains));
  const installedGraphSummary = agentRuntimeStatus.appliedSummary;
  const hasUnsavedDraftChanges = !areAgentsEquivalent(activeAgentDocument, draftAgentDocument);

  useEffect(() => {
    const nextSnapshot = serializeBrainLibrarySnapshot(brainLibrary);
    if (persistedBrainLibrarySnapshotRef.current === nextSnapshot) {
      return;
    }

    try {
      saveBrainLibrary(brainLibrary);
      persistedBrainLibrarySnapshotRef.current = nextSnapshot;
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
    setAgentRuntimeActivity({ activeNodeIds: [] });
    setLifecycleRequest('idle');
    setResetToken((current) => current + 1);
  }, [setLifecycleRequest]);

  const handleStatsUpdate = useCallback((newStats: SimulationState['stats']) => {
    setStats(newStats);
  }, []);

  const handleLifecycleChange = useCallback((nextState: SimulationLifecycleState) => {
    setRunState(nextState);
  }, []);

  const commitEditedAgentDocument = useCallback(
    (
      nextAgentDocument: AgentIR,
      installToRuntime: boolean = true,
      persistActiveBrain: boolean = true
    ) => {
      const nextUpdatedAt = new Date().toISOString();
      const normalizedAgentDocument: AgentIR = {
        ...nextAgentDocument,
        metadata: {
          ...nextAgentDocument.metadata,
          updatedAt: nextUpdatedAt,
        },
      };
      setDraftGraphStatusOverride(null);
      setDraftAgentDocument(normalizedAgentDocument);
      if (installToRuntime) {
        setActiveAgentDocument(normalizedAgentDocument);
      }
      setBrainLibrary((currentLibrary) =>
        persistActiveBrain && activeBrainId
          ? upsertBrainLibraryItemAgent(
              currentLibrary,
              activeBrainId,
              normalizedAgentDocument,
              nextUpdatedAt
            )
          : currentLibrary
      );
    },
    [activeBrainId]
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

  const handleAgentParametersChange = useCallback((params: AgentParameters) => {
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
  }, []);

  useEffect(() => {
    setDraftAgentParameters(agentParameters);
  }, [agentParameters]);

  useEffect(() => {
    draftAgentDocumentRef.current = draftAgentDocument;
  }, [draftAgentDocument]);

  useEffect(() => {
    activeAgentDocumentRef.current = activeAgentDocument;
  }, [activeAgentDocument]);

  const handleAgentChange = useCallback((
    updater: (current: AgentIR) => AgentIR,
    options?: GraphDocumentChangeOptions
  ) => {
    const currentDraftAgent = draftAgentDocumentRef.current;
    const nextAgentDocument = updater(currentDraftAgent);
    if (nextAgentDocument === currentDraftAgent) {
      return;
    }

    const shouldInstallToRuntime = options?.installToRuntime !== false;
    commitEditedAgentDocument(nextAgentDocument, shouldInstallToRuntime, shouldInstallToRuntime);
  }, [commitEditedAgentDocument]);

  const handleAgentParametersApply = useCallback((params: AgentParameters) => {
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
    handleAgentChange(
      (currentAgent) => reconcileAgentIRVisionCells(currentAgent, params.visionCells),
      { installToRuntime: true }
    );
  }, [handleAgentChange]);

  const handleAgentRuntimeStatusChange = useCallback((nextStatus: AgentRuntimeStatus) => {
    setAgentRuntimeStatus(nextStatus);
  }, []);

  const handleAgentRuntimeActivityChange = useCallback((nextSnapshot: AgentRuntimeActivitySnapshot) => {
    setAgentRuntimeActivity(nextSnapshot);
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

  const resetGraphEditorSession = useCallback(() => {
    const nextSessionKey = graphPathSessionKeyRef.current + 1;
    graphPathSessionKeyRef.current = nextSessionKey;
    setGraphEditorSessionKey(nextSessionKey);
    graphPathNavigateRef.current = () => {};
    setGraphPath(ROOT_GRAPH_PATH);
  }, []);

  const handleGraphPathChange = useCallback((nextGraphPath: GraphPathItem[], sourceSessionKey: number) => {
    if (sourceSessionKey !== graphPathSessionKeyRef.current) {
      return;
    }

    setGraphPath((currentGraphPath) => (areGraphPathsEqual(currentGraphPath, nextGraphPath) ? currentGraphPath : nextGraphPath));
  }, []);

  const handleGraphPathNavigateRegister = useCallback((navigate: (pathId: string) => void, sourceSessionKey: number) => {
    if (sourceSessionKey !== graphPathSessionKeyRef.current) {
      return;
    }

    graphPathNavigateRef.current = navigate;
  }, []);

  const handleCreateBrainFromCurrent = useCallback((name: string) => {
    const nextBrain = createBrainLibraryItemFromAgent(name, draftAgentDocumentRef.current);
    setBrainLibrary((currentLibrary) => [...currentLibrary, nextBrain]);
    setIsBrainLibraryOpen(true);
    applyBrainRecordIdentityToCurrentState(nextBrain, {
      setActiveBrainId,
      setActiveAgentDocument,
      setDraftAgentDocument,
      setDraftGraphStatusOverride,
    });
  }, []);

  const confirmUnsavedBrainReplacement = useCallback((): boolean => {
    if (!hasUnsavedDraftChanges) {
      return true;
    }

    return window.confirm('当前 Brain 存在尚未保存或未安装的草稿改动。继续会丢失这些编辑内容，是否继续？');
  }, [hasUnsavedDraftChanges]);

  const handleSelectBrain = useCallback((brainId: string) => {
    if (!confirmUnsavedBrainReplacement()) {
      return;
    }

    const selectedBrain = brainLibrary.find((brain) => brain.agent.metadata.id === brainId);
    if (!selectedBrain) {
      return;
    }

    applyBrainRecordToEditorState(selectedBrain, {
      resetGraphEditorSession,
      resetRuntimeForBrainSwitch,
      setIsBrainLibraryOpen,
      setActiveBrainId,
      setActiveAgentDocument,
      setDraftAgentDocument,
      setDraftGraphStatusOverride,
      setAgentParameters,
      setEditorTab,
    });
  }, [brainLibrary, confirmUnsavedBrainReplacement, resetGraphEditorSession, resetRuntimeForBrainSwitch]);

  const handleImportBrain = useCallback((name: string, payload: unknown) => {
    const nextBrain = normalizeImportedAgentPackage(payload, {
      name,
      existingIds: brainLibrary.map((brain) => brain.agent.metadata.id),
    });
    if (!nextBrain) {
      throw new Error('导入内容规范化失败。');
    }
    if (!confirmUnsavedBrainReplacement()) {
      return;
    }

    setBrainLibrary((currentLibrary) => [...currentLibrary, nextBrain]);
    applyBrainRecordToEditorState(nextBrain, {
      resetGraphEditorSession,
      resetRuntimeForBrainSwitch,
      setIsBrainLibraryOpen,
      setActiveBrainId,
      setActiveAgentDocument,
      setDraftAgentDocument,
      setDraftGraphStatusOverride,
      setAgentParameters,
      setEditorTab,
    });
  }, [brainLibrary, confirmUnsavedBrainReplacement, resetGraphEditorSession, resetRuntimeForBrainSwitch]);

  const handleExportBrain = useCallback((brainId: string) => {
    const selectedBrain = brainLibrary.find((brain) => brain.agent.metadata.id === brainId);
    if (!selectedBrain) {
      return;
    }

    const exportedPackage = encodeBrainLibraryRecord(selectedBrain);
    const blob = new Blob([JSON.stringify(exportedPackage, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedBrain.agent.metadata.name || selectedBrain.agent.metadata.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [brainLibrary]);

  const handleRenameBrain = useCallback((brainId: string, name: string) => {
    const nextLibrary = renameBrainLibraryItem(brainLibrary, brainId, name);
    setBrainLibrary(nextLibrary);
    if (brainId !== activeBrainId) {
      return;
    }

    const renamedActiveBrain = nextLibrary.find((brain) => brain.agent.metadata.id === brainId);
    if (!renamedActiveBrain) {
      return;
    }

    setActiveAgentDocument((currentAgent) => ({
      ...currentAgent,
      metadata: { ...renamedActiveBrain.agent.metadata },
    }));
    setDraftAgentDocument((currentAgent) => ({
      ...currentAgent,
      metadata: { ...renamedActiveBrain.agent.metadata },
    }));
  }, [activeBrainId, brainLibrary]);

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
        const currentAgent = draftAgentDocumentRef.current;
        if (currentAgent.connections.some((connection) => connection.id === 'test-valid-draft-link-vision-R-0-neuron-2')) {
          return;
        }
        handleAgentChange(
          (current) => ({
            ...current,
            connections: [
              ...current.connections,
              {
                id: 'test-valid-draft-link-vision-R-0-neuron-2',
                from: {
                  scope: 'bodyInput',
                  nodeId: 'vision-R-0',
                  portId: 'out',
                },
                to: {
                  scope: 'brain',
                  nodeId: 'neuron-2',
                  portId: 'dendrite',
                },
                weight: 1,
              },
            ],
          }),
          { installToRuntime: false }
        );
      },
      injectInvalidGraphDraft: () => {
        const currentAgent = draftAgentDocumentRef.current;
        const firstConnection = currentAgent.connections[0];
        if (!firstConnection) {
          return;
        }
        if (currentAgent.connections.some((connection) => connection.id === `${firstConnection.id}-invalid-body-output-source`)) {
          return;
        }
        handleAgentChange(
          (draftAgent) => ({
            ...draftAgent,
            connections: [
              ...draftAgent.connections,
              {
                id: `${firstConnection.id}-invalid-body-output-source`,
                from: {
                  scope: 'bodyOutput',
                  nodeId: 'output-move-forward',
                  portId: 'out',
                },
                to: {
                  scope: 'brain',
                  nodeId: firstConnection.to.scope === 'brain' ? firstConnection.to.nodeId : 'neuron-1',
                  portId: 'dendrite',
                },
                weight: 1,
              },
            ],
          }),
          { installToRuntime: false }
        );
      },
      getRuntimeActiveNodeIds: () => [...agentRuntimeActivity.activeNodeIds],
      getGraphPathIds: () => graphPath.map((item) => item.id),
      getActiveAgentId: () => activeAgentDocumentRef.current.metadata.id,
      getDraftAgentId: () => draftAgentDocumentRef.current.metadata.id,
    };

    return () => {
      delete window.__NEURALSOUP_TEST_API__;
    };
  }, [agentRuntimeActivity.activeNodeIds, graphPath, handleAgentChange, isE2ETestMode]);

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
          agentDocument={activeAgentDocument}
          agentParameters={agentParameters}
          requestedLifecycleState={requestedLifecycleState}
          resetToken={resetToken}
          onStatsUpdate={handleStatsUpdate}
          onLifecycleChange={handleLifecycleChange}
          onAgentParametersChange={handleAgentParametersChange}
          onAgentRuntimeStatusChange={handleAgentRuntimeStatusChange}
          onAgentRuntimeActivityChange={handleAgentRuntimeActivityChange}
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
          <span data-testid="graph-ir-validation-count">{agentDraftStatus.issues.length}</span>
          <span data-testid="graph-ir-runtime-state">{agentRuntimeStatus.state}</span>
          <span data-testid="graph-ir-runtime-validation-count">{agentRuntimeStatus.issues.length}</span>
          <span data-testid="graph-ir-runtime-message">{agentRuntimeStatus.message ?? ''}</span>
          <span data-testid="graph-ir-installed-input-count">{installedGraphSummary.inputSignalCount}</span>
          <span data-testid="graph-ir-installed-neuron-count">{installedGraphSummary.neuronCount}</span>
          <span data-testid="graph-ir-installed-output-count">{installedGraphSummary.outputSignalCount}</span>
          <span data-testid="graph-ir-installed-link-count">{installedGraphSummary.leafLinkCount}</span>
        </div>

        <div className={`content-area ${editorTab === 'graph' ? 'snn-mode' : 'settings-mode'}`}>
          <GraphEditorPanel
            isActive={editorTab === 'graph'}
            agent={draftAgentDocument}
            graphSessionKey={graphEditorSessionKey}
            visionCells={agentParameters.visionCells}
            runtimeStatus={agentRuntimeStatus}
            draftStatus={agentDraftStatus}
            runtimeActivity={agentRuntimeActivity}
            onAgentChange={handleAgentChange}
            onGraphPathChange={handleGraphPathChange}
            onGraphPathNavigateRegister={handleGraphPathNavigateRegister}
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
