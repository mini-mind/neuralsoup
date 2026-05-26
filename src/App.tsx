import React, { useState, useCallback, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import SimulationCanvas, { type RuntimeInstallReceipt } from './components/SimulationCanvas';
import {
  preflightBrainStructure,
  buildAgentBodyEndpointPreviewModel,
  resolveCompiledAgentBodyEndpointIds,
  resolveBodyInputVisionCellIndex,
  summarizeAgentIR,
  validateAgentIR,
  type WorldRegistry,
  type AgentIR,
} from './domain/brain';
import { VISION_ACTION_HOST_PROFILE } from './host';
import type { SimulationControlMode } from './domain/world';
import type { SimulationLifecycleState } from './engine/SimulationEngine';
import type { AgentDraftStatus, AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from './types/agentRuntime';
import type { SimulationState } from './types/simulation';
import BrainLibraryModal from './components/editor/BrainLibraryModal';
import BodyMappingPanel from './components/editor/BodyMappingPanel';
import EditorToolbar from './components/editor/EditorToolbar';
import GraphEditorPanel from './components/editor/GraphEditorPanel';
import { isEditableOrInteractiveTarget } from './components/editor/graph/isEditableOrInteractiveTarget';
import SettingsPanel from './components/editor/SettingsPanel';
import type {
  AgentParameters,
  BodyIRDraftStatus,
  BodyIRPreviewData,
  BodyIRValidationMessage,
  EditorTab,
  GraphPathItem,
  SettingsSection,
} from './components/editor/types';
import type { GraphDocumentChangeOptions } from './components/hooks/useSNNTopologyState';
import {
  GRAPH_DRAFT_ONLY_CHANGE,
  GRAPH_SEMANTIC_CHANGE,
} from './components/hooks/graphDocumentChangePolicy';
import {
  loadBrainLibraryWithStatus,
  saveBrainLibrary,
} from './storage/brainLibraryStorage';
import {
  type BrainLibraryRecord,
  createBrainLibraryItemFromAgent,
  deleteBrainLibraryItem,
  duplicateBrainLibraryItem,
  renameBrainLibraryItem,
  upsertBrainLibraryItemAgent,
} from './storage/brainLibraryRecord';
import {
  encodeBrainLibraryRecordForExchange,
  normalizeImportedBrainExchange,
} from './storage/brainLibraryExchange';
import './App.css';

declare global {
  interface Window {
    __NEURALSOUP_TEST_API__?: {
      injectValidDraftOnly: () => void;
      injectInvalidGraphDraft: () => void;
      injectInvalidStructureDraft: () => void;
      getRuntimeActiveNodeIds: () => string[];
      getGraphPathIds: () => string[];
      getActiveAgentId: () => string;
      getActiveBrainId: () => string | null;
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
const DEFAULT_AGENT_PARAMETERS: AgentParameters = {
  visionCells: 36,
  visionRange: 250,
  visionAngle: 120,
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const clampSplitRatio = (containerSize: number, ratio: number): number => {
  if (containerSize <= MIN_PANEL_SIZE * 2 + SPLIT_DIVIDER_SIZE) {
    return 0.5;
  }

  const minRatio = MIN_PANEL_SIZE / containerSize;
  const maxRatio = (containerSize - MIN_PANEL_SIZE - SPLIT_DIVIDER_SIZE) / containerSize;
  return clamp(ratio, minRatio, maxRatio);
};
const createInitialAgentRuntimeStatus = (
  agent: AgentIR,
  worldRegistry: WorldRegistry
): AgentRuntimeStatus => ({
  state: 'applied',
  appliedSummary: summarizeAgentIR(agent, worldRegistry),
  issues: [],
  message: null,
});

const createAgentDraftStatus = (
  draftAgent: AgentIR,
  worldRegistry: WorldRegistry
): AgentDraftStatus => {
  const summary = summarizeAgentIR(draftAgent, worldRegistry);
  const structuralIssues = preflightBrainStructure(draftAgent.brain).issues.map((issue) => ({
    code: 'invalid-brain-structure' as const,
    message: issue.message,
  }));
  const validationIssues = validateAgentIR(draftAgent, worldRegistry);
  const allIssues = [...structuralIssues, ...validationIssues];

  if (allIssues.length > 0) {
    return {
      state: 'invalid',
      issues: allIssues,
      message: allIssues.map((issue) => issue.message).join(' | '),
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

const createRuntimeInstallRequestKey = (agent: AgentIR): string =>
  JSON.stringify(normalizeAgentForCompare(agent));

const serializeBrainLibrarySnapshot = (brains: BrainLibraryRecord[]): string =>
  JSON.stringify(brains);

const ROOT_GRAPH_PATH: GraphPathItem[] = [{ id: 'root', label: 'root' }];

const deriveProjectedVisionCellCountFromAgent = (
  agent: AgentIR,
  fallback: number
): number => {
  let maxVisionCellIndex = -1;

  const recordVisionNode = (nodeId: string) => {
    const cellIndex = resolveBodyInputVisionCellIndex(nodeId, agent.body);
    if (cellIndex != null && cellIndex >= 0) {
      maxVisionCellIndex = Math.max(maxVisionCellIndex, cellIndex);
    }
  };

  for (const connection of agent.connections) {
    if (connection.from.scope === 'bodyInput') {
      recordVisionNode(connection.from.nodeId);
    }
    if (connection.to.scope === 'bodyInput') {
      recordVisionNode(connection.to.nodeId);
    }
  }

  for (const nodeId of Object.keys(agent.layout?.nodes ?? {})) {
    recordVisionNode(nodeId);
  }

  return maxVisionCellIndex >= 0 ? maxVisionCellIndex + 1 : fallback;
};

const deriveAgentParametersFromBrain = (
  agent: AgentIR,
  currentParameters: AgentParameters
): AgentParameters => ({
  ...currentParameters,
  visionCells: deriveProjectedVisionCellCountFromAgent(agent, currentParameters.visionCells),
});

const applyBrainRecordToEditorState = (
  brain: BrainLibraryRecord,
  options: {
    resetRuntimeForBrainSwitch: () => void;
    syncAgentParametersFromBrain: (agent: AgentIR) => void;
    setIsBrainLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setActiveBrainId: React.Dispatch<React.SetStateAction<string | null>>;
    setCurrentAgentDocument: React.Dispatch<React.SetStateAction<AgentIR>>;
    setRuntimeInstallRequest: React.Dispatch<React.SetStateAction<AgentIR>>;
    setDraftAgentDocument: React.Dispatch<React.SetStateAction<AgentIR>>;
    setDraftBodyDocument: React.Dispatch<React.SetStateAction<AgentIR['body']>>;
    setDraftGraphStatusOverride: React.Dispatch<React.SetStateAction<AgentDraftStatus | null>>;
    setEditorTab: React.Dispatch<React.SetStateAction<EditorTab>>;
  }
): void => {
  options.resetRuntimeForBrainSwitch();
  options.syncAgentParametersFromBrain(brain.agent);
  options.setIsBrainLibraryOpen(true);
  options.setActiveBrainId(brain.agent.metadata.id);
  options.setCurrentAgentDocument(brain.agent);
  options.setRuntimeInstallRequest(brain.agent);
  options.setDraftAgentDocument(brain.agent);
  options.setDraftBodyDocument(brain.agent.body);
  options.setDraftGraphStatusOverride(null);
  options.setEditorTab((currentTab) => (currentTab === 'graph' ? 'graph' : currentTab));
};

const applyBrainRecordIdentityToCurrentState = (
  brain: BrainLibraryRecord,
  options: {
    syncAgentParametersFromBrain: (agent: AgentIR) => void;
    setActiveBrainId: React.Dispatch<React.SetStateAction<string | null>>;
    setCurrentAgentDocument: React.Dispatch<React.SetStateAction<AgentIR>>;
    setRuntimeInstallRequest: React.Dispatch<React.SetStateAction<AgentIR>>;
    setDraftAgentDocument: React.Dispatch<React.SetStateAction<AgentIR>>;
    setDraftBodyDocument: React.Dispatch<React.SetStateAction<AgentIR['body']>>;
    setDraftGraphStatusOverride: React.Dispatch<React.SetStateAction<AgentDraftStatus | null>>;
  }
): void => {
  options.syncAgentParametersFromBrain(brain.agent);
  options.setActiveBrainId(brain.agent.metadata.id);
  options.setCurrentAgentDocument(brain.agent);
  options.setRuntimeInstallRequest(brain.agent);
  options.setDraftAgentDocument(brain.agent);
  options.setDraftBodyDocument(brain.agent.body);
  options.setDraftGraphStatusOverride(null);
};

const App: React.FC = () => {
  const hostProfile = VISION_ACTION_HOST_PROFILE;
  const worldRegistry = hostProfile.worldRegistry;
  const initialBrainLibraryLoad = useRef(loadBrainLibraryWithStatus(worldRegistry)).current;
  const initialAgentDocument = hostProfile.createSeedAgentIR(36, '当前 Agent');
  const isE2ETestMode = import.meta.env.MODE === 'test' || import.meta.env.VITE_E2E === 'true';
  const [runState, setRunState] = useState<SimulationLifecycleState>('idle');
  const [requestedLifecycleState, setRequestedLifecycleState] = useState<SimulationLifecycleState>('idle');
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<SimulationState['stats']>(INITIAL_STATS);
  const [currentAgentDocument, setCurrentAgentDocument] = useState<AgentIR>(() => initialAgentDocument);
  const [runtimeInstallRequest, setRuntimeInstallRequest] = useState<AgentIR>(() => initialAgentDocument);
  const [draftAgentDocument, setDraftAgentDocument] = useState<AgentIR>(() => initialAgentDocument);
  const [draftBodyDocument, setDraftBodyDocument] = useState(() => initialAgentDocument.body);
  const [draftGraphStatusOverride, setDraftGraphStatusOverride] = useState<AgentDraftStatus | null>(null);
  const [agentRuntimeStatus, setAgentRuntimeStatus] = useState<AgentRuntimeStatus>(() =>
    createInitialAgentRuntimeStatus(initialAgentDocument, worldRegistry)
  );
  const [lastAppliedRuntimeInstallReceipt, setLastAppliedRuntimeInstallReceipt] = useState<RuntimeInstallReceipt>(() => ({
    agentId: initialAgentDocument.metadata.id,
    requestKey: createRuntimeInstallRequestKey(initialAgentDocument),
  }));
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
  const [agentParameters, setAgentParameters] = useState<AgentParameters>(DEFAULT_AGENT_PARAMETERS);
  const [draftAgentParameters, setDraftAgentParameters] = useState<AgentParameters>(DEFAULT_AGENT_PARAMETERS);
  const [splitRatio, setSplitRatio] = useState(0.6);
  const [isStackedLayout, setIsStackedLayout] = useState<boolean>(() => (
    typeof window !== 'undefined' ? window.innerWidth <= STACKED_LAYOUT_BREAKPOINT : false
  ));
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('graph');
  const [graphPath, setGraphPath] = useState<GraphPathItem[]>(ROOT_GRAPH_PATH);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('agent-parameters');
  const requestedLifecycleStateRef = useRef<SimulationLifecycleState>('idle');
  const draftAgentDocumentRef = useRef(draftAgentDocument);
  const draftBodyDocumentRef = useRef(draftBodyDocument);
  const agentParametersRef = useRef(agentParameters);
  const draftProjectedVisionCellCount = draftAgentParameters.visionCells;
  const bodyPreviewAgent = useMemo<AgentIR>(
    () => ({
      ...draftAgentDocument,
      body: draftBodyDocument,
    }),
    [draftAgentDocument, draftBodyDocument]
  );
  const bodyPreviewDraftStatus = useMemo<AgentDraftStatus>(
    () => createAgentDraftStatus(bodyPreviewAgent, worldRegistry),
    [bodyPreviewAgent, worldRegistry]
  );
  const agentDraftStatus = useMemo<AgentDraftStatus>(
    () => draftGraphStatusOverride ?? bodyPreviewDraftStatus,
    [bodyPreviewDraftStatus, draftGraphStatusOverride]
  );
  const currentAgentDocumentRef = useRef(currentAgentDocument);
  const graphPathNavigateRef = useRef<(pathId: string) => void>(() => {});
  const appRef = useRef<HTMLDivElement | null>(null);
  const simulationPanelRef = useRef<HTMLDivElement | null>(null);
  const persistedBrainLibrarySnapshotRef = useRef(serializeBrainLibrarySnapshot(initialBrainLibraryLoad.brains));
  const bodyDraftStatus = useMemo<BodyIRDraftStatus>(
    () => ({
      hasChanges: JSON.stringify(draftBodyDocument) !== JSON.stringify(draftAgentDocument.body),
    }),
    [draftAgentDocument.body, draftBodyDocument]
  );
  const installedGraphSummary = agentRuntimeStatus.appliedSummary;
  const hasDraftEditingChanges = !areAgentsEquivalent(currentAgentDocument, draftAgentDocument);
  const currentRuntimeInstallRequestKey = useMemo(
    () => createRuntimeInstallRequestKey(currentAgentDocument),
    [currentAgentDocument]
  );
  const hasPendingRuntimeInstall =
    agentRuntimeStatus.state !== 'applied' ||
    lastAppliedRuntimeInstallReceipt.agentId !== currentAgentDocument.metadata.id ||
    lastAppliedRuntimeInstallReceipt.requestKey !== currentRuntimeInstallRequestKey;
  const hasUnsavedDraftChanges =
    hasDraftEditingChanges || hasPendingRuntimeInstall || bodyDraftStatus.hasChanges;
  const bodyEndpointPreviewModel = useMemo(
    () => buildAgentBodyEndpointPreviewModel(bodyPreviewAgent, worldRegistry, draftProjectedVisionCellCount),
    [bodyPreviewAgent, draftProjectedVisionCellCount, worldRegistry]
  );
  const bodyEndpointPreview = useMemo<BodyIRPreviewData>(() => {
    const inputEndpointById = new Map(draftBodyDocument.inputEndpoints.map((endpoint) => [endpoint.id, endpoint]));
    const outputEndpointById = new Map(draftBodyDocument.outputEndpoints.map((endpoint) => [endpoint.id, endpoint]));

    const inputMatches = bodyEndpointPreviewModel.input.endpointMappings.flatMap((previewGroup) => {
      const endpointEntry = inputEndpointById.get(previewGroup.endpointId);
      return previewGroup.mappings.map((previewEndpoint) => ({
        endpointId: previewGroup.endpointId,
        endpointIndex: draftBodyDocument.inputEndpoints.findIndex((endpoint) => endpoint.id === previewGroup.endpointId),
        nodeId: previewEndpoint.nodeId,
        resolvedSource: previewEndpoint.resolved,
        scale: endpointEntry?.scale,
      }));
    });
    const outputMatches = bodyEndpointPreviewModel.output.endpointMappings.flatMap((previewGroup) => {
      const endpointEntry = outputEndpointById.get(previewGroup.endpointId);
      return previewGroup.mappings.map((previewEndpoint) => ({
        endpointId: previewGroup.endpointId,
        endpointIndex: draftBodyDocument.outputEndpoints.findIndex((endpoint) => endpoint.id === previewGroup.endpointId),
        nodeId: previewEndpoint.nodeId,
        resolvedTarget: previewEndpoint.resolved,
        decayPerSecond: endpointEntry?.decayPerSecond,
      }));
    });

    const compiledEndpointIds = resolveCompiledAgentBodyEndpointIds(bodyPreviewAgent, worldRegistry);

    return {
      canonicalSummary: `host projected coverage ${draftProjectedVisionCellCount} cells；输入 endpoint ${bodyEndpointPreviewModel.input.endpointNodeIds.length} 个，输出 endpoint ${bodyEndpointPreviewModel.output.endpointNodeIds.length} 个。`,
      compiledSummary: `compiled runtime shape：输入 endpoint ${compiledEndpointIds.bodyInputNodeIds.length} 个，输出 endpoint ${compiledEndpointIds.bodyOutputNodeIds.length} 个。`,
      inputMatches,
      outputMatches,
    };
  }, [bodyEndpointPreviewModel, bodyPreviewAgent, draftProjectedVisionCellCount, draftBodyDocument.inputEndpoints, draftBodyDocument.outputEndpoints, worldRegistry]);
  const bodyEndpointValidation = useMemo<BodyIRValidationMessage[]>(() => {
    return bodyEndpointPreviewModel.issues.map((issue) => ({
      level: issue.kind === 'compile-error' || issue.kind === 'conflict' ? 'error' : 'warning',
      message: issue.message,
      scope: issue.scope === 'input' ? 'input-endpoint' : 'output-endpoint',
      endpointId: issue.endpointId,
      endpointIndex: issue.scope === 'input'
        ? draftBodyDocument.inputEndpoints.findIndex((endpoint) => endpoint.id === issue.endpointId)
        : issue.scope === 'output'
          ? draftBodyDocument.outputEndpoints.findIndex((endpoint) => endpoint.id === issue.endpointId)
          : undefined,
    }));
  }, [bodyEndpointPreviewModel.issues, draftBodyDocument.inputEndpoints, draftBodyDocument.outputEndpoints]);

  useEffect(() => {
    const nextSnapshot = serializeBrainLibrarySnapshot(brainLibrary);
    if (persistedBrainLibrarySnapshotRef.current === nextSnapshot) {
      return;
    }

    try {
      saveBrainLibrary(brainLibrary, worldRegistry);
      persistedBrainLibrarySnapshotRef.current = nextSnapshot;
      setBrainLibraryStatusMessage((currentMessage) =>
        currentMessage?.startsWith('Brain Library 保存失败') ? null : currentMessage
      );
    } catch (error) {
      setBrainLibraryStatusMessage(error instanceof Error ? error.message : 'Brain Library 保存失败。');
    }
  }, [brainLibrary, worldRegistry]);

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
      options?: GraphDocumentChangeOptions
    ) => {
      const nextUpdatedAt = new Date().toISOString();
      const shouldCommitToCurrentDocument = options?.commitToCurrentDocument !== false;
      const shouldInstallToRuntime = options?.installToRuntime !== false;
      const shouldPersistActiveBrain = options?.persistActiveBrain ?? shouldCommitToCurrentDocument;
      const normalizedAgentDocument: AgentIR = {
        ...nextAgentDocument,
        metadata: {
          ...nextAgentDocument.metadata,
          updatedAt: nextUpdatedAt,
        },
      };
      setDraftGraphStatusOverride(null);
      setDraftAgentDocument(normalizedAgentDocument);
      if (shouldCommitToCurrentDocument) {
        setCurrentAgentDocument(normalizedAgentDocument);
      }
      if (shouldInstallToRuntime) {
        setRuntimeInstallRequest(normalizedAgentDocument);
      }
      const canPersistActiveBrain = validateAgentIR(normalizedAgentDocument, worldRegistry).length === 0;
      setBrainLibrary((currentLibrary) =>
        shouldPersistActiveBrain && canPersistActiveBrain && activeBrainId
          ? upsertBrainLibraryItemAgent(
              currentLibrary,
              activeBrainId,
              normalizedAgentDocument,
              worldRegistry,
              nextUpdatedAt
            )
          : currentLibrary
      );
    },
    [activeBrainId, worldRegistry]
  );

  useEffect(() => {
    const handleLifecycleHotkey = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isBrainLibraryOpen ||
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
  }, [handleStartPause, isBrainLibraryOpen]);

  const handleAgentParametersChange = useCallback((params: AgentParameters) => {
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
  }, []);

  const syncAgentParametersFromBrain = useCallback((agent: AgentIR) => {
    const nextParameters = deriveAgentParametersFromBrain(agent, agentParametersRef.current);
    setAgentParameters((current) => (areAgentParametersEqual(current, nextParameters) ? current : nextParameters));
    setDraftAgentParameters((current) => (areAgentParametersEqual(current, nextParameters) ? current : nextParameters));
  }, []);

  useEffect(() => {
    setDraftAgentParameters(agentParameters);
  }, [agentParameters]);

  useEffect(() => {
    draftAgentDocumentRef.current = draftAgentDocument;
  }, [draftAgentDocument]);

  useEffect(() => {
    draftBodyDocumentRef.current = draftBodyDocument;
  }, [draftBodyDocument]);

  useEffect(() => {
    currentAgentDocumentRef.current = currentAgentDocument;
  }, [currentAgentDocument]);

  useEffect(() => {
    agentParametersRef.current = agentParameters;
  }, [agentParameters]);

  const handleAgentChange = useCallback((
    updater: (current: AgentIR) => AgentIR,
    options?: GraphDocumentChangeOptions
  ) => {
    const currentDraftAgent = draftAgentDocumentRef.current;
    const nextAgentDocument = updater(currentDraftAgent);
    if (nextAgentDocument === currentDraftAgent) {
      return;
    }

    commitEditedAgentDocument(nextAgentDocument, options);
  }, [commitEditedAgentDocument]);

  const handleGraphAgentChange = useCallback((
    updater: (current: AgentIR) => AgentIR,
    options?: GraphDocumentChangeOptions
  ) => {
    const currentDraftAgent = draftAgentDocumentRef.current;
    const nextDraftAgent = updater(currentDraftAgent);
    if (nextDraftAgent === currentDraftAgent) {
      return;
    }

    commitEditedAgentDocument(nextDraftAgent, options);
  }, [commitEditedAgentDocument]);

  const handleAgentParametersApply = useCallback((params: AgentParameters) => {
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
    handleAgentChange(
      (currentAgent) => hostProfile.reconcileAgentIR(currentAgent, params.visionCells),
      GRAPH_SEMANTIC_CHANGE
    );
  }, [handleAgentChange, hostProfile]);

  const handleDraftAgentParametersChange = useCallback<React.Dispatch<React.SetStateAction<AgentParameters>>>((value) => {
    setDraftAgentParameters((current) => (typeof value === 'function' ? value(current) : value));
  }, []);

  const handleBodyApply = useCallback(() => {
    handleAgentChange(
      (currentAgent) =>
        hostProfile.reconcileAgentIR(
          {
            ...currentAgent,
            body: draftBodyDocument,
          },
          agentParameters.visionCells
        ),
      GRAPH_SEMANTIC_CHANGE
    );
  }, [agentParameters.visionCells, draftBodyDocument, handleAgentChange, hostProfile]);

  const handleBodyReset = useCallback(() => {
    setDraftBodyDocument(draftAgentDocumentRef.current.body);
  }, []);

  const handleAgentRuntimeStatusChange = useCallback((nextStatus: AgentRuntimeStatus) => {
    setAgentRuntimeStatus(nextStatus);
  }, []);

  const handleAgentRuntimeInstallApplied = useCallback((receipt: RuntimeInstallReceipt) => {
    setLastAppliedRuntimeInstallReceipt((currentReceipt) => (
      currentReceipt.agentId === receipt.agentId && currentReceipt.requestKey === receipt.requestKey
        ? currentReceipt
        : receipt
    ));
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
    setDraftAgentParameters(DEFAULT_AGENT_PARAMETERS);
  }, []);

  const graphEditorSessionToken = currentAgentDocument.metadata.id;

  useEffect(() => {
    graphPathNavigateRef.current = () => {};
    setGraphPath(ROOT_GRAPH_PATH);
  }, [graphEditorSessionToken]);

  const handleGraphPathNavigate = useCallback((pathId: string) => {
    graphPathNavigateRef.current(pathId);
  }, []);

  const handleGraphPathChange = useCallback((nextGraphPath: GraphPathItem[], sourceSessionToken: string) => {
    if (sourceSessionToken !== currentAgentDocumentRef.current.metadata.id) {
      return;
    }

    setGraphPath((currentGraphPath) => (areGraphPathsEqual(currentGraphPath, nextGraphPath) ? currentGraphPath : nextGraphPath));
  }, []);

  const handleGraphPathNavigateRegister = useCallback((navigate: (pathId: string) => void, sourceSessionToken: string) => {
    if (sourceSessionToken !== currentAgentDocumentRef.current.metadata.id) {
      return;
    }

    graphPathNavigateRef.current = navigate;
  }, []);

  const handleCreateBrainFromCurrent = useCallback((name: string) => {
    const nextBrain = createBrainLibraryItemFromAgent(
      name,
      {
        ...draftAgentDocumentRef.current,
        body: draftBodyDocumentRef.current,
      },
      worldRegistry
    );
    setBrainLibrary((currentLibrary) => [...currentLibrary, nextBrain]);
    setIsBrainLibraryOpen(true);
    applyBrainRecordIdentityToCurrentState(nextBrain, {
      syncAgentParametersFromBrain,
      setActiveBrainId,
      setCurrentAgentDocument,
      setRuntimeInstallRequest,
      setDraftAgentDocument,
      setDraftBodyDocument,
      setDraftGraphStatusOverride,
    });
  }, [syncAgentParametersFromBrain, worldRegistry]);

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
      resetRuntimeForBrainSwitch,
      syncAgentParametersFromBrain,
      setIsBrainLibraryOpen,
      setActiveBrainId,
      setCurrentAgentDocument,
      setRuntimeInstallRequest,
      setDraftAgentDocument,
      setDraftBodyDocument,
      setDraftGraphStatusOverride,
      setEditorTab,
    });
  }, [brainLibrary, confirmUnsavedBrainReplacement, resetRuntimeForBrainSwitch, syncAgentParametersFromBrain]);

  const handleImportBrain = useCallback((name: string, payload: unknown) => {
    const existingIds = Array.from(new Set([
      ...brainLibrary.map((brain) => brain.agent.metadata.id),
      currentAgentDocumentRef.current.metadata.id,
    ]));
    const nextBrain = normalizeImportedBrainExchange(
      payload,
      worldRegistry,
      {
        name,
        existingIds,
      }
    );
    if (!nextBrain) {
      throw new Error('导入内容规范化失败。');
    }
    if (!confirmUnsavedBrainReplacement()) {
      return;
    }

    setBrainLibrary((currentLibrary) => [...currentLibrary, nextBrain]);
    applyBrainRecordToEditorState(nextBrain, {
      resetRuntimeForBrainSwitch,
      syncAgentParametersFromBrain,
      setIsBrainLibraryOpen,
      setActiveBrainId,
      setCurrentAgentDocument,
      setRuntimeInstallRequest,
      setDraftAgentDocument,
      setDraftBodyDocument,
      setDraftGraphStatusOverride,
      setEditorTab,
    });
  }, [brainLibrary, confirmUnsavedBrainReplacement, resetRuntimeForBrainSwitch, syncAgentParametersFromBrain, worldRegistry]);

  const handleExportBrain = useCallback((brainId: string) => {
    const selectedBrain = brainLibrary.find((brain) => brain.agent.metadata.id === brainId);
    if (!selectedBrain) {
      return;
    }

    const exportedPackage = encodeBrainLibraryRecordForExchange(selectedBrain);
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

    setCurrentAgentDocument((currentAgent) => ({
      ...currentAgent,
      metadata: { ...renamedActiveBrain.agent.metadata },
    }));
    setRuntimeInstallRequest((currentAgent) => ({
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
    if (activeBrainId !== brainId) {
      return;
    }

    const fallbackAgent = hostProfile.createSeedAgentIR(agentParameters.visionCells, '当前 Agent');
    setActiveBrainId(null);
    setCurrentAgentDocument(fallbackAgent);
    setRuntimeInstallRequest(fallbackAgent);
    setDraftAgentDocument(fallbackAgent);
    setDraftBodyDocument(fallbackAgent.body);
    setDraftGraphStatusOverride(null);
    setGraphPath(ROOT_GRAPH_PATH);
    resetRuntimeForBrainSwitch();
  }, [activeBrainId, agentParameters.visionCells, hostProfile, resetRuntimeForBrainSwitch]);

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
                synapseModelId: 'seed.synapse.static-current.v1',
                parameterOverrides: {
                  weight: 1,
                },
              },
            ],
          }),
          GRAPH_DRAFT_ONLY_CHANGE
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
                synapseModelId: 'seed.synapse.static-current.v1',
                parameterOverrides: {
                  weight: 1,
                },
              },
            ],
          }),
          GRAPH_DRAFT_ONLY_CHANGE
        );
      },
      injectInvalidStructureDraft: () => {
        const currentAgent = draftAgentDocumentRef.current;
        if (currentAgent.brain.containers.some((container) => container.id === 'invalid-orphan-group')) {
          return;
        }

        handleGraphAgentChange(
          (draftAgent) => ({
            ...draftAgent,
            brain: {
              ...draftAgent.brain,
              containers: [
                ...draftAgent.brain.containers,
                {
                  id: 'invalid-orphan-group',
                  label: 'Invalid Orphan',
                  children: [],
                },
              ],
            },
          }),
          GRAPH_DRAFT_ONLY_CHANGE
        );
      },
      getRuntimeActiveNodeIds: () => [...agentRuntimeActivity.activeNodeIds],
      getGraphPathIds: () => graphPath.map((item) => item.id),
      getActiveAgentId: () => currentAgentDocumentRef.current.metadata.id,
      getActiveBrainId: () => activeBrainId,
      getDraftAgentId: () => draftAgentDocumentRef.current.metadata.id,
    };

    return () => {
      delete window.__NEURALSOUP_TEST_API__;
    };
  }, [activeBrainId, agentRuntimeActivity.activeNodeIds, graphPath, handleAgentChange, handleGraphAgentChange, isE2ETestMode]);

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
          hostProfile={hostProfile}
          controlMode={'snn' as Extract<SimulationControlMode, 'keyboard' | 'snn'>}
          runtimeInstallRequest={runtimeInstallRequest}
          agentParameters={agentParameters}
          requestedLifecycleState={requestedLifecycleState}
          resetToken={resetToken}
          onStatsUpdate={handleStatsUpdate}
          onLifecycleChange={handleLifecycleChange}
          onAgentParametersChange={handleAgentParametersChange}
          onAgentRuntimeStatusChange={handleAgentRuntimeStatusChange}
          onAgentRuntimeActivityChange={handleAgentRuntimeActivityChange}
          onAgentRuntimeInstallApplied={handleAgentRuntimeInstallApplied}
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
          <span data-testid="body-ir-validation-count">{bodyEndpointValidation.length}</span>
          <span data-testid="graph-ir-validation-count">{agentDraftStatus.issues.length}</span>
          <span data-testid="graph-ir-runtime-state">{agentRuntimeStatus.state}</span>
          <span data-testid="graph-ir-runtime-validation-count">{agentRuntimeStatus.issues.length}</span>
          <span data-testid="graph-ir-runtime-message">{agentRuntimeStatus.message ?? ''}</span>
          <span data-testid="graph-ir-installed-agent-id">{lastAppliedRuntimeInstallReceipt.agentId}</span>
          <span data-testid="graph-ir-installed-input-count">{installedGraphSummary.inputSignalCount}</span>
          <span data-testid="graph-ir-installed-neuron-count">{installedGraphSummary.neuronCount}</span>
          <span data-testid="graph-ir-installed-output-count">{installedGraphSummary.outputSignalCount}</span>
          <span data-testid="graph-ir-installed-link-count">{installedGraphSummary.leafLinkCount}</span>
        </div>

        <div className={`content-area ${editorTab === 'settings' ? 'settings-mode' : 'snn-mode'}`}>
          <div
            className={`content-panel settings-control ${editorTab === 'body' ? 'is-active' : 'is-hidden'}`}
            aria-hidden={editorTab !== 'body'}
          >
            <BodyMappingPanel
              agent={bodyPreviewAgent}
              worldRegistry={worldRegistry}
              bodyDraftStatus={bodyDraftStatus}
              preview={bodyEndpointPreview}
              validation={bodyEndpointValidation}
              onBodyChange={(updater) => {
                setDraftBodyDocument((currentBody) => updater(currentBody));
              }}
              onApply={handleBodyApply}
              onReset={handleBodyReset}
            />
          </div>
          <GraphEditorPanel
            isActive={editorTab === 'graph'}
            agent={draftAgentDocument}
            graphSessionToken={graphEditorSessionToken}
            visionCells={draftProjectedVisionCellCount}
            installedSummary={installedGraphSummary}
            worldRegistry={worldRegistry}
            runtimeStatus={agentRuntimeStatus}
            draftStatus={agentDraftStatus}
            runtimeActivity={agentRuntimeActivity}
            onAgentChange={handleGraphAgentChange}
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
              onDraftAgentParametersChange={handleDraftAgentParametersChange}
              onApplyAgentParameters={applyDraftAgentParameters}
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
