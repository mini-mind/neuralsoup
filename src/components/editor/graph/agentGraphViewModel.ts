import type {
  AgentConnection,
  AgentConnectionEndpoint,
  AgentIR,
  AgentIRSummary,
  BodyInputEndpointIR,
  BodyOutputEndpointIR,
  BrainContainerNode,
  BrainNeuronNode,
  BrainStructuralPreflight,
  SynapseModelIR,
  WorldRegistry,
} from '../../../domain/brain';
import {
  collectAgentSignalNodeIds,
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
  kind: 'neuron-group' | 'neuron' | 'signal';
  label: string;
  endpoint?: AgentConnectionEndpoint &
    Partial<BodyInputEndpointIR> &
    Partial<BodyOutputEndpointIR> & {
      endpointId?: string;
    };
  neuron?: BrainNeuronNode;
  container?: BrainContainerNode;
}

export interface AgentGraphViewIndexes extends GraphTopologyIndexes<AgentGraphViewNodeRecord> {
  structuralPreflight: BrainStructuralPreflight;
  containerById: Map<string, BrainContainerNode>;
  childRefsByContainerId: Map<string, Array<{ scope: 'brain' | 'signal' | 'container'; nodeId: string }>>;
  parentContainerIdByNodeId: Map<string, string>;
  linkById: Map<string, AgentConnection>;
  endpointByViewNodeId: Map<string, NonNullable<AgentGraphViewNodeRecord['endpoint']>>;
  bodyInputNodeIds: string[];
  bodyOutputNodeIds: string[];
  rootNodeIds: string[];
}

export interface AgentGraphViewModel
  extends GraphViewModel<AgentGraphViewNodeRecord, BrainContainerNode | { id: 'root'; children: AgentGraphViewNodeRecord[] }> {
  indexes: AgentGraphViewIndexes;
}

const ROOT_FALLBACK_LAYOUT: Record<string, Position> = {
  [AGENT_GRAPH_ROOT_CONTAINER_TEST_ID]: { x: 300, y: 200 },
};

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

const isContainerNode = (node: AgentGraphViewNodeRecord) => node.kind === 'neuron-group';
const isExpandedChildViewNode = (node: GraphViewNode) => node.expansionParentId != null;

const isSignalContainerChildRef = (childRef: { scope: 'brain' | 'signal' | 'container'; nodeId: string }) =>
  childRef.scope === 'signal';

const getContainerChildRecords = (
  node: AgentGraphViewNodeRecord,
  indexes: AgentGraphViewIndexes
): AgentGraphViewNodeRecord[] => {
  const containerId = node.container?.id ?? node.refNodeId;
  return (indexes.childRefsByContainerId.get(containerId) ?? [])
    .map((childRef) => indexes.nodeById.get(childRef.nodeId))
    .filter((child): child is AgentGraphViewNodeRecord => child != null);
};

const getUnownedSignalRecords = (indexes: AgentGraphViewIndexes): AgentGraphViewNodeRecord[] =>
  [...indexes.bodyInputNodeIds, ...indexes.bodyOutputNodeIds]
    .filter((nodeId) => !indexes.parentContainerIdByNodeId.has(nodeId))
    .map((nodeId) => indexes.nodeById.get(nodeId))
    .filter((node): node is AgentGraphViewNodeRecord => node != null);

const mergeDistinctNodeRecords = (...groups: AgentGraphViewNodeRecord[][]): AgentGraphViewNodeRecord[] => {
  const merged: AgentGraphViewNodeRecord[] = [];
  const seenIds = new Set<string>();
  for (const group of groups) {
    for (const node of group) {
      if (seenIds.has(node.id)) {
        continue;
      }
      seenIds.add(node.id);
      merged.push(node);
    }
  }
  return merged;
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

  return 'internal';
};

const createNodeDetail = (
  node: AgentGraphViewNodeRecord,
  childCount: number,
  runtimeInstalledLeafCount: number
): string => {
  if (node.kind === 'neuron-group') {
    return `${childCount} leaf nodes`;
  }

  if (node.kind === 'signal') {
    const direction = node.endpoint?.scope === 'bodyInput' ? 'input' : 'output';
    return runtimeInstalledLeafCount > 0 ? `${direction} / installed` : `${direction} / canonical-only`;
  }

  return 'neuron';
};

