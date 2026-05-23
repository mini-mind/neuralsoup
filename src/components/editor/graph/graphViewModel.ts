import type {
  AdapterNode,
  AggregateLinkView,
  LeafLink,
  LiteralValue,
  ModelDefinition,
  NeuronGroupNode,
  NeuronNode,
  RootGraph,
  SignalNode,
  TopologyNode,
  GraphIRDocument,
} from '../../../domain/brain/ir';
import type { Position, IzhikevichNeuronParameters } from '../../../domain/brain/shared';
import { getGraphLinkCapabilities } from './graphLinkPolicy';
import type {
  GraphBreadcrumbItem,
  GraphTopologyIndexes,
  GraphViewLink,
  GraphViewModel,
  GraphViewNode,
  NodePositionDraftMap,
} from './graphViewTypes';

export const CHILD_SCOPE_OFFSET = {
  x: 260,
  y: 40,
} as const;

export const MIN_NODE_POSITION = 24;
export const LEAF_NODE_SIZE = 14;
export const GROUP_NODE_SIZE = {
  width: 188,
  height: 96,
} as const;
export const EXPANDED_GROUP_MIN_SIZE = {
  width: 300,
  height: 210,
} as const;
export const EXPANDED_GROUP_PADDING = 30;

const ROOT_FALLBACK_LAYOUT: Record<string, Position> = {
  'input-adapter': { x: MIN_NODE_POSITION, y: 180 },
  'core-neuron-group': { x: 334, y: 200 },
  'output-adapter': { x: 644, y: 200 },
};

const DEFAULT_NEURON_PARAMS: IzhikevichNeuronParameters = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
};

const isRecord = (value: LiteralValue | undefined): value is Record<string, LiteralValue> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const isLeafNode = (node: TopologyNode): node is NeuronNode | SignalNode =>
  node.kind === 'neuron' || node.kind === 'signal';

export const isContainerNode = (node: TopologyNode): node is AdapterNode | NeuronGroupNode =>
  node.kind === 'adapter' || node.kind === 'neuron-group';

const getModelById = (models: ModelDefinition[]) => new Map(models.map((model) => [model.id, model]));

const toFiniteNumber = (value: LiteralValue | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const getNeuronParameters = (node: NeuronNode): IzhikevichNeuronParameters => {
  const overrides = isRecord(node.parameterOverrides) ? node.parameterOverrides : undefined;

  return {
    a: toFiniteNumber(overrides?.a, DEFAULT_NEURON_PARAMS.a),
    b: toFiniteNumber(overrides?.b, DEFAULT_NEURON_PARAMS.b),
    c: toFiniteNumber(overrides?.c, DEFAULT_NEURON_PARAMS.c),
    d: toFiniteNumber(overrides?.d, DEFAULT_NEURON_PARAMS.d),
    threshold: toFiniteNumber(overrides?.threshold, DEFAULT_NEURON_PARAMS.threshold),
  };
};

const getNodeSize = (node: TopologyNode) =>
  isLeafNode(node)
    ? { width: LEAF_NODE_SIZE, height: LEAF_NODE_SIZE }
    : { width: GROUP_NODE_SIZE.width, height: GROUP_NODE_SIZE.height };

const getStoredNodeSize = (node: TopologyNode) =>
  isLeafNode(node)
    ? { width: LEAF_NODE_SIZE, height: LEAF_NODE_SIZE }
    : { width: GROUP_NODE_SIZE.width, height: GROUP_NODE_SIZE.height };

const isExpandedGroup = (node: TopologyNode): node is NeuronGroupNode =>
  node.kind === 'neuron-group' && node.collapsed === false;

const getDefaultExpandedChildPosition = (node: TopologyNode, index: number): Position => {
  if (isLeafNode(node)) {
    const column = index % 5;
    const row = Math.floor(index / 5);
    return {
      x: EXPANDED_GROUP_PADDING + column * 48,
      y: EXPANDED_GROUP_PADDING + row * 44,
    };
  }

  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: EXPANDED_GROUP_PADDING + column * 132,
    y: EXPANDED_GROUP_PADDING + row * 112,
  };
};

