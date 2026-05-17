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
export type BrainOutputChannel = 'turn-left' | 'move-forward' | 'turn-right';
