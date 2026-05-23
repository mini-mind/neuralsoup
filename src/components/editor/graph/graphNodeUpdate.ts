export interface GraphNodeParameterOverrides {
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  threshold?: number;
}

export interface GraphNodeInitialStateUpdate {
  v: number;
  u?: number;
}

export interface GraphNodeUpdatePayload {
  label: string;
  parameterOverrides?: GraphNodeParameterOverrides;
  initialState?: GraphNodeInitialStateUpdate;
}
