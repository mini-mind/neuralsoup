export type GraphNodeParameterOverrides = Record<string, number>;
export type GraphLinkParameterOverrides = Record<string, number>;

export interface GraphNodeInitialStateUpdate {
  v: number;
  u?: number;
}

export interface GraphNodeUpdatePayload {
  label: string;
  neuronModelId?: string;
  parameterOverrides?: GraphNodeParameterOverrides;
  initialState?: GraphNodeInitialStateUpdate;
  nodeKind?: 'neuron' | 'neuron-group' | 'signal';
  source?: string;
  target?: string;
  scale?: number;
  decayPerSecond?: number;
}

export interface GraphLinkUpdatePayload {
  synapseModelId?: string;
  parameterOverrides?: GraphLinkParameterOverrides;
}
