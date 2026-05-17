import React, { useState, useCallback, useEffect, useRef } from 'react';
import SimulationCanvas from './components/SimulationCanvas';
import {
  createDefaultGraphIRDocument,
  reconcileGraphIRDocumentVisionCells,
  validateGraphIRDocument,
  type GraphIRDocument,
} from './domain/brain';
import type { SimulationControlMode } from './domain/world';
import type { SimulationLifecycleState } from './engine/SimulationEngine';
import type { GraphIRRuntimeStatus } from './types/graphIRRuntime';
import type { SimulationState } from './types/simulation';
import EditorToolbar from './components/editor/EditorToolbar';
import GraphEditorPanel from './components/editor/GraphEditorPanel';
import SettingsPanel from './components/editor/SettingsPanel';
import type { AgentParameters, EditorTab, SettingsSection } from './components/editor/types';
import './App.css';

declare global {
  interface Window {
    __NEURALSOUP_TEST_API__?: {
      injectValidDraftOnly: () => void;
      injectInvalidGraphDraft: () => void;
    };
  }
}

const INITIAL_STATS: SimulationState['stats'] = {
  fps: 0,
  totalReward: 0,
  collisionCount: 0,
  neuralState: { motivation: 0, stress: 0, homeostasis: 0.5 }
};

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
  const isE2ETestMode = import.meta.env.MODE === 'test' || import.meta.env.VITE_E2E === 'true';
  const [runState, setRunState] = useState<SimulationLifecycleState>('idle');
  const [requestedLifecycleState, setRequestedLifecycleState] = useState<SimulationLifecycleState>('idle');
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<SimulationState['stats']>(INITIAL_STATS);
  const [graphDocument, setGraphDocument] = useState<GraphIRDocument>(() => createDefaultGraphIRDocument(36));
  const [runtimeGraphDocument, setRuntimeGraphDocument] = useState<GraphIRDocument>(() =>
    createDefaultGraphIRDocument(36)
  );
  const [graphIRRuntimeStatus, setGraphIRRuntimeStatus] = useState<GraphIRRuntimeStatus | null>(null);
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
  const graphIRIssues = validateGraphIRDocument(graphDocument);
  const graphDocumentRef = useRef(graphDocument);
  const installedGraphSummary = graphIRRuntimeStatus?.appliedSummary ?? null;

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

  const updateGraphDocument = useCallback(
    (nextDocument: GraphIRDocument, installToRuntime: boolean = true) => {
      graphDocumentRef.current = nextDocument;
      setGraphDocument(nextDocument);
      if (installToRuntime) {
        setRuntimeGraphDocument(nextDocument);
      }
    },
    []
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
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
    updateGraphDocument(reconcileGraphIRDocumentVisionCells(graphDocumentRef.current, params.visionCells));
  }, [updateGraphDocument]);

  const handleAgentParametersChange = useCallback((params: AgentParameters) => {
    setAgentParameters((current) => (areAgentParametersEqual(current, params) ? current : params));
  }, []);

  useEffect(() => {
    setDraftAgentParameters(agentParameters);
  }, [agentParameters]);

  useEffect(() => {
    graphDocumentRef.current = graphDocument;
  }, [graphDocument]);

  const handleGraphDocumentChange = useCallback((nextDocument: GraphIRDocument) => {
    updateGraphDocument(nextDocument);
  }, [updateGraphDocument]);

  const handleGraphIRRuntimeStatusChange = useCallback((nextStatus: GraphIRRuntimeStatus) => {
    setGraphIRRuntimeStatus(nextStatus);
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
      }
    };

    return () => {
      delete window.__NEURALSOUP_TEST_API__;
    };
  }, [isE2ETestMode, updateGraphDocument]);

  return (
    <div className="app" data-testid="app-shell">
      <div className="game-area" data-testid="simulation-panel">
        <SimulationCanvas
          width={canvasWidth}
          height={canvasHeight}
          controlMode={'snn' as Extract<SimulationControlMode, 'keyboard' | 'snn'>}
          graphDocument={runtimeGraphDocument}
          agentParameters={agentParameters}
          requestedLifecycleState={requestedLifecycleState}
          resetToken={resetToken}
          onStatsUpdate={handleStatsUpdate}
          onLifecycleChange={handleLifecycleChange}
          onAgentParametersChange={handleAgentParametersChange}
          onGraphIRStatusChange={handleGraphIRRuntimeStatusChange}
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
          <span data-testid="graph-ir-validation-count">{graphIRIssues.length}</span>
          <span data-testid="graph-ir-runtime-state">{graphIRRuntimeStatus?.state ?? ''}</span>
          <span data-testid="graph-ir-runtime-validation-count">{graphIRRuntimeStatus?.issues.length ?? 0}</span>
          <span data-testid="graph-ir-runtime-message">{graphIRRuntimeStatus?.message ?? ''}</span>
          <span data-testid="graph-ir-installed-input-count">{installedGraphSummary?.inputSignalCount ?? 0}</span>
          <span data-testid="graph-ir-installed-neuron-count">{installedGraphSummary?.neuronCount ?? 0}</span>
          <span data-testid="graph-ir-installed-output-count">{installedGraphSummary?.outputSignalCount ?? 0}</span>
          <span data-testid="graph-ir-installed-link-count">{installedGraphSummary?.leafLinkCount ?? 0}</span>
        </div>

        <div className={`content-area ${editorTab === 'graph' ? 'snn-mode' : 'settings-mode'}`}>
          {graphIRRuntimeStatus ? (
            <GraphEditorPanel
              isActive={editorTab === 'graph'}
              document={graphDocument}
              visionCells={agentParameters.visionCells}
              runtimeStatus={graphIRRuntimeStatus}
              onDocumentChange={handleGraphDocumentChange}
            />
          ) : (
            <div
              className={`content-panel snn-control ${editorTab === 'graph' ? 'is-active' : 'is-hidden'}`}
              data-testid="topology-viewport"
              aria-hidden={editorTab !== 'graph'}
            />
          )}
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
