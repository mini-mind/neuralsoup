import type {
  AgentConnection,
  AgentConnectionEndpoint,
  AgentIR,
  AgentIRSummary,
  BrainContainerNode,
  BrainNeuronNode,
  BrainStructuralPreflight,
  SynapseModelIR,
  WorldRegistry,
} from '../../../domain/brain';
import {
  preflightBrainStructure,
  resolveAgentBodyEndpointIds,
  resolveCompiledAgentBodyEndpointIds,
} from '../../../domain/brain';
import type { Position } from '../../../domain/brain/shared';
import { getGraphLinkCapabilities } from './graphLinkPolicy';
import type {
  GraphBreadcrumbItem,
  GraphTopologyIndexes,
  GraphViewLink,
  GraphViewModel,
  GraphViewNode,
  NodePositionDraftMap,
} from './graphViewTypes';
import {
  AGENT_GRAPH_CHILD_SCOPE_OFFSET,
  AGENT_GRAPH_EXPANDED_GROUP_MIN_SIZE,
  AGENT_GRAPH_EXPANDED_GROUP_PADDING,
  AGENT_GRAPH_GROUP_NODE_SIZE,
  AGENT_GRAPH_LEAF_NODE_SIZE,
  AGENT_GRAPH_ROOT_CONTAINER_TEST_ID,
} from './agentGraphViewConstants';

export interface AgentGraphViewNodeRecord {
  id: string;
  refNodeId: string;
  kind: 'adapter' | 'neuron-group' | 'neuron' | 'signal';
  label: string;
  endpoint?: AgentConnectionEndpoint;
  neuron?: BrainNeuronNode;
  container?: BrainContainerNode;
}

export interface AgentGraphViewIndexes extends GraphTopologyIndexes<AgentGraphViewNodeRecord> {
  structuralPreflight: BrainStructuralPreflight;
  containerById: Map<string, BrainContainerNode>;
  childRefsByContainerId: Map<string, Array<{ scope: 'brain' | 'container'; nodeId: string }>>;
  parentContainerIdByNodeId: Map<string, string>;
  linkById: Map<string, AgentConnection>;
  endpointByViewNodeId: Map<string, AgentConnectionEndpoint>;
  bodyInputNodeIds: string[];
  bodyOutputNodeIds: string[];
  rootNodeIds: string[];
}

export interface AgentGraphViewModel
  extends GraphViewModel<AgentGraphViewNodeRecord, BrainContainerNode | { id: 'root'; children: AgentGraphViewNodeRecord[] }> {
  indexes: AgentGraphViewIndexes;
}

const ROOT_FALLBACK_LAYOUT: Record<string, Position> = {
  'input-adapter': { x: 24, y: 180 },
  [AGENT_GRAPH_ROOT_CONTAINER_TEST_ID]: { x: 300, y: 200 },
  'output-adapter': { x: 644, y: 200 },
  'core-input-adapter': { x: 40, y: 180 },
  'core-output-adapter': { x: 520, y: 180 },
};

const BODY_INPUTS_GROUP_ID = 'input-adapter';
const BODY_OUTPUTS_GROUP_ID = 'output-adapter';
const CORE_BODY_INPUTS_GROUP_ID = 'core-input-adapter';
const CORE_BODY_OUTPUTS_GROUP_ID = 'core-output-adapter';
type RootContainerView = { id: 'root'; children: AgentGraphViewNodeRecord[] };
type AggregateLinkView = {
  fromNodeId: string;
  toNodeId: string;
  leafLinkIds: string[];
  count: number;
  totalWeight: number;
  resolvedWeightCount: number;
  unresolvedWeightCount: number;
  synapseModelIds: string[];
};
type GraphViewSynapseInfo = NonNullable<GraphViewLink['synapse']>;
type GraphViewSynapseSummary = NonNullable<GraphViewLink['synapseSummary']>;

const FALLBACK_WEIGHT_VALUE = 0;
const FALLBACK_WEIGHT_DISPLAY = 'unresolved-weight';
const FALLBACK_DELAY_DISPLAY = 'unresolved-delay';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const formatWeightDisplay = (weight: number | null): string =>
  weight == null ? FALLBACK_WEIGHT_DISPLAY : Number.isInteger(weight) ? `${weight}` : weight.toFixed(2);

const toNumericRecord = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const numericRecord: Record<string, number> = {};
  for (const [key, candidate] of Object.entries(record)) {
    if (isFiniteNumber(candidate)) {
      numericRecord[key] = candidate;
    }
  }
  return numericRecord;
};

const createSynapseModelIndex = (agent: AgentIR): Map<string, SynapseModelIR> =>
  new Map((agent.brain.synapseModels ?? []).map((model) => [model.id, model]));

