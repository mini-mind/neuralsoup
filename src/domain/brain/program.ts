import type { BrainGraph, BrainInputPort, BrainNeuronNode, BrainOutputPort, BrainSynapse } from './types';

export interface BrainProgramNodeIndex {
  inputs: Map<string, BrainInputPort>;
  neurons: Map<string, BrainNeuronNode>;
  outputs: Map<string, BrainOutputPort>;
}

export interface BrainProgram {
  graph: BrainGraph;
  inputPorts: BrainInputPort[];
  neuronNodes: BrainNeuronNode[];
  outputPorts: BrainOutputPort[];
  synapses: BrainSynapse[];
  nodeIndex: BrainProgramNodeIndex;
}

