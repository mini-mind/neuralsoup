import { useCallback, useMemo, useRef, useState } from 'react';
import type { AgentIR, WorldRegistry } from '../../domain/brain';
import { summarizeAgentIR } from '../../domain/brain';
import type { SimulationLifecycleState } from '../../engine/SimulationEngine';
import type { RuntimeInstallReceipt } from '../SimulationCanvas';
import type { AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from '../../types/agentRuntime';
import type { SimulationState } from '../../types/simulation';

const INITIAL_STATS: SimulationState['stats'] = {
  fps: 0,
  totalReward: 0,
  collisionCount: 0,
  neuralState: { motivation: 0, stress: 0, homeostasis: 0.5 },
};

const normalizeAgentForCompare = (agent: AgentIR): AgentIR => ({
  ...agent,
  metadata: {
    ...agent.metadata,
    updatedAt: '',
  },
});

const createRuntimeInstallRequestKey = (agent: AgentIR): string =>
  JSON.stringify(normalizeAgentForCompare(agent));

const createInitialAgentRuntimeStatus = (
  agent: AgentIR,
  worldRegistry: WorldRegistry
): AgentRuntimeStatus => ({
  state: 'applied',
  appliedSummary: summarizeAgentIR(agent, worldRegistry),
  issues: [],
  message: null,
});

interface UseSimulationRuntimeCoordinatorOptions {
  initialAgentDocument: AgentIR;
  worldRegistry: WorldRegistry;
  currentAgentDocument: AgentIR;
}

export const useSimulationRuntimeCoordinator = ({
  initialAgentDocument,
  worldRegistry,
  currentAgentDocument,
}: UseSimulationRuntimeCoordinatorOptions) => {
  const [runState, setRunState] = useState<SimulationLifecycleState>('idle');
  const [requestedLifecycleState, setRequestedLifecycleState] =
    useState<SimulationLifecycleState>('idle');
  const [resetToken, setResetToken] = useState(0);
  const [stats, setStats] = useState<SimulationState['stats']>(INITIAL_STATS);
  const [runtimeInstallRequest, setRuntimeInstallRequest] =
    useState<AgentIR>(initialAgentDocument);
  const [agentRuntimeStatus, setAgentRuntimeStatus] = useState<AgentRuntimeStatus>(() =>
    createInitialAgentRuntimeStatus(initialAgentDocument, worldRegistry)
  );
  const [lastAppliedRuntimeInstallReceipt, setLastAppliedRuntimeInstallReceipt] =
    useState<RuntimeInstallReceipt>(() => ({
      agentId: initialAgentDocument.metadata.id,
      requestKey: createRuntimeInstallRequestKey(initialAgentDocument),
    }));
  const [agentRuntimeActivity, setAgentRuntimeActivity] =
    useState<AgentRuntimeActivitySnapshot>({
      activeNodeIds: [],
    });
  const requestedLifecycleStateRef = useRef<SimulationLifecycleState>('idle');

  const currentRuntimeInstallRequestKey = useMemo(
    () => createRuntimeInstallRequestKey(currentAgentDocument),
    [currentAgentDocument]
  );

  const hasPendingRuntimeInstall =
    agentRuntimeStatus.state !== 'applied' ||
    lastAppliedRuntimeInstallReceipt.agentId !== currentAgentDocument.metadata.id ||
    lastAppliedRuntimeInstallReceipt.requestKey !== currentRuntimeInstallRequestKey;

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

  const handleStatsUpdate = useCallback((nextStats: SimulationState['stats']) => {
    setStats(nextStats);
  }, []);

  const handleLifecycleChange = useCallback((nextState: SimulationLifecycleState) => {
    setRunState(nextState);
  }, []);

  const handleAgentRuntimeStatusChange = useCallback((nextStatus: AgentRuntimeStatus) => {
    setAgentRuntimeStatus(nextStatus);
  }, []);

  const handleAgentRuntimeInstallApplied = useCallback((receipt: RuntimeInstallReceipt) => {
    setLastAppliedRuntimeInstallReceipt((currentReceipt) =>
      currentReceipt.agentId === receipt.agentId &&
      currentReceipt.requestKey === receipt.requestKey
        ? currentReceipt
        : receipt
    );
  }, []);

  const handleAgentRuntimeActivityChange = useCallback(
    (nextSnapshot: AgentRuntimeActivitySnapshot) => {
      setAgentRuntimeActivity(nextSnapshot);
    },
    []
  );

  return {
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
  };
};
