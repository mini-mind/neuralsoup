import type { IzhikevichNeuronParameters, Position } from './shared';
import type {
  AgentConnection,
  AgentIR,
  AgentLayoutIR,
  AgentMetadata,
  BodyIR,
  BrainContainerNode,
  BrainIR,
  BrainNeuronNode,
} from './agent-ir';
import {
  deriveAgentIRVisionCellCount,
  withDerivedBodyVisionCellCount,
  withVisionCellLayoutMarkers,
} from './agent-ir';
import type {
  GraphIRDocument,
  LeafLink,
  NeuronGroupNode,
  NeuronNode,
  SignalNode,
  TopologyNode,
} from './ir';
import {
  createLegacyBrainLayoutFromDefinition,
  createDefaultLegacyBodyDefinition,
  getLegacyBodyVisionCellCount,
  type LegacyBodyDefinition,
  type BrainLayoutDocument,
} from './package';
import { createDefaultGraphIRDocument } from './defaults';

const DEFAULT_NEURON_PARAMS: IzhikevichNeuronParameters = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
};

const DEFAULT_ROOT_CONTAINER_ID = 'root-container';
const DEFAULT_VISION_SCALE = 1;
const DEFAULT_OUTPUT_DECAY_PER_SECOND = 4;
const LEGACY_ROOT_GROUP_ID = 'core-neuron-group';
const LEGACY_CORE_INPUT_ADAPTER_ID = 'core-input-adapter';
const LEGACY_CORE_OUTPUT_ADAPTER_ID = 'core-output-adapter';

const INPUT_CHANNEL_PATTERN = /^vision-([RGB])-(\d+)$/;
const OUTPUT_CHANNEL_PATTERN = /^output-(turn-left|move-forward|turn-right)$/;
const BODY_INPUT_SOURCE_PATTERN = /^vision\.([RGB])\.(\d+)$/;
const BODY_OUTPUT_TARGET_PATTERN = /^action\.(turn-left|move-forward|turn-right)$/;
const CORE_INPUT_NODE_PATTERN = /^core-input-([RGB])$/;
const CORE_OUTPUT_NODE_PATTERN = /^core-output-(turn-left|move-forward|turn-right)$/;
const SIGNAL_INPUT_PORT = 'in';
const SIGNAL_OUTPUT_PORT = 'out';
const NEURON_INPUT_PORT = 'dendrite';
const NEURON_OUTPUT_PORT = 'axon';
const LEGACY_INITIAL_STATE_V_KEY = '__agent_initialState_v';
const LEGACY_INITIAL_STATE_U_KEY = '__agent_initialState_u';

const clonePosition = (position?: Position): Position | undefined =>
  position ? { ...position } : undefined;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const applyRuleTemplate = (template: string, match: RegExpExecArray): string =>
  template.replace(/\$(\d+)/g, (_token, rawGroupIndex: string) => {
    const groupIndex = Number.parseInt(rawGroupIndex, 10);
    return match[groupIndex] ?? '';
  });

