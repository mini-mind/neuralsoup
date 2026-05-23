import type { IzhikevichNeuronParameters, Position } from '../domain/brain/shared';
import type {
  AgentIR,
  AgentMetadata,
  BodyIR,
  BrainNeuronNode,
} from '../domain/brain/agent-ir';
import type { GraphIRDocument, NeuronNode, SignalNode, TopologyNode } from '../domain/brain/ir';
import type { LegacyBodyDefinition } from './legacyBrainPackage';

export const DEFAULT_NEURON_PARAMS: IzhikevichNeuronParameters = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
};

export const DEFAULT_ROOT_CONTAINER_ID = 'root-container';
export const DEFAULT_VISION_SCALE = 1;
export const DEFAULT_OUTPUT_DECAY_PER_SECOND = 4;
export const LEGACY_ROOT_GROUP_ID = 'core-neuron-group';
export const LEGACY_CORE_INPUT_ADAPTER_ID = 'core-input-adapter';
export const LEGACY_CORE_OUTPUT_ADAPTER_ID = 'core-output-adapter';

export const INPUT_CHANNEL_PATTERN = /^vision-([RGB])-(\d+)$/;
export const OUTPUT_CHANNEL_PATTERN = /^output-(turn-left|move-forward|turn-right)$/;
const BODY_INPUT_SOURCE_PATTERN = /^vision\.([RGB])\.(\d+)$/;
const BODY_OUTPUT_TARGET_PATTERN = /^action\.(turn-left|move-forward|turn-right)$/;
export const CORE_INPUT_NODE_PATTERN = /^core-input-([RGB])$/;
export const CORE_OUTPUT_NODE_PATTERN = /^core-output-(turn-left|move-forward|turn-right)$/;
export const SIGNAL_INPUT_PORT = 'in';
export const SIGNAL_OUTPUT_PORT = 'out';
export const NEURON_INPUT_PORT = 'dendrite';
export const NEURON_OUTPUT_PORT = 'axon';
export const LEGACY_INITIAL_STATE_V_KEY = '__agent_initialState_v';
export const LEGACY_INITIAL_STATE_U_KEY = '__agent_initialState_u';

export const clonePosition = (position?: Position): Position | undefined =>
  position ? { ...position } : undefined;

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const applyRuleTemplate = (template: string, match: RegExpExecArray): string =>
  template.replace(/\$(\d+)/g, (_token, rawGroupIndex: string) => {
    const groupIndex = Number.parseInt(rawGroupIndex, 10);
    return match[groupIndex] ?? '';
  });

const findBodyInputRuleMatch = (
  agent: AgentIR,
  nodeId: string
): Array<{ rule: BodyIR['inputRules'][number]; match: RegExpExecArray }> =>
  agent.body.inputRules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

const findBodyOutputRuleMatch = (
  agent: AgentIR,
  nodeId: string
): Array<{ rule: BodyIR['outputRules'][number]; match: RegExpExecArray }> =>
  agent.body.outputRules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

export const resolveLegacyInputSignalNodeId = (agent: AgentIR, nodeId: string): string | null => {
  if (INPUT_CHANNEL_PATTERN.test(nodeId)) {
    return nodeId;
  }

  const matches = findBodyInputRuleMatch(agent, nodeId);
  if (matches.length !== 1) {
    return null;
  }

  const source = applyRuleTemplate(matches[0].rule.sourceTemplate, matches[0].match);
  const parsed = source.match(BODY_INPUT_SOURCE_PATTERN);
  return parsed ? `vision-${parsed[1]}-${parsed[2]}` : null;
};

export const resolveBodyInputScale = (agent: AgentIR, nodeId: string): number | null => {
  const matches = findBodyInputRuleMatch(agent, nodeId);
  return matches.length === 1 ? matches[0].rule.scale : null;
};

export const resolveLegacyOutputSignalNodeId = (agent: AgentIR, nodeId: string): string | null => {
  if (OUTPUT_CHANNEL_PATTERN.test(nodeId)) {
    return nodeId;
  }

  const matches = findBodyOutputRuleMatch(agent, nodeId);
  if (matches.length !== 1) {
    return null;
  }

  const target = applyRuleTemplate(matches[0].rule.targetTemplate, matches[0].match);
  const parsed = target.match(BODY_OUTPUT_TARGET_PATTERN);
  return parsed ? `output-${parsed[1]}` : null;
};

export const resolveBodyOutputDecay = (agent: AgentIR, nodeId: string): number | null => {
  const matches = findBodyOutputRuleMatch(agent, nodeId);
  return matches.length === 1 ? matches[0].rule.decayPerSecond : null;
};

