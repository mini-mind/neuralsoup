import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentIR } from '../../domain/brain';
import { buildAgentGraphViewModel } from '../editor/graph/agentGraphViewModel';
import { clampZoom } from '../editor/graph/tools/canvasGeometry';
import { useGraphEditorCommands } from './useGraphEditorCommands';
import { createEmptySelectionState, useGraphEditorSessionState } from './useGraphEditorSessionState';

export interface DetailModalData {
  type: 'node' | 'link';
  id: string;
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
  focusNodeId: string | null;
  linkId: string | null;
}

export type GraphNodeDoubleClickAction = 'navigate' | 'edit' | null;

export interface GraphSelectionOptions {
  additive?: boolean;
}

export interface GraphNodePositionUpdate extends GraphPoint {
  nodeId: string;
}

interface UseSNNTopologyStateOptions {
  agent: AgentIR;
  runtimeActiveNodeIds?: string[];
  onAgentChange?: (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => void;
}

export interface GraphDocumentChangeOptions {
  installToRuntime?: boolean;
}

const getScopeBaseViewport = (scope: 'root' | 'child'): GraphPoint =>
  scope === 'root' ? { x: 0, y: 0 } : { x: 48, y: 36 };

const uniqueIds = (ids: string[]) => Array.from(new Set(ids));

const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const useSNNTopologyState = ({
  agent,
  runtimeActiveNodeIds = [],
  onAgentChange,
}: UseSNNTopologyStateOptions) => {
  const [navigationPath, setNavigationPath] = useState<string[]>([]);
  const {
    selectionState,
    setSelectionState,
    showDetailModal,
    setShowDetailModal,
    selectionRect,
    setSelectionRect,
    canvasViewport,
    setCanvasViewport,
    canvasScale,
    setCanvasScale,
    draftNodePositions,
    setDraftNodePositions,
    pendingFocusNodeId,
    setPendingFocusNodeId,
    pendingFocusLinkId,
    setPendingFocusLinkId,
  } = useGraphEditorSessionState();
  const scopeSessionRef = useRef<string | null>(null);
  const setAgent = useCallback(
    (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => {
      onAgentChange?.(updater, options);
    },
    [onAgentChange]
  );

  const agentViewModel = useMemo(
    () =>
      buildAgentGraphViewModel({
        agent,
        navigationPath,
        draftNodePositions,
        runtimeActiveNodeIds,
      }),
    [agent, draftNodePositions, navigationPath, runtimeActiveNodeIds]
  );
  const {
    breadcrumbs,
    currentScope,
    currentContainerKind,
    scopeKey,
    nodes,
    viewNodeById,
    links,
    activeViewNodeIds,
  } = agentViewModel;
  const localSelectableNodeIds = useMemo(
    () => new Set(nodes.filter((node) => !node.proxy).map((node) => node.viewId)),
    [nodes]
  );

  useEffect(() => {
    setSelectionState((currentSelection) => {
      const nextNodeIds = currentSelection.nodeIds.filter((nodeId) => localSelectableNodeIds.has(nodeId));
      const nextFocusNodeId =
        currentSelection.focusNodeId && nextNodeIds.includes(currentSelection.focusNodeId)
          ? currentSelection.focusNodeId
          : nextNodeIds[0] ?? null;
      const nextLinkId = currentSelection.linkId && links.some((link) => link.id === currentSelection.linkId)
        ? currentSelection.linkId
        : null;

      if (
        areStringArraysEqual(currentSelection.nodeIds, nextNodeIds) &&
        currentSelection.focusNodeId === nextFocusNodeId &&
        currentSelection.linkId === nextLinkId
      ) {
        return currentSelection;
      }

      return {
        nodeIds: nextNodeIds,
        focusNodeId: nextFocusNodeId,
        linkId: nextLinkId,
      };
    });
  }, [links, localSelectableNodeIds]);

  useEffect(() => {
    if (!pendingFocusNodeId || !localSelectableNodeIds.has(pendingFocusNodeId)) {
      return;
    }

    setSelectionState({
      nodeIds: [pendingFocusNodeId],
      focusNodeId: pendingFocusNodeId,
      linkId: null,
    });
    setPendingFocusNodeId(null);
  }, [localSelectableNodeIds, pendingFocusNodeId, setPendingFocusNodeId]);

  useEffect(() => {
    if (!pendingFocusLinkId || !links.some((link) => link.id === pendingFocusLinkId)) {
      return;
    }

    setSelectionState({
      nodeIds: [],
      focusNodeId: null,
      linkId: pendingFocusLinkId,
    });
    setPendingFocusLinkId(null);
  }, [links, pendingFocusLinkId, setPendingFocusLinkId]);

  const activeNode = useMemo(() => {
    if (showDetailModal?.type !== 'node') {
      return null;
    }

    return agentViewModel.indexes.nodeById.get(showDetailModal.id) ?? null;
  }, [agentViewModel.indexes.nodeById, showDetailModal]);

  const activeLink = useMemo(() => {
    if (showDetailModal?.type !== 'link') {
      return null;
    }

    return agent.connections.find((link) => link.id === showDetailModal.id) ?? null;
  }, [agent.connections, showDetailModal]);

  useEffect(() => {
    if (!showDetailModal) {
      return;
    }

    if (showDetailModal.type === 'node' && !activeNode) {
      setShowDetailModal(null);
      return;
    }

    if (showDetailModal.type === 'link' && !activeLink) {
      setShowDetailModal(null);
    }
  }, [activeLink, activeNode, setShowDetailModal, showDetailModal]);

  const clearTransientState = useCallback(() => {
    setSelectionState(createEmptySelectionState());
    setSelectionRect(null);
    setShowDetailModal(null);
    setDraftNodePositions({});
    setCanvasViewport({ x: 0, y: 0 });
    setCanvasScale(1);
    setPendingFocusNodeId(null);
    setPendingFocusLinkId(null);
  }, [setCanvasScale, setPendingFocusLinkId]);

  useEffect(() => {
    if (scopeSessionRef.current === scopeKey) {
      return;
    }

    scopeSessionRef.current = scopeKey;
    setCanvasViewport(getScopeBaseViewport(currentScope));
    setCanvasScale(1);
  }, [currentScope, scopeKey, setCanvasScale]);

  useEffect(() => {
    if (navigationPath.length > 0) {
      return;
    }

    scopeSessionRef.current = 'root';
  }, [navigationPath.length]);

  const navigateTo = useCallback(
    (nodeId: string) => {
      const viewNode = viewNodeById.get(nodeId);
      if (!viewNode?.navigable) {
        return;
      }

      const path =
        agentViewModel.indexes.pathById.get(nodeId) ??
        agentViewModel.indexes.pathById.get(viewNode.refNodeId);
      if (!path) {
        return;
      }

      setNavigationPath(path);
      clearTransientState();
    },
    [agentViewModel.indexes.pathById, clearTransientState, viewNodeById]
  );

  const navigateToBreadcrumb = useCallback(
    (breadcrumbId: string) => {
      if (breadcrumbId === 'root') {
        setNavigationPath([]);
      } else {
        const path = agentViewModel.indexes.pathById.get(breadcrumbId);
        if (!path) {
          return;
        }

        setNavigationPath(path);
      }

      clearTransientState();
    },
    [agentViewModel.indexes.pathById, clearTransientState]
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
            focusNodeId: alreadySelected ? nextNodeIds.at(-1) ?? null : nodeId,
            linkId: null,
          };
        }

        return {
          nodeIds: [nodeId],
          focusNodeId: nodeId,
          linkId: null,
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
            focusNodeId: normalizedNodeIds.at(-1) ?? currentSelection.focusNodeId,
            linkId: null,
          };
        }

