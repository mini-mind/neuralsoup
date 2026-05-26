import type { AgentIR, AgentIRSummary, BodyInputNodeRuntime, BodyOutputNodeRuntime } from './agent-ir';
import type { IzhikevichNeuronParameters } from './shared';

export interface AgentProgramInputPort {
  id: string;
  source: string;
  worldPort: string;
  scale: number;
}

export interface AgentProgramOutputPort {
  id: string;
  target: string;
  normalizedTarget: string;
  worldPort: string;
  commandKind: string;
  decayPerSecond: number;
}

export interface AgentProgramConnectionBase {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  synapseModelId: string;
  weight: number;
  delayMs: number;
}

export interface AgentProgramStaticCurrentConnection extends AgentProgramConnectionBase {
  synapseKind: 'static-current';
}

export interface AgentProgramSingleExpConductanceConnection extends AgentProgramConnectionBase {
  synapseKind: 'single-exp-conductance';
  gMax: number;
  reversalPotential: number;
  tauDecayMs: number;
}

export interface AgentProgramDualExpConductanceConnection extends AgentProgramConnectionBase {
  synapseKind: 'dual-exp-conductance';
  gMax: number;
  reversalPotential: number;
  tauRiseMs: number;
  tauDecayMs: number;
}

export interface AgentProgramDualExpStdpConnection extends AgentProgramConnectionBase {
  synapseKind: 'dual-exp-stdp';
  gMax: number;
  reversalPotential: number;
  tauRiseMs: number;
  tauDecayMs: number;
  aPlus: number;
  aMinus: number;
  tauPlusMs: number;
  tauMinusMs: number;
  wMin: number;
  wMax: number;
}

export type AgentProgramConnection =
  | AgentProgramStaticCurrentConnection
  | AgentProgramSingleExpConductanceConnection
  | AgentProgramDualExpConductanceConnection
  | AgentProgramDualExpStdpConnection;

export interface AgentProgramNeuronNode {
  id: string;
  label: string;
  neuronModelId: string;
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
