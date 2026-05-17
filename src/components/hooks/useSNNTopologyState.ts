import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdapterNode,
  AggregateLinkView,
  GraphIRDocument,
  LeafLink,
  LiteralValue,
  ModelDefinition,
  NeuronGroupNode,
  NeuronNode,
  RootGraph,
  SignalNode,
  TopologyNode,
  IzhikevichNeuronParameters,
} from '../../domain/brain';

export interface DetailModalData {
  type: 'node' | 'link';
  id: string;
}

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
  direction: 'input' | 'output' | 'internal';
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
  onDocumentChange?: (document: GraphIRDocument) => void;
}

const NODE_CARD = {
  width: 168,
  height: 92,
} as const;

const ROOT_FALLBACK_LAYOUT: Record<string, { x: number; y: number }> = {
  'input-adapter': { x: 80, y: 140 },
  'core-neuron-group': { x: 380, y: 190 },
  'output-adapter': { x: 680, y: 140 },
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

const collectNodePathById = (root: RootGraph) => {
  const pathById = new Map<string, string[]>();
  const nodeById = new Map<string, TopologyNode>();

  const visit = (container: RootGraph | AdapterNode | NeuronGroupNode, trail: string[]) => {
    for (const child of container.children) {
      const nextTrail = [...trail, child.id];
      pathById.set(child.id, nextTrail);
      nodeById.set(child.id, child);
      if (child.kind === 'adapter' || child.kind === 'neuron-group') {
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
  if (!candidate || (candidate.kind !== 'adapter' && candidate.kind !== 'neuron-group')) {
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

const getLayoutPosition = (
  node: TopologyNode,
  index: number,
  scope: 'root' | 'child'
): { x: number; y: number } => {
  if (node.position) {
    if (scope === 'child') {
      return {
        x: node.position.x + 260,
        y: node.position.y + 24,
      };
    }

    return node.position;
  }

  if (scope === 'root' && ROOT_FALLBACK_LAYOUT[node.id]) {
    return ROOT_FALLBACK_LAYOUT[node.id];
  }

  const column = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: 120 + column * 220,
    y: 120 + row * 150,
  };
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
      if (child.id !== head || (child.kind !== 'adapter' && child.kind !== 'neuron-group')) {
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
      if (child.id === nodeId) {
        return updater(child);
      }

      if (child.kind === 'adapter' || child.kind === 'neuron-group') {
        return {
          ...child,
          children: visit(child.children),
        };
      }

      return child;
    });

  return {
    ...root,
    children: visit(root.children),
  };
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

  return [...aggregateMap.values()];
};

const createNodeDetail = (node: TopologyNode, document: GraphIRDocument): string => {
  if (node.kind === 'adapter') {
    return `${node.children.length} signals`;
  }

  if (node.kind === 'neuron-group') {
    const leafCount = node.children.filter(isLeafNode).length;
    return `${leafCount} leaf nodes`;
  }

  if (node.kind === 'signal') {
    return `${node.direction === 'input' ? 'input' : 'output'} adapter leaf`;
  }

  const model = document.models.find((candidate) => candidate.id === node.modelId);
  return model ? model.id : 'neuron';
};

export const useSNNTopologyState = ({ document, onDocumentChange }: UseSNNTopologyStateOptions) => {
  const documentRef = useRef(document);
  const [navigationPath, setNavigationPath] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ nodeId: string | null; linkId: string | null }>({
    nodeId: null,
    linkId: null,
  });
  const [showDetailModal, setShowDetailModal] = useState<DetailModalData | null>(null);
  const [pendingLinkSourceId, setPendingLinkSourceId] = useState<string | null>(null);

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
    [document.root, navigationPath, indexes.nodeById]
  );
  const currentChildren = currentContainer.children;
  const currentScope = navigationPath.length === 0 ? 'root' : 'child';
  const currentContainerKind =
    'kind' in currentContainer ? currentContainer.kind : 'root';
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
        x: direction === 'input' ? 20 : 760,
        y: 80 + offsetIndex * 110,
        width: NODE_CARD.width,
        height: NODE_CARD.height,
        parentId: navigationPath.at(-1) ?? null,
        detail: `${direction === 'input' ? 'upstream' : 'downstream'} boundary`,
        editable: false,
        navigable: false,
        leaf: true,
        proxy: true,
        direction,
      });
    }

    return [...proxyNodeMap.values()];
  }, [indexes.nodeById, localLeafIds, navigationPath, scopedLeafLinks]);

  const nodes = useMemo<GraphViewNode[]>(
    () => [
      ...currentChildren.map((node, index) => {
        const position = getLayoutPosition(node, index, currentScope);
        const direction: GraphViewNode['direction'] =
          node.kind === 'signal'
            ? node.direction
            : node.kind === 'adapter'
              ? node.adapterType === 'output'
                ? 'output'
                : 'input'
              : 'internal';
        return {
          id: node.id,
          refNodeId: node.id,
          label: node.label,
          kind: node.kind,
          x: position.x,
          y: position.y,
          width: NODE_CARD.width,
          height: NODE_CARD.height,
          parentId: navigationPath.at(-1) ?? null,
          detail: createNodeDetail(node, document),
          editable: isLeafNode(node),
          navigable: node.kind === 'adapter' || node.kind === 'neuron-group',
          leaf: isLeafNode(node),
          proxy: false,
          direction,
        };
      }),
      ...boundaryProxyNodes,
    ],
    [boundaryProxyNodes, currentChildren, currentScope, document, navigationPath]
  );

  const viewNodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const nodeIdsInView = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);

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
      .map((link) => {
        const fromNodeId = localLeafIds.has(link.from.nodeId) ? link.from.nodeId : `proxy:${link.from.nodeId}`;
        const toNodeId = localLeafIds.has(link.to.nodeId) ? link.to.nodeId : `proxy:${link.to.nodeId}`;
        return {
          id: link.id,
          fromNodeId,
          toNodeId,
          weight: link.weight,
          count: 1,
          aggregate: false,
          leafLinkIds: [link.id],
          editable: true,
        };
      })
      .filter((link) => nodeIdsInView.has(link.fromNodeId) && nodeIdsInView.has(link.toNodeId))
  }, [aggregateLinks, localLeafIds, navigationPath.length, nodeIdsInView, scopedLeafLinks]);

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

  const navigateTo = useCallback(
    (nodeId: string) => {
      const node = indexes.nodeById.get(nodeId);
      if (!node || (node.kind !== 'adapter' && node.kind !== 'neuron-group')) {
        return;
      }

      const path = indexes.pathById.get(nodeId);
      if (!path) {
        return;
      }

      setNavigationPath(path);
      setSelection({ nodeId: null, linkId: null });
      setPendingLinkSourceId(null);
      setShowDetailModal(null);
    },
    [indexes.nodeById, indexes.pathById]
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

      setSelection({ nodeId: null, linkId: null });
      setPendingLinkSourceId(null);
      setShowDetailModal(null);
    },
    [indexes.pathById]
  );

  const selectNode = useCallback((nodeId: string | null) => {
    setSelection({ nodeId, linkId: null });
  }, []);

  const selectLink = useCallback((linkId: string | null) => {
    setSelection({ nodeId: null, linkId });
  }, []);

  const openNodeDetail = useCallback((nodeId: string) => {
    setShowDetailModal({ type: 'node', id: nodeId });
    selectNode(nodeId);
  }, [selectNode]);

  const openLinkDetail = useCallback((linkId: string) => {
    setShowDetailModal({ type: 'link', id: linkId });
    selectLink(linkId);
  }, [selectLink]);

  const closeDetailModal = useCallback(() => {
    setShowDetailModal(null);
  }, []);

  const startLinkCreation = useCallback((nodeId: string) => {
    const node = viewNodeById.get(nodeId);
    if (!node) {
      return;
    }

    const actualNode = indexes.nodeById.get(node.refNodeId);
    if (!actualNode || !isLeafNode(actualNode)) {
      return;
    }

    const isSource =
      node.direction === 'input' ||
      (actualNode.kind === 'neuron' && node.direction === 'internal');
    if (!isSource) {
      return;
    }

    setPendingLinkSourceId(nodeId);
    selectNode(nodeId);
  }, [indexes.nodeById, selectNode, viewNodeById]);

  const finishLinkCreation = useCallback(
    (targetNodeId: string) => {
      if (!pendingLinkSourceId) {
        return;
      }

      const sourceViewNode = viewNodeById.get(pendingLinkSourceId);
      const targetViewNode = viewNodeById.get(targetNodeId);
      if (!sourceViewNode || !targetViewNode) {
        return;
      }

      const sourceNode = indexes.nodeById.get(sourceViewNode.refNodeId);
      const targetNode = indexes.nodeById.get(targetViewNode.refNodeId);
      if (!sourceNode || !targetNode || !isLeafNode(sourceNode) || !isLeafNode(targetNode)) {
        return;
      }

      const canSource =
        sourceViewNode.direction === 'input' ||
        (sourceNode.kind === 'neuron' && sourceViewNode.direction === 'internal');
      const canTarget =
        targetViewNode.direction === 'output' ||
        (targetNode.kind === 'neuron' && targetViewNode.direction === 'internal');
      if (!canSource || !canTarget || sourceNode.id === targetNode.id) {
        setPendingLinkSourceId(null);
        return;
      }

      const sourceIsLocalLeaf = localLeafIds.has(sourceNode.id);
      const targetIsLocalLeaf = localLeafIds.has(targetNode.id);
      if (!sourceIsLocalLeaf && !targetIsLocalLeaf) {
        setPendingLinkSourceId(null);
        setSelection({ nodeId: null, linkId: null });
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
        setPendingLinkSourceId(null);
        setSelection({ nodeId: null, linkId: existingLink.id });
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
      setPendingLinkSourceId(null);
      setSelection({ nodeId: null, linkId: nextLink.id });
    },
    [indexes.nodeById, localLeafIds, pendingLinkSourceId, setDocument, viewNodeById]
  );

  const cancelPendingLink = useCallback(() => {
    setPendingLinkSourceId(null);
  }, []);

  const removeSelected = useCallback(() => {
    if (selection.linkId) {
      const linkId = selection.linkId;
      setDocument((current) => ({
        ...current,
        root: {
          ...current.root,
          links: current.root.links.filter((link) => link.id !== linkId),
        },
      }));
      setSelection({ nodeId: null, linkId: null });
      if (showDetailModal?.type === 'link' && showDetailModal.id === linkId) {
        setShowDetailModal(null);
      }
      return;
    }

    if (!selection.nodeId || navigationPath.length === 0) {
      return;
    }

    const selectedNode = viewNodeById.get(selection.nodeId);
    if (!selectedNode || selectedNode.proxy) {
      return;
    }

    const nodeId = selectedNode.refNodeId;
    const nextRoot = updateChildrenAtPath(documentRef.current.root, navigationPath, (children) =>
      children.filter((child) => child.id !== nodeId)
    );
    setDocument((current) => ({
      ...current,
      root: {
        ...nextRoot,
        links: current.root.links.filter(
          (link) => link.from.nodeId !== nodeId && link.to.nodeId !== nodeId
        ),
      },
    }));
    setSelection({ nodeId: null, linkId: null });
    if (showDetailModal?.type === 'node' && showDetailModal.id === nodeId) {
      setShowDetailModal(null);
    }
  }, [navigationPath, selection, setDocument, showDetailModal, viewNodeById]);

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
        position: {
          x: Math.max(24, Math.round(x - NODE_CARD.width / 2)),
          y: Math.max(24, Math.round(y - NODE_CARD.height / 2)),
        },
      };

      setDocument((current) => ({
        ...current,
        root: updateChildrenAtPath(current.root, navigationPath, (children) => [...children, nextNode]),
      }));
      setSelection({ nodeId: nextNode.id, linkId: null });
      setPendingLinkSourceId(null);
    },
    [currentChildren, currentContainerKind, navigationPath, setDocument]
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

  return {
    breadcrumbs,
    currentScope,
    nodes,
    links,
    selection,
    pendingLinkSourceId,
    showDetailModal,
    viewNodeById,
    activeNode,
    activeLink,
    activeNodeModel,
    activeNeuronParameters,
    navigateTo,
    navigateToBreadcrumb,
    selectNode,
    selectLink,
    openNodeDetail,
    openLinkDetail,
    closeDetailModal,
    startLinkCreation,
    finishLinkCreation,
    cancelPendingLink,
    removeSelected,
    addNeuronAt,
    updateNodeLabelAndParams,
    updateLinkWeight,
  };
};
