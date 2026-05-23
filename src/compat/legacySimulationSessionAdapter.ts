import type { AgentIR } from '../domain/brain';
import type { AgentRuntimeStatus } from '../types/agentRuntime';
import type { Agent } from '../types/simulation';
import { SimulationSession } from '../runtime/SimulationSession';

export interface LegacySimulationSessionAdapter {
  getCurrentAgentIR(): AgentIR;
  getAppliedAgentSummary(): AgentRuntimeStatus['appliedSummary'];
  getAvailableVisionCellCount(): number;
  setAgentIR(agent: AgentIR): AgentRuntimeStatus;
}

export interface LegacySimulationSessionAdapterRawSession {
  getCurrentAgentIR(): AgentIR;
  getAppliedAgentIR(): AgentIR;
  getAgentRuntimeStatus(): AgentRuntimeStatus;
  getMainAgent(): Agent | null;
  getVisionCellCount(): number;
  setAgentIR(agent: AgentIR): AgentRuntimeStatus;
}

export type LegacySimulationSessionCompatTarget = LegacySimulationSessionAdapter | SimulationSession;

const isLegacySimulationSessionAdapter = (
  value: LegacySimulationSessionCompatTarget
): value is LegacySimulationSessionAdapter =>
  typeof value === 'object' &&
  value !== null &&
  'getCurrentAgentIR' in value &&
  typeof value.getCurrentAgentIR === 'function' &&
  'getAppliedAgentSummary' in value &&
  typeof value.getAppliedAgentSummary === 'function' &&
  'getAvailableVisionCellCount' in value &&
  typeof value.getAvailableVisionCellCount === 'function' &&
  'setAgentIR' in value &&
  typeof value.setAgentIR === 'function';

export const createLegacySimulationSessionAdapter = (
  session: LegacySimulationSessionAdapterRawSession
): LegacySimulationSessionAdapter => ({
  getCurrentAgentIR: () => session.getAppliedAgentIR(),
  getAppliedAgentSummary: () => session.getAgentRuntimeStatus().appliedSummary,
  getAvailableVisionCellCount: () => session.getMainAgent()?.visionCells.length ?? session.getVisionCellCount(),
  setAgentIR: (agent) => session.setAgentIR(agent),
});

export const getLegacySimulationSessionAdapter = (
  target: LegacySimulationSessionCompatTarget
): LegacySimulationSessionAdapter =>
  isLegacySimulationSessionAdapter(target)
    ? target
    : createLegacySimulationSessionAdapter(target);