const resolveLegacyInputSignalNodeId = (agent: AgentIR, nodeId: string): string | null => {
  if (INPUT_CHANNEL_PATTERN.test(nodeId)) {
    return nodeId;
  }

  const matches = agent.body.inputRules.flatMap((rule) => {
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
  const parsed = source.match(BODY_INPUT_SOURCE_PATTERN);
  return parsed ? `vision-${parsed[1]}-${parsed[2]}` : null;
};

const resolveBodyInputScale = (agent: AgentIR, nodeId: string): number | null => {
  const matches = agent.body.inputRules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

  return matches.length === 1 ? matches[0].rule.scale : null;
};

const resolveLegacyOutputSignalNodeId = (agent: AgentIR, nodeId: string): string | null => {
  if (OUTPUT_CHANNEL_PATTERN.test(nodeId)) {
    return nodeId;
  }

  const matches = agent.body.outputRules.flatMap((rule) => {
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

  const target = applyRuleTemplate(matches[0].rule.targetTemplate, matches[0].match);
  const parsed = target.match(BODY_OUTPUT_TARGET_PATTERN);
  return parsed ? `output-${parsed[1]}` : null;
};

const resolveBodyOutputDecay = (agent: AgentIR, nodeId: string): number | null => {
  const matches = agent.body.outputRules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

  return matches.length === 1 ? matches[0].rule.decayPerSecond : null;
};

const createAgentMetadata = (
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

const getNeuronParams = (node: NeuronNode): IzhikevichNeuronParameters => {
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

const getNeuronInitialState = (node: NeuronNode, params: IzhikevichNeuronParameters): BrainNeuronNode['initialState'] => {
  const overrides = node.parameterOverrides ?? {};
  const v = typeof overrides[LEGACY_INITIAL_STATE_V_KEY] === 'number' ? overrides[LEGACY_INITIAL_STATE_V_KEY] : params.c;
  const u = typeof overrides[LEGACY_INITIAL_STATE_U_KEY] === 'number' ? overrides[LEGACY_INITIAL_STATE_U_KEY] : undefined;

  return {
    v,
    u,
  };
};

const collectSignalNodes = (nodes: TopologyNode[]): SignalNode[] => {
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

const collectNeuronNodes = (nodes: TopologyNode[]): NeuronNode[] => {
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

const buildBodyIRFromLegacy = (document: GraphIRDocument): BodyIR => {
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

const buildBodyIRFromCompatBody = (body: LegacyBodyDefinition): BodyIR => {
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

const deriveLegacyDocumentVisionCellCount = (document: GraphIRDocument): number =>
  Math.max(
    0,
    ...collectSignalNodes(document.root.children)
      .filter((signal) => INPUT_CHANNEL_PATTERN.test(signal.id))
      .map((signal) => Number.parseInt(signal.id.match(INPUT_CHANNEL_PATTERN)?.[2] ?? '-1', 10) + 1)
  );

const buildBrainNeuronsFromLegacy = (document: GraphIRDocument): BrainNeuronNode[] =>
  collectNeuronNodes(document.root.children).map((node) => {
    const params = getNeuronParams(node);
    return {
      id: node.id,
      label: node.label,
      model: 'izhikevich',
      params,
      initialState: getNeuronInitialState(node, params),
    };
  });

const buildContainerChildren = (nodes: TopologyNode[]): BrainContainerNode['children'] => {
  const children: BrainContainerNode['children'] = [];

  for (const node of nodes) {
    if (node.kind === 'neuron') {
      children.push({ scope: 'brain', nodeId: node.id });
      continue;
    }

    if (node.kind === 'neuron-group') {
      children.push({ scope: 'container', nodeId: node.id });
    }
  }

  return children;
};

const buildContainersFromLegacy = (
  document: GraphIRDocument
): { containers: BrainContainerNode[]; rootContainerId: string } => {
  const visit = (group: NeuronGroupNode, containers: BrainContainerNode[]) => {
    containers.push({
      id: group.id,
      label: group.label,
      children: buildContainerChildren(group.children),
    });

    for (const child of group.children) {
      if (child.kind === 'neuron-group') {
        visit(child, containers);
      }
    }
  };

  const topLevelGroups = document.root.children.filter(
    (node): node is NeuronGroupNode => node.kind === 'neuron-group'
  );
  const legacyRootGroup =
    topLevelGroups.length === 1
      ? topLevelGroups[0]
      : topLevelGroups.find((node) => node.id === LEGACY_ROOT_GROUP_ID);
  if (legacyRootGroup) {
    const containers: BrainContainerNode[] = [
      {
        id: legacyRootGroup.id,
        label: legacyRootGroup.label,
        children: buildContainerChildren(legacyRootGroup.children),
      },
    ];

    for (const child of legacyRootGroup.children) {
      if (child.kind === 'neuron-group') {
        visit(child, containers);
      }
    }

    return {
      containers,
      rootContainerId: legacyRootGroup.id,
    };
  }

  const containers: BrainContainerNode[] = [
    {
      id: DEFAULT_ROOT_CONTAINER_ID,
      label: 'root',
      children: buildContainerChildren(document.root.children),
    },
  ];

  for (const child of document.root.children) {
    if (child.kind === 'neuron-group') {
      visit(child, containers);
    }
  }

  return {
    containers,
    rootContainerId: DEFAULT_ROOT_CONTAINER_ID,
  };
};

interface LegacyAgentConnectionBuildResult {
  connections: AgentConnection[];
  droppedLinkIds: string[];
}

const buildAgentConnectionsFromLegacy = (document: GraphIRDocument): LegacyAgentConnectionBuildResult => {
  const outgoingLinksByNodeId = new Map<string, LeafLink[]>();
  const consumedLinkIds = new Set<string>();

  for (const link of document.root.links) {
    const existingLinks = outgoingLinksByNodeId.get(link.from.nodeId);
    if (existingLinks) {
      existingLinks.push(link);
      continue;
    }

    outgoingLinksByNodeId.set(link.from.nodeId, [link]);
  }

  const connections: AgentConnection[] = [];

  for (const link of document.root.links) {
    const fromNodeId = link.from.nodeId;
    const toNodeId = link.to.nodeId;

    if (OUTPUT_CHANNEL_PATTERN.test(fromNodeId) || INPUT_CHANNEL_PATTERN.test(toNodeId)) {
      continue;
    }

    if (INPUT_CHANNEL_PATTERN.test(fromNodeId) && CORE_INPUT_NODE_PATTERN.test(toNodeId)) {
      const bridgedLinks = outgoingLinksByNodeId.get(toNodeId) ?? [];
      for (const bridgedLink of bridgedLinks) {
        if (INPUT_CHANNEL_PATTERN.test(bridgedLink.to.nodeId) || OUTPUT_CHANNEL_PATTERN.test(bridgedLink.from.nodeId)) {
          continue;
        }

        connections.push({
          id: `${link.id}__${bridgedLink.id}`,
          from: {
            scope: 'bodyInput',
            nodeId: fromNodeId,
            portId: link.from.portId,
          },
          to: {
            scope: 'brain',
            nodeId: bridgedLink.to.nodeId,
            portId: bridgedLink.to.portId,
          },
          weight: link.weight * bridgedLink.weight,
          delayMs: (link.delayMs ?? 0) + (bridgedLink.delayMs ?? 0),
        });
        consumedLinkIds.add(link.id);
        consumedLinkIds.add(bridgedLink.id);
      }
      continue;
    }

    if (CORE_OUTPUT_NODE_PATTERN.test(toNodeId) && !CORE_OUTPUT_NODE_PATTERN.test(fromNodeId)) {
      const bridgedLinks = outgoingLinksByNodeId.get(toNodeId) ?? [];
      for (const bridgedLink of bridgedLinks) {
        if (!OUTPUT_CHANNEL_PATTERN.test(bridgedLink.to.nodeId)) {
          continue;
        }

        connections.push({
          id: `${link.id}__${bridgedLink.id}`,
          from: {
            scope: INPUT_CHANNEL_PATTERN.test(fromNodeId) ? 'bodyInput' : 'brain',
            nodeId: fromNodeId,
            portId: link.from.portId,
          },
          to: {
            scope: 'bodyOutput',
            nodeId: bridgedLink.to.nodeId,
            portId: bridgedLink.to.portId,
          },
          weight: link.weight * bridgedLink.weight,
          delayMs: (link.delayMs ?? 0) + (bridgedLink.delayMs ?? 0),
        });
        consumedLinkIds.add(link.id);
        consumedLinkIds.add(bridgedLink.id);
      }
      continue;
    }

    if (CORE_INPUT_NODE_PATTERN.test(fromNodeId) || CORE_INPUT_NODE_PATTERN.test(toNodeId)) {
      continue;
    }

    if (CORE_OUTPUT_NODE_PATTERN.test(fromNodeId) || CORE_OUTPUT_NODE_PATTERN.test(toNodeId)) {
      continue;
    }

    const fromScope = INPUT_CHANNEL_PATTERN.test(fromNodeId)
      ? 'bodyInput'
      : OUTPUT_CHANNEL_PATTERN.test(fromNodeId)
        ? 'bodyOutput'
        : 'brain';
    const toScope = INPUT_CHANNEL_PATTERN.test(toNodeId)
      ? 'bodyInput'
      : OUTPUT_CHANNEL_PATTERN.test(toNodeId)
        ? 'bodyOutput'
        : 'brain';

    if (fromScope === 'bodyOutput' || toScope === 'bodyInput') {
      continue;
    }

    connections.push({
      id: link.id,
      from: {
        scope: fromScope,
        nodeId: fromNodeId,
        portId: link.from.portId,
      },
      to: {
        scope: toScope,
        nodeId: toNodeId,
        portId: link.to.portId,
      },
      weight: link.weight,
      delayMs: link.delayMs,
    });
    consumedLinkIds.add(link.id);
  }

  return {
    connections,
    droppedLinkIds: document.root.links
      .map((link) => link.id)
      .filter((linkId) => !consumedLinkIds.has(linkId)),
  };
};

interface CompatBodyBindingMaps {
  inputNodeIdToBodySignalId: Map<string, string>;
  outputNodeIdToBodySignalId: Map<string, string>;
  bodyInputSignalById: Map<string, LegacyBodyDefinition['inputSignals'][number]>;
  bodyOutputSignalById: Map<string, LegacyBodyDefinition['outputSignals'][number]>;
}

const buildCompatBodyBindingMaps = (body: LegacyBodyDefinition): CompatBodyBindingMaps => ({
  inputNodeIdToBodySignalId: new Map(
    body.brainBindings.inputs.map((binding) => [binding.brainSignalNodeId, binding.bodySignalId])
  ),
  outputNodeIdToBodySignalId: new Map(
    body.brainBindings.outputs.map((binding) => [binding.brainSignalNodeId, binding.bodySignalId])
  ),
  bodyInputSignalById: new Map(body.inputSignals.map((signal) => [signal.id, signal])),
  bodyOutputSignalById: new Map(body.outputSignals.map((signal) => [signal.id, signal])),
});

const buildAgentConnectionsFromCompatBody = (
  document: GraphIRDocument,
  body: LegacyBodyDefinition
): LegacyAgentConnectionBuildResult => {
  const outgoingLinksByNodeId = new Map<string, LeafLink[]>();
  const consumedLinkIds = new Set<string>();
  for (const link of document.root.links) {
    const existingLinks = outgoingLinksByNodeId.get(link.from.nodeId);
    if (existingLinks) {
      existingLinks.push(link);
      continue;
    }
    outgoingLinksByNodeId.set(link.from.nodeId, [link]);
  }

  const { inputNodeIdToBodySignalId, outputNodeIdToBodySignalId } =
    buildCompatBodyBindingMaps(body);
  const connections: AgentConnection[] = [];

  for (const link of document.root.links) {
    const fromNodeId = link.from.nodeId;
    const toNodeId = link.to.nodeId;
    const directInputSignalId = inputNodeIdToBodySignalId.get(fromNodeId);
    const directOutputSignalId = outputNodeIdToBodySignalId.get(toNodeId);

    if (directInputSignalId && CORE_INPUT_NODE_PATTERN.test(toNodeId)) {
      const bridgedLinks = outgoingLinksByNodeId.get(toNodeId) ?? [];
      for (const bridgedLink of bridgedLinks) {
        if (outputNodeIdToBodySignalId.has(bridgedLink.from.nodeId) || inputNodeIdToBodySignalId.has(bridgedLink.to.nodeId)) {
          continue;
        }

        connections.push({
          id: `${link.id}__${bridgedLink.id}`,
          from: {
            scope: 'bodyInput',
            nodeId: fromNodeId,
            portId: link.from.portId,
          },
          to: {
            scope: 'brain',
            nodeId: bridgedLink.to.nodeId,
            portId: bridgedLink.to.portId,
          },
          weight: link.weight * bridgedLink.weight,
          delayMs: (link.delayMs ?? 0) + (bridgedLink.delayMs ?? 0),
        });
        consumedLinkIds.add(link.id);
        consumedLinkIds.add(bridgedLink.id);
      }
      continue;
    }

    if (CORE_OUTPUT_NODE_PATTERN.test(toNodeId) && !CORE_OUTPUT_NODE_PATTERN.test(fromNodeId)) {
      const bridgedLinks = outgoingLinksByNodeId.get(toNodeId) ?? [];
      for (const bridgedLink of bridgedLinks) {
        const bodySignalId = outputNodeIdToBodySignalId.get(bridgedLink.to.nodeId);
        if (!bodySignalId) {
          continue;
        }

        connections.push({
          id: `${link.id}__${bridgedLink.id}`,
          from: {
            scope: directInputSignalId ? 'bodyInput' : 'brain',
            nodeId: fromNodeId,
            portId: link.from.portId,
          },
          to: {
            scope: 'bodyOutput',
            nodeId: bridgedLink.to.nodeId,
            portId: bridgedLink.to.portId,
          },
          weight: link.weight * bridgedLink.weight,
          delayMs: (link.delayMs ?? 0) + (bridgedLink.delayMs ?? 0),
        });
        consumedLinkIds.add(link.id);
        consumedLinkIds.add(bridgedLink.id);
      }
      continue;
    }

    if (CORE_INPUT_NODE_PATTERN.test(fromNodeId) || CORE_INPUT_NODE_PATTERN.test(toNodeId)) {
      continue;
    }

    if (CORE_OUTPUT_NODE_PATTERN.test(fromNodeId) || CORE_OUTPUT_NODE_PATTERN.test(toNodeId)) {
      continue;
    }

    const fromScope = directInputSignalId
      ? 'bodyInput'
      : outputNodeIdToBodySignalId.has(fromNodeId)
        ? 'bodyOutput'
        : 'brain';
    const toScope = inputNodeIdToBodySignalId.has(toNodeId)
      ? 'bodyInput'
      : directOutputSignalId
        ? 'bodyOutput'
        : 'brain';

    if (fromScope === 'bodyOutput' || toScope === 'bodyInput') {
      continue;
    }

    connections.push({
      id: link.id,
      from: {
        scope: fromScope,
        nodeId: fromNodeId,
        portId: link.from.portId,
      },
      to: {
        scope: toScope,
        nodeId: toNodeId,
        portId: link.to.portId,
      },
      weight: link.weight,
      delayMs: link.delayMs,
    });
    consumedLinkIds.add(link.id);
  }

  return {
    connections,
    droppedLinkIds: document.root.links
      .map((link) => link.id)
      .filter((linkId) => !consumedLinkIds.has(linkId)),
  };
};

const buildAgentLayoutFromLegacy = (
  document: GraphIRDocument,
  layout?: BrainLayoutDocument
): AgentLayoutIR => {
  const graphLayout = layout ?? createLegacyBrainLayoutFromDefinition(document);
  const nodes: AgentLayoutIR['nodes'] = {};

  for (const [nodeId, state] of Object.entries(graphLayout.nodes)) {
    nodes[nodeId] = {
      position: clonePosition(state.position),
      size: state.size ? { ...state.size } : undefined,
      collapsed: state.collapsed,
      expanded: state.collapsed === false ? true : undefined,
    };
  }

  return {
    version: 1,
    nodes,
    viewportByContainerId: graphLayout.viewportByContainerId
      ? Object.fromEntries(
          Object.entries(graphLayout.viewportByContainerId).map(([containerId, viewport]) => [
            containerId,
            { ...viewport },
          ])
        )
      : undefined,
  };
};

export const createAgentIRFromLegacyGraph = (
  name: string,
  document: GraphIRDocument,
  body?: LegacyBodyDefinition,
  layout?: BrainLayoutDocument,
  metadataOverrides?: Partial<AgentMetadata>
): AgentIR => {
  return createAgentIRFromLegacyGraphDetailed(name, document, body, layout, metadataOverrides).agent;
};

export interface LegacyToAgentIRBridgeResult {
  agent: AgentIR;
  droppedLinkIds: string[];
}

export const createAgentIRFromLegacyGraphDetailed = (
  name: string,
  document: GraphIRDocument,
  body?: LegacyBodyDefinition,
  layout?: BrainLayoutDocument,
  metadataOverrides?: Partial<AgentMetadata>
): LegacyToAgentIRBridgeResult => {
  const resolvedBody = body ?? createDefaultLegacyBodyDefinition(1);
  const metadata = createAgentMetadata(name, metadataOverrides);
  const agentBody = body ? buildBodyIRFromCompatBody(resolvedBody) : buildBodyIRFromLegacy(document);
  const { containers, rootContainerId } = buildContainersFromLegacy(document);
  const brain: BrainIR = {
    version: 1,
    neurons: buildBrainNeuronsFromLegacy(document),
    containers,
    rootContainerId,
  };
  const connectionBuildResult = body
    ? buildAgentConnectionsFromCompatBody(document, resolvedBody)
    : buildAgentConnectionsFromLegacy(document);

  return {
    agent: withDerivedBodyVisionCellCount(
      withVisionCellLayoutMarkers(
        {
          version: 1,
          metadata,
          body: agentBody,
          brain,
          connections: connectionBuildResult.connections,
          layout: buildAgentLayoutFromLegacy(document, layout),
        },
        Math.max(1, body ? getLegacyBodyVisionCellCount(resolvedBody) : deriveLegacyDocumentVisionCellCount(document))
      )
    ),
    droppedLinkIds: connectionBuildResult.droppedLinkIds,
  };
};

const createNeuronNodeFromAgent = (neuron: BrainNeuronNode, position?: Position): NeuronNode => ({
  kind: 'neuron',
  id: neuron.id,
  label: neuron.label,
  modelId: 'izhikevich-neuron',
  position,
  parameterOverrides: {
    a: neuron.params.a,
    b: neuron.params.b,
    c: neuron.params.c,
    d: neuron.params.d,
    threshold: neuron.params.threshold,
    [LEGACY_INITIAL_STATE_V_KEY]: neuron.initialState.v,
    ...(neuron.initialState.u !== undefined ? { [LEGACY_INITIAL_STATE_U_KEY]: neuron.initialState.u } : {}),
  },
});

const createContainerNodeFromAgent = (
  container: BrainContainerNode,
  agent: AgentIR,
  position?: Position
): NeuronGroupNode => {
  const children: TopologyNode[] = [];

  for (const childRef of container.children) {
    if (childRef.scope === 'brain') {
      const neuron = agent.brain.neurons.find((entry) => entry.id === childRef.nodeId);
      if (neuron) {
        children.push(createNeuronNodeFromAgent(neuron, agent.layout?.nodes[neuron.id]?.position));
      }
      continue;
    }

    const childContainer = agent.brain.containers.find((entry) => entry.id === childRef.nodeId);
    if (childContainer) {
      children.push(
        createContainerNodeFromAgent(childContainer, agent, agent.layout?.nodes[childContainer.id]?.position)
      );
    }
  }

  return {
    kind: 'neuron-group',
    id: container.id,
    label: container.label ?? container.id,
    position,
    collapsed:
      agent.layout?.nodes[container.id]?.collapsed ??
      (agent.layout?.nodes[container.id]?.expanded === true ? false : undefined),
    children,
  };
};

export interface LegacyGraphBridgeResult {
  document: GraphIRDocument;
  body: LegacyBodyDefinition;
  layout: BrainLayoutDocument;
  droppedConnectionIds: string[];
  documentOnlyLosses: string[];
}

const buildCompatBodyFromAgent = (agent: AgentIR, visionCells: number): LegacyBodyDefinition => {
  const nextBody = createDefaultLegacyBodyDefinition(visionCells);
  const inputSignalsById = new Map(nextBody.inputSignals.map((signal) => [signal.id, signal]));
  const outputSignalsById = new Map(nextBody.outputSignals.map((signal) => [signal.id, signal]));

  for (const connection of agent.connections) {
    if (connection.from.scope !== 'bodyInput') {
      continue;
    }
    const legacyNodeId = resolveLegacyInputSignalNodeId(agent, connection.from.nodeId);
    const scale = resolveBodyInputScale(agent, connection.from.nodeId);
    const match = legacyNodeId?.match(INPUT_CHANNEL_PATTERN);
    if (!match || scale == null) {
      continue;
    }
    const signal = inputSignalsById.get(`vision-${match[1].toLowerCase()}-${match[2]}`);
    if (signal) {
      signal.scale = scale;
    }
  }

  for (const connection of agent.connections) {
    if (connection.to.scope !== 'bodyOutput') {
      continue;
    }
    const legacyNodeId = resolveLegacyOutputSignalNodeId(agent, connection.to.nodeId);
    const decayPerSecond = resolveBodyOutputDecay(agent, connection.to.nodeId);
    const match = legacyNodeId?.match(OUTPUT_CHANNEL_PATTERN);
    if (!match || decayPerSecond == null) {
      continue;
    }
    const signal = outputSignalsById.get(`motor-${match[1]}`);
    if (signal) {
      signal.decayPerSecond = decayPerSecond;
    }
  }

  return nextBody;
};

const resolveBodyInputSemantic = (body: BodyIR, nodeId: string): string => {
  const matches = body.inputRules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

  if (matches.length !== 1) {
    return matches.length === 0 ? 'unmatched' : 'ambiguous';
  }

  return `source:${applyRuleTemplate(matches[0].rule.sourceTemplate, matches[0].match)}|scale:${matches[0].rule.scale}`;
};

const resolveBodyOutputSemantic = (body: BodyIR, nodeId: string): string => {
  const matches = body.outputRules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

  if (matches.length !== 1) {
    return matches.length === 0 ? 'unmatched' : 'ambiguous';
  }

  return `target:${applyRuleTemplate(matches[0].rule.targetTemplate, matches[0].match)}|decay:${matches[0].rule.decayPerSecond}`;
};

const compareCompatBodySemantics = (
  agent: AgentIR,
  compatBody: LegacyBodyDefinition
): string[] => {
  const losses: string[] = [];
  const rebuiltBody = buildBodyIRFromCompatBody(compatBody);
  const visionCellCount = deriveAgentIRVisionCellCount(agent);

  if (getLegacyBodyVisionCellCount(compatBody) !== visionCellCount) {
    losses.push(
      `Legacy GraphIR compat getter cannot preserve BodyIR vision cell coverage (${visionCellCount} -> ${getLegacyBodyVisionCellCount(
        compatBody
      )}).`
    );
  }

  const inputCandidates = new Set<string>([
    ...Array.from({ length: visionCellCount }, (_, cellIndex) =>
      ['R', 'G', 'B'].map((channel) => `vision-${channel}-${cellIndex}`)
    ).flat(),
    ...agent.connections.flatMap((connection) => {
      const endpoints: string[] = [];
      if (connection.from.scope === 'bodyInput') {
        endpoints.push(connection.from.nodeId);
      }
      if (connection.to.scope === 'bodyInput') {
        endpoints.push(connection.to.nodeId);
      }
      return endpoints;
    }),
  ]);
  const outputCandidates = new Set<string>([
    'output-turn-left',
    'output-move-forward',
    'output-turn-right',
    ...agent.connections.flatMap((connection) => {
      const endpoints: string[] = [];
      if (connection.from.scope === 'bodyOutput') {
        endpoints.push(connection.from.nodeId);
      }
      if (connection.to.scope === 'bodyOutput') {
        endpoints.push(connection.to.nodeId);
      }
      return endpoints;
    }),
  ]);

  const inputMismatches = [...inputCandidates].filter(
    (nodeId) => resolveBodyInputSemantic(agent.body, nodeId) !== resolveBodyInputSemantic(rebuiltBody, nodeId)
  );
  if (inputMismatches.length > 0) {
    losses.push(
      `Legacy GraphIR compat getter cannot preserve full BodyIR input rule semantics for: ${inputMismatches.join(', ')}.`
    );
  }

  const outputMismatches = [...outputCandidates].filter(
    (nodeId) => resolveBodyOutputSemantic(agent.body, nodeId) !== resolveBodyOutputSemantic(rebuiltBody, nodeId)
  );
  if (outputMismatches.length > 0) {
    losses.push(
      `Legacy GraphIR compat getter cannot preserve full BodyIR output rule semantics for: ${outputMismatches.join(', ')}.`
    );
  }

  return losses;
};

export const createLegacyGraphBridgeFromAgent = (agent: AgentIR): LegacyGraphBridgeResult => {
  const visionCellIds = new Set<number>();
  for (const connection of agent.connections) {
    if (connection.from.scope !== 'bodyInput') {
      continue;
    }
    const legacyInputNodeId = resolveLegacyInputSignalNodeId(agent, connection.from.nodeId);
    const match = legacyInputNodeId?.match(INPUT_CHANNEL_PATTERN);
    if (!match) {
      continue;
    }
    visionCellIds.add(Number.parseInt(match[2], 10));
  }

  const visionCells = Math.max(
    deriveAgentIRVisionCellCount(agent),
    visionCellIds.size > 0 ? Math.max(...visionCellIds) + 1 : 0,
    1
  );
  const nextDocument = createDefaultGraphIRDocument(visionCells);
  const nextBody = buildCompatBodyFromAgent(agent, visionCells);
  const documentOnlyLosses = compareCompatBodySemantics(agent, nextBody);
  const defaultRootGroup = nextDocument.root.children.find(
    (node): node is NeuronGroupNode => node.kind === 'neuron-group' && node.id === LEGACY_ROOT_GROUP_ID
  );
  const defaultCoreInputAdapter = defaultRootGroup?.children.find(
    (node): node is Extract<TopologyNode, { kind: 'adapter' }> => node.kind === 'adapter' && node.id === LEGACY_CORE_INPUT_ADAPTER_ID
  );
  const defaultCoreOutputAdapter = defaultRootGroup?.children.find(
    (node): node is Extract<TopologyNode, { kind: 'adapter' }> => node.kind === 'adapter' && node.id === LEGACY_CORE_OUTPUT_ADAPTER_ID
  );

  const rootChildren: TopologyNode[] = nextDocument.root.children.map((node: TopologyNode) => {
    if (node.kind === 'neuron-group' && node.id === LEGACY_ROOT_GROUP_ID) {
      const rootContainer = agent.brain.containers.find((entry) => entry.id === agent.brain.rootContainerId);
      if (!rootContainer) {
        return node;
      }

      return {
        ...node,
        id: rootContainer.id,
        label: rootContainer.label ?? rootContainer.id,
        position: agent.layout?.nodes[rootContainer.id]?.position ?? node.position,
        collapsed: agent.layout?.nodes[rootContainer.id]?.collapsed ?? node.collapsed,
        children: [
          ...(defaultCoreInputAdapter ? [{ ...defaultCoreInputAdapter }] : []),
          ...rootContainer.children.flatMap<TopologyNode>((childRef) => {
            if (childRef.scope === 'brain') {
              const neuron = agent.brain.neurons.find((entry) => entry.id === childRef.nodeId);
              if (!neuron) {
                return [];
              }
              return [createNeuronNodeFromAgent(neuron, agent.layout?.nodes[neuron.id]?.position)];
            }

            const container = agent.brain.containers.find((entry) => entry.id === childRef.nodeId);
            if (!container) {
              return [];
            }
            return [createContainerNodeFromAgent(container, agent, agent.layout?.nodes[container.id]?.position)];
          }),
          ...(defaultCoreOutputAdapter ? [{ ...defaultCoreOutputAdapter }] : []),
        ],
      };
    }

    return {
      ...node,
      position: agent.layout?.nodes[node.id]?.position ?? node.position,
      collapsed:
        'collapsed' in node
          ? agent.layout?.nodes[node.id]?.collapsed ??
            (agent.layout?.nodes[node.id]?.expanded === true ? false : node.collapsed)
          : undefined,
    };
  });

  const links: LeafLink[] = [];
  const rootInputLinkIds = new Set<string>();
  const coreInputLinkIds = new Set<string>();
  const rootOutputLinkIds = new Set<string>();
  const coreOutputLinkIds = new Set<string>();
  const coreInputLinkSemantics = new Map<string, string>();
  const coreOutputLinkSemantics = new Map<string, string>();
  const droppedConnectionIds = new Set<string>();

  for (const connection of agent.connections) {
    if (connection.from.scope === 'bodyOutput' || connection.to.scope === 'bodyInput') {
      continue;
    }

    if (connection.from.scope === 'bodyInput' && connection.to.scope === 'brain') {
      const legacyInputNodeId = resolveLegacyInputSignalNodeId(agent, connection.from.nodeId);
      if (!legacyInputNodeId) {
        droppedConnectionIds.add(connection.id);
        continue;
      }
      const channelMatch = legacyInputNodeId.match(INPUT_CHANNEL_PATTERN);
      if (!channelMatch) {
        continue;
      }

      const channel = channelMatch[1];
      const legacySignalNodeId = legacyInputNodeId;
      const coreInputNodeId = `core-input-${channel}`;
      const rootLinkId = `bridge-root:${legacySignalNodeId}:${coreInputNodeId}`;
      if (!rootInputLinkIds.has(rootLinkId)) {
        rootInputLinkIds.add(rootLinkId);
        links.push({
          id: rootLinkId,
          from: {
            nodeId: legacySignalNodeId,
            portId: connection.from.portId ?? SIGNAL_OUTPUT_PORT,
          },
          to: {
            nodeId: coreInputNodeId,
            portId: SIGNAL_INPUT_PORT,
          },
          weight: 1,
        });
      }

      const coreLinkId = `bridge-core:${coreInputNodeId}:${connection.to.nodeId}`;
      const coreLinkSemanticKey = `${connection.weight}:${connection.delayMs ?? 0}:${connection.to.portId ?? NEURON_INPUT_PORT}`;
      if (!coreInputLinkIds.has(coreLinkId)) {
        coreInputLinkIds.add(coreLinkId);
        coreInputLinkSemantics.set(coreLinkId, coreLinkSemanticKey);
        links.push({
          id: coreLinkId,
          from: {
            nodeId: coreInputNodeId,
            portId: SIGNAL_OUTPUT_PORT,
          },
          to: {
            nodeId: connection.to.nodeId,
            portId: connection.to.portId ?? NEURON_INPUT_PORT,
          },
          weight: connection.weight,
          delayMs: connection.delayMs,
        });
      } else if (coreInputLinkSemantics.get(coreLinkId) !== coreLinkSemanticKey) {
        droppedConnectionIds.add(connection.id);
      }
      continue;
    }

    if (connection.from.scope === 'brain' && connection.to.scope === 'brain') {
      links.push({
        id: connection.id,
        from: {
          nodeId: connection.from.nodeId,
          portId: connection.from.portId ?? NEURON_OUTPUT_PORT,
        },
        to: {
          nodeId: connection.to.nodeId,
          portId: connection.to.portId ?? NEURON_INPUT_PORT,
        },
        weight: connection.weight,
        delayMs: connection.delayMs,
      });
      continue;
    }

    if (connection.from.scope === 'brain' && connection.to.scope === 'bodyOutput') {
      const legacyOutputNodeId = resolveLegacyOutputSignalNodeId(agent, connection.to.nodeId);
      if (!legacyOutputNodeId) {
        droppedConnectionIds.add(connection.id);
        continue;
      }
      const outputMatch = legacyOutputNodeId.match(OUTPUT_CHANNEL_PATTERN);
      if (!outputMatch) {
        continue;
      }

      const action = outputMatch[1];
      const legacySignalNodeId = legacyOutputNodeId;
      const coreOutputNodeId = `core-output-${action}`;
      const coreLinkId = `bridge-core:${connection.from.nodeId}:${coreOutputNodeId}`;
      const coreLinkSemanticKey = `${connection.weight}:${connection.delayMs ?? 0}:${connection.from.portId ?? NEURON_OUTPUT_PORT}`;
      if (!coreOutputLinkIds.has(coreLinkId)) {
        coreOutputLinkIds.add(coreLinkId);
        coreOutputLinkSemantics.set(coreLinkId, coreLinkSemanticKey);
        links.push({
          id: coreLinkId,
          from: {
            nodeId: connection.from.nodeId,
            portId: connection.from.portId ?? NEURON_OUTPUT_PORT,
          },
          to: {
            nodeId: coreOutputNodeId,
            portId: SIGNAL_INPUT_PORT,
          },
          weight: connection.weight,
          delayMs: connection.delayMs,
        });
      } else if (coreOutputLinkSemantics.get(coreLinkId) !== coreLinkSemanticKey) {
        droppedConnectionIds.add(connection.id);
      }

      const rootLinkId = `bridge-root:${coreOutputNodeId}:${legacySignalNodeId}`;
      if (!rootOutputLinkIds.has(rootLinkId)) {
        rootOutputLinkIds.add(rootLinkId);
        links.push({
          id: rootLinkId,
          from: {
            nodeId: coreOutputNodeId,
            portId: SIGNAL_OUTPUT_PORT,
          },
          to: {
            nodeId: legacySignalNodeId,
            portId: connection.to.portId ?? SIGNAL_INPUT_PORT,
          },
          weight: 1,
        });
      }
    }
  }

  const layout: BrainLayoutDocument = {
    version: 1,
    nodes: Object.fromEntries(
      Object.entries(agent.layout?.nodes ?? {}).map(([nodeId, state]) => [
        nodeId,
        {
          position: clonePosition(state.position),
          collapsed: state.collapsed,
          size: state.size ? { ...state.size } : undefined,
          expanded: state.expanded,
        },
      ])
    ),
    viewportByContainerId: agent.layout?.viewportByContainerId
      ? Object.fromEntries(
          Object.entries(agent.layout.viewportByContainerId).map(([containerId, viewport]) => [
            containerId,
            { ...viewport },
          ])
        )
      : undefined,
  };

  if (
    documentOnlyLosses.length === 0 &&
    (
      nextBody.inputSignals.some((signal) => (signal.scale ?? DEFAULT_VISION_SCALE) !== DEFAULT_VISION_SCALE) ||
      nextBody.outputSignals.some(
        (signal) => (signal.decayPerSecond ?? DEFAULT_OUTPUT_DECAY_PER_SECOND) !== DEFAULT_OUTPUT_DECAY_PER_SECOND
      )
    )
  ) {
    documentOnlyLosses.push('Legacy GraphIR document-only getter cannot preserve BodyIR scale/decay semantics.');
  }

  if (
    Object.values(agent.layout?.nodes ?? {}).some((node) => node.size !== undefined) ||
    agent.layout?.viewportByContainerId
  ) {
    documentOnlyLosses.push('Legacy GraphIR document-only getter cannot preserve AgentLayout size/viewport semantics.');
  }

  return {
    document: {
      ...nextDocument,
      root: {
        ...nextDocument.root,
        children: rootChildren,
        links,
      },
    },
    body: nextBody,
    layout,
    droppedConnectionIds: [...droppedConnectionIds],
    documentOnlyLosses,
  };
};