const resolveConnectionSynapseInfo = (
  connection: AgentConnection,
  synapseModelsById: Map<string, SynapseModelIR>
): GraphViewSynapseInfo => {
  const synapseModelId = connection.synapseModelId?.trim() ?? '';
  const parameterOverrides = toNumericRecord(connection.parameterOverrides);

  if (synapseModelId.length === 0) {
    return {
      resolutionStatus: 'missing-synapse-model-id',
      synapseModelId: null,
      synapseModelLabel: null,
      synapseKind: null,
      defaults: {},
      parameterOverrides,
      effectiveParameters: { ...parameterOverrides },
      effectiveWeight: null,
      effectiveDelayMs: null,
      effectiveDelayMsDisplay: FALLBACK_DELAY_DISPLAY,
    };
  }

  const synapseModel = synapseModelsById.get(synapseModelId);
  if (!synapseModel) {
    return {
      resolutionStatus: 'missing-synapse-model',
      synapseModelId,
      synapseModelLabel: null,
      synapseKind: null,
      defaults: {},
      parameterOverrides,
      effectiveParameters: { ...parameterOverrides },
      effectiveWeight: null,
      effectiveDelayMs: null,
      effectiveDelayMsDisplay: FALLBACK_DELAY_DISPLAY,
    };
  }

  const defaults = toNumericRecord(synapseModel.defaults);
  const effectiveParameters: Record<string, number> = {
    ...defaults,
    ...parameterOverrides,
  };
  const effectiveWeight = isFiniteNumber(effectiveParameters.weight) ? effectiveParameters.weight : null;
  const effectiveDelayMs = isFiniteNumber(effectiveParameters.delayMs) ? effectiveParameters.delayMs : null;
  const resolutionStatus: GraphViewSynapseInfo['resolutionStatus'] =
    effectiveWeight == null
      ? 'missing-effective-weight'
      : effectiveDelayMs == null
        ? 'missing-effective-delay'
        : 'resolved';

  return {
    resolutionStatus,
    synapseModelId: synapseModel.id,
    synapseModelLabel: synapseModel.label ?? null,
    synapseKind: synapseModel.kind,
    defaults,
    parameterOverrides,
    effectiveParameters,
    effectiveWeight,
    effectiveDelayMs,
    effectiveDelayMsDisplay: effectiveDelayMs == null ? FALLBACK_DELAY_DISPLAY : `${effectiveDelayMs}`,
  };
};

const toViewPosition = (position: Position, scope: 'root' | 'child'): Position =>
  scope === 'child'
    ? {
        x: position.x + AGENT_GRAPH_CHILD_SCOPE_OFFSET.x,
        y: position.y + AGENT_GRAPH_CHILD_SCOPE_OFFSET.y,
      }
    : position;

const getNodeSize = (node: AgentGraphViewNodeRecord) =>
  node.kind === 'neuron' || node.kind === 'signal'
    ? { width: AGENT_GRAPH_LEAF_NODE_SIZE, height: AGENT_GRAPH_LEAF_NODE_SIZE }
    : { width: AGENT_GRAPH_GROUP_NODE_SIZE.width, height: AGENT_GRAPH_GROUP_NODE_SIZE.height };

const getStoredNodeSize = getNodeSize;

const isLeafNode = (node: AgentGraphViewNodeRecord) => node.kind === 'neuron' || node.kind === 'signal';

const isContainerNode = (node: AgentGraphViewNodeRecord) => node.kind === 'adapter' || node.kind === 'neuron-group';

const isInputAdapterId = (nodeId: string) => nodeId === BODY_INPUTS_GROUP_ID || nodeId === CORE_BODY_INPUTS_GROUP_ID;

const isOutputAdapterId = (nodeId: string) => nodeId === BODY_OUTPUTS_GROUP_ID || nodeId === CORE_BODY_OUTPUTS_GROUP_ID;

const getAdapterChildRecords = (
  adapterId: string,
  indexes: AgentGraphViewIndexes
): AgentGraphViewNodeRecord[] => {
  const nodeIds = isInputAdapterId(adapterId) ? indexes.bodyInputNodeIds : isOutputAdapterId(adapterId) ? indexes.bodyOutputNodeIds : [];
  return nodeIds
    .map((nodeId) => indexes.nodeById.get(nodeId))
    .filter((node): node is AgentGraphViewNodeRecord => node != null);
};

const getContainerChildRecords = (
  node: AgentGraphViewNodeRecord,
  indexes: AgentGraphViewIndexes
): AgentGraphViewNodeRecord[] => {
  if (node.kind === 'adapter') {
    return getAdapterChildRecords(node.id, indexes);
  }

  const containerId = node.container?.id ?? node.refNodeId;
  return (indexes.childRefsByContainerId.get(containerId) ?? [])
    .map((childRef) => indexes.nodeById.get(childRef.nodeId))
    .filter((child): child is AgentGraphViewNodeRecord => child != null);
};

const isNodeExpanded = (agent: AgentIR, node: AgentGraphViewNodeRecord): boolean =>
  isContainerNode(node) && agent.layout?.nodes[getLayoutNodeKey(node)]?.collapsed === false;

const getLayoutNodeKey = (node: AgentGraphViewNodeRecord) => {
  if (node.kind === 'neuron-group' && node.container) {
    return node.container.id;
  }

  return node.refNodeId;
};

const getNodeDirection = (node: AgentGraphViewNodeRecord): GraphViewNode['direction'] => {
  if (node.kind === 'signal' && node.endpoint) {
    return node.endpoint.scope === 'bodyInput' ? 'input' : 'output';
  }

  if (node.kind === 'adapter') {
    return node.id === BODY_OUTPUTS_GROUP_ID || node.id === CORE_BODY_OUTPUTS_GROUP_ID ? 'output' : 'input';
  }

  return 'internal';
};

const createNodeDetail = (
  node: AgentGraphViewNodeRecord,
  childCount: number,
  runtimeInstalledLeafCount: number
): string => {
  if (node.kind === 'adapter') {
    return `${childCount} canonical / ${runtimeInstalledLeafCount} installed`;
  }

  if (node.kind === 'neuron-group') {
    return `${childCount} leaf nodes`;
  }

  if (node.kind === 'signal') {
    const direction = node.endpoint?.scope === 'bodyInput' ? 'input' : 'output';
    return runtimeInstalledLeafCount > 0 ? `${direction} / installed` : `${direction} / canonical-only`;
  }

  return 'neuron';
};

