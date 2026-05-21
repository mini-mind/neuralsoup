import type {
  AdapterNode,
  AggregateLinkView,
  GraphIRDocument,
  IzhikevichNeuronParameters,
  LeafLink,
  LiteralValue,
  ModelDefinition,
  NeuronGroupNode,
  NeuronNode,
  Position,
  RootGraph,
  SignalNode,
  TopologyNode,
} from '../../../domain/brain';
import { getGraphLinkCapabilities } from './graphLinkPolicy';

export interface GraphBreadcrumbItem {
  id: string;
  label: string;
}

export interface GraphViewNode {
  id: string;
  refNodeId: string;
  label: string;
  kind: TopologyNode['kind'];
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  detail: string;
  editable: boolean;
  navigable: boolean;
  leaf: boolean;
  proxy: boolean;
  movable: boolean;
  local: boolean;
  direction: 'input' | 'output' | 'internal';
  connectableSource: boolean;
  connectableTarget: boolean;
}

export interface GraphViewLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  weight: number;
  count: number;
  aggregate: boolean;
  leafLinkIds: string[];
  editable: boolean;
}

export interface GraphTopologyIndexes {
  pathById: Map<string, string[]>;
  nodeById: Map<string, TopologyNode>;
}

export interface GraphViewModel {
  indexes: GraphTopologyIndexes;
  breadcrumbs: GraphBreadcrumbItem[];
  currentContainer: RootGraph | AdapterNode | NeuronGroupNode;
  currentChildren: TopologyNode[];
  currentScope: 'root' | 'child';
  currentContainerKind: 'root' | AdapterNode['kind'] | NeuronGroupNode['kind'];
  scopeKey: string;
  localLeafIds: Set<string>;
  nodes: GraphViewNode[];
  viewNodeById: Map<string, GraphViewNode>;
  links: GraphViewLink[];
  activeViewNodeIds: Set<string>;
  modelById: Map<string, ModelDefinition>;
}

type NodePositionDraftMap = Record<string, Position>;

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

export const collectNodePathById = (root: RootGraph): GraphTopologyIndexes => {
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
  currentPath: string[]
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

  return trail[directChildIndex] ?? null;
};

const collectAggregateLinks = (
  links: LeafLink[],
  pathById: Map<string, string[]>,
  currentPath: string[]
): AggregateLinkView[] => {
  const aggregateMap = new Map<string, AggregateLinkView>();

  for (const link of links) {
    const fromNodeId = getScopeNodeIdForLeaf(link.from.nodeId, pathById, currentPath);
    const toNodeId = getScopeNodeIdForLeaf(link.to.nodeId, pathById, currentPath);
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

export const buildGraphViewModel = ({
  document,
  navigationPath,
  draftNodePositions,
  runtimeActiveNodeIds,
}: {
  document: GraphIRDocument;
  navigationPath: string[];
  draftNodePositions: NodePositionDraftMap;
  runtimeActiveNodeIds: string[];
}): GraphViewModel => {
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
  const aggregateLinks = collectAggregateLinks(containerLinks, indexes.pathById, navigationPath);

  const nodes: GraphViewNode[] = [
    ...currentChildren.map((node, index) => {
      const layoutPosition = getLayoutPosition(node, index, currentScope);
      const draftPosition = draftNodePositions[node.id];
      const position = draftPosition ? toViewPosition(draftPosition, currentScope) : layoutPosition;
      const size = getNodeSize(node);
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

      return {
        id: node.id,
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
      };
    }),
  ];

  const viewNodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeIdsInView = new Set(nodes.map((node) => node.id));
  const links: GraphViewLink[] = aggregateLinks
    .filter((link) => nodeIdsInView.has(link.fromNodeId) && nodeIdsInView.has(link.toNodeId))
    .map((link) => {
      const isDirectLeafLink =
        link.count === 1 && localLeafIds.has(link.fromNodeId) && localLeafIds.has(link.toNodeId);
      const leafLinkId = link.leafLinkIds[0] ?? `aggregate:${link.fromNodeId}:${link.toNodeId}`;
      const leafLink = isDirectLeafLink ? containerLinks.find((candidate) => candidate.id === leafLinkId) : null;

      if (isDirectLeafLink && leafLink) {
        return {
          id: leafLink.id,
          fromNodeId: leafLink.from.nodeId,
          toNodeId: leafLink.to.nodeId,
          weight: leafLink.weight,
          count: 1,
          aggregate: false,
          leafLinkIds: [leafLink.id],
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

  const activeLeafNodeIds = new Set(runtimeActiveNodeIds);
  const activeViewNodeIds = new Set<string>();

  for (const node of nodes) {
    if (node.proxy || node.leaf) {
      if (activeLeafNodeIds.has(node.refNodeId)) {
        activeViewNodeIds.add(node.id);
      }
      continue;
    }

    for (const activeLeafNodeId of activeLeafNodeIds) {
      if (getScopeNodeIdForLeaf(activeLeafNodeId, indexes.pathById, navigationPath) === node.refNodeId) {
        activeViewNodeIds.add(node.id);
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
