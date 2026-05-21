import { useCallback } from 'react';
import type {
  GraphIRDocument,
  LeafLink,
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
  isContainerNode,
  isLeafNode,
  type GraphViewNode,
} from '../editor/graph/graphViewModel';
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

const cloneTopologyNodeWithPosition = (node: TopologyNode, position: Position): TopologyNode => ({
  ...node,
  position,
});

interface GraphEditorCommandDependencies {
  documentRef: React.MutableRefObject<GraphIRDocument>;
  setDocument: (updater: (current: GraphIRDocument) => GraphIRDocument, options?: GraphDocumentChangeOptions) => void;
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
      const nextLinks: LeafLink[] = [];
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
        const existingLink = documentRef.current.root.links.find(
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

        const nextLink: LeafLink = {
          id: `link-${sourceNode.id}-${targetNode.id}-${timestamp}-${nextLinks.length}`,
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
        nextLinks.push(nextLink);
        resolvedLinkIds.push(nextLink.id);
      }

      if (nextLinks.length > 0) {
        setDocument((current) => ({
          ...current,
          root: {
            ...current.root,
            links: [...current.root.links, ...nextLinks],
          },
        }));
      }

      if (resolvedLinkIds.length === 0) {
        return;
      }

      scheduleFocusLink(resolvedLinkIds.at(-1) ?? null);
    },
    [documentRef, indexes.nodeById, localLeafIds, scheduleFocusLink, setDocument, viewNodeById]
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

          nextDrafts[viewNode.refNodeId] = toStoredPosition(update, currentScope);
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

      setDocument(
        (current) => ({
          ...current,
          root: updateNodePositions(current.root, positionsToCommit),
        }),
        { installToRuntime: false }
      );
      setDraftNodePositions({});
    },
    [draftNodePositions, setDocument, setDraftNodePositions]
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
    if (selectionState.linkId) {
      const removableLinkId = selectionState.linkId;
      setDocument((current) => ({
        ...current,
        root: {
          ...current.root,
          links: current.root.links.filter((link) => link.id !== removableLinkId),
        },
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
    dismissDetailModalIf((detail) => detail.type === 'node' && removableNodeIds.has(detail.id));
  }, [
    clearSelection,
    dismissDetailModalIf,
    documentRef,
    navigationPath,
    selectionState,
    setDocument,
    viewNodeById,
  ]);

  const addNeuronAt = useCallback(
    (x: number, y: number) => {
      if (navigationPath.length === 0 || currentContainerKind !== 'neuron-group') {
        return;
      }

      const siblingIndex = currentChildren.filter((child) => child.kind === 'neuron').length + 1;
      const nextNeuronId = `neuron-${getNextNumericId(indexes.nodeById.keys(), 'neuron-')}`;
      const nextNode: NeuronNode = {
        kind: 'neuron',
        id: nextNeuronId,
        label: `神经元${siblingIndex}`,
        modelId: 'izhikevich-neuron',
        position: toStoredPosition({ x, y }, currentScope),
      };

      setDocument((current) => ({
        ...current,
        root: updateChildrenAtPath(current.root, navigationPath, (children) => [...children, nextNode]),
      }));
      scheduleFocusNode(nextNode.id);
    },
    [currentChildren, currentContainerKind, currentScope, indexes.nodeById, navigationPath, scheduleFocusNode, setDocument]
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

  return {
    connectSourceNodesToTarget,
    updateNodePositionsInDraft,
    discardNodeDraftPositions,
    persistNodePositions,
    removeSelected,
    addNeuronAt,
    aggregateSelectedNodes,
    updateNodeLabelAndParams,
    updateLinkWeight,
  };
};
