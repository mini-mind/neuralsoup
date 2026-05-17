import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from '../../domain/brain';

export interface DetailModalData {
  type: 'node' | 'link';
  id: string;
}

export interface GraphBreadcrumbItem {
  id: string;
  label: string;
}

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphSelectionRect extends GraphPoint {
  width: number;
  height: number;
}

export interface GraphCanvasViewport extends GraphPoint {}

export interface GraphSelectionState {
  nodeIds: string[];
  linkIds: string[];
  focusNodeId: string | null;
  focusLinkId: string | null;
}

export type GraphConnectionTrigger = 'button' | 'contextmenu';
export type GraphNodeDoubleClickAction = 'navigate' | 'edit' | null;

export interface GraphPendingConnectionState {
  sourceNodeId: string;
  sourceRefNodeId: string;
  trigger: GraphConnectionTrigger;
}

export interface GraphSelectionOptions {
  additive?: boolean;
  intersectedNodeIds?: string[];
}

export interface GraphNodePositionUpdate extends GraphPoint {
  nodeId: string;
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

interface UseSNNTopologyStateOptions {
  document: GraphIRDocument;
  runtimeActiveNodeIds?: string[];
  onDocumentChange?: (document: GraphIRDocument) => void;
}

type NodePositionDraftMap = Record<string, Position>;

const CHILD_SCOPE_OFFSET = {
  x: 260,
  y: 40,
} as const;

const MIN_NODE_POSITION = 24;
const LEAF_NODE_SIZE = 14;
const GROUP_NODE_SIZE = {
  width: 188,
  height: 96,
} as const;

const ROOT_FALLBACK_LAYOUT: Record<string, Position> = {
  'input-adapter': { x: -260, y: 180 },
  'core-neuron-group': { x: 50, y: 200 },
  'output-adapter': { x: 320, y: 200 },
};

const INPUT_PORT_ID = 'in';
const OUTPUT_PORT_ID = 'out';
const NEURON_INPUT_PORT_ID = 'dendrite';
const NEURON_OUTPUT_PORT_ID = 'axon';

const DEFAULT_NEURON_PARAMS: IzhikevichNeuronParameters = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
};

const isRecord = (value: LiteralValue | undefined): value is Record<string, LiteralValue> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isLeafNode = (node: TopologyNode): node is NeuronNode | SignalNode =>
  node.kind === 'neuron' || node.kind === 'signal';

const isContainerNode = (node: TopologyNode): node is AdapterNode | NeuronGroupNode =>
  node.kind === 'adapter' || node.kind === 'neuron-group';

const createEmptySelectionState = (): GraphSelectionState => ({
  nodeIds: [],
  linkIds: [],
  focusNodeId: null,
  focusLinkId: null,
});

const uniqueIds = (ids: string[]) => Array.from(new Set(ids));

const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const clampNodePosition = ({ x, y }: GraphPoint): Position => ({
  x: Math.max(MIN_NODE_POSITION, Math.round(x)),
  y: Math.max(MIN_NODE_POSITION, Math.round(y)),
});

const normalizeSelectionRect = ({ x, y, width, height }: GraphSelectionRect): GraphSelectionRect => ({
  x: width >= 0 ? x : x + width,
  y: height >= 0 ? y : y + height,
  width: Math.abs(width),
  height: Math.abs(height),
});

const intersectsSelectionRect = (
  rect: GraphSelectionRect,
  node: Pick<GraphViewNode, 'x' | 'y' | 'width' | 'height'>
) =>
  rect.x <= node.x + node.width &&
  rect.x + rect.width >= node.x &&
  rect.y <= node.y + node.height &&
  rect.y + rect.height >= node.y;

