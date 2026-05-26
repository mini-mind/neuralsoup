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
}

export interface GraphLinkUpdatePayload {
  synapseModelId?: string;
  parameterOverrides?: GraphLinkParameterOverrides;
}