const createBoundaryAdapterRecord = (
  id: typeof CORE_BODY_INPUTS_GROUP_ID | typeof CORE_BODY_OUTPUTS_GROUP_ID,
  label: string
): AgentGraphViewNodeRecord => ({
  id,
  refNodeId: id,
  kind: 'adapter',
  label,
});

const getDefaultStoredPosition = (node: AgentGraphViewNodeRecord, index: number, scope: 'root' | 'child'): Position => {
  if (scope === 'root' && ROOT_FALLBACK_LAYOUT[node.id]) {
    return ROOT_FALLBACK_LAYOUT[node.id];
  }

  if (scope === 'child' && node.id === CORE_BODY_INPUTS_GROUP_ID) {
    return { x: -180, y: 170 };
  }

  if (scope === 'child' && node.id === CORE_BODY_OUTPUTS_GROUP_ID) {
    return { x: 260, y: 180 };
  }

  if (isLeafNode(node)) {
    const column = index % 6;
    const row = Math.floor(index / 6);
    return {
      x: 96 + column * 110,
      y: 96 + row * 96,
    };
  }

  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: 48 + column * 250,
    y: 120 + row * 180,
  };
};

const getDefaultExpandedChildPosition = (node: AgentGraphViewNodeRecord, index: number): Position => {
  if (isLeafNode(node)) {
    const column = index % 5;
    const row = Math.floor(index / 5);
    return {
      x: AGENT_GRAPH_EXPANDED_GROUP_PADDING + column * 48,
      y: AGENT_GRAPH_EXPANDED_GROUP_PADDING + row * 44,
    };
  }

  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: AGENT_GRAPH_EXPANDED_GROUP_PADDING + column * 132,
    y: AGENT_GRAPH_EXPANDED_GROUP_PADDING + row * 112,
  };
};

const getExpandedChildOffset = (
  groupChildren: AgentGraphViewNodeRecord[],
  agent: AgentIR
): Position => {
  if (groupChildren.length === 0) {
    return { x: 0, y: 0 };
  }

  const minX = Math.min(
    ...groupChildren.map((child, index) => {
      const position =
        agent.layout?.nodes[getLayoutNodeKey(child)]?.position ??
        getDefaultExpandedChildPosition(child, index);
      return position.x;
    })
  );
  const minY = Math.min(
    ...groupChildren.map((child, index) => {
      const position =
        agent.layout?.nodes[getLayoutNodeKey(child)]?.position ??
        getDefaultExpandedChildPosition(child, index);
      return position.y;
    })
  );

  return {
    x: minX < AGENT_GRAPH_EXPANDED_GROUP_PADDING ? AGENT_GRAPH_EXPANDED_GROUP_PADDING - minX : 0,
    y: minY < AGENT_GRAPH_EXPANDED_GROUP_PADDING ? AGENT_GRAPH_EXPANDED_GROUP_PADDING - minY : 0,
  };
};

const getExpandedGroupSize = (
  groupChildren: AgentGraphViewNodeRecord[],
  agent: AgentIR
) => {
  if (groupChildren.length === 0) {
    return AGENT_GRAPH_EXPANDED_GROUP_MIN_SIZE;
  }

  const offset = getExpandedChildOffset(groupChildren, agent);
  const maxRight = Math.max(
    ...groupChildren.map((child, index) => {
      const position =
        agent.layout?.nodes[getLayoutNodeKey(child)]?.position ??
        getDefaultExpandedChildPosition(child, index);
      const size = getStoredNodeSize(child);
      return position.x + offset.x + size.width;
    })
  );
  const maxBottom = Math.max(
    ...groupChildren.map((child, index) => {
      const position =
        agent.layout?.nodes[getLayoutNodeKey(child)]?.position ??
        getDefaultExpandedChildPosition(child, index);
      const size = getStoredNodeSize(child);
      return position.y + offset.y + size.height;
    })
  );

  return {
    width: Math.max(
      AGENT_GRAPH_EXPANDED_GROUP_MIN_SIZE.width,
      maxRight + AGENT_GRAPH_EXPANDED_GROUP_PADDING
    ),
    height: Math.max(
      AGENT_GRAPH_EXPANDED_GROUP_MIN_SIZE.height,
      maxBottom + AGENT_GRAPH_EXPANDED_GROUP_PADDING
    ),
  };
};

const getLayoutPosition = (
  agent: AgentIR,
  node: AgentGraphViewNodeRecord,
  index: number,
  scope: 'root' | 'child',
  draftNodePositions: NodePositionDraftMap
): Position => {
  const draftPosition = draftNodePositions[node.id] ?? draftNodePositions[node.refNodeId];
  if (draftPosition) {
    return toViewPosition(draftPosition, scope);
  }

  return toViewPosition(
    agent.layout?.nodes[getLayoutNodeKey(node)]?.position ?? getDefaultStoredPosition(node, index, scope),
    scope
  );
};