const collectNodePathById = (root: RootGraph) => {
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

const getNodeByPath = (
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

const getLeafPortId = (node: NeuronNode | SignalNode, direction: 'input' | 'output') => {
  if (node.kind === 'neuron') {
    return direction === 'input' ? NEURON_INPUT_PORT_ID : NEURON_OUTPUT_PORT_ID;
  }

  return direction === 'input' ? INPUT_PORT_ID : OUTPUT_PORT_ID;
};

const getModelById = (models: ModelDefinition[]) => new Map(models.map((model) => [model.id, model]));

const toFiniteNumber = (value: LiteralValue | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const getNeuronParameters = (node: NeuronNode): IzhikevichNeuronParameters => {
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

const getLayoutPosition = (
  node: TopologyNode,
  index: number,
  scope: 'root' | 'child'
): Position => {
  if (node.position) {
    if (scope === 'child') {
      return {
        x: node.position.x + CHILD_SCOPE_OFFSET.x,
        y: node.position.y + CHILD_SCOPE_OFFSET.y,
      };
    }

    return node.position;
  }

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

const toStoredPosition = (position: GraphPoint, scope: 'root' | 'child'): Position => {
  if (scope === 'child') {
    return clampNodePosition({
      x: position.x - CHILD_SCOPE_OFFSET.x,
      y: position.y - CHILD_SCOPE_OFFSET.y,
    });
  }

  return clampNodePosition(position);
};

const updateChildrenAtPath = (
  root: RootGraph,
  path: string[],
  transform: (children: TopologyNode[]) => TopologyNode[]
): RootGraph => {
  if (path.length === 0) {
    return {
      ...root,
      children: transform(root.children),
    };
  }

  const [head, ...tail] = path;
  return {
    ...root,
    children: root.children.map((child) => {
      if (child.id !== head || !isContainerNode(child)) {
        return child;
      }

      if (tail.length === 0) {
        return {
          ...child,
          children: transform(child.children),
        };
      }

      return {
        ...child,
        children: updateChildrenAtPath(
          {
            id: 'root',
            children: child.children,
            links: [],
          },
          tail,
          transform
        ).children,
      };
    }),
  };
};

const updateNodeById = (
  root: RootGraph,
  nodeId: string,
  updater: (node: TopologyNode) => TopologyNode
): RootGraph => {
  const visit = (children: TopologyNode[]): TopologyNode[] =>
    children.map((child) => {
      const nextChild = child.id === nodeId ? updater(child) : child;

      if (isContainerNode(nextChild)) {
        return {
          ...nextChild,
          children: visit(nextChild.children),
        };
      }

      return nextChild;
    });

  return {
    ...root,
    children: visit(root.children),
  };
};

const updateNodePositions = (root: RootGraph, positions: NodePositionDraftMap): RootGraph => {
  const positionEntries = Object.entries(positions);
  if (positionEntries.length === 0) {
    return root;
  }

  let nextRoot = root;
  for (const [nodeId, position] of positionEntries) {
    nextRoot = updateNodeById(nextRoot, nodeId, (node) => ({
      ...node,
      position,
    }));
  }

  return nextRoot;
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

export const useSNNTopologyState = ({
  document,
  runtimeActiveNodeIds = [],
  onDocumentChange,
}: UseSNNTopologyStateOptions) => {
  const documentRef = useRef(document);
  const [navigationPath, setNavigationPath] = useState<string[]>([]);
  const [selectionState, setSelectionState] = useState<GraphSelectionState>(createEmptySelectionState);
  const [showDetailModal, setShowDetailModal] = useState<DetailModalData | null>(null);
  const [pendingConnection, setPendingConnection] = useState<GraphPendingConnectionState | null>(null);
  const [selectionRect, setSelectionRect] = useState<GraphSelectionRect | null>(null);
  const [canvasViewport, setCanvasViewport] = useState<GraphCanvasViewport>({ x: 0, y: 0 });
  const [draftNodePositions, setDraftNodePositions] = useState<NodePositionDraftMap>({});

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  const setDocument = useCallback(
    (updater: (current: GraphIRDocument) => GraphIRDocument) => {
      const nextDocument = updater(documentRef.current);
      if (nextDocument === documentRef.current) {
        return;
      }

      documentRef.current = nextDocument;
      onDocumentChange?.(nextDocument);
    },
    [onDocumentChange]
  );

  const indexes = useMemo(() => collectNodePathById(document.root), [document.root]);
  const currentContainer = useMemo(
    () => getNodeByPath(document.root, navigationPath, indexes.nodeById),
    [document.root, indexes.nodeById, navigationPath]
  );
  const currentChildren = currentContainer.children;
  const currentScope = navigationPath.length === 0 ? 'root' : 'child';
  const currentContainerKind = 'kind' in currentContainer ? currentContainer.kind : 'root';
  const scopeKey = navigationPath.length === 0 ? 'root' : navigationPath.join('/');
  const localLeafIds = useMemo(
    () => new Set(currentChildren.filter(isLeafNode).map((node) => node.id)),
    [currentChildren]
  );

  const breadcrumbs = useMemo<GraphBreadcrumbItem[]>(() => {
    const items: GraphBreadcrumbItem[] = [{ id: 'root', label: 'root' }];

    for (let index = 0; index < navigationPath.length; index += 1) {
      const nodeId = navigationPath[index];
      const node = indexes.nodeById.get(nodeId);
      if (!node) {
        continue;
      }

      items.push({
        id: nodeId,
        label: node.label,
      });
    }

    return items;
  }, [indexes.nodeById, navigationPath]);

  const modelById = useMemo(() => getModelById(document.models), [document.models]);
  const aggregateLinks = useMemo(
    () => collectAggregateLinks(document.root.links, indexes.pathById, navigationPath),
    [document.root.links, indexes.pathById, navigationPath]
  );
  const scopedLeafLinks = useMemo(
    () =>
      navigationPath.length === 0
        ? []
        : document.root.links.filter(
            (link) => localLeafIds.has(link.from.nodeId) || localLeafIds.has(link.to.nodeId)
          ),
    [document.root.links, localLeafIds, navigationPath.length]
  );

  const boundaryProxyNodes = useMemo<GraphViewNode[]>(() => {
    if (navigationPath.length === 0) {
      return [];
    }

    const proxyNodeMap = new Map<string, GraphViewNode>();

    for (const link of scopedLeafLinks) {
      const localSource = localLeafIds.has(link.from.nodeId);
      const localTarget = localLeafIds.has(link.to.nodeId);
      if (localSource === localTarget) {
        continue;
      }

      const externalNodeId = localSource ? link.to.nodeId : link.from.nodeId;
      if (proxyNodeMap.has(externalNodeId)) {
        continue;
      }

      const externalNode = indexes.nodeById.get(externalNodeId);
      if (!externalNode || !isLeafNode(externalNode)) {
        continue;
      }

      const direction = localTarget ? 'input' : 'output';
      const offsetIndex = proxyNodeMap.size;
      proxyNodeMap.set(externalNodeId, {
        id: `proxy:${externalNodeId}`,
        refNodeId: externalNodeId,
        label: externalNode.label,
        kind: externalNode.kind,
        x: direction === 'input' ? 20 : 820,
        y: 80 + offsetIndex * 96,
        width: LEAF_NODE_SIZE,
        height: LEAF_NODE_SIZE,
        parentId: navigationPath.at(-1) ?? null,
        detail: `${direction === 'input' ? 'upstream' : 'downstream'} boundary`,
        editable: false,
        navigable: false,
        leaf: true,
        proxy: true,
        movable: false,
        local: false,
        direction,
        connectableSource: currentScope === 'child' && direction === 'input',
        connectableTarget: currentScope === 'child' && direction === 'output',
      });
    }

    return Array.from(proxyNodeMap.values());
  }, [currentScope, indexes.nodeById, localLeafIds, navigationPath, scopedLeafLinks]);

  const nodes = useMemo<GraphViewNode[]>(
    () => [
      ...currentChildren.map((node, index) => {
        const layoutPosition = getLayoutPosition(node, index, currentScope);
        const draftPosition = draftNodePositions[node.id];
        const position =
          draftPosition && currentScope === 'child'
            ? {
                x: draftPosition.x + CHILD_SCOPE_OFFSET.x,
                y: draftPosition.y + CHILD_SCOPE_OFFSET.y,
              }
            : draftPosition ?? layoutPosition;
        const size = getNodeSize(node);
        const direction = getNodeDirection(node);
        const leaf = isLeafNode(node);

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
          connectableSource:
            currentScope === 'child' && leaf && (direction === 'input' || node.kind === 'neuron'),
          connectableTarget:
            currentScope === 'child' && leaf && (direction === 'output' || node.kind === 'neuron'),
        };
      }),
      ...boundaryProxyNodes,
    ],
    [boundaryProxyNodes, currentChildren, currentScope, draftNodePositions, navigationPath]
  );

  const viewNodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const nodeIdsInView = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const localSelectableNodeIds = useMemo(
    () => new Set(nodes.filter((node) => !node.proxy).map((node) => node.id)),
    [nodes]
  );

  const links = useMemo<GraphViewLink[]>(() => {
    if (navigationPath.length === 0) {
      return aggregateLinks
        .filter((link) => nodeIdsInView.has(link.fromNodeId) && nodeIdsInView.has(link.toNodeId))
        .map((link) => ({
          id: `aggregate:${link.fromNodeId}:${link.toNodeId}`,
          fromNodeId: link.fromNodeId,
          toNodeId: link.toNodeId,
          weight: link.totalWeight,
          count: link.count,
          aggregate: true,
          leafLinkIds: [...link.leafLinkIds],
          editable: false,
        }));
    }

    return scopedLeafLinks
      .map((link) => ({
        id: link.id,
        fromNodeId: localLeafIds.has(link.from.nodeId) ? link.from.nodeId : `proxy:${link.from.nodeId}`,
        toNodeId: localLeafIds.has(link.to.nodeId) ? link.to.nodeId : `proxy:${link.to.nodeId}`,
        weight: link.weight,
        count: 1,
        aggregate: false,
        leafLinkIds: [link.id],
        editable: true,
      }))
      .filter((link) => nodeIdsInView.has(link.fromNodeId) && nodeIdsInView.has(link.toNodeId));
  }, [aggregateLinks, localLeafIds, navigationPath.length, nodeIdsInView, scopedLeafLinks]);

  const activeViewNodeIds = useMemo(() => {
    const activeLeafNodeIds = new Set(runtimeActiveNodeIds);
    const nextActiveViewNodeIds = new Set<string>();

    for (const node of nodes) {
      if (node.proxy) {
        if (activeLeafNodeIds.has(node.refNodeId)) {
          nextActiveViewNodeIds.add(node.id);
        }
        continue;
      }

      if (node.leaf) {
        if (activeLeafNodeIds.has(node.refNodeId)) {
          nextActiveViewNodeIds.add(node.id);
        }
        continue;
      }

      for (const activeLeafNodeId of activeLeafNodeIds) {
        if (getScopeNodeIdForLeaf(activeLeafNodeId, indexes.pathById, navigationPath) === node.refNodeId) {
          nextActiveViewNodeIds.add(node.id);
          break;
        }
      }
    }

    return nextActiveViewNodeIds;
  }, [indexes.pathById, navigationPath, nodes, runtimeActiveNodeIds]);

  useEffect(() => {
    setSelectionState((currentSelection) => {
      const nextNodeIds = currentSelection.nodeIds.filter((nodeId) => localSelectableNodeIds.has(nodeId));
      const nextLinkIds = currentSelection.linkIds.filter((linkId) => links.some((link) => link.id === linkId));
      const nextFocusNodeId =
        currentSelection.focusNodeId && nextNodeIds.includes(currentSelection.focusNodeId)
          ? currentSelection.focusNodeId
          : nextNodeIds[0] ?? null;
      const nextFocusLinkId =
        currentSelection.focusLinkId && nextLinkIds.includes(currentSelection.focusLinkId)
          ? currentSelection.focusLinkId
          : nextLinkIds[0] ?? null;

      if (
        areStringArraysEqual(currentSelection.nodeIds, nextNodeIds) &&
        areStringArraysEqual(currentSelection.linkIds, nextLinkIds) &&
        currentSelection.focusNodeId === nextFocusNodeId &&
        currentSelection.focusLinkId === nextFocusLinkId
      ) {
        return currentSelection;
      }

      return {
        nodeIds: nextNodeIds,
        linkIds: nextLinkIds,
        focusNodeId: nextFocusNodeId,
        focusLinkId: nextFocusLinkId,
      };
    });
  }, [links, localSelectableNodeIds]);

  useEffect(() => {
    if (!pendingConnection || viewNodeById.has(pendingConnection.sourceNodeId)) {
      return;
    }

    setPendingConnection(null);
  }, [pendingConnection, viewNodeById]);

  const activeNode = useMemo(() => {
    if (showDetailModal?.type !== 'node') {
      return null;
    }

    return indexes.nodeById.get(showDetailModal.id) ?? null;
  }, [indexes.nodeById, showDetailModal]);

  const activeLink = useMemo(() => {
    if (showDetailModal?.type !== 'link') {
      return null;
    }

    return document.root.links.find((link) => link.id === showDetailModal.id) ?? null;
  }, [document.root.links, showDetailModal]);

  const clearTransientState = useCallback(() => {
    setSelectionState(createEmptySelectionState());
    setPendingConnection(null);
    setSelectionRect(null);
    setShowDetailModal(null);
    setDraftNodePositions({});
    setCanvasViewport({ x: 0, y: 0 });
  }, []);

  const navigateTo = useCallback(
    (nodeId: string) => {
      const node = indexes.nodeById.get(nodeId);
      if (!node || !isContainerNode(node)) {
        return;
      }

      const path = indexes.pathById.get(nodeId);
      if (!path) {
        return;
      }

      setNavigationPath(path);
      clearTransientState();
    },
    [clearTransientState, indexes.nodeById, indexes.pathById]
  );

  const navigateToBreadcrumb = useCallback(
    (breadcrumbId: string) => {
      if (breadcrumbId === 'root') {
        setNavigationPath([]);
      } else {
        const path = indexes.pathById.get(breadcrumbId);
        if (!path) {
          return;
        }

        setNavigationPath(path);
      }

      clearTransientState();
    },
    [clearTransientState, indexes.pathById]
  );

  const selectNode = useCallback(
    (nodeId: string | null, options?: GraphSelectionOptions) => {
      setSelectionRect(null);
      setSelectionState((currentSelection) => {
        if (!nodeId) {
          return createEmptySelectionState();
        }

        if (!localSelectableNodeIds.has(nodeId)) {
          return currentSelection;
        }

        if (options?.additive) {
          const alreadySelected = currentSelection.nodeIds.includes(nodeId);
          const nextNodeIds = alreadySelected
            ? currentSelection.nodeIds.filter((candidateId) => candidateId !== nodeId)
            : [...currentSelection.nodeIds, nodeId];
          return {
            nodeIds: nextNodeIds,
            linkIds: [],
            focusNodeId: alreadySelected ? nextNodeIds.at(-1) ?? null : nodeId,
            focusLinkId: null,
          };
        }

        return {
          nodeIds: [nodeId],
          linkIds: [],
          focusNodeId: nodeId,
          focusLinkId: null,
        };
      });
    },
    [localSelectableNodeIds]
  );

  const selectNodes = useCallback(
    (nodeIds: string[], options?: GraphSelectionOptions) => {
      setSelectionRect(null);
      const normalizedNodeIds = uniqueIds(nodeIds).filter((nodeId) => localSelectableNodeIds.has(nodeId));
      setSelectionState((currentSelection) => {
        if (options?.additive) {
          const mergedNodeIds = uniqueIds([...currentSelection.nodeIds, ...normalizedNodeIds]).filter((nodeId) =>
            localSelectableNodeIds.has(nodeId)
          );
          return {
            nodeIds: mergedNodeIds,
            linkIds: [],
            focusNodeId: normalizedNodeIds.at(-1) ?? currentSelection.focusNodeId,
            focusLinkId: null,
          };
        }

        return {
          nodeIds: normalizedNodeIds,
          linkIds: [],
          focusNodeId: normalizedNodeIds.at(-1) ?? null,
          focusLinkId: null,
        };
      });
    },
    [localSelectableNodeIds]
  );

  const selectLink = useCallback((linkId: string | null, options?: GraphSelectionOptions) => {
    setSelectionRect(null);
    setSelectionState((currentSelection) => {
      if (!linkId) {
        return createEmptySelectionState();
      }

      if (!links.some((link) => link.id === linkId)) {
        return currentSelection;
      }

      if (options?.additive) {
        const alreadySelected = currentSelection.linkIds.includes(linkId);
        const nextLinkIds = alreadySelected
          ? currentSelection.linkIds.filter((candidateId) => candidateId !== linkId)
          : [...currentSelection.linkIds, linkId];
        return {
          nodeIds: [],
          linkIds: nextLinkIds,
          focusNodeId: null,
          focusLinkId: alreadySelected ? nextLinkIds.at(-1) ?? null : linkId,
        };
      }

      return {
        nodeIds: [],
        linkIds: [linkId],
        focusNodeId: null,
        focusLinkId: linkId,
      };
    });
  }, [links]);

  const clearSelection = useCallback(() => {
    setSelectionState(createEmptySelectionState());
    setSelectionRect(null);
  }, []);

  const beginSelectionRect = useCallback((point: GraphPoint) => {
    setSelectionRect({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    });
    setSelectionState(createEmptySelectionState());
  }, []);

  const updateSelectionRect = useCallback(
    (point: GraphPoint, options?: GraphSelectionOptions) => {
      setSelectionRect((currentRect) => {
        if (!currentRect) {
          return currentRect;
        }

        const nextRect = {
          x: currentRect.x,
          y: currentRect.y,
          width: point.x - currentRect.x,
          height: point.y - currentRect.y,
        };
        const normalizedRect = normalizeSelectionRect(nextRect);
        const intersectedNodeIds =
          options?.intersectedNodeIds ??
          nodes
            .filter((node) => !node.proxy && intersectsSelectionRect(normalizedRect, node))
            .map((node) => node.id);

        setSelectionState((currentSelection) => {
          if (options?.additive) {
            const mergedNodeIds = uniqueIds([...currentSelection.nodeIds, ...intersectedNodeIds]);
            return {
              nodeIds: mergedNodeIds,
              linkIds: [],
              focusNodeId: intersectedNodeIds.at(-1) ?? currentSelection.focusNodeId,
              focusLinkId: null,
            };
          }

          return {
            nodeIds: intersectedNodeIds,
            linkIds: [],
            focusNodeId: intersectedNodeIds.at(-1) ?? null,
            focusLinkId: null,
          };
        });

        return nextRect;
      });
    },
    [nodes]
  );

  const commitSelectionRect = useCallback(() => {
    setSelectionRect((currentRect) => (currentRect ? normalizeSelectionRect(currentRect) : null));
  }, []);

  const cancelSelectionRect = useCallback(() => {
    setSelectionRect(null);
  }, []);

  const openNodeDetail = useCallback(
    (nodeId: string) => {
      setShowDetailModal({ type: 'node', id: nodeId });
      selectNode(nodeId);
    },
    [selectNode]
  );

  const openLinkDetail = useCallback(
    (linkId: string) => {
      setShowDetailModal({ type: 'link', id: linkId });
      selectLink(linkId);
    },
    [selectLink]
  );

  const closeDetailModal = useCallback(() => {
    setShowDetailModal(null);
  }, []);

  const getNodeDoubleClickAction = useCallback(
    (nodeId: string): GraphNodeDoubleClickAction => {
      const node = viewNodeById.get(nodeId);
      if (!node) {
        return null;
      }

      if (node.navigable) {
        return 'navigate';
      }

      if (node.editable && !node.proxy) {
        return 'edit';
      }

      return null;
    },
    [viewNodeById]
  );

  const startLinkCreation = useCallback(
    (nodeId: string, trigger: GraphConnectionTrigger = 'button') => {
      const node = viewNodeById.get(nodeId);
      if (!node || !node.connectableSource) {
        return;
      }

      const actualNode = indexes.nodeById.get(node.refNodeId);
      if (!actualNode || !isLeafNode(actualNode)) {
        return;
      }

      setPendingConnection({
        sourceNodeId: node.id,
        sourceRefNodeId: node.refNodeId,
        trigger,
      });
      selectNode(node.id);
    },
    [indexes.nodeById, selectNode, viewNodeById]
  );

  const finishLinkCreation = useCallback(
    (targetNodeId: string) => {
      if (!pendingConnection) {
        return;
      }

      const sourceViewNode = viewNodeById.get(pendingConnection.sourceNodeId);
      const targetViewNode = viewNodeById.get(targetNodeId);
      if (!sourceViewNode || !targetViewNode || !targetViewNode.connectableTarget) {
        setPendingConnection(null);
        return;
      }

      const sourceNode = indexes.nodeById.get(sourceViewNode.refNodeId);
      const targetNode = indexes.nodeById.get(targetViewNode.refNodeId);
      if (!sourceNode || !targetNode || !isLeafNode(sourceNode) || !isLeafNode(targetNode)) {
        setPendingConnection(null);
        return;
      }

      if (sourceNode.id === targetNode.id) {
        setPendingConnection(null);
        return;
      }

      const sourceIsLocalLeaf = localLeafIds.has(sourceNode.id);
      const targetIsLocalLeaf = localLeafIds.has(targetNode.id);
      if (!sourceIsLocalLeaf && !targetIsLocalLeaf) {
        setPendingConnection(null);
        clearSelection();
        return;
      }

      const fromPortId = getLeafPortId(sourceNode, 'output');
      const toPortId = getLeafPortId(targetNode, 'input');
      const existingLink = documentRef.current.root.links.find(
        (link) =>
          link.from.nodeId === sourceNode.id &&
          link.from.portId === fromPortId &&
          link.to.nodeId === targetNode.id &&
          link.to.portId === toPortId
      );
      if (existingLink) {
        setPendingConnection(null);
        setSelectionState({
          nodeIds: [],
          linkIds: [existingLink.id],
          focusNodeId: null,
          focusLinkId: existingLink.id,
        });
        return;
      }

      const nextLink: LeafLink = {
        id: `link-${sourceNode.id}-${targetNode.id}-${Date.now()}`,
        from: {
          nodeId: sourceNode.id,
          portId: fromPortId,
        },
        to: {
          nodeId: targetNode.id,
          portId: toPortId,
        },
        weight: 0.8,
      };

      setDocument((current) => ({
        ...current,
        root: {
          ...current.root,
          links: [...current.root.links, nextLink],
        },
      }));
      setPendingConnection(null);
      setSelectionState({
        nodeIds: [],
        linkIds: [nextLink.id],
        focusNodeId: null,
        focusLinkId: nextLink.id,
      });
    },
    [clearSelection, indexes.nodeById, localLeafIds, pendingConnection, setDocument, viewNodeById]
  );

  const cancelPendingLink = useCallback(() => {
    setPendingConnection(null);
  }, []);

  const setNodeDraftPositionMap = useCallback((positions: NodePositionDraftMap) => {
    setDraftNodePositions(positions);
  }, []);

  const updateNodePositionsInDraft = useCallback((updates: GraphNodePositionUpdate[]) => {
    if (updates.length === 0) {
      return;
    }

    setDraftNodePositions((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      for (const update of updates) {
        const viewNode = viewNodeById.get(update.nodeId);
        if (!viewNode || viewNode.proxy) {
          continue;
        }

        nextDrafts[viewNode.refNodeId] = toStoredPosition(update, currentScope);
      }
      return nextDrafts;
    });
  }, [currentScope, viewNodeById]);

  const commitNodeDraftPositions = useCallback(
    (positions?: NodePositionDraftMap) => {
      const positionsToCommit = positions ?? draftNodePositions;
      if (Object.keys(positionsToCommit).length === 0) {
        return;
      }

      setDocument((current) => ({
        ...current,
        root: updateNodePositions(current.root, positionsToCommit),
      }));
      setDraftNodePositions({});
    },
    [draftNodePositions, setDocument]
  );

  const discardNodeDraftPositions = useCallback(() => {
    setDraftNodePositions({});
  }, []);

  const persistNodePositions = useCallback(
    (updates: GraphNodePositionUpdate[]) => {
      if (updates.length === 0) {
        return;
      }

      const positions: NodePositionDraftMap = {};
      for (const update of updates) {
        const viewNode = viewNodeById.get(update.nodeId);
        if (!viewNode || viewNode.proxy) {
          continue;
        }

        positions[viewNode.refNodeId] = toStoredPosition(update, currentScope);
      }

      if (Object.keys(positions).length === 0) {
        return;
      }

      commitNodeDraftPositions(positions);
    },
    [commitNodeDraftPositions, currentScope, viewNodeById]
  );

  const removeSelected = useCallback(() => {
    if (selectionState.linkIds.length > 0) {
      const removableLinkIds = new Set(selectionState.linkIds);
      setDocument((current) => ({
        ...current,
        root: {
          ...current.root,
          links: current.root.links.filter((link) => !removableLinkIds.has(link.id)),
        },
      }));
      clearSelection();
      if (showDetailModal?.type === 'link' && removableLinkIds.has(showDetailModal.id)) {
        setShowDetailModal(null);
      }
      return;
    }

    if (selectionState.nodeIds.length === 0 || navigationPath.length === 0) {
      return;
    }

    const selectedViewNodes = selectionState.nodeIds
      .map((nodeId) => viewNodeById.get(nodeId))
      .filter((node): node is GraphViewNode => node != null)
      .filter((node) => !node.proxy);
    if (selectedViewNodes.length === 0) {
      return;
    }

    const removableNodeIds = new Set(selectedViewNodes.map((node) => node.refNodeId));
    const nextRoot = updateChildrenAtPath(documentRef.current.root, navigationPath, (children) =>
      children.filter((child) => !removableNodeIds.has(child.id))
    );
    setDocument((current) => ({
      ...current,
      root: {
        ...nextRoot,
        links: current.root.links.filter(
          (link) => !removableNodeIds.has(link.from.nodeId) && !removableNodeIds.has(link.to.nodeId)
        ),
      },
    }));
    clearSelection();
    if (showDetailModal?.type === 'node' && removableNodeIds.has(showDetailModal.id)) {
      setShowDetailModal(null);
    }
  }, [clearSelection, navigationPath, selectionState, setDocument, showDetailModal, viewNodeById]);

  const addNeuronAt = useCallback(
    (x: number, y: number) => {
      if (navigationPath.length === 0 || currentContainerKind !== 'neuron-group') {
        return;
      }

      const siblingIndex = currentChildren.filter((child) => child.kind === 'neuron').length + 1;
      const nextNode: NeuronNode = {
        kind: 'neuron',
        id: `neuron-${Date.now()}`,
        label: `神经元${siblingIndex}`,
        modelId: 'izhikevich-neuron',
        position: toStoredPosition({ x, y }, currentScope),
      };

      setDocument((current) => ({
        ...current,
        root: updateChildrenAtPath(current.root, navigationPath, (children) => [...children, nextNode]),
      }));
      setSelectionState({
        nodeIds: [nextNode.id],
        linkIds: [],
        focusNodeId: nextNode.id,
        focusLinkId: null,
      });
      setPendingConnection(null);
    },
    [currentChildren, currentContainerKind, currentScope, navigationPath, setDocument]
  );

  const updateNodeLabelAndParams = useCallback(
    (nodeId: string, payload: { label: string; parameterOverrides?: Record<string, LiteralValue> }) => {
      setDocument((current) => ({
        ...current,
        root: updateNodeById(current.root, nodeId, (node) => {
          if (!isLeafNode(node)) {
            return node;
          }

          return {
            ...node,
            label: payload.label,
            parameterOverrides: payload.parameterOverrides ?? node.parameterOverrides,
          };
        }),
      }));
    },
    [setDocument]
  );

  const updateLinkWeight = useCallback(
    (linkId: string, weight: number) => {
      setDocument((current) => ({
        ...current,
        root: {
          ...current.root,
          links: current.root.links.map((link) =>
            link.id === linkId
              ? {
                  ...link,
                  weight,
                }
              : link
          ),
        },
      }));
    },
    [setDocument]
  );

  const panCanvas = useCallback((delta: GraphPoint) => {
    setCanvasViewport((currentViewport) => ({
      x: currentViewport.x + delta.x,
      y: currentViewport.y + delta.y,
    }));
  }, []);

  const setCanvasOffset = useCallback((offset: GraphCanvasViewport) => {
    setCanvasViewport(offset);
  }, []);

  const resetCanvasViewport = useCallback(() => {
    setCanvasViewport({ x: 0, y: 0 });
  }, []);

  const activeNeuronParameters = useMemo(() => {
    if (!activeNode || activeNode.kind !== 'neuron') {
      return null;
    }

    return getNeuronParameters(activeNode);
  }, [activeNode]);

  const activeNodeModel = useMemo(() => {
    if (!activeNode || !('modelId' in activeNode)) {
      return null;
    }

    return modelById.get(activeNode.modelId) ?? null;
  }, [activeNode, modelById]);

  const selection = useMemo(
    () => ({
      nodeId: selectionState.focusNodeId,
      linkId: selectionState.focusLinkId,
    }),
    [selectionState.focusLinkId, selectionState.focusNodeId]
  );

  const pendingLinkSourceId = pendingConnection?.sourceNodeId ?? null;

  return {
    breadcrumbs,
    scopeKey,
    currentScope,
    currentContainerKind,
    nodes,
    links,
    selection,
    selectionState,
    selectedNodeIds: selectionState.nodeIds,
    selectedNodeId: selectionState.focusNodeId,
    selectedLinkId: selectionState.focusLinkId,
    selectionRect,
    pendingLinkSourceId,
    pendingConnection,
    showDetailModal,
    canvasViewport,
    viewNodeById,
    activeViewNodeIds,
    activeNode,
    activeLink,
    activeNodeModel,
    activeNeuronParameters,
    navigateTo,
    navigateToBreadcrumb,
    setNodeSelection: selectNodes,
    selectNode,
    selectNodes,
    selectLink,
    clearSelection,
    beginSelectionRect,
    updateSelectionRect,
    commitSelectionRect,
    cancelSelectionRect,
    openNodeDetail,
    openLinkDetail,
    closeDetailModal,
    getNodeDoubleClickAction,
    startLinkCreation,
    finishLinkCreation,
    cancelPendingLink,
    setNodeDraftPositionMap,
    updateNodePositionsInDraft,
    commitNodeDraftPositions,
    discardNodeDraftPositions,
    persistNodePositions,
    removeSelected,
    addNeuronAt,
    panCanvas,
    setCanvasOffset,
    resetCanvasViewport,
    updateNodeLabelAndParams,
    updateLinkWeight,
  };
};