const createSignalRecord = (
  nodeId: string,
  direction: 'input' | 'output',
  inputEndpointByNodeId: Map<string, BodyInputEndpointIR>,
  inputEndpointIdByNodeId: Map<string, string>,
  outputEndpointByNodeId: Map<string, BodyOutputEndpointIR>,
  outputEndpointIdByNodeId: Map<string, string>
): AgentGraphViewNodeRecord => {
  if (direction === 'input') {
    const endpoint = inputEndpointByNodeId.get(nodeId);
    const endpointId = inputEndpointIdByNodeId.get(nodeId);
    return {
      id: nodeId,
      refNodeId: nodeId,
      kind: 'signal',
      label: nodeId,
      endpoint: {
        scope: 'bodyInput',
        nodeId,
        ...(endpoint ?? {}),
        ...(endpointId ? { endpointId } : {}),
      },
    };
  }

  const endpoint = outputEndpointByNodeId.get(nodeId);
  const endpointId = outputEndpointIdByNodeId.get(nodeId);
  return {
    id: nodeId,
    refNodeId: nodeId,
    kind: 'signal',
    label: nodeId,
    endpoint: {
      scope: 'bodyOutput',
      nodeId,
      ...(endpoint ?? {}),
      ...(endpointId ? { endpointId } : {}),
    },
  };
};