const buildIndexes = (
  agent: AgentIR,
  worldRegistry: WorldRegistry,
  structuralPreflight: BrainStructuralPreflight,
  projectedVisionCellCount?: number
): AgentGraphViewIndexes => {
  const pathById = new Map<string, string[]>();
  const nodeById = new Map<string, AgentGraphViewNodeRecord>();
  const containerById = structuralPreflight.containerById;
  const parentContainerIdByNodeId = new Map<string, string>();
  const linkById = new Map(agent.connections.map((connection) => [connection.id, connection]));
  const endpointByViewNodeId = new Map<string, AgentConnectionEndpoint>();

  const { bodyInputNodeIds: bodyInputIds, bodyOutputNodeIds: bodyOutputIds } = resolveAgentBodyEndpointIds(
    agent,
    worldRegistry,
    projectedVisionCellCount
  );

  const rootChildren: AgentGraphViewNodeRecord[] = [];

  if (bodyInputIds.length > 0) {
    rootChildren.push({
      id: BODY_INPUTS_GROUP_ID,
      refNodeId: BODY_INPUTS_GROUP_ID,
      kind: 'adapter',
      label: '输入组',
    });
  }

  const rootContainer = structuralPreflight.rootContainer;
  if (rootContainer) {
    rootChildren.push({
      id: rootContainer.id,
      refNodeId: rootContainer.id,
      kind: 'neuron-group',
      label: 'Brain组',
      container: rootContainer,
    });
  }

  if (bodyOutputIds.length > 0) {
    rootChildren.push({
      id: BODY_OUTPUTS_GROUP_ID,
      refNodeId: BODY_OUTPUTS_GROUP_ID,
      kind: 'adapter',
      label: '输出组',
    });
  }

  for (const child of rootChildren) {
    pathById.set(child.id, [child.id]);
    if (child.refNodeId !== child.id) {
      pathById.set(child.refNodeId, [child.id]);
    }
    nodeById.set(child.id, child);
  }

  const visitContainer = (containerId: string, trail: string[]) => {
    const container = containerById.get(containerId);
    if (!container) {
      return;
    }

    for (const childRef of structuralPreflight.childRefsByContainerId.get(containerId) ?? []) {
      if (childRef.scope === 'brain') {
        const neuron = structuralPreflight.neuronById.get(childRef.nodeId);
        if (!neuron) {
          continue;
        }

        const record: AgentGraphViewNodeRecord = {
          id: neuron.id,
          refNodeId: neuron.id,
          kind: 'neuron',
          label: neuron.label ?? neuron.id,
          neuron,
        };
        const nextTrail = [...trail, neuron.id];
        if (!pathById.has(neuron.id)) {
          pathById.set(neuron.id, nextTrail);
        }
        if (!nodeById.has(neuron.id)) {
          nodeById.set(neuron.id, record);
        }
        parentContainerIdByNodeId.set(neuron.id, containerId);
        continue;
      }

      const childContainer = containerById.get(childRef.nodeId);
      if (!childContainer) {
        continue;
      }

      const record: AgentGraphViewNodeRecord = {
          id: childContainer.id,
          refNodeId: childContainer.id,
          kind: 'neuron-group',
          label: childContainer.label ?? childContainer.id,
          container: childContainer,
      };
      const nextTrail = [...trail, childContainer.id];
      if (!pathById.has(childContainer.id)) {
        pathById.set(childContainer.id, nextTrail);
      }
      if (!nodeById.has(childContainer.id)) {
        nodeById.set(childContainer.id, record);
      }
      parentContainerIdByNodeId.set(childContainer.id, containerId);
      if (trail.includes(childContainer.id)) {
        continue;
      }
      visitContainer(childContainer.id, nextTrail);
    }
  };

  if (rootContainer) {
    visitContainer(rootContainer.id, [rootContainer.id]);
  }

  for (const nodeId of bodyInputIds) {
    const record: AgentGraphViewNodeRecord = {
      id: nodeId,
      refNodeId: nodeId,
      kind: 'signal',
      label: nodeId,
      endpoint: { scope: 'bodyInput', nodeId },
    };
    pathById.set(nodeId, [BODY_INPUTS_GROUP_ID, nodeId]);
    nodeById.set(nodeId, record);
    parentContainerIdByNodeId.set(nodeId, BODY_INPUTS_GROUP_ID);
    endpointByViewNodeId.set(nodeId, { scope: 'bodyInput', nodeId });
  }

  for (const nodeId of bodyOutputIds) {
    const record: AgentGraphViewNodeRecord = {
      id: nodeId,
      refNodeId: nodeId,
      kind: 'signal',
      label: nodeId,
      endpoint: { scope: 'bodyOutput', nodeId },
    };
    pathById.set(nodeId, [BODY_OUTPUTS_GROUP_ID, nodeId]);
    nodeById.set(nodeId, record);
    parentContainerIdByNodeId.set(nodeId, BODY_OUTPUTS_GROUP_ID);
    endpointByViewNodeId.set(nodeId, { scope: 'bodyOutput', nodeId });
  }

  return {
    pathById,
    nodeById,
    structuralPreflight,
    containerById,
    childRefsByContainerId: structuralPreflight.childRefsByContainerId,
    parentContainerIdByNodeId,
    linkById,
    endpointByViewNodeId,
    bodyInputNodeIds: bodyInputIds,
    bodyOutputNodeIds: bodyOutputIds,
    rootNodeIds: rootChildren.map((child) => child.id),
  };
};

const collectLeafIds = (
  node: AgentGraphViewNodeRecord,
  indexes: AgentGraphViewIndexes
): Set<string> => {
  const leafIds = new Set<string>();
  const visitedNodeIds = new Set<string>();

  const visit = (candidate: AgentGraphViewNodeRecord) => {
    if (visitedNodeIds.has(candidate.id)) {
      return;
    }
    visitedNodeIds.add(candidate.id);

    if (isLeafNode(candidate)) {
      leafIds.add(candidate.refNodeId);
      return;
    }

    if (candidate.kind === 'adapter') {
      for (const child of getAdapterChildRecords(candidate.id, indexes)) {
        visit(child);
      }
      return;
    }

    const container = candidate.container ?? indexes.containerById.get(candidate.refNodeId);
    if (!container) {
      return;
    }

    for (const childRef of indexes.childRefsByContainerId.get(container.id) ?? []) {
      const child = indexes.nodeById.get(childRef.nodeId);
      if (child) {
        visit(child);
      }
    }
  };

  visit(node);
  return leafIds;
};

