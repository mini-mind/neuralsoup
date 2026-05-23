import type { AgentIR, AgentIRSummary } from './agent-ir';
import type { AgentProgram } from './agent-program';
import { resolveAgentBodyEndpointIds } from './agent-body-rules';
import { compileAgentIR } from './agent-compiler';

export const summarizeAgentIR = (agent: AgentIR): AgentIRSummary => {
  const endpointIds = resolveAgentBodyEndpointIds(agent);

  return {
    inputSignalCount: endpointIds.bodyInputNodeIds.length,
    outputSignalCount: endpointIds.bodyOutputNodeIds.length,
    neuronCount: agent.brain.neurons.length,
    leafLinkCount: agent.connections.length,
  };
};

export const summarizeCompiledAgentProgram = (program: AgentProgram): AgentIRSummary => program.summary;

export const summarizeCompiledAgentIR = (agent: AgentIR): AgentIRSummary => compileAgentIR(agent).summary;
