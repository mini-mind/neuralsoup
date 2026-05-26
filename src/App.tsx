import React, { useState, useEffect, useRef } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import {
  type AgentIR,
} from './domain/brain';
import { VISION_ACTION_HOST_PROFILE } from './host';
import type { SimulationControlMode } from './domain/world';
import BrainLibraryModal from './components/editor/BrainLibraryModal';
import BodyMappingPanel from './components/editor/BodyMappingPanel';
import EditorToolbar from './components/editor/EditorToolbar';
import GraphEditorPanel from './components/editor/GraphEditorPanel';
import SettingsPanel from './components/editor/SettingsPanel';
import type {
  AgentParameters,
  EditorTab,
  SettingsSection,
} from './components/editor/types';
import {
  GRAPH_DRAFT_ONLY_CHANGE,
} from './components/hooks/graphDocumentChangePolicy';
import { loadBrainLibraryWithStatus } from './storage/brainLibraryStorage';
import { useBrainLibraryCoordinator } from './components/hooks/useBrainLibraryCoordinator';
import { useGlobalRuntimeHotkeys } from './components/hooks/useGlobalRuntimeHotkeys';
import { useGraphNavigationCoordinator } from './components/hooks/useGraphNavigationCoordinator';
import { useAgentWorkspaceCoordinator } from './components/hooks/useAgentWorkspaceCoordinator';
import { useSimulationRuntimeCoordinator } from './components/hooks/useSimulationRuntimeCoordinator';
import { useSplitLayoutController } from './components/hooks/useSplitLayoutController';
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

const DEFAULT_AGENT_PARAMETERS: AgentParameters = {
  visionCells: 36,
  visionRange: 250,
  visionAngle: 120,
};

