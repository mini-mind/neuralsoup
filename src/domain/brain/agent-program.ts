import type { AgentIR, AgentIRSummary, BodyInputNodeRuntime, BodyOutputNodeRuntime } from './agent-ir';
import type { IzhikevichNeuronParameters } from './shared';

export interface AgentProgramInputPort {
  id: string;
  source: string;
  worldPort: string;
  index: number;
  scale: number;
}

export interface AgentProgramOutputPort {
  id: string;
  target: string;
  normalizedTarget: string;
  worldPort: string;
  decayPerSecond: number;
}

export interface AgentProgramConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  weight: number;
  delayMs: number;
}

export interface AgentProgramNeuronNode {
  id: string;
  label: string;
  params: IzhikevichNeuronParameters;
  initialState: {
    v: number;
    u: number;
  };
  inputConnections: AgentProgramConnection[];
  outputConnections: AgentProgramConnection[];
}

export interface AgentProgram {
  agent: AgentIR;
  summary: AgentIRSummary;
  inputPorts: AgentProgramInputPort[];
  outputPorts: AgentProgramOutputPort[];
  neuronNodes: AgentProgramNeuronNode[];
  connections: AgentProgramConnection[];
  bodyInputsById: Map<string, BodyInputNodeRuntime>;
  bodyOutputsById: Map<string, BodyOutputNodeRuntime>;
  neuronNodeIndex: Map<string, AgentProgramNeuronNode>;
}