const getDefaultStoredPosition = (node: AgentGraphViewNodeRecord, index: number, scope: 'root' | 'child'): Position => {
  if (scope === 'root' && ROOT_FALLBACK_LAYOUT[node.id]) {
    return ROOT_FALLBACK_LAYOUT[node.id];
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
  const endpointByViewNodeId = new Map<string, NonNullable<AgentGraphViewNodeRecord['endpoint']>>();
  const inputEndpointById = new Map(agent.body.inputEndpoints.map((endpoint) => [endpoint.id, endpoint]));
  const outputEndpointById = new Map(agent.body.outputEndpoints.map((endpoint) => [endpoint.id, endpoint]));
  const inputEndpointByNodeId = new Map<string, BodyInputEndpointIR>();
  const inputEndpointIdByNodeId = new Map<string, string>();
  const outputEndpointByNodeId = new Map<string, BodyOutputEndpointIR>();
  const outputEndpointIdByNodeId = new Map<string, string>();

  const { bodyInputNodeIds: bodyInputIds, bodyOutputNodeIds: bodyOutputIds } = resolveAgentBodyEndpointIds(
    agent,
    worldRegistry,
    projectedVisionCellCount
  );

  for (const mapping of agent.body.mappings) {
    if (mapping.kind === 'input') {
      const endpoint = inputEndpointById.get(mapping.endpointId);
      if (endpoint) {
        inputEndpointByNodeId.set(mapping.nodeId, endpoint);
        inputEndpointIdByNodeId.set(mapping.nodeId, mapping.endpointId);
      }
      continue;
    }

    const endpoint = outputEndpointById.get(mapping.endpointId);
    if (endpoint) {
      outputEndpointByNodeId.set(mapping.nodeId, endpoint);
      outputEndpointIdByNodeId.set(mapping.nodeId, mapping.endpointId);
    }
  }

  const rootChildren: AgentGraphViewNodeRecord[] = [];
  const rootContainer = structuralPreflight.rootContainer;

  if (rootContainer) {
    const rootContainerRecord: AgentGraphViewNodeRecord = {
      id: rootContainer.id,
      refNodeId: rootContainer.id,
      kind: 'neuron-group',
      label: rootContainer.label ?? rootContainer.id,
      container: rootContainer,
    };
    pathById.set(rootContainer.id, [rootContainer.id]);
    nodeById.set(rootContainer.id, rootContainerRecord);
    const rootContainerChildren = structuralPreflight.childRefsByContainerId.get(rootContainer.id) ?? [];
    for (const childRef of rootContainerChildren) {
      if (childRef.scope === 'brain') {
        const neuron = structuralPreflight.neuronById.get(childRef.nodeId);
        if (!neuron) {
          continue;
        }
        rootChildren.push({
          id: neuron.id,
          refNodeId: neuron.id,
          kind: 'neuron',
          label: neuron.label ?? neuron.id,
          neuron,
        });
        continue;
      }

      if (isSignalContainerChildRef(childRef)) {
        rootChildren.push(
          createSignalRecord(
            childRef.nodeId,
            bodyInputIds.includes(childRef.nodeId) ? 'input' : 'output',
            inputEndpointByNodeId,
            inputEndpointIdByNodeId,
            outputEndpointByNodeId,
            outputEndpointIdByNodeId
          )
        );
        continue;
      }

      const childContainer = containerById.get(childRef.nodeId);
      if (!childContainer) {
        continue;
      }

      rootChildren.push({
        id: childContainer.id,
        refNodeId: childContainer.id,
        kind: 'neuron-group',
        label: childContainer.label ?? childContainer.id,
        container: childContainer,
      });
    }
  }

  for (const child of rootChildren) {
    pathById.set(child.id, [child.id]);
    if (child.refNodeId !== child.id) {
      pathById.set(child.refNodeId, [child.id]);
    }
    nodeById.set(child.id, child);
    if (child.endpoint) {
      endpointByViewNodeId.set(child.id, child.endpoint);
    }
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

      if (isSignalContainerChildRef(childRef)) {
        const record = createSignalRecord(
          childRef.nodeId,
          bodyInputIds.includes(childRef.nodeId) ? 'input' : 'output',
          inputEndpointByNodeId,
          inputEndpointIdByNodeId,
          outputEndpointByNodeId,
          outputEndpointIdByNodeId
        );
        const nextTrail = [...trail, childRef.nodeId];
        if (!pathById.has(childRef.nodeId)) {
          pathById.set(childRef.nodeId, nextTrail);
        }
        if (!nodeById.has(childRef.nodeId)) {
          nodeById.set(childRef.nodeId, record);
        }
        if (record.endpoint) {
          endpointByViewNodeId.set(childRef.nodeId, record.endpoint);
        }
        parentContainerIdByNodeId.set(childRef.nodeId, containerId);
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
    visitContainer(rootContainer.id, []);
  }

  for (const nodeId of bodyInputIds) {
    const record = createSignalRecord(
      nodeId,
      'input',
      inputEndpointByNodeId,
      inputEndpointIdByNodeId,
      outputEndpointByNodeId,
      outputEndpointIdByNodeId
    );
    if (!pathById.has(nodeId)) {
      pathById.set(nodeId, [nodeId]);
    }
    if (!nodeById.has(nodeId)) {
      nodeById.set(nodeId, record);
    }
    if (record.endpoint) {
      endpointByViewNodeId.set(nodeId, record.endpoint);
    }
  }

  for (const nodeId of bodyOutputIds) {
    const record = createSignalRecord(
      nodeId,
      'output',
      inputEndpointByNodeId,
      inputEndpointIdByNodeId,
      outputEndpointByNodeId,
      outputEndpointIdByNodeId
    );
    if (!pathById.has(nodeId)) {
      pathById.set(nodeId, [nodeId]);
    }
    if (!nodeById.has(nodeId)) {
      nodeById.set(nodeId, record);
    }
    if (record.endpoint) {
      endpointByViewNodeId.set(nodeId, record.endpoint);
    }
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

const getCurrentChildren = (
  indexes: AgentGraphViewIndexes,
  navigationPath: string[],
  rootContainerId: string
): { currentContainer: RootContainerView | BrainContainerNode; currentChildren: AgentGraphViewNodeRecord[]; currentContainerKind: 'root' | 'neuron-group' } => {
  const rootContainer = indexes.containerById.get(rootContainerId) ?? null;
  if (navigationPath.length === 0 || (navigationPath.length === 1 && navigationPath[0] === rootContainerId)) {
    const currentChildren = mergeDistinctNodeRecords(
      indexes.rootNodeIds
        .map((nodeId) => indexes.nodeById.get(nodeId))
        .filter((node): node is AgentGraphViewNodeRecord => node != null),
      getUnownedSignalRecords(indexes)
    );
    if (rootContainer) {
      return {
        currentContainer: rootContainer,
        currentChildren,
        currentContainerKind: 'neuron-group',
      };
    }
    return {
      currentContainer: { id: 'root', children: currentChildren },
      currentChildren,
      currentContainerKind: 'root',
    };
  }

  const currentNodeId = navigationPath[navigationPath.length - 1]!;
  const currentNode = indexes.nodeById.get(currentNodeId);
  if (!currentNode) {
    const fallbackChildren = mergeDistinctNodeRecords(
      indexes.rootNodeIds
        .map((nodeId) => indexes.nodeById.get(nodeId))
        .filter((node): node is AgentGraphViewNodeRecord => node != null),
      getUnownedSignalRecords(indexes)
    );
    return {
      currentContainer: { id: 'root', children: fallbackChildren },
      currentChildren: fallbackChildren,
      currentContainerKind: 'root',
    };
  }

  const container = currentNode.container ?? indexes.containerById.get(currentNode.refNodeId);
  if (!container) {
    const fallbackChildren = mergeDistinctNodeRecords(
      indexes.rootNodeIds
        .map((nodeId) => indexes.nodeById.get(nodeId))
        .filter((node): node is AgentGraphViewNodeRecord => node != null),
      getUnownedSignalRecords(indexes)
    );
    return {
      currentContainer: { id: 'root', children: fallbackChildren },
      currentChildren: fallbackChildren,
      currentContainerKind: 'root',
    };
  }

  const currentChildren = (indexes.childRefsByContainerId.get(container.id) ?? [])
    .map((childRef) => indexes.nodeById.get(childRef.nodeId))
    .filter((node): node is AgentGraphViewNodeRecord => node != null);

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
  installedSummary: _installedSummary,
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
  const structuralPreflight = preflightBrainStructure(agent.brain, collectAgentSignalNodeIds(agent));
  const indexes = buildIndexes(agent, worldRegistry, structuralPreflight, projectedVisionCellCount);
  const normalizedNavigationPath =
    navigationPath.length === 1 && navigationPath[0] === agent.brain.rootContainerId ? [] : navigationPath;
  const compiledEndpointIds = resolveCompiledAgentBodyEndpointIds(agent, worldRegistry);
  const installedBodyInputNodeIds = new Set(compiledEndpointIds.bodyInputNodeIds);
  const installedBodyOutputNodeIds = new Set(compiledEndpointIds.bodyOutputNodeIds);
  const { currentContainer, currentChildren, currentContainerKind } = getCurrentChildren(
    indexes,
    navigationPath,
    agent.brain.rootContainerId
  );
  const currentScope = normalizedNavigationPath.length === 0 ? 'root' : 'child';
  const scopeKey = normalizedNavigationPath.length === 0 ? 'root' : normalizedNavigationPath.join('/');
  const breadcrumbs: GraphBreadcrumbItem[] = [{ id: 'root', label: 'root' }];

  for (const nodeId of normalizedNavigationPath) {
    const node = indexes.nodeById.get(nodeId);
    if (!node) {
      continue;
    }
    breadcrumbs.push({ id: node.refNodeId, label: node.label });
  }

  const nodes: GraphViewNode[] = [];
  const currentPath = normalizedNavigationPath;
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
  const boundaryAggregateLinks: AggregateLinkView[] = [];

  for (const [index, node] of currentChildren.entries()) {
    const position = getLayoutPosition(agent, node, index, currentScope, draftNodePositions);
    const expanded = isNodeExpanded(agent, node);
    const groupChildren = getContainerChildRecords(node, indexes);
    const size = expanded ? getExpandedGroupSize(groupChildren, agent) : getNodeSize(node);
    const childCount =
      groupChildren.length;
    const runtimeInstalledLeafCount =
      node.kind === 'signal'
        ? node.endpoint?.scope === 'bodyInput'
          ? (installedBodyInputNodeIds.has(node.refNodeId) ? 1 : 0)
          : (installedBodyOutputNodeIds.has(node.refNodeId) ? 1 : 0)
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
      parentId: normalizedNavigationPath.at(-1) ?? null,
      detail: createNodeDetail(node, childCount, runtimeInstalledLeafCount),
      editable: leaf,
      navigable: isContainerNode(node),
      leaf,
      proxy: false,
      movable: true,
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
          previewOnly: false,
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
        movable: currentScope === 'root',
        local: true,
        previewOnly: false,
        direction,
        connectableSource: capabilities.canSource,
        connectableTarget: capabilities.canTarget,
        expanded: false,
        expansionParentId: node.id,
        expansionOffsetX: AGENT_GRAPH_EXPANDED_GROUP_PADDING,
        expansionOffsetY: AGENT_GRAPH_EXPANDED_GROUP_PADDING,
        runtimeInstalled: false,
        runtimeInstalledLeafCount: 0,
      });
    }
  }

  const viewNodeByViewId = new Map<string, GraphViewNode>();
  const renderNodeByRefId = new Map<string, GraphViewNode>();
  for (const node of nodes) {
    viewNodeByViewId.set(node.viewId, node);
    const existingRenderNode = renderNodeByRefId.get(node.refNodeId);
    if (!existingRenderNode || (isExpandedChildViewNode(node) && !isExpandedChildViewNode(existingRenderNode))) {
      renderNodeByRefId.set(node.refNodeId, node);
    }
  }
  const localLeafIds = new Set(nodes.filter((node) => node.local && node.leaf && !node.proxy).map((node) => node.refNodeId));
  const nodeIdsInView = new Set(nodes.map((node) => node.id));
  const viewConnectionById = new Map(containerConnections.map((connection) => [connection.id, connection]));
  const links: GraphViewLink[] = [...aggregateLinks, ...boundaryAggregateLinks]
    .filter((link) => nodeIdsInView.has(link.fromNodeId) && nodeIdsInView.has(link.toNodeId))
    .map((link) => {
      const fromViewNode = renderNodeByRefId.get(link.fromNodeId);
      const toViewNode = renderNodeByRefId.get(link.toNodeId);
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
        fromRefNodeId: renderNodeByRefId.get(link.fromNodeId)?.refNodeId ?? link.fromNodeId,
        toRefNodeId: renderNodeByRefId.get(link.toNodeId)?.refNodeId ?? link.toNodeId,
        weight: link.totalWeight,
        weightDisplay: formatWeightDisplay(link.totalWeight),
        count: link.count,
        aggregate: true,
        leafLinkIds: [...link.leafLinkIds],
        inspectable: true,
        editable: true,
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
    links,
    activeViewNodeIds,
  };
};