        return {
          nodeIds: normalizedNodeIds,
          focusNodeId: normalizedNodeIds.at(-1) ?? null,
          linkId: null,
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
        return {
          nodeIds: [],
          focusNodeId: null,
          linkId: currentSelection.linkId === linkId ? null : linkId,
        };
      }

      return {
        nodeIds: [],
        focusNodeId: null,
        linkId,
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
    (point: GraphPoint, intersectedNodeIds: string[]) => {
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
        setSelectionState({
          nodeIds: intersectedNodeIds,
          focusNodeId: intersectedNodeIds.at(-1) ?? null,
          linkId: null,
        });

        return nextRect;
      });
    },
    [setSelectionState]
  );

  const cancelSelectionRect = useCallback(() => {
    setSelectionRect(null);
  }, []);

  const openNodeDetail = useCallback(
    (nodeId: string) => {
      const node = viewNodeById.get(nodeId);
      if (!node) {
        return;
      }

      setShowDetailModal({ type: 'node', id: node.refNodeId });
      selectNode(nodeId);
    },
    [selectNode, viewNodeById]
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

  const dismissDetailModalIf = useCallback((predicate: (detail: DetailModalData) => boolean) => {
    setShowDetailModal((current) => {
      if (!current || !predicate(current)) {
        return current;
      }

      return null;
    });
  }, []);

  const clearDraftNodePositions = useCallback(() => {
    setDraftNodePositions({});
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

  const {
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
  } = useGraphEditorCommands({
    setAgent,
    currentScope,
    currentContainerKind,
    currentChildren: agentViewModel.currentChildren,
    navigationPath,
    indexes: agentViewModel.indexes,
    localLeafIds: agentViewModel.localLeafIds,
    viewNodeById,
    selectionState,
    draftNodePositions,
    setDraftNodePositions,
    clearSelection,
    scheduleFocusNode: setPendingFocusNodeId,
    scheduleFocusLink: setPendingFocusLinkId,
    clearSelectionRect: cancelSelectionRect,
    clearDraftNodePositions,
    closeDetailModal,
    dismissDetailModalIf,
  });

  const setCanvasOffset = useCallback((offset: GraphCanvasViewport) => {
    setCanvasViewport(offset);
  }, [setCanvasViewport]);

  const setCanvasScaleState = useCallback((nextScale: number) => {
    setCanvasScale(clampZoom(nextScale));
  }, [setCanvasScale]);

  const activeNeuronParameters = useMemo(() => {
    if (!activeNode || activeNode.kind !== 'neuron') {
      return null;
    }

    return {
      a: activeNode.neuron?.params.a ?? 0.02,
      b: activeNode.neuron?.params.b ?? 0.2,
      c: activeNode.neuron?.params.c ?? -65,
      d: activeNode.neuron?.params.d ?? 8,
      threshold: activeNode.neuron?.params.threshold ?? 30,
    };
  }, [activeNode]);

  return {
    breadcrumbs,
    scopeKey,
    canvasScopeKey: `${agent.metadata.id}:${scopeKey}`,
    currentScope,
    currentContainerKind,
    nodes,
    links,
    selectedNodeIds: selectionState.nodeIds,
    selectedNodeId: selectionState.focusNodeId,
    selectedLinkId: selectionState.linkId,
    selectionRect,
    showDetailModal,
    canvasViewport,
    canvasScale,
    viewNodeById,
    activeViewNodeIds,
    activeNode,
    activeLink,
    activeNeuronParameters,
    navigateTo,
    navigateToBreadcrumb,
    selectNodes,
    selectNode,
    selectLink,
    clearSelection,
    beginSelectionRect,
    updateSelectionRect,
    cancelSelectionRect,
    openNodeDetail,
    openLinkDetail,
    closeDetailModal,
    dismissDetailModalIf,
    getNodeDoubleClickAction,
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
    clearDraftNodePositions,
    setCanvasOffset,
    setCanvasScale: setCanvasScaleState,
    updateNodeLabelAndParams,
    updateLinkWeight,
  };
};