const getScopeNodeIdForLeaf = (
  leafId: string,
  pathById: Map<string, string[]>,
  currentPath: string[],
  expandedContainerIds: Set<string>
): string | null => {
  const trail = pathById.get(leafId);
  if (!trail) {
    return null;
  }

  if (currentPath.length === 0) {
    return trail[0] ?? null;
  }

  const directChildIndex = currentPath.length;
  const parentPath = trail.slice(0, currentPath.length);
  if (parentPath.length !== currentPath.length || parentPath.some((id, index) => id !== currentPath[index])) {
    return null;
  }

  const directChildId = trail[directChildIndex] ?? null;
  if (!directChildId) {
    return null;
  }

  if (!expandedContainerIds.has(directChildId)) {
    return directChildId;
  }

  return trail[directChildIndex + 1] ?? directChildId;
};

const collectAggregateLinks = (
  connections: AgentConnection[],
  synapseInfoByConnectionId: Map<string, GraphViewSynapseInfo>,
  pathById: Map<string, string[]>,
  currentPath: string[],
  expandedContainerIds: Set<string>
): AggregateLinkView[] => {
  const aggregateMap = new Map<string, AggregateLinkView>();

  for (const connection of connections) {
    const fromNodeId = getScopeNodeIdForLeaf(connection.from.nodeId, pathById, currentPath, expandedContainerIds);
    const toNodeId = getScopeNodeIdForLeaf(connection.to.nodeId, pathById, currentPath, expandedContainerIds);
    if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
      continue;
    }

    const key = `${fromNodeId}->${toNodeId}`;
    const synapseInfo = synapseInfoByConnectionId.get(connection.id) ?? null;
    const resolvedWeight = synapseInfo?.effectiveWeight;
    const hasResolvedWeight = resolvedWeight != null;
    const effectiveWeight = hasResolvedWeight ? resolvedWeight : FALLBACK_WEIGHT_VALUE;
    const synapseModelId = synapseInfo?.synapseModelId ?? null;
    const current = aggregateMap.get(key);
    if (current) {
      current.leafLinkIds.push(connection.id);
      current.count += 1;
      current.totalWeight += effectiveWeight;
      if (hasResolvedWeight) {
        current.resolvedWeightCount += 1;
      } else {
        current.unresolvedWeightCount += 1;
      }
      if (synapseModelId && !current.synapseModelIds.includes(synapseModelId)) {
        current.synapseModelIds.push(synapseModelId);
      }
      continue;
    }

    aggregateMap.set(key, {
      fromNodeId,
      toNodeId,
      leafLinkIds: [connection.id],
      count: 1,
      totalWeight: effectiveWeight,
      resolvedWeightCount: hasResolvedWeight ? 1 : 0,
      unresolvedWeightCount: hasResolvedWeight ? 0 : 1,
      synapseModelIds: synapseModelId ? [synapseModelId] : [],
    });
  }

  return [...aggregateMap.values()];
};

const collectBoundaryAggregateLinks = ({
  connections,
  synapseInfoByConnectionId,
  pathById,
  currentPath,
  expandedContainerIds,
}: {
  connections: AgentConnection[];
  synapseInfoByConnectionId: Map<string, GraphViewSynapseInfo>;
  pathById: Map<string, string[]>;
  currentPath: string[];
  expandedContainerIds: Set<string>;
}): AggregateLinkView[] => {
  const aggregateMap = new Map<string, AggregateLinkView>();
  const projectBoundaryAdapterNodeId = (
    scope: 'bodyInput' | 'bodyOutput',
    leafNodeId: string
  ) => {
    const adapterId = scope === 'bodyInput' ? CORE_BODY_INPUTS_GROUP_ID : CORE_BODY_OUTPUTS_GROUP_ID;
    return expandedContainerIds.has(adapterId) ? leafNodeId : adapterId;
  };

  const append = (fromNodeId: string, toNodeId: string, connection: AgentConnection) => {
    if (fromNodeId === toNodeId) {
      return;
    }

    const key = `${fromNodeId}->${toNodeId}`;
    const synapseInfo = synapseInfoByConnectionId.get(connection.id) ?? null;
    const resolvedWeight = synapseInfo?.effectiveWeight;
    const hasResolvedWeight = resolvedWeight != null;
    const effectiveWeight = hasResolvedWeight ? resolvedWeight : FALLBACK_WEIGHT_VALUE;
    const synapseModelId = synapseInfo?.synapseModelId ?? null;
    const current = aggregateMap.get(key);
    if (current) {
      current.leafLinkIds.push(connection.id);
      current.count += 1;
      current.totalWeight += effectiveWeight;
      if (hasResolvedWeight) {
        current.resolvedWeightCount += 1;
      } else {
        current.unresolvedWeightCount += 1;
      }
      if (synapseModelId && !current.synapseModelIds.includes(synapseModelId)) {
        current.synapseModelIds.push(synapseModelId);
      }
      return;
    }

    aggregateMap.set(key, {
      fromNodeId,
      toNodeId,
      leafLinkIds: [connection.id],
      count: 1,
      totalWeight: effectiveWeight,
      resolvedWeightCount: hasResolvedWeight ? 1 : 0,
      unresolvedWeightCount: hasResolvedWeight ? 0 : 1,
      synapseModelIds: synapseModelId ? [synapseModelId] : [],
    });
  };

  for (const connection of connections) {
    if (connection.from.scope === 'bodyInput' && connection.to.scope === 'brain') {
      const toNodeId = getScopeNodeIdForLeaf(connection.to.nodeId, pathById, currentPath, expandedContainerIds);
      if (toNodeId) {
        append(projectBoundaryAdapterNodeId('bodyInput', connection.from.nodeId), toNodeId, connection);
      }
      continue;
    }

    if (connection.from.scope === 'brain' && connection.to.scope === 'bodyOutput') {
      const fromNodeId = getScopeNodeIdForLeaf(connection.from.nodeId, pathById, currentPath, expandedContainerIds);
      if (fromNodeId) {
        append(fromNodeId, projectBoundaryAdapterNodeId('bodyOutput', connection.to.nodeId), connection);
      }
    }
  }

  return [...aggregateMap.values()];
};

