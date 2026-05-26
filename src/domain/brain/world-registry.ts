export interface WorldInputBinding {
  source: string;
  worldPort: string;
  cellIndex?: number;
}

export interface WorldOutputBinding {
  target: string;
  worldPort: string;
  commandKind: string;
}

export interface WorldPortDescriptor {
  id: string;
  direction: 'input' | 'output';
  kind: string;
  enumerable: boolean;
}

export interface WorldRegistry {
  version: 1;
  inputs: WorldPortDescriptor[];
  outputs: WorldPortDescriptor[];
  resolveInputBinding(source: string): WorldInputBinding | null;
  resolveOutputBinding(target: string): WorldOutputBinding | null;
}
