export interface Position {
  x: number;
  y: number;
}

export interface IzhikevichNeuronParameters {
  a: number;
  b: number;
  c: number;
  d: number;
  threshold: number;
}

export interface IzhikevichNeuronRuntimeState {
  v: number;
  u: number;
  spike: boolean;
  lastSpikeTime: number;
}

export type BrainInputChannel = 'R' | 'G' | 'B';
export type BrainInputModality = 'vision';
export type BrainOutputChannel = 'turn-left' | 'move-forward' | 'turn-right';

export interface BrainInputPort {
  id: string;
  label: string;
  modality: BrainInputModality;
  channel: BrainInputChannel;
  index: number;
}

export interface BrainOutputPort {
  id: string;
  label: string;
  channel: BrainOutputChannel;
  index: number;
}

export interface BrainNeuronNode {
  id: string;
  label: string;
  position: Position;
  params: IzhikevichNeuronParameters;
}

export interface BrainSynapse {
  id: string;
  from: string;
  to: string;
  weight: number;
}

export interface BrainGraph {
  inputs: BrainInputPort[];
  neurons: BrainNeuronNode[];
  outputs: BrainOutputPort[];
  synapses: BrainSynapse[];
}