const getExpandedChildOffset = (group: NeuronGroupNode, draftNodePositions?: NodePositionDraftMap): Position => {
  if (group.children.length === 0) {
    return { x: 0, y: 0 };
  }

  const minX = Math.min(
    ...group.children.map((child, index) => {
      const position = draftNodePositions?.[child.id] ?? child.position ?? getDefaultExpandedChildPosition(child, index);
      return position.x;
    })
  );
  const minY = Math.min(
    ...group.children.map((child, index) => {
      const position = draftNodePositions?.[child.id] ?? child.position ?? getDefaultExpandedChildPosition(child, index);
      return position.y;
    })
  );

  return {
    x: minX < EXPANDED_GROUP_PADDING ? EXPANDED_GROUP_PADDING - minX : 0,
    y: minY < EXPANDED_GROUP_PADDING ? EXPANDED_GROUP_PADDING - minY : 0,
  };
};

const getExpandedGroupSize = (group: NeuronGroupNode) => {
  if (group.children.length === 0) {
    return EXPANDED_GROUP_MIN_SIZE;
  }

  const offset = getExpandedChildOffset(group);
  const maxRight = Math.max(
    ...group.children.map((child, index) => {
      const position = child.position ?? getDefaultExpandedChildPosition(child, index);
      const size = getStoredNodeSize(child);
      return position.x + offset.x + size.width;
    })
  );
  const maxBottom = Math.max(
    ...group.children.map((child, index) => {
      const position = child.position ?? getDefaultExpandedChildPosition(child, index);
      const size = getStoredNodeSize(child);
      return position.y + offset.y + size.height;
    })
  );

  return {
    width: Math.max(EXPANDED_GROUP_MIN_SIZE.width, maxRight + EXPANDED_GROUP_PADDING),
    height: Math.max(EXPANDED_GROUP_MIN_SIZE.height, maxBottom + EXPANDED_GROUP_PADDING),
  };
};

const getExpandedChildDisplayPosition = (
  group: NeuronGroupNode,
  child: TopologyNode,
  childIndex: number,
  draftNodePositions: NodePositionDraftMap
): Position => {
  const offset = getExpandedChildOffset(group, draftNodePositions);
  const childPosition = draftNodePositions[child.id] ?? child.position ?? getDefaultExpandedChildPosition(child, childIndex);

  return {
    x: childPosition.x + offset.x,
    y: childPosition.y + offset.y,
  };
};

const toViewPosition = (position: Position, scope: 'root' | 'child'): Position =>
  scope === 'child'
    ? {
        x: position.x + CHILD_SCOPE_OFFSET.x,
        y: position.y + CHILD_SCOPE_OFFSET.y,
      }
    : position;

const getDefaultStoredPosition = (node: TopologyNode, index: number, scope: 'root' | 'child'): Position => {
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

const getLayoutPosition = (node: TopologyNode, index: number, scope: 'root' | 'child'): Position =>
  toViewPosition(node.position ?? getDefaultStoredPosition(node, index, scope), scope);

export const collectNodePathById = (root: RootGraph): GraphTopologyIndexes<TopologyNode> => {
  const pathById = new Map<string, string[]>();
  const nodeById = new Map<string, TopologyNode>();

  const visit = (container: RootGraph | AdapterNode | NeuronGroupNode, trail: string[]) => {
    for (const child of container.children) {
      const nextTrail = [...trail, child.id];
      pathById.set(child.id, nextTrail);
      nodeById.set(child.id, child);
      if (isContainerNode(child)) {
        visit(child, nextTrail);
      }
    }
  };

  visit(root, []);
  return { pathById, nodeById };
};

export const getNodeByPath = (
  root: RootGraph,
  path: string[],
  nodeById: Map<string, TopologyNode>
): RootGraph | AdapterNode | NeuronGroupNode => {
  if (path.length === 0) {
    return root;
  }

  const candidate = nodeById.get(path[path.length - 1]);
  if (!candidate || !isContainerNode(candidate)) {
    return root;
  }

  return candidate;
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
  links: LeafLink[],
  pathById: Map<string, string[]>,
  currentPath: string[],
  expandedContainerIds: Set<string>
): AggregateLinkView[] => {
  const aggregateMap = new Map<string, AggregateLinkView>();

  for (const link of links) {
    const fromNodeId = getScopeNodeIdForLeaf(link.from.nodeId, pathById, currentPath, expandedContainerIds);
    const toNodeId = getScopeNodeIdForLeaf(link.to.nodeId, pathById, currentPath, expandedContainerIds);
    if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
      continue;
    }

    const key = `${fromNodeId}->${toNodeId}`;
    const current = aggregateMap.get(key);
    if (current) {
      current.leafLinkIds.push(link.id);
      current.count += 1;
      current.totalWeight += link.weight;
      continue;
    }

    aggregateMap.set(key, {
      fromNodeId,
      toNodeId,
      leafLinkIds: [link.id],
      count: 1,
      totalWeight: link.weight,
    });
  }

  return Array.from(aggregateMap.values());
};

