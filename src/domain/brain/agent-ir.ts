import type { IzhikevichNeuronParameters, Position } from './shared';
import type { BrainOutputChannel } from './shared';
import { getDefaultWorldRegistry } from './world-registry';

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
  collapsed?: boolean;
}

export interface AgentLayoutIR {
  version: 1;
  nodes: Record<string, AgentLayoutNodeState>;
}

export interface AgentIR {
  version: 1;
  metadata: AgentMetadata;
  body: BodyIR;
  brain: BrainIR;
  connections: AgentConnection[];
  layout?: AgentLayoutIR;
}

export interface AgentIRSummary {
  inputSignalCount: number;
  outputSignalCount: number;
  neuronCount: number;
  leafLinkCount: number;
}

export interface BodyInputNodeRuntime {
  id: string;
  source: string;
  worldPort: string;
  visualInputIndex: number;
  scale: number;
}

export interface BodyOutputNodeRuntime {
  id: string;
  target: BrainOutputChannel;
  normalizedTarget: string;
  worldPort: string;
  decayPerSecond: number;
}

const normalizeVisionCellCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.max(0, Math.floor(value))
    : null;

const applyRuleTemplate = (template: string, match: RegExpExecArray): string =>
  template.replace(/\$(\d+)/g, (_token, rawGroupIndex: string) => {
    const groupIndex = Number.parseInt(rawGroupIndex, 10);
    return match[groupIndex] ?? '';
  });

export const resolveBodyInputVisionCellIndex = (
  nodeId: string,
  rules: BodyInputRule[]
): number | null => {
  const matches = rules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

  if (matches.length !== 1) {
    return null;
  }

  const source = applyRuleTemplate(matches[0].rule.sourceTemplate, matches[0].match);
  const binding = getDefaultWorldRegistry().resolveInputBinding(source);
  return binding?.runtimeIndex != null ? Math.floor(binding.runtimeIndex / 3) : null;
};

export const withVisionCellCount = (
  agent: AgentIR,
  visionCellCount: number
): AgentIR => {
  const normalizedVisionCellCount = Math.max(0, Math.floor(visionCellCount));

  return {
    ...agent,
    body: {
      ...agent.body,
      visionCellCount: normalizeVisionCellCount(normalizedVisionCellCount) ?? 0,
    },
  };
};
