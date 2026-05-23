import type {
  AgentConnection,
  AgentIR,
  AgentLayoutIR,
  AgentMetadata,
  BrainContainerNode,
  BrainIR,
  BrainNeuronNode,
} from '../domain/brain/agent-ir';
import {
  withDerivedBodyVisionCellCount,
  withVisionCellLayoutMarkers,
} from '../domain/brain/agent-ir';
import type {
  GraphIRDocument,
  LeafLink,
  NeuronGroupNode,
  TopologyNode,
} from '../domain/brain/ir';
import {
  createLegacyBrainLayoutFromDefinition,
  createDefaultLegacyBodyDefinition,
  getLegacyBodyVisionCellCount,
  type LegacyBodyDefinition,
  type BrainLayoutDocument,
} from './legacyBrainPackage';
import {
  CORE_INPUT_NODE_PATTERN,
  CORE_OUTPUT_NODE_PATTERN,
  DEFAULT_ROOT_CONTAINER_ID,
  INPUT_CHANNEL_PATTERN,
  LEGACY_ROOT_GROUP_ID,
  buildBodyIRFromCompatBody,
  buildBodyIRFromLegacy,
  clonePosition,
  collectNeuronNodes,
  collectSignalNodes,
  createAgentMetadata,
  getNeuronInitialState,
  getNeuronParams,
} from './legacyGraphBridgeShared';

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

    if (/^output-/.test(fromNodeId) || /^vision-/.test(toNodeId)) {
      continue;
    }

    if (INPUT_CHANNEL_PATTERN.test(fromNodeId) && CORE_INPUT_NODE_PATTERN.test(toNodeId)) {
      const bridgedLinks = outgoingLinksByNodeId.get(toNodeId) ?? [];
      for (const bridgedLink of bridgedLinks) {
        if (INPUT_CHANNEL_PATTERN.test(bridgedLink.to.nodeId) || /^output-/.test(bridgedLink.from.nodeId)) {
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
        if (!/^output-/.test(bridgedLink.to.nodeId)) {
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
      : /^output-/.test(fromNodeId)
        ? 'bodyOutput'
        : 'brain';
    const toScope = INPUT_CHANNEL_PATTERN.test(toNodeId)
      ? 'bodyInput'
      : /^output-/.test(toNodeId)
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

  const { inputNodeIdToBodySignalId, outputNodeIdToBodySignalId } = buildCompatBodyBindingMaps(body);
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
      collapsed: state.collapsed,
    };
  }

  return {
    version: 1,
    nodes,
  };
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

export const createAgentIRFromLegacyGraph = (
  name: string,
  document: GraphIRDocument,
  body?: LegacyBodyDefinition,
  layout?: BrainLayoutDocument,
  metadataOverrides?: Partial<AgentMetadata>
): AgentIR => createAgentIRFromLegacyGraphDetailed(name, document, body, layout, metadataOverrides).agent;
