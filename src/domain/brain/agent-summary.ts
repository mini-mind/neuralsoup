import type { AgentIR, AgentIRSummary } from './agent-ir';
import type { AgentProgram } from './agent-program';
import { resolveAgentBodyEndpointIds } from './agent-body-rules';
import { compileAgentIR } from './agent-compiler';
import type { WorldRegistry } from './world-registry';

export const summarizeAgentIR = (
  agent: AgentIR,
  registry: WorldRegistry,
  projectedVisionCellCount?: number
): AgentIRSummary => {
  const endpointIds = resolveAgentBodyEndpointIds(agent, registry, projectedVisionCellCount);

  return {
    inputSignalCount: endpointIds.bodyInputNodeIds.length,
    outputSignalCount: endpointIds.bodyOutputNodeIds.length,
    neuronCount: agent.brain.neurons.length,
    connectionCount: agent.connections.length,
    leafLinkCount: agent.connections.length,
  };
};

export const summarizeCompiledAgentProgram = (program: AgentProgram): AgentIRSummary => program.summary;

export const summarizeCompiledAgentIR = (agent: AgentIR, registry: WorldRegistry): AgentIRSummary => compileAgentIR(agent, registry).summary;
