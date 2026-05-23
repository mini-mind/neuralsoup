import type { LeafLink, ModelDefinition } from './legacyGraphIR';
import type { BrainInputChannel, BrainOutputChannel, IzhikevichNeuronParameters } from '../domain/brain/shared';
import type { AgentProgram } from '../domain/brain/agent-program';

export interface ProgramInputPort {
  id: string;
  label: string;
  modality: 'vision';
  channel: BrainInputChannel;
  index: number;
}

export interface ProgramOutputPort {
  id: string;
  label: string;
  channel: BrainOutputChannel;
  index: number;
}

export interface BrainProgramNodeIndex {
  inputs: Map<string, ProgramInputPort>;
  neurons: Map<string, BrainProgramNeuronNode>;
  outputs: Map<string, BrainProgramSignalNode>;
}

export interface BrainProgramConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  weight: number;
  delayMs: number;
}

export interface BrainProgramInputBinding {
  nodeId: string;
  portId: string;
  index: number;
}

export interface BrainProgramOutputBinding {
  nodeId: string;
  portId: string;
  channel: BrainOutputChannel;
}

export interface BrainProgramNeuronNode {
  id: string;
  label: string;
  modelId: string;
  params: IzhikevichNeuronParameters;
  inputConnections: BrainProgramConnection[];
  outputConnections: BrainProgramConnection[];
}

export interface BrainProgramSignalNode {
  id: string;
  label: string;
  modelId: string;
  direction: 'input' | 'output';
  signalId: string;
  inputConnections: BrainProgramConnection[];
  outputConnections: BrainProgramConnection[];
}

export interface LegacyBrainProgram {
  inputPorts: ProgramInputPort[];
  neuronNodes: BrainProgramNeuronNode[];
  outputPorts: ProgramOutputPort[];
  signalNodes: BrainProgramSignalNode[];
  links: LeafLink[];
  inputBindings: BrainProgramInputBinding[];
  outputBindings: BrainProgramOutputBinding[];
  modelsById: Map<string, ModelDefinition>;
  nodeIndex: BrainProgramNodeIndex;
}
export type LegacyGraphProgram = LegacyBrainProgram;

const compiledAgentProgramByLegacyProgram = new WeakMap<LegacyBrainProgram, AgentProgram>();

export const attachLegacyBrainProgramRuntimePayload = (
  program: LegacyBrainProgram,
  compiledAgentProgram: AgentProgram
): LegacyBrainProgram => {
  compiledAgentProgramByLegacyProgram.set(program, compiledAgentProgram);
  return program;
};

export const getLegacyBrainProgramRuntimePayload = (program: LegacyBrainProgram): AgentProgram => {
  const compiledAgentProgram = compiledAgentProgramByLegacyProgram.get(program);
  if (!compiledAgentProgram) {
    throw new Error('LegacyBrainProgram is missing the compiled Agent runtime payload.');
  }

  return compiledAgentProgram;
};
