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
import type {
  GraphIRDocument,
  LeafLink,
  NeuronGroupNode,
  NeuronNode,
  SignalNode,
  TopologyNode,
} from './ir';
import {
  createBrainLayoutFromDefinition,
  createDefaultBodyDefinition,
  getBodyVisionCellCount,
  type BodyDefinition,
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
const CORE_INPUT_NODE_PATTERN = /^core-input-([RGB])$/;
const CORE_OUTPUT_NODE_PATTERN = /^core-output-(turn-left|move-forward|turn-right)$/;
const SIGNAL_INPUT_PORT = 'in';
const SIGNAL_OUTPUT_PORT = 'out';
const NEURON_INPUT_PORT = 'dendrite';
const NEURON_OUTPUT_PORT = 'axon';

const clonePosition = (position?: Position): Position | undefined =>
  position ? { ...position } : undefined;

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
    visionCellCount: Math.max(
      0,
      ...signals
        .filter((signal) => INPUT_CHANNEL_PATTERN.test(signal.id))
        .map((signal) => Number.parseInt(signal.id.match(INPUT_CHANNEL_PATTERN)?.[2] ?? '-1', 10) + 1)
    ),
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

const buildBrainNeuronsFromLegacy = (document: GraphIRDocument): BrainNeuronNode[] =>
  collectNeuronNodes(document.root.children).map((node) => {
    const params = getNeuronParams(node);
    return {
      id: node.id,
      label: node.label,
      model: 'izhikevich',
      params,
      initialState: {
        v: params.c,
      },
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

  const legacyRootGroup = document.root.children.find(
    (node): node is NeuronGroupNode => node.kind === 'neuron-group' && node.id === LEGACY_ROOT_GROUP_ID
  );
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

const buildAgentConnectionsFromLegacy = (document: GraphIRDocument): AgentConnection[] => {
  const outgoingLinksByNodeId = new Map<string, LeafLink[]>();

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
  }

  return connections;
};

const buildAgentLayoutFromLegacy = (
  document: GraphIRDocument,
  layout?: BrainLayoutDocument
): AgentLayoutIR => {
  const graphLayout = layout ?? createBrainLayoutFromDefinition(document);
  const nodes: AgentLayoutIR['nodes'] = {};

  for (const [nodeId, state] of Object.entries(graphLayout.nodes)) {
    nodes[nodeId] = {
      position: clonePosition(state.position),
      collapsed: state.collapsed,
      expanded: state.collapsed === false ? true : undefined,
    };
  }

  return {
    version: 1,
    nodes,
  };
};

export const createAgentIRFromLegacyGraph = (
  name: string,
  document: GraphIRDocument,
  body?: BodyDefinition,
  layout?: BrainLayoutDocument,
  metadataOverrides?: Partial<AgentMetadata>
): AgentIR => {
  const resolvedBody = body ?? createDefaultBodyDefinition(1);
  const metadata = createAgentMetadata(name, metadataOverrides);
  const agentBody = {
    ...buildBodyIRFromLegacy(document),
    visionCellCount: Math.max(0, getBodyVisionCellCount(resolvedBody)),
  };
  const { containers, rootContainerId } = buildContainersFromLegacy(document);
  const brain: BrainIR = {
    version: 1,
    neurons: buildBrainNeuronsFromLegacy(document),
    containers,
    rootContainerId,
  };

  void resolvedBody;

  return {
    version: 1,
    metadata,
    body: agentBody,
    brain,
    connections: buildAgentConnectionsFromLegacy(document),
    layout: buildAgentLayoutFromLegacy(document, layout),
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
  body: BodyDefinition;
  layout: BrainLayoutDocument;
}

export const createLegacyGraphBridgeFromAgent = (agent: AgentIR): LegacyGraphBridgeResult => {
  const visionCellIds = new Set<number>();
  for (const connection of agent.connections) {
    if (connection.from.scope !== 'bodyInput') {
      continue;
    }
    const match = connection.from.nodeId.match(INPUT_CHANNEL_PATTERN);
    if (!match) {
      continue;
    }
    visionCellIds.add(Number.parseInt(match[2], 10));
  }

  const visionCells = Math.max(agent.body.visionCellCount, visionCellIds.size > 0 ? Math.max(...visionCellIds) + 1 : 0, 1);
  const nextDocument = createDefaultGraphIRDocument(visionCells);
  const nextBody = createDefaultBodyDefinition(visionCells);
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
        position: agent.layout?.nodes[node.id]?.position ?? node.position,
        collapsed: agent.layout?.nodes[node.id]?.collapsed ?? node.collapsed,
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

  for (const connection of agent.connections) {
    if (connection.from.scope === 'bodyOutput' || connection.to.scope === 'bodyInput') {
      continue;
    }

    if (connection.from.scope === 'bodyInput' && connection.to.scope === 'brain') {
      const channelMatch = connection.from.nodeId.match(INPUT_CHANNEL_PATTERN);
      if (!channelMatch) {
        continue;
      }

      const channel = channelMatch[1];
      const coreInputNodeId = `core-input-${channel}`;
      const rootLinkId = `bridge-root:${connection.from.nodeId}:${coreInputNodeId}`;
      if (!rootInputLinkIds.has(rootLinkId)) {
        rootInputLinkIds.add(rootLinkId);
        links.push({
          id: rootLinkId,
          from: {
            nodeId: connection.from.nodeId,
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
      if (!coreInputLinkIds.has(coreLinkId)) {
        coreInputLinkIds.add(coreLinkId);
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
      const outputMatch = connection.to.nodeId.match(OUTPUT_CHANNEL_PATTERN);
      if (!outputMatch) {
        continue;
      }

      const action = outputMatch[1];
      const coreOutputNodeId = `core-output-${action}`;
      const coreLinkId = `bridge-core:${connection.from.nodeId}:${coreOutputNodeId}`;
      if (!coreOutputLinkIds.has(coreLinkId)) {
        coreOutputLinkIds.add(coreLinkId);
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
      }

      const rootLinkId = `bridge-root:${coreOutputNodeId}:${connection.to.nodeId}`;
      if (!rootOutputLinkIds.has(rootLinkId)) {
        rootOutputLinkIds.add(rootLinkId);
        links.push({
          id: rootLinkId,
          from: {
            nodeId: coreOutputNodeId,
            portId: SIGNAL_OUTPUT_PORT,
          },
          to: {
            nodeId: connection.to.nodeId,
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
          expanded: state.expanded,
        },
      ])
    ),
  };

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
  };
};