const getCurrentChildren = (
  indexes: AgentGraphViewIndexes,
  navigationPath: string[]
): { currentContainer: RootContainerView | BrainContainerNode; currentChildren: AgentGraphViewNodeRecord[]; currentContainerKind: 'root' | 'adapter' | 'neuron-group' } => {
  if (navigationPath.length === 0) {
    const currentChildren = indexes.rootNodeIds
      .map((nodeId) => indexes.nodeById.get(nodeId))
      .filter((node): node is AgentGraphViewNodeRecord => node != null);
    return {
      currentContainer: { id: 'root', children: currentChildren },
      currentChildren,
      currentContainerKind: 'root',
    };
  }

  const currentNodeId = navigationPath[navigationPath.length - 1]!;
  const currentNode = indexes.nodeById.get(currentNodeId);
  if (!currentNode) {
    const fallbackChildren = indexes.rootNodeIds
      .map((nodeId) => indexes.nodeById.get(nodeId))
      .filter((node): node is AgentGraphViewNodeRecord => node != null);
    return {
      currentContainer: { id: 'root', children: fallbackChildren },
      currentChildren: fallbackChildren,
      currentContainerKind: 'root',
    };
  }

  if (currentNode.id === BODY_INPUTS_GROUP_ID || currentNode.id === BODY_OUTPUTS_GROUP_ID) {
    const currentChildren = [...indexes.nodeById.values()].filter(
      (node) => indexes.parentContainerIdByNodeId.get(node.id) === currentNode.id
    );
    return {
      currentContainer: { id: 'root', children: currentChildren },
      currentChildren,
      currentContainerKind: 'adapter',
    };
  }

  const container = currentNode.container ?? indexes.containerById.get(currentNode.refNodeId);
  if (!container) {
    const fallbackChildren = indexes.rootNodeIds
      .map((nodeId) => indexes.nodeById.get(nodeId))
      .filter((node): node is AgentGraphViewNodeRecord => node != null);
    return {
      currentContainer: { id: 'root', children: fallbackChildren },
      currentChildren: fallbackChildren,
      currentContainerKind: 'neuron-group',
    };
  }

  const currentChildren = (indexes.childRefsByContainerId.get(container.id) ?? [])
    .map((childRef) => indexes.nodeById.get(childRef.nodeId))
    .filter((node): node is AgentGraphViewNodeRecord => node != null);

  if (currentNode.refNodeId === container.id && indexes.containerById.get(currentNode.refNodeId)?.id === currentNode.refNodeId) {
    const bodyInputCount = indexes.bodyInputNodeIds.length;
    const bodyOutputCount = indexes.bodyOutputNodeIds.length;

    return {
      currentContainer: container,
      currentChildren: [
        ...(bodyInputCount > 0 ? [createBoundaryAdapterRecord(CORE_BODY_INPUTS_GROUP_ID, 'Inputs')] : []),
        ...currentChildren,
        ...(bodyOutputCount > 0 ? [createBoundaryAdapterRecord(CORE_BODY_OUTPUTS_GROUP_ID, 'Outputs')] : []),
      ],
      currentContainerKind: 'neuron-group',
    };
  }

  return {
    currentContainer: container,
    currentChildren,
    currentContainerKind: 'neuron-group',
  };
};

