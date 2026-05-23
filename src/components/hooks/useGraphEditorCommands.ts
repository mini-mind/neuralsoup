import { useCallback } from 'react';
import type {
  BrainContainerNode,
  AgentIR,
} from '../../domain/brain';
import type { Position } from '../../domain/brain/shared';
import {
  AGENT_GRAPH_CHILD_SCOPE_OFFSET,
  AGENT_GRAPH_EXPANDED_GROUP_PADDING,
  AGENT_GRAPH_LEAF_NODE_SIZE,
  AGENT_GRAPH_ROOT_BRAIN_GROUP_ID,
} from '../editor/graph/agentGraphViewConstants';
import {
  aggregateAgentNodesIntoGroup,
  createNeuronAndConnectInContainer,
  ungroupAgentContainer,
} from '../editor/graph/agentGraphEditing';
import type { GraphNodeUpdatePayload } from '../editor/graph/graphNodeUpdate';
import type { GraphViewNode } from '../editor/graph/graphViewTypes';
import type { AgentGraphViewIndexes, AgentGraphViewNodeRecord } from '../editor/graph/agentGraphViewModel';
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

type AgentLeafNodeRecord = AgentGraphViewNodeRecord & { kind: 'neuron' | 'signal' };

const isAgentLeafNodeRecord = (node: AgentGraphViewNodeRecord | null | undefined): node is AgentLeafNodeRecord =>
  node?.kind === 'neuron' || node?.kind === 'signal';

const getLeafPortId = (node: AgentLeafNodeRecord, direction: 'input' | 'output') => {
  if (node.kind === 'neuron') {
    return direction === 'input' ? NEURON_INPUT_PORT_ID : NEURON_OUTPUT_PORT_ID;
  }

  return direction === 'input' ? INPUT_PORT_ID : OUTPUT_PORT_ID;
};

const toStoredPosition = (position: GraphPoint, scope: 'root' | 'child'): Position => {
  if (scope === 'child') {
    return toRoundedPosition({
      x: position.x - AGENT_GRAPH_CHILD_SCOPE_OFFSET.x,
      y: position.y - AGENT_GRAPH_CHILD_SCOPE_OFFSET.y,
    });
  }

  return toRoundedPosition(position);
};

