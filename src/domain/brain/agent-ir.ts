import type { BrainOutputChannel, IzhikevichNeuronParameters, Position } from './shared';

export interface AgentMetadata {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BodyInputRule {
  id: string;
  nodeIdPattern: string;
  sourceTemplate: string;
  scale: number;
}

export interface BodyOutputRule {
  id: string;
  nodeIdPattern: string;
  targetTemplate: string;
  decayPerSecond: number;
}

export interface BodyIR {
  version: 1;
  visionCellCount: number;
  inputRules: BodyInputRule[];
  outputRules: BodyOutputRule[];
}

export interface BrainNeuronInitialState {
  v: number;
  u?: number;
}

export interface BrainNeuronNode {
  id: string;
  label: string;
  model: 'izhikevich';
  params: IzhikevichNeuronParameters;
  initialState: BrainNeuronInitialState;
}

export interface BrainContainerChildRef {
  scope: 'brain' | 'container';
  nodeId: string;
}

export interface BrainContainerNode {
  id: string;
  label?: string;
  children: BrainContainerChildRef[];
}

export interface BrainIR {
  version: 1;
  neurons: BrainNeuronNode[];
  containers: BrainContainerNode[];
  rootContainerId: string;
}

export type AgentConnectionEndpoint =
  | { scope: 'bodyInput'; nodeId: string; portId?: string }
  | { scope: 'bodyOutput'; nodeId: string; portId?: string }
  | { scope: 'brain'; nodeId: string; portId?: string };

export interface AgentConnection {
  id: string;
  from: AgentConnectionEndpoint;
  to: AgentConnectionEndpoint;
  weight: number;
  delayMs?: number;
}

export interface AgentLayoutNodeState {
  position?: Position;
  size?: { width: number; height: number };
  collapsed?: boolean;
  expanded?: boolean;
}

export interface AgentLayoutViewport {
  x: number;
  y: number;
  scale: number;
}

export interface AgentLayoutIR {
  version: 1;
  nodes: Record<string, AgentLayoutNodeState>;
  viewportByContainerId?: Record<string, AgentLayoutViewport>;
}

export interface AgentIR {
  version: 1;
  metadata: AgentMetadata;
  body: BodyIR;
  brain: BrainIR;
  connections: AgentConnection[];
  layout?: AgentLayoutIR;
}

export interface AgentLibraryItem {
  packageVersion: 1;
  metadata: AgentMetadata;
  agent: AgentIR;
}

export interface BodyInputNodeRuntime {
  id: string;
  source: string;
  visualInputIndex: number;
  scale: number;
}

export interface BodyOutputNodeRuntime {
  id: string;
  target: BrainOutputChannel;
  decayPerSecond: number;
}
