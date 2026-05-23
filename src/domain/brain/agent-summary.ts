import type { AgentIR, AgentIRSummary } from './agent-ir';
import { resolveAgentBodyEndpointIds } from './agent-body-rules';

export const summarizeAgentIR = (agent: AgentIR): AgentIRSummary => {
  const endpointIds = resolveAgentBodyEndpointIds(agent);

  return {
    inputSignalCount: endpointIds.bodyInputNodeIds.length,
    outputSignalCount: endpointIds.bodyOutputNodeIds.length,
    neuronCount: agent.brain.neurons.length,
    leafLinkCount: agent.connections.length,
  };
};