const clampPositionInsideExpandedParent = (position: GraphPoint, viewNode: GraphViewNode, parentNode: GraphViewNode): GraphPoint => ({
  x: Math.round(
    Math.min(
      Math.max(position.x, parentNode.x + AGENT_GRAPH_EXPANDED_GROUP_PADDING),
      parentNode.x + parentNode.width - AGENT_GRAPH_EXPANDED_GROUP_PADDING - viewNode.width
    )
  ),
  y: Math.round(
    Math.min(
      Math.max(position.y, parentNode.y + AGENT_GRAPH_EXPANDED_GROUP_PADDING),
      parentNode.y + parentNode.height - AGENT_GRAPH_EXPANDED_GROUP_PADDING - viewNode.height
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
  if (currentNodeId === AGENT_GRAPH_ROOT_BRAIN_GROUP_ID) {
    return agent.brain.rootContainerId;
  }

  return agent.brain.containers.some((container) => container.id === currentNodeId) ? currentNodeId : null;
};

const toAgentEndpoint = (
  node: AgentLeafNodeRecord,
  direction: 'input' | 'output'
): AgentIR['connections'][number]['from'] => ({
  scope: node.kind === 'signal' ? (direction === 'output' ? 'bodyInput' : 'bodyOutput') : 'brain',
  nodeId: node.refNodeId,
  portId: getLeafPortId(node, direction),
});

const collectLeafRecordIds = (
  nodes: AgentGraphViewNodeRecord[],
  indexes: AgentGraphViewIndexes
): Set<string> => {
  const leafNodeIds = new Set<string>();

  const visit = (node: AgentGraphViewNodeRecord) => {
    if (isAgentLeafNodeRecord(node)) {
      leafNodeIds.add(node.refNodeId);
      return;
    }

    if (node.kind !== 'neuron-group') {
      return;
    }

    const container = node.container ?? indexes.containerById.get(node.refNodeId);
    if (!container) {
      return;
    }

    for (const child of container.children) {
      const nextNode = indexes.nodeById.get(child.nodeId);
      if (nextNode) {
        visit(nextNode);
      }
    }
  };

  nodes.forEach(visit);
  return leafNodeIds;
};

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

const collectSelectedContainerIds = (selectedNodes: AgentGraphViewNodeRecord[]): string[] =>
  selectedNodes
    .filter((node) => node.kind === 'neuron-group')
    .map((node) => node.refNodeId);

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
  setAgent: (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => void;
  currentScope: 'root' | 'child';
  currentContainerKind: 'root' | 'adapter' | 'neuron-group';
  currentChildren: AgentGraphViewNodeRecord[];
  navigationPath: string[];
  indexes: AgentGraphViewIndexes;
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
      if (!isAgentLeafNodeRecord(targetNode)) {
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
        if (!isAgentLeafNodeRecord(sourceNode)) {
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
        const existingLink = [...indexes.linkById.values()].find(
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
    [currentScope, indexes.linkById, indexes.nodeById, localLeafIds, scheduleFocusLink, setAgent, viewNodeById]
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
      }, { installToRuntime: false, commitToCurrentDocument: true, persistActiveBrain: true });
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
    const selectedNodeRecords = selectedViewNodes
      .map((node) => indexes.nodeById.get(node.refNodeId))
      .filter((node): node is AgentGraphViewNodeRecord => node != null);
    const removableLeafNodeIds = collectLeafRecordIds(
      selectedNodeRecords,
      indexes
    );
    const removableContainerIds = collectRemovableContainerIds(
      indexes.containerById,
      collectSelectedContainerIds(selectedNodeRecords)
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
      if (navigationPath.length === 0 || currentContainerKind !== 'neuron-group') {
        return;
      }

      const siblingIndex = currentChildren.filter((child) => child.kind === 'neuron').length + 1;
      const nextNeuronId = `neuron-${getNextNumericId(indexes.nodeById.keys(), 'neuron-')}`;
      const nextTargetNode: GraphViewNode = {
        id: nextNeuronId,
        viewId: nextNeuronId,
        refNodeId: nextNeuronId,
        label: nextNeuronId,
        kind: 'neuron',
        x,
        y,
        width: AGENT_GRAPH_LEAF_NODE_SIZE,
        height: AGENT_GRAPH_LEAF_NODE_SIZE,
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
        if (!isAgentLeafNodeRecord(sourceNode)) {
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

      setAgent((current) => {
        const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
        if (!currentContainerId) {
          return current;
        }

        return createNeuronAndConnectInContainer(current, {
          parentContainerId: currentContainerId,
          nextNeuronId,
          nextNeuronLabel: `神经元${siblingIndex}`,
          nextNeuronPosition: toStoredPosition({ x, y }, currentScope),
          connections: nextConnections,
        });
      });
      scheduleFocusNode(nextNeuronId);
      scheduleFocusLink(resolvedLinkIds.at(-1) ?? null);
    },
    [
      currentChildren,
      currentContainerKind,
      currentScope,
      indexes.nodeById,
      localLeafIds,
      navigationPath,
      scheduleFocusNode,
      scheduleFocusLink,
      setAgent,
      viewNodeById,
    ]
  );

  const aggregateSelectedNodes = useCallback(() => {
    if (currentContainerKind !== 'neuron-group' || selectionState.nodeIds.length < 2 || navigationPath.length === 0) {
      return;
    }

    const selectedNodeIdSet = new Set(selectionState.nodeIds.map((nodeId) => viewNodeById.get(nodeId)?.refNodeId ?? nodeId));
    const selectedChildren = currentChildren.filter((child) => selectedNodeIdSet.has(child.refNodeId));
    if (selectedChildren.length < 2) {
      return;
    }

    const selectedViewNodes = selectedChildren
      .map((child) => viewNodeById.get(child.id) ?? viewNodeById.get(child.refNodeId))
      .filter((node): node is GraphViewNode => node != null && !node.proxy);
    if (selectedViewNodes.length !== selectedChildren.length) {
      return;
    }

    const minX = Math.min(...selectedViewNodes.map((node) => node.x));
    const minY = Math.min(...selectedViewNodes.map((node) => node.y));
    const groupIndex = currentChildren.filter((child) => child.kind === 'neuron-group').length + 1;
    const nextGroupId = `group-${getNextNumericId(indexes.nodeById.keys(), 'group-')}`;
    setAgent((current) => {
      const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
      if (!currentContainerId) {
        return current;
      }

      return aggregateAgentNodesIntoGroup(current, {
        parentContainerId: currentContainerId,
        selectedNodeIds: selectedChildren.map((child) => child.refNodeId),
        nextGroupId,
        nextGroupLabel: `神经元组${groupIndex}`,
        nextGroupPosition: toStoredPosition({ x: minX, y: minY }, currentScope),
        childPositionsById: Object.fromEntries(
          selectedChildren.map((child) => {
            const viewNode = viewNodeById.get(child.id) ?? viewNodeById.get(child.refNodeId);
            return [
              child.refNodeId,
              viewNode
                ? {
                    x: Math.round(viewNode.x - minX),
                    y: Math.round(viewNode.y - minY),
                  }
                : { x: 0, y: 0 },
            ];
          })
        ),
      });
    }, { installToRuntime: false, commitToCurrentDocument: true, persistActiveBrain: true });
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
    setAgent,
    viewNodeById,
  ]);

  const ungroupNode = useCallback(
    (nodeId: string) => {
      if (currentContainerKind !== 'neuron-group' || navigationPath.length === 0) {
        return;
      }

      const targetGroup = currentChildren.find((child) => child.id === nodeId || child.refNodeId === nodeId);
      if (!targetGroup || targetGroup.kind !== 'neuron-group') {
        return;
      }

      setAgent((current) => {
        const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
        if (!currentContainerId) {
          return current;
        }

        return ungroupAgentContainer(current, currentContainerId, targetGroup.refNodeId);
      }, { installToRuntime: false, commitToCurrentDocument: true, persistActiveBrain: true });
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
      setAgent,
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
        { installToRuntime: false, commitToCurrentDocument: true, persistActiveBrain: true }
      );
      clearSelection();
      clearSelectionRect();
      clearDraftNodePositions();
    },
    [clearDraftNodePositions, clearSelection, clearSelectionRect, setAgent, viewNodeById]
  );

  const updateNodeLabelAndParams = useCallback(
    (nodeId: string, payload: GraphNodeUpdatePayload) => {
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
                  ...(payload.initialState
                    ? {
                        initialState: {
                          v: payload.initialState.v,
                          ...(typeof payload.initialState.u === 'number' ? { u: payload.initialState.u } : {}),
                        },
                      }
                    : {}),
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
