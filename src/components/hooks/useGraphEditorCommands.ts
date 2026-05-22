import { useCallback } from 'react';
import type {
  BrainContainerNode,
  AgentIR,
  GraphIRDocument,
  LiteralValue,
  NeuronGroupNode,
  NeuronNode,
  Position,
  RootGraph,
  SignalNode,
  TopologyNode,
} from '../../domain/brain';
import {
  CHILD_SCOPE_OFFSET,
  EXPANDED_GROUP_PADDING,
  LEAF_NODE_SIZE,
  isContainerNode,
  isLeafNode,
} from '../editor/graph/graphViewModel';
import type { GraphViewNode } from '../editor/graph/graphViewTypes';
import { canGraphNodesConnect } from '../editor/graph/graphLinkPolicy';
import type {
  DetailModalData,
  GraphDocumentChangeOptions,
  GraphNodePositionUpdate,
  GraphPoint,
  GraphSelectionState,
} from './useSNNTopologyState';

type NodePositionDraftMap = Record<string, Position>;

const INPUT_PORT_ID = 'in';
const OUTPUT_PORT_ID = 'out';
const NEURON_INPUT_PORT_ID = 'dendrite';
const NEURON_OUTPUT_PORT_ID = 'axon';
const LEGACY_ROOT_GROUP_ID = 'core-neuron-group';

const uniqueIds = (ids: string[]) => Array.from(new Set(ids));

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getNextNumericId = (ids: Iterable<string>, prefix: string) => {
  const pattern = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  let maxId = 0;

  for (const id of ids) {
    const match = id.match(pattern);
    if (!match) {
      continue;
    }

    maxId = Math.max(maxId, Number.parseInt(match[1], 10));
  }

  return maxId + 1;
};

const toRoundedPosition = ({ x, y }: GraphPoint): Position => ({
  x: Math.round(x),
  y: Math.round(y),
});

const getLeafPortId = (node: NeuronNode | SignalNode, direction: 'input' | 'output') => {
  if (node.kind === 'neuron') {
    return direction === 'input' ? NEURON_INPUT_PORT_ID : NEURON_OUTPUT_PORT_ID;
  }

  return direction === 'input' ? INPUT_PORT_ID : OUTPUT_PORT_ID;
};

const toStoredPosition = (position: GraphPoint, scope: 'root' | 'child'): Position => {
  if (scope === 'child') {
    return toRoundedPosition({
      x: position.x - CHILD_SCOPE_OFFSET.x,
      y: position.y - CHILD_SCOPE_OFFSET.y,
    });
  }

  return toRoundedPosition(position);
};

const clampPositionInsideExpandedParent = (position: GraphPoint, viewNode: GraphViewNode, parentNode: GraphViewNode): GraphPoint => ({
  x: Math.round(
    Math.min(
      Math.max(position.x, parentNode.x + EXPANDED_GROUP_PADDING),
      parentNode.x + parentNode.width - EXPANDED_GROUP_PADDING - viewNode.width
    )
  ),
  y: Math.round(
    Math.min(
      Math.max(position.y, parentNode.y + EXPANDED_GROUP_PADDING),
      parentNode.y + parentNode.height - EXPANDED_GROUP_PADDING - viewNode.height
    )
  ),
});