const App: React.FC = () => {
  const hostProfile = VISION_ACTION_HOST_PROFILE;
  const worldRegistry = hostProfile.worldRegistry;
  const initialBrainLibraryLoad = useRef(loadBrainLibraryWithStatus(worldRegistry)).current;
  const initialAgentDocument = hostProfile.createSeedAgentIR(36, '当前 Agent');
  const isE2ETestMode = import.meta.env.MODE === 'test' || import.meta.env.VITE_E2E === 'true';
  const pendingRuntimeInstallRequestRef = useRef<AgentIR | null>(null);
  const pendingPersistActiveBrainRef = useRef<{
    agent: AgentIR;
    updatedAt: string;
  } | null>(null);
  const runtimeInstallRequestHandlerRef = useRef<(agent: AgentIR) => void>((agent) => {
    pendingRuntimeInstallRequestRef.current = agent;
  });
  const persistActiveBrainAgentRef = useRef<
    (agent: AgentIR, updatedAt: string) => void
  >((agent, updatedAt) => {
    pendingPersistActiveBrainRef.current = { agent, updatedAt };
  });
  const {
    appRef,
    simulationPanelRef,
    canvasWidth,
    canvasHeight,
    isStackedLayout,
    isResizingSplit,
    handleSplitPointerDown,
    handleSplitKeyDown,
    gameAreaStyle,
    controlAreaStyle,
  } = useSplitLayoutController();
  const [editorTab, setEditorTab] = useState<EditorTab>('graph');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('agent-parameters');
  const {
    currentAgentDocument,
    currentAgentDocumentRef,
    draftAgentDocument,
    draftAgentDocumentRef,
    setCurrentAgentDocument,
    setDraftAgentDocument,
    setDraftGraphStatusOverride,
    agentParameters,
    draftAgentParameters,
    syncAgentParametersFromBrain,
    draftProjectedVisionCellCount,
    agentDraftStatus,
    bodyEndpointValidation,
    hasUnsavedDraftChanges: hasUnsavedWorkspaceChanges,
    handleAgentParametersChange,
    handleAgentChange,
    handleGraphAgentChange,
    handleDraftAgentParametersChange,
    handleBodyApply,
    handleBodyReset,
    applyDraftAgentParameters,
    resetDraftAgentParameters,
    commitEditedAgentDocument,
  } = useAgentWorkspaceCoordinator({
    initialAgentDocument,
    defaultAgentParameters: DEFAULT_AGENT_PARAMETERS,
    worldRegistry,
    hostProfile,
    onRuntimeInstallRequest: (agent) => {
      runtimeInstallRequestHandlerRef.current(agent);
    },
    onPersistActiveBrainAgent: (agent, updatedAt) => {
      persistActiveBrainAgentRef.current(agent, updatedAt);
    },
  });
  const {
    runState,
    requestedLifecycleState,
    resetToken,
    stats,
    runtimeInstallRequest,
    agentRuntimeStatus,
    lastAppliedRuntimeInstallReceipt,
    agentRuntimeActivity,
    hasPendingRuntimeInstall,
    setRuntimeInstallRequest,
    handleStartPause,
    handleReset,
    resetRuntimeForBrainSwitch,
    handleStatsUpdate,
    handleLifecycleChange,
    handleAgentRuntimeStatusChange,
    handleAgentRuntimeInstallApplied,
    handleAgentRuntimeActivityChange,
  } = useSimulationRuntimeCoordinator({
    initialAgentDocument,
    worldRegistry,
    currentAgentDocument,
  });
  const installedGraphSummary = agentRuntimeStatus.appliedSummary;
  const graphEditorSessionToken = currentAgentDocument.metadata.id;
  const {
    mirroredGraphPath,
    bridgeNavigateToPathId,
    syncMirroredGraphPath,
    registerBridgePathNavigator,
  } = useGraphNavigationCoordinator(graphEditorSessionToken);
  const {
    brainLibrary,
    activeBrainId,
    isBrainLibraryOpen,
    brainLibraryStatusMessage,
    openBrainLibrary,
    closeBrainLibrary,
    handleCreateBrainFromCurrent,
    handleSelectBrain,
    handleImportBrain,
    handleExportBrain,
    handleRenameBrain,
    handleDeleteBrain,
    handleDuplicateBrain,
    persistActiveBrainAgent,
  } = useBrainLibraryCoordinator({
    initialBrains: initialBrainLibraryLoad.brains,
    initialStatusMessage: initialBrainLibraryLoad.status.message,
    worldRegistry,
    hostProfile,
    visionCells: agentParameters.visionCells,
    currentAgentId: currentAgentDocument.metadata.id,
    currentDraftAgentRef: draftAgentDocumentRef,
    hasUnsavedDraftChanges: hasUnsavedWorkspaceChanges || hasPendingRuntimeInstall,
    syncAgentParametersFromBrain,
    onActivateBrain: (brain) => {
      resetRuntimeForBrainSwitch();
      setCurrentAgentDocument(brain.agent);
      setRuntimeInstallRequest(brain.agent);
      setDraftAgentDocument(brain.agent);
      setDraftGraphStatusOverride(null);
      setEditorTab((currentTab) => (currentTab === 'graph' ? 'graph' : currentTab));
    },
    onAdoptCreatedBrain: (brain) => {
      setCurrentAgentDocument(brain.agent);
      setRuntimeInstallRequest(brain.agent);
      setDraftAgentDocument(brain.agent);
      setDraftGraphStatusOverride(null);
    },
    onRenameActiveBrainMetadata: (_brainId, agent) => {
      setCurrentAgentDocument((currentAgent) => ({
        ...currentAgent,
        metadata: { ...agent.metadata },
      }));
      setRuntimeInstallRequest((currentAgent) => ({
        ...currentAgent,
        metadata: { ...agent.metadata },
      }));
      setDraftAgentDocument((currentAgent) => ({
        ...currentAgent,
        metadata: { ...agent.metadata },
      }));
    },
    onDeleteActiveBrainFallback: (fallbackAgent) => {
      setCurrentAgentDocument(fallbackAgent);
      setRuntimeInstallRequest(fallbackAgent);
      setDraftAgentDocument(fallbackAgent);
      setDraftGraphStatusOverride(null);
      resetRuntimeForBrainSwitch();
    },
  });

  useEffect(() => {
    runtimeInstallRequestHandlerRef.current = setRuntimeInstallRequest;
    if (pendingRuntimeInstallRequestRef.current) {
      setRuntimeInstallRequest(pendingRuntimeInstallRequestRef.current);
      pendingRuntimeInstallRequestRef.current = null;
    }
  }, [setRuntimeInstallRequest]);

  useEffect(() => {
    persistActiveBrainAgentRef.current = persistActiveBrainAgent;
    if (pendingPersistActiveBrainRef.current) {
      const { agent, updatedAt } = pendingPersistActiveBrainRef.current;
      persistActiveBrainAgent(agent, updatedAt);
      pendingPersistActiveBrainRef.current = null;
    }
  }, [persistActiveBrainAgent]);

  useGlobalRuntimeHotkeys({
    enabled: !isBrainLibraryOpen,
    onToggleRunPause: handleStartPause,
  });

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
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
      getGraphPathIds: () => mirroredGraphPath.map((item) => item.id),
      getActiveAgentId: () => currentAgentDocumentRef.current.metadata.id,
      getActiveBrainId: () => activeBrainId,
      getDraftAgentId: () => draftAgentDocumentRef.current.metadata.id,
    };

    return () => {
      delete window.__NEURALSOUP_TEST_API__;
    };
  }, [activeBrainId, agentRuntimeActivity.activeNodeIds, handleAgentChange, handleGraphAgentChange, isE2ETestMode, mirroredGraphPath]);

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
          mirroredGraphPath={mirroredGraphPath}
          runState={runState}
          onBrainLibraryOpen={openBrainLibrary}
          onEditorTabChange={setEditorTab}
          onBridgeNavigateToPathId={bridgeNavigateToPathId}
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
              agent={draftAgentDocument}
              worldRegistry={worldRegistry}
              validation={bodyEndpointValidation}
              onBodyChange={(updater) => {
                commitEditedAgentDocument(
                  {
                    ...draftAgentDocumentRef.current,
                    body: updater(draftAgentDocumentRef.current.body),
                  },
                  GRAPH_DRAFT_ONLY_CHANGE
                );
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
            onMirroredGraphPathSync={syncMirroredGraphPath}
            onBridgePathNavigatorRegister={registerBridgePathNavigator}
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
          onClose={closeBrainLibrary}
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