export const createAgentMetadata = (
  name: string,
  overrides?: Partial<AgentMetadata>
): AgentMetadata => {
  const timestamp = overrides?.updatedAt ?? new Date().toISOString();
  return {
    id: overrides?.id ?? `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim() || '未命名 Agent',
    description: overrides?.description,
    tags: overrides?.tags ? [...overrides.tags] : undefined,
    createdAt: overrides?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
};

export const getNeuronParams = (node: NeuronNode): IzhikevichNeuronParameters => {
  const overrides = node.parameterOverrides ?? {};
  const toFiniteNumber = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  return {
    a: toFiniteNumber(overrides.a, DEFAULT_NEURON_PARAMS.a),
    b: toFiniteNumber(overrides.b, DEFAULT_NEURON_PARAMS.b),
    c: toFiniteNumber(overrides.c, DEFAULT_NEURON_PARAMS.c),
    d: toFiniteNumber(overrides.d, DEFAULT_NEURON_PARAMS.d),
    threshold: toFiniteNumber(overrides.threshold, DEFAULT_NEURON_PARAMS.threshold),
  };
};

export const getNeuronInitialState = (
  node: NeuronNode,
  params: IzhikevichNeuronParameters
): BrainNeuronNode['initialState'] => {
  const overrides = node.parameterOverrides ?? {};
  const v = typeof overrides[LEGACY_INITIAL_STATE_V_KEY] === 'number' ? overrides[LEGACY_INITIAL_STATE_V_KEY] : params.c;
  const u = typeof overrides[LEGACY_INITIAL_STATE_U_KEY] === 'number' ? overrides[LEGACY_INITIAL_STATE_U_KEY] : undefined;

  return {
    v,
    u,
  };
};

export const collectSignalNodes = (nodes: TopologyNode[]): SignalNode[] => {
  const signals: SignalNode[] = [];

  const visit = (node: TopologyNode) => {
    if (node.kind === 'signal') {
      signals.push(node);
      return;
    }

    if ('children' in node) {
      node.children.forEach(visit);
    }
  };

  nodes.forEach(visit);
  return signals;
};

export const collectNeuronNodes = (nodes: TopologyNode[]): NeuronNode[] => {
  const neurons: NeuronNode[] = [];

  const visit = (node: TopologyNode) => {
    if (node.kind === 'neuron') {
      neurons.push(node);
      return;
    }

    if ('children' in node) {
      node.children.forEach(visit);
    }
  };

  nodes.forEach(visit);
  return neurons;
};

export const buildBodyIRFromLegacy = (document: GraphIRDocument): BodyIR => {
  const signals = collectSignalNodes(document.root.children);
  const hasVisionSignals = signals.some((signal) => INPUT_CHANNEL_PATTERN.test(signal.id));
  const hasMotorSignals = signals.some((signal) => OUTPUT_CHANNEL_PATTERN.test(signal.id));

  return {
    version: 1,
    inputRules: hasVisionSignals
      ? [
          {
            id: 'legacy-vision-inputs',
            nodeIdPattern: '^vision-([RGB])-(\\d+)$',
            sourceTemplate: 'vision.$1.$2',
            scale: DEFAULT_VISION_SCALE,
          },
        ]
      : [],
    outputRules: hasMotorSignals
      ? [
          {
            id: 'legacy-motor-outputs',
            nodeIdPattern: '^output-(turn-left|move-forward|turn-right)$',
            targetTemplate: 'action.$1',
            decayPerSecond: DEFAULT_OUTPUT_DECAY_PER_SECOND,
          },
        ]
      : [],
  };
};

export const buildBodyIRFromCompatBody = (body: LegacyBodyDefinition): BodyIR => {
  const inputSignalsById = new Map(body.inputSignals.map((signal) => [signal.id, signal]));
  const outputSignalsById = new Map(body.outputSignals.map((signal) => [signal.id, signal]));

  return {
    version: 1,
    inputRules: body.brainBindings.inputs.flatMap((binding) => {
      const signal = inputSignalsById.get(binding.bodySignalId);
      if (!signal) {
        return [];
      }

      return [
        {
          id: `compat-input:${binding.brainSignalNodeId}`,
          nodeIdPattern: `^${escapeRegex(binding.brainSignalNodeId)}$`,
          sourceTemplate: `vision.${signal.source.channel}.${signal.source.cellIndex}`,
          scale: signal.scale ?? DEFAULT_VISION_SCALE,
        },
      ];
    }),
    outputRules: body.brainBindings.outputs.flatMap((binding) => {
      const signal = outputSignalsById.get(binding.bodySignalId);
      if (!signal) {
        return [];
      }

      return [
        {
          id: `compat-output:${binding.brainSignalNodeId}`,
          nodeIdPattern: `^${escapeRegex(binding.brainSignalNodeId)}$`,
          targetTemplate: `action.${signal.target.channel}`,
          decayPerSecond: signal.decayPerSecond ?? DEFAULT_OUTPUT_DECAY_PER_SECOND,
        },
      ];
    }),
  };
};