const collectLeafIds = (children: TopologyNode[]): Set<string> => {
  const leafIds = new Set<string>();

  const visit = (nodes: TopologyNode[]) => {
    for (const node of nodes) {
      if (isLeafNode(node)) {
        leafIds.add(node.id);
        continue;
      }

      if (isContainerNode(node)) {
        visit(node.children);
      }
    }
  };

  visit(children);
  return leafIds;
};

const createNodeDetail = (node: TopologyNode): string => {
  if (node.kind === 'adapter') {
    return `${node.children.length} signals`;
  }

  if (node.kind === 'neuron-group') {
    const leafCount = node.children.filter(isLeafNode).length;
    return `${leafCount} leaf nodes`;
  }

  if (node.kind === 'signal') {
    return node.direction === 'input' ? 'input' : 'output';
  }

  return 'neuron';
};

const getNodeDirection = (node: TopologyNode): GraphViewNode['direction'] => {
  if (node.kind === 'signal') {
    return node.direction;
  }

  if (node.kind === 'adapter') {
    return node.adapterType === 'output' ? 'output' : 'input';
  }

  return 'internal';
};

export const buildLegacyGraphViewModel = ({
  document,
  navigationPath,
  draftNodePositions,
  runtimeActiveNodeIds,
}: {
  document: GraphIRDocument;
  navigationPath: string[];
  draftNodePositions: NodePositionDraftMap;
  runtimeActiveNodeIds: string[];
}): GraphViewModel<TopologyNode, RootGraph | AdapterNode | NeuronGroupNode> => {
  const getViewNodeId = (nodeId: string, parentViewId?: string | null) =>
    parentViewId ? `${parentViewId}::${nodeId}` : nodeId;
  const indexes = collectNodePathById(document.root);
  const currentContainer = getNodeByPath(document.root, navigationPath, indexes.nodeById);
  const currentChildren = currentContainer.children;
  const currentScope = navigationPath.length === 0 ? 'root' : 'child';
  const currentContainerKind = 'kind' in currentContainer ? currentContainer.kind : 'root';
  const scopeKey = navigationPath.length === 0 ? 'root' : navigationPath.join('/');
  const localLeafIds = new Set(currentChildren.filter(isLeafNode).map((node) => node.id));
  const containerLeafIds = collectLeafIds(currentChildren);
  const breadcrumbs: GraphBreadcrumbItem[] = [{ id: 'root', label: 'root' }];

  for (const nodeId of navigationPath) {
    const node = indexes.nodeById.get(nodeId);
    if (!node) {
      continue;
    }

    breadcrumbs.push({
      id: nodeId,
      label: node.label,
    });
  }

  const modelById = getModelById(document.models);
  const containerLinks = document.root.links.filter(
    (link) => containerLeafIds.has(link.from.nodeId) && containerLeafIds.has(link.to.nodeId)
  );
  const expandedContainerIds = new Set(currentChildren.filter(isExpandedGroup).map((node) => node.id));
  const aggregateLinks = collectAggregateLinks(containerLinks, indexes.pathById, navigationPath, expandedContainerIds);

  const nodes: GraphViewNode[] = [
    ...currentChildren.flatMap((node, index) => {
      const layoutPosition = getLayoutPosition(node, index, currentScope);
      const draftPosition = draftNodePositions[node.id];
      const position = draftPosition ? toViewPosition(draftPosition, currentScope) : layoutPosition;
      const expanded = isExpandedGroup(node);
      const size = expanded ? getExpandedGroupSize(node) : getNodeSize(node);
      const direction = getNodeDirection(node);
      const leaf = isLeafNode(node);

      const linkCapabilities = getGraphLinkCapabilities(
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

      const viewNode: GraphViewNode = {
        id: node.id,
        viewId: getViewNodeId(node.id),
        refNodeId: node.id,
        label: node.label,
        kind: node.kind,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        parentId: navigationPath.at(-1) ?? null,
        detail: createNodeDetail(node),
        editable: leaf,
        navigable: isContainerNode(node),
        leaf,
        proxy: false,
        movable: true,
        local: true,
        direction,
        connectableSource: linkCapabilities.canSource,
        connectableTarget: linkCapabilities.canTarget,
        expanded,
        expansionParentId: null,
        expansionOffsetX: 0,
        expansionOffsetY: 0,
      };

      if (!expanded) {
        return [viewNode];
      }

      return [
        viewNode,
        ...node.children.map((child, childIndex) => {
          const childStoredPosition = getExpandedChildDisplayPosition(node, child, childIndex, draftNodePositions);
          const childDisplayOffset = getExpandedChildOffset(node, draftNodePositions);
          const childSize = getStoredNodeSize(child);
          const childDirection = getNodeDirection(child);
          const childLeaf = isLeafNode(child);
          const childCapabilities = getGraphLinkCapabilities(
            {
              refNodeId: child.id,
              kind: child.kind,
              leaf: childLeaf,
              proxy: false,
              local: true,
              direction: childDirection,
            },
            currentScope
          );

          return {
            id: child.id,
            viewId: getViewNodeId(child.id, node.id),
            refNodeId: child.id,
            label: child.label,
            kind: child.kind,
            x: position.x + childStoredPosition.x,
            y: position.y + childStoredPosition.y,
            width: childSize.width,
            height: childSize.height,
            parentId: node.id,
            detail: createNodeDetail(child),
            editable: childLeaf,
            navigable: isContainerNode(child),
            leaf: childLeaf,
            proxy: false,
            movable: true,
            local: true,
            direction: childDirection,
            connectableSource: childCapabilities.canSource,
            connectableTarget: childCapabilities.canTarget,
            expanded: false,
            expansionParentId: node.id,
            expansionOffsetX: childDisplayOffset.x,
            expansionOffsetY: childDisplayOffset.y,
          };
        }),
      ];
    }),
  ];

  const viewNodeById = new Map<string, GraphViewNode>();
  for (const node of nodes) {
    if (!viewNodeById.has(node.id)) {
      viewNodeById.set(node.id, node);
    }
    viewNodeById.set(node.viewId, node);
  }
  const viewNodeByRefId = new Map<string, GraphViewNode>();
  for (const node of nodes) {
    if (node.expansionParentId && viewNodeByRefId.has(node.refNodeId)) {
      continue;
    }
    viewNodeByRefId.set(node.refNodeId, node);
  }
  const links: GraphViewLink[] = aggregateLinks
    .map((link) => {
      const fromViewNode = viewNodeByRefId.get(link.fromNodeId);
      const toViewNode = viewNodeByRefId.get(link.toNodeId);
      if (!fromViewNode || !toViewNode) {
        return null;
      }
      const isDirectLeafLink = link.count === 1 && Boolean(fromViewNode?.leaf && toViewNode?.leaf);
      const leafLinkId = link.leafLinkIds[0] ?? `aggregate:${link.fromNodeId}:${link.toNodeId}`;
      const leafLink = isDirectLeafLink ? containerLinks.find((candidate) => candidate.id === leafLinkId) : null;

      if (isDirectLeafLink && leafLink) {
        return {
          id: leafLink.id,
          fromNodeId: fromViewNode.id,
          toNodeId: toViewNode.id,
          weight: leafLink.weight,
          count: 1,
          aggregate: false,
          leafLinkIds: [leafLink.id],
          editable: true,
        };
      }

      return {
        id: `aggregate:${link.fromNodeId}:${link.toNodeId}`,
        fromNodeId: fromViewNode.id,
        toNodeId: toViewNode.id,
        weight: link.totalWeight,
        count: link.count,
        aggregate: true,
        leafLinkIds: [...link.leafLinkIds],
        editable: false,
      };
    })
    .filter((link): link is GraphViewLink => link !== null);

  const activeLeafNodeIds = new Set(runtimeActiveNodeIds);
  const activeViewNodeIds = new Set<string>();

  for (const node of nodes) {
    if (node.proxy || node.leaf) {
      if (activeLeafNodeIds.has(node.refNodeId)) {
        activeViewNodeIds.add(node.viewId);
      }
      continue;
    }

    for (const activeLeafNodeId of activeLeafNodeIds) {
      if (getScopeNodeIdForLeaf(activeLeafNodeId, indexes.pathById, navigationPath, expandedContainerIds) === node.refNodeId) {
        activeViewNodeIds.add(node.viewId);
        break;
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
    modelById,
  };
};
