import type { AgentIR } from '../domain/brain';
import type { AgentRuntimeStatus } from '../types/agentRuntime';
import type { World } from '../types/simulation';
import type {
  SimulationSessionRuntimeConfigSnapshot,
  SimulationSessionRuntimeProgramSnapshot,
} from '../runtime/SimulationSession';

const LEGACY_SIMULATION_SESSION_ADAPTER_BRAND: unique symbol = Symbol('LegacySimulationSessionAdapter');

export interface LegacySimulationSessionAdapter {
  readonly [LEGACY_SIMULATION_SESSION_ADAPTER_BRAND]: true;
  getCurrentAgentIR(): AgentIR;
  getAppliedAgentSummary(): AgentRuntimeStatus['appliedSummary'];
  getAvailableVisionCellCount(): number;
  setAgentIR(agent: AgentIR): AgentRuntimeStatus;
}

export interface LegacySimulationSessionAdapterSource {
  getRuntimeProgramSnapshot(): SimulationSessionRuntimeProgramSnapshot;
  getAgentRuntimeStatus(): AgentRuntimeStatus;
  getRuntimeConfigSnapshot(): SimulationSessionRuntimeConfigSnapshot;
  getWorldSnapshot(): World;
  setAgentIR(agent: AgentIR): AgentRuntimeStatus;
}

const isLegacySimulationSessionAdapter = (
  value: unknown
): value is LegacySimulationSessionAdapter =>
  typeof value === 'object' &&
  value !== null &&
  LEGACY_SIMULATION_SESSION_ADAPTER_BRAND in value;

const isLegacySimulationSessionAdapterSource = (
  value: unknown
): value is LegacySimulationSessionAdapterSource =>
  typeof value === 'object' &&
  value !== null &&
  'getRuntimeProgramSnapshot' in value &&
  typeof value.getRuntimeProgramSnapshot === 'function' &&
  'getAgentRuntimeStatus' in value &&
  typeof value.getAgentRuntimeStatus === 'function' &&
  'getRuntimeConfigSnapshot' in value &&
  typeof value.getRuntimeConfigSnapshot === 'function' &&
  'getWorldSnapshot' in value &&
  typeof value.getWorldSnapshot === 'function' &&
  'setAgentIR' in value &&
  typeof value.setAgentIR === 'function';

export const createLegacySimulationSessionAdapter = (
  session: LegacySimulationSessionAdapterSource
): LegacySimulationSessionAdapter => {
  const readAvailableVisionCellCount = (): number => {
    const world = session.getWorldSnapshot();
    const mainAgent = world.agents.find((agent) => agent.id === world.mainAgentId);
    return mainAgent?.visionCells.length ?? session.getRuntimeConfigSnapshot().visionCells;
  };

  return {
    [LEGACY_SIMULATION_SESSION_ADAPTER_BRAND]: true,
    getCurrentAgentIR: () => session.getRuntimeProgramSnapshot().appliedAgentIR,
    getAppliedAgentSummary: () => session.getRuntimeProgramSnapshot().appliedSummary,
    getAvailableVisionCellCount: readAvailableVisionCellCount,
    setAgentIR: (agent) => session.setAgentIR(agent),
  };
};

export function getLegacySimulationSessionAdapter(
  target: LegacySimulationSessionAdapter
): LegacySimulationSessionAdapter;
export function getLegacySimulationSessionAdapter(
  target: LegacySimulationSessionAdapter | LegacySimulationSessionAdapterSource
): LegacySimulationSessionAdapter {
  if (isLegacySimulationSessionAdapter(target)) {
    return target;
  }

  if (isLegacySimulationSessionAdapterSource(target)) {
    return createLegacySimulationSessionAdapter(target);
  }

  throw new TypeError(
    'Legacy compat API requires a LegacySimulationSessionAdapter. Wrap the session with createLegacySimulationSessionAdapter(session).'
  );
}
