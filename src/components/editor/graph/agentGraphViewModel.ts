import type {
  AgentConnection,
  AgentConnectionEndpoint,
  AgentIR,
  BrainContainerNode,
  BrainNeuronNode,
} from '../../../domain/brain';
import type { ModelDefinition } from '../../../domain/brain/ir';
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
  AGENT_GRAPH_ROOT_BRAIN_GROUP_ID,
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
  containerById: Map<string, BrainContainerNode>;
  parentContainerIdByNodeId: Map<string, string>;
  linkById: Map<string, AgentConnection>;
  endpointByViewNodeId: Map<string, AgentConnectionEndpoint>;
}

export interface AgentGraphViewModel
  extends GraphViewModel<AgentGraphViewNodeRecord, BrainContainerNode | { id: 'root'; children: AgentGraphViewNodeRecord[] }> {
  indexes: AgentGraphViewIndexes;
}

const ROOT_FALLBACK_LAYOUT: Record<string, Position> = {
  'input-adapter': { x: 24, y: 180 },
  'core-neuron-group': { x: 334, y: 200 },
  'output-adapter': { x: 644, y: 200 },
};

const DEFAULT_MODELS: ModelDefinition[] = [];

const BODY_INPUTS_GROUP_ID = 'input-adapter';
const BODY_OUTPUTS_GROUP_ID = 'output-adapter';
const ROOT_BRAIN_GROUP_ID = AGENT_GRAPH_ROOT_BRAIN_GROUP_ID;
type RootContainerView = { id: 'root'; children: AgentGraphViewNodeRecord[] };
type AggregateLinkView = {
  fromNodeId: string;
  toNodeId: string;
  leafLinkIds: string[];
  count: number;
  totalWeight: number;
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
    return node.id === BODY_OUTPUTS_GROUP_ID ? 'output' : 'input';
  }

  return 'internal';
};