export const buildAgentGraphViewModel = ({
  agent,
  navigationPath,
  draftNodePositions,
  runtimeActiveNodeIds,
  installedSummary,
  projectedVisionCellCount,
  worldRegistry,
}: {
  agent: AgentIR;
  navigationPath: string[];
  draftNodePositions: NodePositionDraftMap;
  runtimeActiveNodeIds: string[];
  installedSummary?: AgentIRSummary;
  projectedVisionCellCount?: number;
  worldRegistry: WorldRegistry;
}): AgentGraphViewModel => {
  const structuralPreflight = preflightBrainStructure(agent.brain);
  const indexes = buildIndexes(agent, worldRegistry, structuralPreflight, projectedVisionCellCount);
  const compiledEndpointIds = resolveCompiledAgentBodyEndpointIds(agent, worldRegistry);
  const installedBodyInputNodeIds = new Set(compiledEndpointIds.bodyInputNodeIds);
  const installedBodyOutputNodeIds = new Set(compiledEndpointIds.bodyOutputNodeIds);
  const installedInputCount = installedSummary?.inputSignalCount ?? compiledEndpointIds.bodyInputNodeIds.length;
  const installedOutputCount = installedSummary?.outputSignalCount ?? compiledEndpointIds.bodyOutputNodeIds.length;
  const { currentContainer, currentChildren, currentContainerKind } = getCurrentChildren(indexes, navigationPath);
  const currentScope = navigationPath.length === 0 ? 'root' : 'child';
  const scopeKey = navigationPath.length === 0 ? 'root' : navigationPath.join('/');
  const breadcrumbs: GraphBreadcrumbItem[] = [{ id: 'root', label: 'root' }];

  for (const nodeId of navigationPath) {
    const node = indexes.nodeById.get(nodeId);
    if (!node) {
      continue;
    }
    breadcrumbs.push({ id: node.refNodeId, label: node.label });
  }

  const nodes: GraphViewNode[] = [];
  const currentPath = navigationPath;
  const containerLeafIds = new Set<string>();
  for (const child of currentChildren) {
    for (const leafId of collectLeafIds(child, indexes)) {
      containerLeafIds.add(leafId);
    }
  }
  const containerConnections = agent.connections.filter(
    (connection) => containerLeafIds.has(connection.from.nodeId) && containerLeafIds.has(connection.to.nodeId)
  );
  const synapseModelsById = createSynapseModelIndex(agent);
  const synapseInfoByConnectionId = new Map<string, GraphViewSynapseInfo>(
    agent.connections.map((connection) => [
      connection.id,
      resolveConnectionSynapseInfo(connection, synapseModelsById),
    ])
  );
  const expandedContainerIds = new Set(
    currentChildren
      .filter((node) => isNodeExpanded(agent, node))
      .map((node) => node.id)
  );
  const aggregateLinks = collectAggregateLinks(
    containerConnections,
    synapseInfoByConnectionId,
    indexes.pathById,
    currentPath,
    expandedContainerIds
  );
  const boundaryAggregateLinks =
    navigationPath.length === 1 && navigationPath[0] === agent.brain.rootContainerId
      ? collectBoundaryAggregateLinks({
          connections: agent.connections,
          synapseInfoByConnectionId,
          pathById: indexes.pathById,
          currentPath,
          expandedContainerIds,
        })
      : [];

  for (const [index, node] of currentChildren.entries()) {
    const position = getLayoutPosition(agent, node, index, currentScope, draftNodePositions);
    const expanded = isNodeExpanded(agent, node);
    const groupChildren = getContainerChildRecords(node, indexes);
    const size = expanded ? getExpandedGroupSize(groupChildren, agent) : getNodeSize(node);
    const childCount =
      node.kind === 'adapter'
        ? getAdapterChildRecords(node.id, indexes).length
        : groupChildren.length;
    const runtimeInstalledLeafCount =
      node.kind === 'signal'
        ? node.endpoint?.scope === 'bodyInput'
          ? (installedBodyInputNodeIds.has(node.refNodeId) ? 1 : 0)
          : (installedBodyOutputNodeIds.has(node.refNodeId) ? 1 : 0)
        : node.id === BODY_INPUTS_GROUP_ID
          ? installedInputCount
          : node.id === BODY_OUTPUTS_GROUP_ID
            ? installedOutputCount
        : node.id === CORE_BODY_INPUTS_GROUP_ID
          ? installedInputCount
          : node.id === CORE_BODY_OUTPUTS_GROUP_ID
            ? installedOutputCount
          : 0;
    const direction = getNodeDirection(node);
    const leaf = isLeafNode(node);
    const capabilities = getGraphLinkCapabilities(
      {
        refNodeId: node.id,
        kind: node.kind,
        leaf,
        proxy: false,
        local: true,
        previewOnly: false,
        direction,
      },
      currentScope
    );

    nodes.push({
      id: node.id,
      viewId: node.id,
      refNodeId: node.refNodeId,
      rootContainer: node.refNodeId === agent.brain.rootContainerId,
      label: node.label,
      kind: node.kind,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      parentId: navigationPath.at(-1) ?? null,
      detail: createNodeDetail(node, childCount, runtimeInstalledLeafCount),
      editable: leaf,
      navigable: isContainerNode(node),
      leaf,
      proxy: false,
      movable: currentScope === 'child',
      local: true,
      previewOnly: false,
      direction,
      connectableSource: capabilities.canSource,
      connectableTarget: capabilities.canTarget,
      expanded,
      expansionParentId: null,
      expansionOffsetX: 0,
      expansionOffsetY: 0,
      runtimeInstalled: runtimeInstalledLeafCount > 0,
      runtimeInstalledLeafCount,
      adapterNavigable: node.kind !== 'adapter' || node.id === BODY_INPUTS_GROUP_ID || node.id === BODY_OUTPUTS_GROUP_ID,
    });

    if (!expanded || !isContainerNode(node)) {
      continue;
    }

    const childOffset = getExpandedChildOffset(groupChildren, agent);

    for (const [childIndex, child] of groupChildren.entries()) {
      const childLayoutPosition = agent.layout?.nodes[getLayoutNodeKey(child)]?.position;
      const childPosition = childLayoutPosition ?? getDefaultExpandedChildPosition(child, childIndex);
      const size = getStoredNodeSize(child);
      const direction = getNodeDirection(child);
      const leaf = isLeafNode(child);
      const capabilities = getGraphLinkCapabilities(
        {
          refNodeId: child.id,
          kind: child.kind,
          leaf,
          proxy: false,
          local: true,
          previewOnly: currentScope === 'root',
          direction,
        },
        currentScope
      );

      nodes.push({
        id: child.id,
        viewId: `${node.id}::${child.id}`,
        refNodeId: child.refNodeId,
        rootContainer: false,
        label: child.label,
        kind: child.kind,
        x: position.x + childPosition.x + childOffset.x,
        y: position.y + childPosition.y + childOffset.y,
        width: size.width,
        height: size.height,
        parentId: node.id,
        detail: createNodeDetail(child, 0, 0),
        editable: leaf,
        navigable: isContainerNode(child),
        leaf,
        proxy: false,
        movable: false,
        local: true,
        previewOnly: currentScope === 'root',
        direction,
        connectableSource: capabilities.canSource,
        connectableTarget: capabilities.canTarget,
        expanded: false,
        expansionParentId: node.id,
        expansionOffsetX: AGENT_GRAPH_EXPANDED_GROUP_PADDING,
        expansionOffsetY: AGENT_GRAPH_EXPANDED_GROUP_PADDING,
        runtimeInstalled: false,
        runtimeInstalledLeafCount: 0,
        adapterNavigable: false,
      });
    }
  }

  const viewNodeByViewId = new Map<string, GraphViewNode>();
  const visibleNodeByRefId = new Map<string, GraphViewNode>();
  for (const node of nodes) {
    viewNodeByViewId.set(node.viewId, node);
    if (!visibleNodeByRefId.has(node.refNodeId)) {
      visibleNodeByRefId.set(node.refNodeId, node);
    }
  }
  const localLeafIds = new Set(nodes.filter((node) => node.local && node.leaf && !node.proxy).map((node) => node.refNodeId));
  const nodeIdsInView = new Set(nodes.map((node) => node.id));
  const viewConnectionById = new Map(containerConnections.map((connection) => [connection.id, connection]));
  const links: GraphViewLink[] = [...aggregateLinks, ...boundaryAggregateLinks]
    .filter((link) => nodeIdsInView.has(link.fromNodeId) && nodeIdsInView.has(link.toNodeId))
    .map((link) => {
      const fromViewNode = visibleNodeByRefId.get(link.fromNodeId);
      const toViewNode = visibleNodeByRefId.get(link.toNodeId);
      const isDirectLeafLink = link.count === 1 && Boolean(fromViewNode?.leaf && toViewNode?.leaf);
      const connectionId = link.leafLinkIds[0] ?? `aggregate:${link.fromNodeId}:${link.toNodeId}`;
      const synapseSummary: GraphViewSynapseSummary = {
        synapseModelIds: [...link.synapseModelIds],
        resolvedWeightCount: link.resolvedWeightCount,
        unresolvedWeightCount: link.unresolvedWeightCount,
        resolvedWeightTotal: link.totalWeight,
      };
      const connection = isDirectLeafLink
        ? viewConnectionById.get(connectionId)
        : null;

      if (isDirectLeafLink && connection) {
        const synapseInfo = synapseInfoByConnectionId.get(connection.id) ?? null;
        const effectiveWeight = synapseInfo?.effectiveWeight ?? null;
        const resolvedWeight = effectiveWeight ?? FALLBACK_WEIGHT_VALUE;
        return {
          id: connection.id,
          fromNodeId: fromViewNode?.viewId ?? link.fromNodeId,
          toNodeId: toViewNode?.viewId ?? link.toNodeId,
          fromRefNodeId: connection.from.nodeId,
          toRefNodeId: connection.to.nodeId,
          weight: resolvedWeight,
          weightDisplay: formatWeightDisplay(effectiveWeight),
          count: 1,
          aggregate: false,
          leafLinkIds: [connection.id],
          inspectable: true,
          editable: true,
          synapse: synapseInfo,
          synapseSummary: {
            synapseModelIds: synapseInfo?.synapseModelId ? [synapseInfo.synapseModelId] : [],
            resolvedWeightCount: effectiveWeight == null ? 0 : 1,
            unresolvedWeightCount: effectiveWeight == null ? 1 : 0,
            resolvedWeightTotal: effectiveWeight ?? FALLBACK_WEIGHT_VALUE,
          },
        };
      }

      return {
        id: `aggregate:${link.fromNodeId}:${link.toNodeId}`,
        fromNodeId: link.fromNodeId,
        toNodeId: link.toNodeId,
        fromRefNodeId: visibleNodeByRefId.get(link.fromNodeId)?.refNodeId ?? link.fromNodeId,
        toRefNodeId: visibleNodeByRefId.get(link.toNodeId)?.refNodeId ?? link.toNodeId,
        weight: link.totalWeight,
        weightDisplay: formatWeightDisplay(link.totalWeight),
        count: link.count,
        aggregate: true,
        leafLinkIds: [...link.leafLinkIds],
        inspectable: true,
        editable: false,
        synapse: null,
        synapseSummary,
      };
    });

  const activeViewNodeIds = new Set<string>();
  for (const node of nodes) {
    if (node.leaf && runtimeActiveNodeIds.includes(node.refNodeId)) {
      activeViewNodeIds.add(node.viewId);
      continue;
    }

    if (!node.leaf) {
      const descendantActive = runtimeActiveNodeIds.some((activeNodeId) => {
        const path = indexes.pathById.get(activeNodeId) ?? [];
        return path.includes(node.id) || path.includes(node.refNodeId);
      });
      if (descendantActive) {
        activeViewNodeIds.add(node.viewId);
      }
    }
  }

  return {
    indexes,
    breadcrumbs,
    currentContainer,
    currentChildren,
    currentScope,
    currentContainerKind,
    scopeKey,
    localLeafIds,
    nodes,
    viewNodeByViewId,
    visibleNodeByRefId,
    links,
    activeViewNodeIds,
  };
};
