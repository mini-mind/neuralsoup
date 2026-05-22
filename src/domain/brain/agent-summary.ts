import type { AgentIR } from './agent-ir';
import type { GraphIRDocumentSummary } from './ir';

export const summarizeAgentIR = (agent: AgentIR): GraphIRDocumentSummary => {
  const inputNodeIds = new Set<string>();
  const outputNodeIds = new Set<string>();

  for (const connection of agent.connections) {
    if (connection.from.scope === 'bodyInput') {
      inputNodeIds.add(connection.from.nodeId);
    }
    if (connection.to.scope === 'bodyOutput') {
      outputNodeIds.add(connection.to.nodeId);
    }
  }

  return {
    inputSignalCount: Math.max(agent.body.visionCellCount * 3 + 3, inputNodeIds.size),
    outputSignalCount: Math.max(3, outputNodeIds.size),
    neuronCount: agent.brain.neurons.length,
    leafLinkCount: agent.connections.length,
  };
};