const createNodeDetail = (node: AgentGraphViewNodeRecord, childCount: number): string => {
  if (node.kind === 'adapter') {
    return `${childCount} signals`;
  }

  if (node.kind === 'neuron-group') {
    return `${childCount} leaf nodes`;
  }

  if (node.kind === 'signal') {
    return node.endpoint?.scope === 'bodyInput' ? 'input' : 'output';
  }

  return 'neuron';
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
  agent: AgentIR,
  draftNodePositions: NodePositionDraftMap
): Position => {
  if (groupChildren.length === 0) {
    return { x: 0, y: 0 };
  }

  const minX = Math.min(
    ...groupChildren.map((child, index) => {
      const position =
        draftNodePositions[child.refNodeId] ??
        draftNodePositions[child.id] ??
        agent.layout?.nodes[getLayoutNodeKey(child)]?.position ??
        getDefaultExpandedChildPosition(child, index);
      return position.x;
    })
  );
  const minY = Math.min(
    ...groupChildren.map((child, index) => {
      const position =
        draftNodePositions[child.refNodeId] ??
        draftNodePositions[child.id] ??
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
  agent: AgentIR,
  draftNodePositions: NodePositionDraftMap
) => {
  if (groupChildren.length === 0) {
    return AGENT_GRAPH_EXPANDED_GROUP_MIN_SIZE;
  }

  const offset = getExpandedChildOffset(groupChildren, agent, draftNodePositions);
  const maxRight = Math.max(
    ...groupChildren.map((child, index) => {
      const position =
        draftNodePositions[child.refNodeId] ??
        draftNodePositions[child.id] ??
        agent.layout?.nodes[getLayoutNodeKey(child)]?.position ??
        getDefaultExpandedChildPosition(child, index);
      const size = getStoredNodeSize(child);
      return position.x + offset.x + size.width;
    })
  );
  const maxBottom = Math.max(
    ...groupChildren.map((child, index) => {
      const position =
        draftNodePositions[child.refNodeId] ??
        draftNodePositions[child.id] ??
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

const collectBodyEndpointIds = (agent: AgentIR, scope: 'bodyInput' | 'bodyOutput'): string[] => {
  const endpointIds = new Set<string>();
  for (const connection of agent.connections) {
    const endpoint = connection.from.scope === scope ? connection.from : connection.to.scope === scope ? connection.to : null;
    if (endpoint) {
      endpointIds.add(endpoint.nodeId);
    }
  }
  return [...endpointIds].sort();
};

const getPathPrefixForContainer = (containerId: string, rootContainerId: string) =>
  containerId === rootContainerId ? [ROOT_BRAIN_GROUP_ID] : [containerId];

const buildIndexes = (agent: AgentIR): AgentGraphViewIndexes => {
  const pathById = new Map<string, string[]>();
  const nodeById = new Map<string, AgentGraphViewNodeRecord>();
  const containerById = new Map(agent.brain.containers.map((container) => [container.id, container]));
  const parentContainerIdByNodeId = new Map<string, string>();
  const linkById = new Map(agent.connections.map((connection) => [connection.id, connection]));
  const endpointByViewNodeId = new Map<string, AgentConnectionEndpoint>();

  const bodyInputIds = collectBodyEndpointIds(agent, 'bodyInput');
  const bodyOutputIds = collectBodyEndpointIds(agent, 'bodyOutput');

  const rootChildren: AgentGraphViewNodeRecord[] = [];

  if (bodyInputIds.length > 0) {
    rootChildren.push({
      id: BODY_INPUTS_GROUP_ID,
      refNodeId: BODY_INPUTS_GROUP_ID,
      kind: 'adapter',
      label: 'Inputs',
    });
  }

  const rootContainer = containerById.get(agent.brain.rootContainerId);
  if (rootContainer) {
    rootChildren.push({
      id: ROOT_BRAIN_GROUP_ID,
      refNodeId: rootContainer.id,
      kind: 'neuron-group',
      label: rootContainer.label ?? rootContainer.id,
      container: rootContainer,
    });
  }

  if (bodyOutputIds.length > 0) {
    rootChildren.push({
      id: BODY_OUTPUTS_GROUP_ID,
      refNodeId: BODY_OUTPUTS_GROUP_ID,
      kind: 'adapter',
      label: 'Outputs',
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

    for (const childRef of container.children) {
      if (childRef.scope === 'brain') {
        const neuron = agent.brain.neurons.find((entry) => entry.id === childRef.nodeId);
        if (!neuron) {
          continue;
        }

        const record: AgentGraphViewNodeRecord = {
          id: neuron.id,
          refNodeId: neuron.id,
          kind: 'neuron',
          label: neuron.label,
          neuron,
        };
        const nextTrail = [...trail, neuron.id];
        pathById.set(neuron.id, nextTrail);
        nodeById.set(neuron.id, record);
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
      pathById.set(childContainer.id, nextTrail);
      nodeById.set(childContainer.id, record);
      parentContainerIdByNodeId.set(childContainer.id, containerId);
      visitContainer(childContainer.id, nextTrail);
    }
  };

  if (rootContainer) {
    visitContainer(rootContainer.id, getPathPrefixForContainer(rootContainer.id, agent.brain.rootContainerId));
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
    containerById,
    parentContainerIdByNodeId,
    linkById,
    endpointByViewNodeId,
  };
};

const collectLeafIds = (
  node: AgentGraphViewNodeRecord,
  indexes: AgentGraphViewIndexes
): Set<string> => {
  const leafIds = new Set<string>();

  const visit = (candidate: AgentGraphViewNodeRecord) => {
    if (isLeafNode(candidate)) {
      leafIds.add(candidate.refNodeId);
      return;
    }

    if (candidate.kind === 'adapter') {
      for (const child of indexes.nodeById.values()) {
        if (indexes.parentContainerIdByNodeId.get(child.id) === candidate.id) {
          visit(child);
        }
      }
      return;
    }

    const container = candidate.container ?? indexes.containerById.get(candidate.refNodeId);
    if (!container) {
      return;
    }

    for (const childRef of container.children) {
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
    const current = aggregateMap.get(key);
    if (current) {
      current.leafLinkIds.push(connection.id);
      current.count += 1;
      current.totalWeight += connection.weight;
      continue;
    }

    aggregateMap.set(key, {
      fromNodeId,
      toNodeId,
      leafLinkIds: [connection.id],
      count: 1,
      totalWeight: connection.weight,
    });
  }

  return [...aggregateMap.values()];
};

const getCurrentChildren = (
  indexes: AgentGraphViewIndexes,
  navigationPath: string[]
): { currentContainer: RootContainerView | BrainContainerNode; currentChildren: AgentGraphViewNodeRecord[]; currentContainerKind: 'root' | 'adapter' | 'neuron-group' } => {
  if (navigationPath.length === 0) {
    const currentChildren = [BODY_INPUTS_GROUP_ID, ROOT_BRAIN_GROUP_ID, BODY_OUTPUTS_GROUP_ID]
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
    return {
      currentContainer: { id: 'root', children: [] },
      currentChildren: [],
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
    return {
      currentContainer: { id: 'root', children: [] },
      currentChildren: [],
      currentContainerKind: 'neuron-group',
    };
  }

  const currentChildren = container.children
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
}: {
  agent: AgentIR;
  navigationPath: string[];
  draftNodePositions: NodePositionDraftMap;
  runtimeActiveNodeIds: string[];
}): AgentGraphViewModel => {
  const indexes = buildIndexes(agent);
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
  const expandedContainerIds = new Set(
    currentChildren
      .filter((node) => node.kind === 'neuron-group' && agent.layout?.nodes[getLayoutNodeKey(node)]?.collapsed === false)
      .map((node) => node.id)
  );
  const aggregateLinks = collectAggregateLinks(containerConnections, indexes.pathById, currentPath, expandedContainerIds);

  for (const [index, node] of currentChildren.entries()) {
    const position = getLayoutPosition(agent, node, index, currentScope, draftNodePositions);
    const expanded = node.kind === 'neuron-group' && agent.layout?.nodes[getLayoutNodeKey(node)]?.collapsed === false;
    const groupChildren = node.container?.children
      .map((childRef) => indexes.nodeById.get(childRef.nodeId))
      .filter((child): child is AgentGraphViewNodeRecord => child != null) ?? [];
    const size = expanded ? getExpandedGroupSize(groupChildren, agent, draftNodePositions) : getNodeSize(node);
    const childCount =
      node.kind === 'neuron-group'
        ? node.container?.children.length ?? 0
        : [...indexes.nodeById.values()].filter((child) => indexes.parentContainerIdByNodeId.get(child.id) === node.id).length;
    const direction = getNodeDirection(node);
    const leaf = isLeafNode(node);
    const capabilities = getGraphLinkCapabilities(
      {
        refNodeId: node.id,
        kind: node.kind,
        leaf,
        proxy: false,
        local: true,
        direction,
      },
      currentScope
    );

    nodes.push({
      id: node.id,
      viewId: node.id,
      refNodeId: node.refNodeId,
      label: node.label,
      kind: node.kind,
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      parentId: navigationPath.at(-1) ?? null,
      detail: createNodeDetail(node, childCount),
      editable: leaf,
      navigable: isContainerNode(node),
      leaf,
      proxy: false,
      movable: true,
      local: true,
      direction,
      connectableSource: capabilities.canSource,
      connectableTarget: capabilities.canTarget,
      expanded,
      expansionParentId: null,
      expansionOffsetX: 0,
      expansionOffsetY: 0,
    });

    if (!expanded || node.kind !== 'neuron-group') {
      continue;
    }

    const childOffset = getExpandedChildOffset(groupChildren, agent, draftNodePositions);

    for (const [childIndex, child] of groupChildren.entries()) {
      const childLayoutPosition =
        draftNodePositions[child.refNodeId] ??
        draftNodePositions[child.id] ??
        agent.layout?.nodes[getLayoutNodeKey(child)]?.position;
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
          direction,
        },
        currentScope
      );

      nodes.push({
        id: child.id,
        viewId: `${node.id}::${child.id}`,
        refNodeId: child.refNodeId,
        label: child.label,
        kind: child.kind,
        x: position.x + childPosition.x + childOffset.x,
        y: position.y + childPosition.y + childOffset.y,
        width: size.width,
        height: size.height,
        parentId: node.id,
        detail: createNodeDetail(child, 0),
        editable: leaf,
        navigable: isContainerNode(child),
        leaf,
        proxy: false,
        movable: true,
        local: true,
        direction,
        connectableSource: capabilities.canSource,
        connectableTarget: capabilities.canTarget,
        expanded: false,
        expansionParentId: node.id,
        expansionOffsetX: AGENT_GRAPH_EXPANDED_GROUP_PADDING,
        expansionOffsetY: AGENT_GRAPH_EXPANDED_GROUP_PADDING,
      });
    }
  }

  const viewNodeById = new Map<string, GraphViewNode>();
  for (const node of nodes) {
    viewNodeById.set(node.id, node);
    viewNodeById.set(node.viewId, node);
  }
  const localLeafIds = new Set(nodes.filter((node) => node.local && node.leaf && !node.proxy).map((node) => node.refNodeId));
  const nodeIdsInView = new Set(nodes.map((node) => node.id));
  const links: GraphViewLink[] = aggregateLinks
    .filter((link) => nodeIdsInView.has(link.fromNodeId) && nodeIdsInView.has(link.toNodeId))
    .map((link) => {
      const fromViewNode = viewNodeById.get(link.fromNodeId);
      const toViewNode = viewNodeById.get(link.toNodeId);
      const isDirectLeafLink = link.count === 1 && Boolean(fromViewNode?.leaf && toViewNode?.leaf);
      const connectionId = link.leafLinkIds[0] ?? `aggregate:${link.fromNodeId}:${link.toNodeId}`;
      const connection = isDirectLeafLink
        ? containerConnections.find((candidate) => candidate.id === connectionId)
        : null;

      if (isDirectLeafLink && connection) {
        return {
          id: connection.id,
          fromNodeId: fromViewNode?.viewId ?? link.fromNodeId,
          toNodeId: toViewNode?.viewId ?? link.toNodeId,
          weight: connection.weight,
          count: 1,
          aggregate: false,
          leafLinkIds: [connection.id],
          editable: true,
        };
      }

      return {
        id: `aggregate:${link.fromNodeId}:${link.toNodeId}`,
        fromNodeId: link.fromNodeId,
        toNodeId: link.toNodeId,
        weight: link.totalWeight,
        count: link.count,
        aggregate: true,
        leafLinkIds: [...link.leafLinkIds],
        editable: false,
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
    viewNodeById,
    links,
    activeViewNodeIds,
    modelById: new Map(DEFAULT_MODELS.map((model) => [model.id, model])),
  };
};