const toStoredPositionForViewNode = (
  position: GraphPoint,
  viewNode: GraphViewNode,
  viewNodeById: Map<string, GraphViewNode>,
  scope: 'root' | 'child'
): Position => {
  if (viewNode.expansionParentId) {
    const parentNode = viewNodeById.get(viewNode.expansionParentId);
    if (parentNode) {
      const clampedPosition = clampPositionInsideExpandedParent(position, viewNode, parentNode);
      return toRoundedPosition({
        x: clampedPosition.x - parentNode.x - viewNode.expansionOffsetX,
        y: clampedPosition.y - parentNode.y - viewNode.expansionOffsetY,
      });
    }
  }

  return toStoredPosition(position, scope);
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

const collectLeafNodeIds = (nodes: TopologyNode[]): Set<string> => {
  const leafNodeIds = new Set<string>();

  const visit = (node: TopologyNode) => {
    if (isLeafNode(node)) {
      leafNodeIds.add(node.id);
      return;
    }

    if (isContainerNode(node)) {
      node.children.forEach(visit);
    }
  };

  nodes.forEach(visit);
  return leafNodeIds;
};

const removeNodesById = (nodes: TopologyNode[], removableNodeIds: Set<string>): TopologyNode[] =>
  nodes
    .filter((node) => !removableNodeIds.has(node.id))
    .map((node) =>
      isContainerNode(node)
        ? {
            ...node,
            children: removeNodesById(node.children, removableNodeIds),
          }
        : node
    );

const cloneTopologyNodeWithPosition = (node: TopologyNode, position: Position): TopologyNode => ({
  ...node,
  position,
});

const updateAgentLayoutNodeState = (
  agent: AgentIR,
  layoutNodeId: string,
  updater: (current: NonNullable<AgentIR['layout']>['nodes'][string]) => NonNullable<AgentIR['layout']>['nodes'][string]
): AgentIR => ({
  ...agent,
  layout: {
    version: 1,
    ...(agent.layout ?? {}),
    nodes: {
      ...(agent.layout?.nodes ?? {}),
      [layoutNodeId]: updater(agent.layout?.nodes[layoutNodeId] ?? {}),
    },
  },
});

const updateBrainContainerById = (
  containers: BrainContainerNode[],
  containerId: string,
  updater: (container: BrainContainerNode) => BrainContainerNode
): BrainContainerNode[] =>
  containers.map((container) => (container.id === containerId ? updater(container) : container));

const resolveCurrentBrainContainerId = (agent: AgentIR, navigationPath: string[]): string | null => {
  if (navigationPath.length === 0) {
    return null;
  }

  const currentNodeId = navigationPath[navigationPath.length - 1]!;
  if (currentNodeId === LEGACY_ROOT_GROUP_ID) {
    return agent.brain.rootContainerId;
  }

  return agent.brain.containers.some((container) => container.id === currentNodeId) ? currentNodeId : null;
};

const toAgentEndpoint = (
  node: NeuronNode | SignalNode,
  direction: 'input' | 'output'
): AgentIR['connections'][number]['from'] => ({
  scope: node.kind === 'signal' ? (direction === 'output' ? 'bodyInput' : 'bodyOutput') : 'brain',
  nodeId: node.id,
  portId: getLeafPortId(node, direction),
});

const collectRemovableContainerIds = (
  containersById: Map<string, BrainContainerNode>,
  initialContainerIds: string[]
): Set<string> => {
  const removableContainerIds = new Set<string>();
  const visit = (containerId: string) => {
    if (removableContainerIds.has(containerId)) {
      return;
    }

    removableContainerIds.add(containerId);
    const container = containersById.get(containerId);
    if (!container) {
      return;
    }

    for (const child of container.children) {
      if (child.scope === 'container') {
        visit(child.nodeId);
      }
    }
  };

  initialContainerIds.forEach(visit);
  return removableContainerIds;
};

const collectNeuronIdsInContainers = (
  containersById: Map<string, BrainContainerNode>,
  containerIds: Set<string>
): Set<string> => {
  const neuronIds = new Set<string>();
  for (const containerId of containerIds) {
    const container = containersById.get(containerId);
    if (!container) {
      continue;
    }

    for (const child of container.children) {
      if (child.scope === 'brain') {
        neuronIds.add(child.nodeId);
      }
    }
  }
  return neuronIds;
};

interface GraphEditorCommandDependencies {
  documentRef: React.MutableRefObject<GraphIRDocument>;
  setDocument: (updater: (current: GraphIRDocument) => GraphIRDocument, options?: GraphDocumentChangeOptions) => void;
  setAgent: (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => void;
  currentScope: 'root' | 'child';
  currentContainerKind: 'root' | 'adapter' | 'neuron-group';
  currentChildren: TopologyNode[];
  navigationPath: string[];
  indexes: {
    nodeById: Map<string, TopologyNode>;
    pathById: Map<string, string[]>;
  };
  localLeafIds: Set<string>;
  viewNodeById: Map<string, GraphViewNode>;
  selectionState: GraphSelectionState;
  draftNodePositions: NodePositionDraftMap;
  setDraftNodePositions: React.Dispatch<React.SetStateAction<NodePositionDraftMap>>;
  clearSelection: () => void;
  scheduleFocusNode: (nodeId: string | null) => void;
  scheduleFocusLink: (linkId: string | null) => void;
  clearSelectionRect: () => void;
  clearDraftNodePositions: () => void;
  closeDetailModal: () => void;
  dismissDetailModalIf: (predicate: (detail: DetailModalData) => boolean) => void;
}

export const useGraphEditorCommands = ({
  documentRef,
  setDocument,
  setAgent,
  currentScope,
  currentContainerKind,
  currentChildren,
  navigationPath,
  indexes,
  localLeafIds,
  viewNodeById,
  selectionState,
  draftNodePositions,
  setDraftNodePositions,
  clearSelection,
  scheduleFocusNode,
  scheduleFocusLink,
  clearSelectionRect,
  clearDraftNodePositions,
  closeDetailModal,
  dismissDetailModalIf,
}: GraphEditorCommandDependencies) => {
  const connectSourceNodesToTarget = useCallback(
    (sourceNodeIds: string[], targetNodeId: string) => {
      const targetViewNode = viewNodeById.get(targetNodeId);
      if (!targetViewNode) {
        return;
      }

      const targetNode = indexes.nodeById.get(targetViewNode.refNodeId);
      if (!targetNode || !isLeafNode(targetNode)) {
        return;
      }

      const uniqueSourceNodeIds = uniqueIds(sourceNodeIds);
      const nextConnections: AgentIR['connections'] = [];
      const resolvedLinkIds: string[] = [];
      const attemptedEndpoints = new Set<string>();
      const timestamp = Date.now();

      for (const sourceNodeId of uniqueSourceNodeIds) {
        const sourceViewNode = viewNodeById.get(sourceNodeId);
        if (!sourceViewNode) {
          continue;
        }

        const sourceNode = indexes.nodeById.get(sourceViewNode.refNodeId);
        if (!sourceNode || !isLeafNode(sourceNode)) {
          continue;
        }

        if (
          !canGraphNodesConnect({
            sourceNode: sourceViewNode,
            targetNode: targetViewNode,
            currentScope,
            localLeafIds,
          })
        ) {
          continue;
        }

        const fromPortId = getLeafPortId(sourceNode, 'output');
        const toPortId = getLeafPortId(targetNode, 'input');
        const endpointKey = `${sourceNode.id}:${fromPortId}->${targetNode.id}:${toPortId}`;
        if (attemptedEndpoints.has(endpointKey)) {
          continue;
        }

        attemptedEndpoints.add(endpointKey);
        const existingLink = [...documentRef.current.root.links].find(
          (link) =>
            link.from.nodeId === sourceNode.id &&
            link.from.portId === fromPortId &&
            link.to.nodeId === targetNode.id &&
            link.to.portId === toPortId
        );
        if (existingLink) {
          resolvedLinkIds.push(existingLink.id);
          continue;
        }

        const nextLinkId = `link-${sourceNode.id}-${targetNode.id}-${timestamp}-${nextConnections.length}`;
        const nextConnection: AgentIR['connections'][number] = {
          id: nextLinkId,
          from: toAgentEndpoint(sourceNode, 'output'),
          to: toAgentEndpoint(targetNode, 'input'),
          weight: 0.8,
        };
        nextConnections.push(nextConnection);
        resolvedLinkIds.push(nextLinkId);
      }

      if (nextConnections.length > 0) {
        setAgent((current) => ({
          ...current,
          connections: [...current.connections, ...nextConnections],
        }));
      }

      if (resolvedLinkIds.length === 0) {
        return;
      }

      scheduleFocusLink(resolvedLinkIds.at(-1) ?? null);
    },
    [documentRef, indexes.nodeById, localLeafIds, scheduleFocusLink, setAgent, viewNodeById]
  );

  const updateNodePositionsInDraft = useCallback(
    (updates: GraphNodePositionUpdate[]) => {
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

          nextDrafts[viewNode.refNodeId] = toStoredPositionForViewNode(update, viewNode, viewNodeById, currentScope);
        }
        return nextDrafts;
      });
    },
    [currentScope, setDraftNodePositions, viewNodeById]
  );

  const commitNodeDraftPositions = useCallback(
    (positions?: NodePositionDraftMap) => {
      const positionsToCommit = positions ?? draftNodePositions;
      if (Object.keys(positionsToCommit).length === 0) {
        return;
      }

      setAgent((current) => {
        let nextAgent = current;
        for (const [nodeId, position] of Object.entries(positionsToCommit)) {
          nextAgent = updateAgentLayoutNodeState(nextAgent, nodeId, (layoutNode) => ({
            ...layoutNode,
            position,
          }));
        }
        return nextAgent;
      }, { installToRuntime: false });
      setDraftNodePositions({});
    },
    [draftNodePositions, setAgent, setDraftNodePositions]
  );

  const discardNodeDraftPositions = useCallback(() => {
    setDraftNodePositions({});
  }, [setDraftNodePositions]);

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

        positions[viewNode.refNodeId] = toStoredPositionForViewNode(update, viewNode, viewNodeById, currentScope);
      }

      if (Object.keys(positions).length === 0) {
        return;
      }

      commitNodeDraftPositions(positions);
    },
    [commitNodeDraftPositions, currentScope, viewNodeById]
  );

  const removeSelected = useCallback(() => {
    if (selectionState.linkId) {
      const removableLinkId = selectionState.linkId;
      setAgent((current) => ({
        ...current,
        connections: current.connections.filter((link) => link.id !== removableLinkId),
      }));
      clearSelection();
      dismissDetailModalIf((detail) => detail.type === 'link' && detail.id === removableLinkId);
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
    const removableLeafNodeIds = collectLeafNodeIds(
      selectedViewNodes
        .map((node) => indexes.nodeById.get(node.refNodeId))
        .filter((node): node is TopologyNode => node != null)
    );
    const removableContainerIds = collectRemovableContainerIds(
      new Map(
        currentChildren
          .filter((child): child is NeuronGroupNode => child.kind === 'neuron-group' && removableNodeIds.has(child.id))
          .map((child) => [
            child.id,
            {
              id: child.id,
              label: child.label,
              children: child.children.map((nestedChild) => ({
                scope: nestedChild.kind === 'neuron-group' ? 'container' : 'brain',
                nodeId: nestedChild.id,
              })),
            } satisfies BrainContainerNode,
          ] as const)
      ),
      currentChildren
        .filter((child): child is NeuronGroupNode => child.kind === 'neuron-group' && removableNodeIds.has(child.id))
        .map((child) => child.id)
    );
    setAgent((current) => {
      const containersById = new Map(current.brain.containers.map((container) => [container.id, container]));
      const expandedRemovableContainerIds = collectRemovableContainerIds(containersById, [...removableContainerIds]);
      const expandedRemovableNeuronIds = new Set([
        ...removableLeafNodeIds,
        ...collectNeuronIdsInContainers(containersById, expandedRemovableContainerIds),
      ]);

      return {
        ...current,
        brain: {
          ...current.brain,
          neurons: current.brain.neurons.filter((neuron) => !expandedRemovableNeuronIds.has(neuron.id)),
          containers: current.brain.containers
            .filter((container) => !expandedRemovableContainerIds.has(container.id))
            .map((container) => ({
              ...container,
              children: container.children.filter(
                (child) =>
                  !expandedRemovableNeuronIds.has(child.nodeId) &&
                  !expandedRemovableContainerIds.has(child.nodeId)
              ),
            })),
        },
        connections: current.connections.filter(
          (link) =>
            !expandedRemovableNeuronIds.has(link.from.nodeId) &&
            !expandedRemovableNeuronIds.has(link.to.nodeId) &&
            !removableNodeIds.has(link.from.nodeId) &&
            !removableNodeIds.has(link.to.nodeId)
        ),
        layout: current.layout
          ? {
              ...current.layout,
              nodes: Object.fromEntries(
                Object.entries(current.layout.nodes).filter(
                  ([nodeId]) =>
                    !expandedRemovableNeuronIds.has(nodeId) &&
                    !expandedRemovableContainerIds.has(nodeId) &&
                    !removableNodeIds.has(nodeId)
                )
              ),
            }
          : current.layout,
      };
    });
    clearSelection();
    dismissDetailModalIf((detail) => detail.type === 'node' && removableNodeIds.has(detail.id));
  }, [
    clearSelection,
    dismissDetailModalIf,
    indexes.nodeById,
    navigationPath,
    selectionState,
    setAgent,
    viewNodeById,
  ]);

  const addNeuronAt = useCallback(
    (x: number, y: number) => {
      if (navigationPath.length === 0 || currentContainerKind !== 'neuron-group') {
        return null;
      }

      const siblingIndex = currentChildren.filter((child) => child.kind === 'neuron').length + 1;
      const nextNeuronId = `neuron-${getNextNumericId(indexes.nodeById.keys(), 'neuron-')}`;
      const storedPosition = toStoredPosition({ x, y }, currentScope);
      setAgent((current) => {
        const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
        if (!currentContainerId) {
          return current;
        }

        return updateAgentLayoutNodeState(
          {
            ...current,
            brain: {
              ...current.brain,
              neurons: [
                ...current.brain.neurons,
                {
                  id: nextNeuronId,
                  label: `神经元${siblingIndex}`,
                  model: 'izhikevich',
                  params: {
                    a: 0.02,
                    b: 0.2,
                    c: -65,
                    d: 8,
                    threshold: 30,
                  },
                  initialState: {
                    v: -65,
                  },
                },
              ],
              containers: updateBrainContainerById(current.brain.containers, currentContainerId, (container) => ({
                ...container,
                children: [...container.children, { scope: 'brain', nodeId: nextNeuronId }],
              })),
            },
          },
          nextNeuronId,
          (layoutNode) => ({
            ...layoutNode,
            position: storedPosition,
          })
        );
      });
      scheduleFocusNode(nextNeuronId);
      return nextNeuronId;
    },
    [currentChildren, currentContainerKind, currentScope, indexes.nodeById, navigationPath, scheduleFocusNode, setAgent]
  );

  const addNeuronGroupAt = useCallback(
    (x: number, y: number) => {
      if (navigationPath.length === 0 || currentContainerKind !== 'neuron-group') {
        return null;
      }

      const groupIndex = currentChildren.filter((child) => child.kind === 'neuron-group').length + 1;
      const nextGroupId = `group-${getNextNumericId(indexes.nodeById.keys(), 'group-')}`;
      const storedPosition = toStoredPosition({ x, y }, currentScope);

      setAgent((current) => {
        const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
        if (!currentContainerId) {
          return current;
        }

        return updateAgentLayoutNodeState(
          {
            ...current,
            brain: {
              ...current.brain,
              containers: [
                ...updateBrainContainerById(current.brain.containers, currentContainerId, (container) => ({
                  ...container,
                  children: [...container.children, { scope: 'container', nodeId: nextGroupId }],
                })),
                {
                  id: nextGroupId,
                  label: `神经元组${groupIndex}`,
                  children: [],
                },
              ],
            },
          },
          nextGroupId,
          (layoutNode) => ({
            ...layoutNode,
            position: storedPosition,
          })
        );
      });
      scheduleFocusNode(nextGroupId);
      return nextGroupId;
    },
    [currentChildren, currentContainerKind, currentScope, indexes.nodeById, navigationPath, scheduleFocusNode, setAgent]
  );

  const createNeuronAndConnectAt = useCallback(
    (sourceNodeIds: string[], x: number, y: number) => {
      const nextNeuronId = addNeuronAt(x, y);
      if (!nextNeuronId) {
        return;
      }

      const nextTargetNode: GraphViewNode = {
        id: nextNeuronId,
        viewId: nextNeuronId,
        refNodeId: nextNeuronId,
        label: nextNeuronId,
        kind: 'neuron',
        x,
        y,
        width: LEAF_NODE_SIZE,
        height: LEAF_NODE_SIZE,
        parentId: navigationPath.at(-1) ?? null,
        detail: '',
        editable: true,
        navigable: false,
        leaf: true,
        proxy: false,
        movable: true,
        local: true,
        direction: 'internal',
        connectableSource: true,
        connectableTarget: true,
        expanded: false,
        expansionParentId: null,
        expansionOffsetX: 0,
        expansionOffsetY: 0,
      };

      const uniqueSourceNodeIds = uniqueIds(sourceNodeIds);
      const nextConnections: AgentIR['connections'] = [];
      const resolvedLinkIds: string[] = [];
      const attemptedEndpoints = new Set<string>();
      const timestamp = Date.now();

      for (const sourceNodeId of uniqueSourceNodeIds) {
        const sourceViewNode = viewNodeById.get(sourceNodeId);
        if (!sourceViewNode) {
          continue;
        }

        const sourceNode = indexes.nodeById.get(sourceViewNode.refNodeId);
        if (!sourceNode || !isLeafNode(sourceNode)) {
          continue;
        }

        if (
          !canGraphNodesConnect({
            sourceNode: sourceViewNode,
            targetNode: nextTargetNode,
            currentScope,
            localLeafIds,
          })
        ) {
          continue;
        }

        const fromPortId = getLeafPortId(sourceNode, 'output');
        const toPortId = NEURON_INPUT_PORT_ID;
        const endpointKey = `${sourceNode.id}:${fromPortId}->${nextNeuronId}:${toPortId}`;
        if (attemptedEndpoints.has(endpointKey)) {
          continue;
        }

        attemptedEndpoints.add(endpointKey);
        const nextLinkId = `link-${sourceNode.id}-${nextNeuronId}-${timestamp}-${nextConnections.length}`;
        nextConnections.push({
          id: nextLinkId,
          from: toAgentEndpoint(sourceNode, 'output'),
          to: {
            scope: 'brain',
            nodeId: nextNeuronId,
            portId: toPortId,
          },
          weight: 0.8,
        });
        resolvedLinkIds.push(nextLinkId);
      }

      if (nextConnections.length === 0) {
        return;
      }

      setAgent((current) => ({
        ...current,
        connections: [...current.connections, ...nextConnections],
      }));
      scheduleFocusLink(resolvedLinkIds.at(-1) ?? null);
    },
    [
      addNeuronAt,
      currentScope,
      indexes.nodeById,
      localLeafIds,
      navigationPath,
      scheduleFocusLink,
      setAgent,
      viewNodeById,
    ]
  );

  const aggregateSelectedNodes = useCallback(() => {
    if (currentContainerKind !== 'neuron-group' || selectionState.nodeIds.length < 2) {
      return;
    }

    const selectedNodeIdSet = new Set(selectionState.nodeIds);
    const selectedChildren = currentChildren.filter((child) => selectedNodeIdSet.has(child.id));
    if (selectedChildren.length < 2) {
      return;
    }

    const selectedViewNodes = selectedChildren
      .map((child) => viewNodeById.get(child.id))
      .filter((node): node is GraphViewNode => node != null && !node.proxy);
    if (selectedViewNodes.length !== selectedChildren.length) {
      return;
    }

    const minX = Math.min(...selectedViewNodes.map((node) => node.x));
    const minY = Math.min(...selectedViewNodes.map((node) => node.y));
    const groupIndex = currentChildren.filter((child) => child.kind === 'neuron-group').length + 1;
    const nextGroupId = `group-${getNextNumericId(indexes.nodeById.keys(), 'group-')}`;
    const nextGroup: NeuronGroupNode = {
      kind: 'neuron-group',
      id: nextGroupId,
      label: `神经元组${groupIndex}`,
      position: toStoredPosition({ x: minX, y: minY }, currentScope),
      children: selectedChildren.map((child) => {
        const viewNode = viewNodeById.get(child.id);
        if (!viewNode) {
          return child;
        }

        return cloneTopologyNodeWithPosition(child, {
          x: Math.round(viewNode.x - minX),
          y: Math.round(viewNode.y - minY),
        });
      }),
    };

    setDocument((current) => ({
      ...current,
      root: updateChildrenAtPath(current.root, navigationPath, (children) => {
        const nextChildren: TopologyNode[] = [];
        let inserted = false;

        for (const child of children) {
          if (selectedNodeIdSet.has(child.id)) {
            if (!inserted) {
              nextChildren.push(nextGroup);
              inserted = true;
            }
            continue;
          }

          nextChildren.push(child);
        }

        return nextChildren;
      }),
    }));
    scheduleFocusNode(nextGroupId);
    closeDetailModal();
    clearSelectionRect();
    clearDraftNodePositions();
  }, [
    clearDraftNodePositions,
    clearSelectionRect,
    closeDetailModal,
    currentChildren,
    currentContainerKind,
    currentScope,
    indexes.nodeById,
    navigationPath,
    scheduleFocusNode,
    selectionState.nodeIds,
    setDocument,
    viewNodeById,
  ]);

  const ungroupNode = useCallback(
    (nodeId: string) => {
      if (currentContainerKind !== 'neuron-group') {
        return;
      }

      const targetGroup = currentChildren.find((child) => child.id === nodeId);
      if (!targetGroup || targetGroup.kind !== 'neuron-group') {
        return;
      }

      const groupPosition = targetGroup.position ?? { x: 0, y: 0 };
      const ungroupedChildren = targetGroup.children.map((child) => ({
        ...child,
        position: {
          x: (child.position?.x ?? 0) + groupPosition.x,
          y: (child.position?.y ?? 0) + groupPosition.y,
        },
      }));

      setDocument((current) => ({
        ...current,
        root: updateChildrenAtPath(current.root, navigationPath, (children) => {
          const nextChildren: TopologyNode[] = [];
          for (const child of children) {
            if (child.id === nodeId && child.kind === 'neuron-group') {
              nextChildren.push(...ungroupedChildren);
              continue;
            }

            nextChildren.push(child);
          }

          return nextChildren;
        }),
      }));
      clearSelection();
      closeDetailModal();
      clearSelectionRect();
      clearDraftNodePositions();
    },
    [
      clearDraftNodePositions,
      clearSelection,
      clearSelectionRect,
      closeDetailModal,
      currentChildren,
      currentContainerKind,
      navigationPath,
      setDocument,
    ]
  );

  const toggleGroupExpanded = useCallback(
    (nodeId: string) => {
      const viewNode = viewNodeById.get(nodeId);
      const layoutNodeId = viewNode?.refNodeId ?? nodeId;
      setAgent(
        (current) =>
          updateAgentLayoutNodeState(current, layoutNodeId, (layoutNode) => ({
            ...layoutNode,
            collapsed: layoutNode.collapsed === false ? true : false,
          })),
        { installToRuntime: false }
      );
      clearSelectionRect();
      clearDraftNodePositions();
    },
    [clearDraftNodePositions, clearSelectionRect, setAgent, viewNodeById]
  );

  const updateNodeLabelAndParams = useCallback(
    (nodeId: string, payload: { label: string; parameterOverrides?: Record<string, LiteralValue> }) => {
      setAgent((current) => ({
        ...current,
        brain: {
          ...current.brain,
          neurons: current.brain.neurons.map((neuron) =>
            neuron.id === nodeId
              ? {
                  ...neuron,
                  label: payload.label,
                  params: {
                    ...neuron.params,
                    ...(typeof payload.parameterOverrides?.a === 'number' ? { a: payload.parameterOverrides.a } : {}),
                    ...(typeof payload.parameterOverrides?.b === 'number' ? { b: payload.parameterOverrides.b } : {}),
                    ...(typeof payload.parameterOverrides?.c === 'number' ? { c: payload.parameterOverrides.c } : {}),
                    ...(typeof payload.parameterOverrides?.d === 'number' ? { d: payload.parameterOverrides.d } : {}),
                    ...(typeof payload.parameterOverrides?.threshold === 'number'
                      ? { threshold: payload.parameterOverrides.threshold }
                      : {}),
                  },
                }
              : neuron
          ),
        },
      }));
    },
    [setAgent]
  );

  const updateLinkWeight = useCallback(
    (linkId: string, weight: number) => {
      setAgent((current) => ({
        ...current,
        connections: current.connections.map((link) =>
          link.id === linkId
            ? {
                ...link,
                weight,
              }
            : link
        ),
      }));
    },
    [setAgent]
  );

  return {
    connectSourceNodesToTarget,
    updateNodePositionsInDraft,
    discardNodeDraftPositions,
    persistNodePositions,
    removeSelected,
    addNeuronAt,
    addNeuronGroupAt,
    createNeuronAndConnectAt,
    aggregateSelectedNodes,
    ungroupNode,
    toggleGroupExpanded,
    updateNodeLabelAndParams,
    updateLinkWeight,
  };
};
