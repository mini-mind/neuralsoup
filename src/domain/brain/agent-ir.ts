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

const LEGACY_BODY_INPUT_NODE_PATTERN = /^vision-[RGB]-(\d+)$/;
const BODY_INPUT_SOURCE_PATTERN = /^vision\.[RGB]\.(\d+)$/;
const VISION_LAYOUT_MARKER_PATTERN = /^__body-vision-cell-(\d+)$/;

type LegacyBodyIR = Omit<BodyIR, 'visionCellCount'> & {
  visionCellCount?: unknown;
};

const normalizeVisionCellCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.max(0, Math.floor(value))
    : null;

const applyRuleTemplate = (template: string, match: RegExpExecArray): string =>
  template.replace(/\$(\d+)/g, (_token, rawGroupIndex: string) => {
    const groupIndex = Number.parseInt(rawGroupIndex, 10);
    return match[groupIndex] ?? '';
  });

const parseLegacyVisionCellIndex = (nodeId: string): number | null => {
  const match = nodeId.match(LEGACY_BODY_INPUT_NODE_PATTERN);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
};

const deriveLegacyAgentIRVisionCellCount = (agent: AgentIR): number => {
  const canonicalVisionCellCount = normalizeVisionCellCount((agent.body as LegacyBodyIR).visionCellCount);
  if (canonicalVisionCellCount != null) {
    return canonicalVisionCellCount;
  }

  let maxCellIndex = -1;

  for (const connection of agent.connections) {
    if (connection.from.scope === 'bodyInput') {
      const cellIndex = resolveBodyInputVisionCellIndex(connection.from.nodeId, agent.body.inputRules);
      if (cellIndex != null) {
        maxCellIndex = Math.max(maxCellIndex, cellIndex);
      }
    }

    if (connection.to.scope === 'bodyInput') {
      const cellIndex = resolveBodyInputVisionCellIndex(connection.to.nodeId, agent.body.inputRules);
      if (cellIndex != null) {
        maxCellIndex = Math.max(maxCellIndex, cellIndex);
      }
    }
  }

  for (const nodeId of Object.keys(agent.layout?.nodes ?? {})) {
    const match = nodeId.match(VISION_LAYOUT_MARKER_PATTERN);
    if (!match) {
      continue;
    }
    maxCellIndex = Math.max(maxCellIndex, Number.parseInt(match[1], 10));
  }

  return maxCellIndex + 1;
};

export const createVisionCellLayoutMarkerId = (cellIndex: number): string => `__body-vision-cell-${cellIndex}`;

export const parseVisionCellLayoutMarkerIndex = (nodeId: string): number | null => {
  const match = nodeId.match(VISION_LAYOUT_MARKER_PATTERN);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
};

export const resolveBodyInputVisionCellIndex = (
  nodeId: string,
  rules: BodyInputRule[]
): number | null => {
  const legacyCellIndex = parseLegacyVisionCellIndex(nodeId);
  if (legacyCellIndex != null) {
    return legacyCellIndex;
  }

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
  const sourceMatch = source.match(BODY_INPUT_SOURCE_PATTERN);
  return sourceMatch ? Number.parseInt(sourceMatch[1], 10) : null;
};

export const deriveAgentIRVisionCellCount = (agent: AgentIR): number =>
  normalizeVisionCellCount((agent.body as LegacyBodyIR).visionCellCount) ?? deriveLegacyAgentIRVisionCellCount(agent);

export const withDerivedBodyVisionCellCount = (agent: AgentIR): AgentIR => {
  return {
    ...agent,
    body: {
      ...agent.body,
      visionCellCount: deriveLegacyAgentIRVisionCellCount(agent),
    },
  };
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
      visionCellCount: normalizedVisionCellCount,
    },
  };
};

/**
 * @deprecated Compatibility helper retained during migration. Canonical production
 * paths no longer write layout markers and only update BodyIR.visionCellCount.
 */
export const withVisionCellLayoutMarkers = (
  agent: AgentIR,
  visionCellCount: number
): AgentIR => withVisionCellCount(agent, visionCellCount);
