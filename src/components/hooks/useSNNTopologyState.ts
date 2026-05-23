import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentIR } from '../../domain/brain';
import { buildAgentGraphViewModel } from '../editor/graph/agentGraphViewModel';
import { clampZoom } from '../editor/graph/tools/canvasGeometry';
import { useGraphEditorCommands } from './useGraphEditorCommands';
import {
  createDefaultCanvasSessionState,
  createEmptySelectionState,
  useGraphEditorSessionState,
} from './useGraphEditorSessionState';

export interface DetailModalData {
  type: 'node' | 'link';
  id: string;
}

export interface GraphLinkDetailData {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromRefNodeId: string;
  toRefNodeId: string;
  weight: number;
  count: number;
  aggregate: boolean;
  inspectable: boolean;
  editable: boolean;
  leafLinkIds: string[];
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
export interface GraphCanvasSessionState {
  viewport: GraphCanvasViewport;
  scale: number;
}
export interface GraphCanvasViewportMetrics {
  width: number;
  height: number;
  originX: number;
  originY: number;
}

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
  graphSessionToken?: string;
  runtimeActiveNodeIds?: string[];
  onAgentChange?: (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => void;
}

export interface GraphDocumentChangeOptions {
  installToRuntime?: boolean;
  commitToCurrentDocument?: boolean;
  persistActiveBrain?: boolean;
}

const uniqueIds = (ids: string[]) => Array.from(new Set(ids));
const arePointsEqual = (left: GraphPoint, right: GraphPoint) => left.x === right.x && left.y === right.y;

const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const useSNNTopologyState = ({
  agent,
  graphSessionToken = 'default',
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
    canvasSession,
    setCanvasSession,
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
  const editorSessionTokenRef = useRef(graphSessionToken);
  const activeCanvasScopeKeyRef = useRef<string | null>(null);
  const viewportStateByScopeKeyRef = useRef<
    Map<string, { session: GraphCanvasSessionState; metrics: GraphCanvasViewportMetrics | null }>
  >(new Map());
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
    viewNodeByViewId,
    visibleNodeByRefId,
    links,
    activeViewNodeIds,
  } = agentViewModel;
  const canvasScopeKey = `${agent.metadata.id}:${scopeKey}`;
  const hasValidNavigationPath = useMemo(() => {
    if (navigationPath.length === 0) {
      return true;
    }

    const currentPath = agentViewModel.indexes.pathById.get(navigationPath[navigationPath.length - 1] ?? '');
    return currentPath != null && areStringArraysEqual(currentPath, navigationPath);
  }, [agentViewModel.indexes.pathById, navigationPath]);
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

  const activeLink = useMemo<GraphLinkDetailData | null>(() => {
    if (showDetailModal?.type !== 'link') {
      return null;
    }

    const viewLink = links.find((link) => link.id === showDetailModal.id);
    if (!viewLink) {
      return null;
    }

    const leafLink = agent.connections.find((link) => link.id === showDetailModal.id) ?? null;
    return {
      id: viewLink.id,
      fromNodeId: viewLink.fromNodeId,
      toNodeId: viewLink.toNodeId,
      fromRefNodeId: viewLink.fromRefNodeId,
      toRefNodeId: viewLink.toRefNodeId,
      weight: leafLink?.weight ?? viewLink.weight,
      count: viewLink.count,
      aggregate: viewLink.aggregate,
      inspectable: viewLink.inspectable,
      editable: viewLink.editable,
      leafLinkIds: [...viewLink.leafLinkIds],
    };
  }, [agent.connections, links, showDetailModal]);

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
    scopeSessionRef.current = null;
    setSelectionState(createEmptySelectionState());
    setSelectionRect(null);
    setShowDetailModal(null);
    setDraftNodePositions({});
    setPendingFocusNodeId(null);
    setPendingFocusLinkId(null);
  }, [setPendingFocusLinkId]);

  useEffect(() => {
    if (editorSessionTokenRef.current === graphSessionToken) {
      return;
    }

    editorSessionTokenRef.current = graphSessionToken;
    activeCanvasScopeKeyRef.current = null;
    viewportStateByScopeKeyRef.current = new Map();
    setNavigationPath([]);
    clearTransientState();
    setCanvasSession(createDefaultCanvasSessionState());
  }, [clearTransientState, graphSessionToken, setCanvasSession]);

  useEffect(() => {
    if (hasValidNavigationPath) {
      return;
    }

    setNavigationPath([]);
    clearTransientState();
  }, [clearTransientState, hasValidNavigationPath]);

  useEffect(() => {
    if (scopeSessionRef.current === scopeKey) {
      return;
    }

    scopeSessionRef.current = scopeKey;
  }, [scopeKey]);

  useEffect(() => {
    if (navigationPath.length > 0) {
      return;
    }

    scopeSessionRef.current = 'root';
  }, [navigationPath.length]);

  const navigateTo = useCallback(
    (nodeId: string) => {
      const viewNode = viewNodeByViewId.get(nodeId);
      if (!viewNode?.navigable) {
        return;
      }

      const path = agentViewModel.indexes.pathById.get(viewNode.refNodeId);
      if (!path) {
        return;
      }

      setNavigationPath(path);
      clearTransientState();
    },
    [agentViewModel.indexes.pathById, clearTransientState, viewNodeByViewId]
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
      const node = viewNodeByViewId.get(nodeId);
      if (!node) {
        return;
      }

      setShowDetailModal({ type: 'node', id: node.refNodeId });
      selectNode(nodeId);
    },
    [selectNode, viewNodeByViewId]
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
      const node = viewNodeByViewId.get(nodeId);
      if (!node) {
        return null;
      }

      if (node.kind === 'adapter') {
        return node.adapterNavigable ? 'navigate' : null;
      }

      if (node.navigable) {
        return 'navigate';
      }

      if (node.editable && !node.proxy) {
        return 'edit';
      }

      return null;
    },
    [viewNodeByViewId]
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
    viewNodeByViewId,
    visibleNodeByRefId,
    links,
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
    const activeScopeKey = activeCanvasScopeKeyRef.current;
    if (activeScopeKey) {
      const currentRecord = viewportStateByScopeKeyRef.current.get(activeScopeKey);
      viewportStateByScopeKeyRef.current.set(activeScopeKey, {
        session: {
          viewport: offset,
          scale: currentRecord?.session.scale ?? canvasSession.scale,
        },
        metrics: currentRecord?.metrics ?? null,
      });
    }
    setCanvasViewport(offset);
  }, [canvasSession.scale, setCanvasViewport]);

  const setCanvasScaleState = useCallback((nextScale: number) => {
    const normalizedScale = clampZoom(nextScale);
    const activeScopeKey = activeCanvasScopeKeyRef.current;
    if (activeScopeKey) {
      const currentRecord = viewportStateByScopeKeyRef.current.get(activeScopeKey);
      viewportStateByScopeKeyRef.current.set(activeScopeKey, {
        session: {
          viewport: currentRecord?.session.viewport ?? canvasSession.viewport,
          scale: normalizedScale,
        },
        metrics: currentRecord?.metrics ?? null,
      });
    }
    setCanvasScale(normalizedScale);
  }, [canvasSession.viewport, setCanvasScale]);

  const setCanvasSessionState = useCallback((nextSession: GraphCanvasSessionState) => {
    const normalizedSession: GraphCanvasSessionState = {
      viewport: nextSession.viewport,
      scale: clampZoom(nextSession.scale),
    };
    const activeScopeKey = activeCanvasScopeKeyRef.current;
    if (activeScopeKey) {
      const currentRecord = viewportStateByScopeKeyRef.current.get(activeScopeKey);
      viewportStateByScopeKeyRef.current.set(activeScopeKey, {
        session: normalizedSession,
        metrics: currentRecord?.metrics ?? null,
      });
    }
    setCanvasSession((currentSession) => {
      if (
        arePointsEqual(currentSession.viewport, normalizedSession.viewport) &&
        currentSession.scale === normalizedSession.scale
      ) {
        return currentSession;
      }

      return normalizedSession;
    });
  }, [setCanvasSession]);

  const syncCanvasViewportForScope = useCallback(
    ({
      scopeKey: nextScopeKey,
      recommendedViewport,
      metrics,
      isActive,
    }: {
      scopeKey: string;
      recommendedViewport: GraphCanvasViewport;
      metrics: GraphCanvasViewportMetrics;
      isActive: boolean;
    }) => {
      if (metrics.width <= 1 || metrics.height <= 1) {
        return;
      }

      const viewportStateByScopeKey = viewportStateByScopeKeyRef.current;
      const previousActiveScopeKey = activeCanvasScopeKeyRef.current;
      const existingRecord = viewportStateByScopeKey.get(nextScopeKey) ?? null;
      const recommendedSession: GraphCanvasSessionState = {
        viewport: recommendedViewport,
        scale: 1,
      };

      if (previousActiveScopeKey !== nextScopeKey) {
        activeCanvasScopeKeyRef.current = nextScopeKey;
        const nextSession = existingRecord?.session ?? recommendedSession;
        viewportStateByScopeKey.set(nextScopeKey, {
          session: nextSession,
          metrics,
        });
        setCanvasSession((currentSession) =>
          arePointsEqual(currentSession.viewport, nextSession.viewport) && currentSession.scale === nextSession.scale
            ? currentSession
            : nextSession
        );
        return;
      }

      if (!existingRecord) {
        viewportStateByScopeKey.set(nextScopeKey, {
          session: recommendedSession,
          metrics,
        });
        setCanvasSession((currentSession) =>
          arePointsEqual(currentSession.viewport, recommendedSession.viewport) &&
          currentSession.scale === recommendedSession.scale
            ? currentSession
            : recommendedSession
        );
        return;
      }

      const previousMetrics = existingRecord.metrics;
      if (
        !previousMetrics ||
        previousMetrics.width <= 1 ||
        previousMetrics.height <= 1 ||
        !isActive
      ) {
        viewportStateByScopeKey.set(nextScopeKey, {
          session: existingRecord.session,
          metrics,
        });
        return;
      }

      const deltaX =
        (metrics.width - previousMetrics.width) / 2 +
        (metrics.originX - previousMetrics.originX) * existingRecord.session.scale;
      const deltaY =
        (metrics.height - previousMetrics.height) / 2 +
        (metrics.originY - previousMetrics.originY) * existingRecord.session.scale;
      if (deltaX === 0 && deltaY === 0) {
        viewportStateByScopeKey.set(nextScopeKey, {
          session: existingRecord.session,
          metrics,
        });
        return;
      }

      setCanvasSession((currentSession) => {
        const baseSession =
          arePointsEqual(currentSession.viewport, existingRecord.session.viewport) &&
          currentSession.scale === existingRecord.session.scale
            ? currentSession
            : existingRecord.session;
        const nextSession: GraphCanvasSessionState = {
          viewport: {
            x: baseSession.viewport.x + deltaX,
            y: baseSession.viewport.y + deltaY,
          },
          scale: baseSession.scale,
        };
        viewportStateByScopeKey.set(nextScopeKey, {
          session: nextSession,
          metrics,
        });
        return nextSession;
      });
    },
    [setCanvasSession]
  );

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
    canvasScopeKey,
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
    viewNodeByViewId,
    visibleNodeByRefId,
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
    setCanvasSession: setCanvasSessionState,
    setCanvasScale: setCanvasScaleState,
    syncCanvasViewportForScope,
    updateNodeLabelAndParams,
    updateLinkWeight,
  };
};
