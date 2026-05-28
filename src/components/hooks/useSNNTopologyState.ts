import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentIR, WorldRegistry } from '../../domain/brain';
import { buildAgentGraphViewModel } from '../editor/graph/agentGraphViewModel';
import { useGraphEditorCommands } from './useGraphEditorCommands';
import {
  createDefaultCanvasSessionState,
  createEmptySelectionState,
  useGraphDraftPositionState,
  useGraphFocusQueueState,
  useGraphSelectionInspectorState,
  useGraphViewportSessionState,
} from './useGraphEditorSessionState';
import { useScopedGraphCanvasSession } from './useScopedGraphCanvasSession';

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
  synapseModelId: string | null;
  parameterOverrides: {
    weight?: number;
    delayMs?: number;
  };
  resolvedParameters: {
    weight: number;
    delayMs: number;
  };
  defaultParameters: {
    weight: number | null;
    delayMs: number | null;
  };
  weight: number;
  delayMs: number;
  count: number;
  aggregate: boolean;
  inspectable: boolean;
  editable: boolean;
  leafLinkIds: string[];
}

interface GraphLinkInspectorSynapseSnapshot {
  defaults?: Record<string, number>;
  parameterOverrides?: Record<string, number>;
  effectiveWeight?: number | null;
  effectiveDelayMs?: number | null;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const allValuesEqual = <T,>(values: T[]) => values.length > 0 && values.every((value) => value === values[0]);
const toNumericRecord = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const numericRecord: Record<string, number> = {};
  for (const [key, candidate] of Object.entries(record)) {
    if (isFiniteNumber(candidate)) {
      numericRecord[key] = candidate;
    }
  }
  return numericRecord;
};

export const resolveGraphLinkInspectorParameters = (snapshot: GraphLinkInspectorSynapseSnapshot | null | undefined) => {
  const defaultWeight = isFiniteNumber(snapshot?.defaults?.weight) ? snapshot.defaults.weight : null;
  const defaultDelayMs = isFiniteNumber(snapshot?.defaults?.delayMs) ? snapshot.defaults.delayMs : null;
  const overrideWeight = isFiniteNumber(snapshot?.parameterOverrides?.weight) ? snapshot.parameterOverrides.weight : undefined;
  const overrideDelayMs = isFiniteNumber(snapshot?.parameterOverrides?.delayMs)
    ? snapshot.parameterOverrides.delayMs
    : undefined;
  const resolvedWeight = overrideWeight ?? (isFiniteNumber(snapshot?.effectiveWeight) ? snapshot.effectiveWeight : defaultWeight ?? 0);
  const resolvedDelayMs =
    overrideDelayMs ?? (isFiniteNumber(snapshot?.effectiveDelayMs) ? snapshot.effectiveDelayMs : defaultDelayMs ?? 0);

  return {
    parameterOverrides: {
      ...(overrideWeight == null ? {} : { weight: overrideWeight }),
      ...(overrideDelayMs == null ? {} : { delayMs: overrideDelayMs }),
    },
    resolvedParameters: {
      weight: resolvedWeight,
      delayMs: resolvedDelayMs,
    },
    defaultParameters: {
      weight: defaultWeight,
      delayMs: defaultDelayMs,
    },
  };
};

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

export interface GraphSelectionOptions {
  additive?: boolean;
}

export interface GraphNodePositionUpdate extends GraphPoint {
  nodeId: string;
}

interface UseSNNTopologyStateOptions {
  agent: AgentIR;
  worldRegistry: WorldRegistry;
  projectedVisionCellCount?: number;
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
const getDefaultNavigationPath = (agent: AgentIR): string[] =>
  agent.brain.rootContainerId ? [agent.brain.rootContainerId] : [];

const areStringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const useSNNTopologyState = ({
  agent,
  worldRegistry,
  projectedVisionCellCount,
  graphSessionToken = 'default',
  runtimeActiveNodeIds = [],
  onAgentChange,
}: UseSNNTopologyStateOptions) => {
  const [navigationPath, setNavigationPath] = useState<string[]>(() => getDefaultNavigationPath(agent));
  const {
    selectionState,
    setSelectionState,
    showDetailModal,
    setShowDetailModal,
    selectionRect,
    setSelectionRect,
  } = useGraphSelectionInspectorState();
  const {
    canvasSession,
    setCanvasSession,
    canvasViewport,
    setCanvasViewport,
    canvasScale,
    setCanvasScale,
  } = useGraphViewportSessionState();
  const { draftNodePositions, setDraftNodePositions } = useGraphDraftPositionState();
  const {
    pendingFocusNodeId,
    setPendingFocusNodeId,
    pendingFocusLinkId,
    setPendingFocusLinkId,
  } = useGraphFocusQueueState();
  const editorSessionTokenRef = useRef(graphSessionToken);
  const {
    resetScopedCanvasSessions,
    setScopedCanvasOffset,
    setScopedCanvasScale,
    setScopedCanvasSession,
    syncCanvasViewportForScope,
  } = useScopedGraphCanvasSession({
    canvasSession,
    setCanvasViewport,
    setCanvasScale,
    setCanvasSession,
  });
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
        projectedVisionCellCount,
        worldRegistry,
      }),
    [agent, draftNodePositions, navigationPath, projectedVisionCellCount, runtimeActiveNodeIds, worldRegistry]
  );
  const {
    breadcrumbs,
    currentScope,
    currentContainerKind,
    scopeKey,
    nodes,
    viewNodeByViewId,
    links,
    activeViewNodeIds,
  } = agentViewModel;
  const linkById = useMemo(
    () => new Map(links.map((link) => [link.id, link] as const)),
    [links]
  );
  const connectionById = useMemo(
    () => new Map(agent.connections.map((connection) => [connection.id, connection] as const)),
    [agent.connections]
  );
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

    const viewLink = linkById.get(showDetailModal.id);
    if (!viewLink) {
      return null;
    }

    const leafLink = connectionById.get(showDetailModal.id) ?? null;
    const aggregateLeafLinks = viewLink.aggregate
      ? viewLink.leafLinkIds
          .map((leafLinkId) => connectionById.get(leafLinkId) ?? null)
          .filter((link): link is AgentIR['connections'][number] => link != null)
      : [];
    const viewSynapse = viewLink.synapse ?? null;
    const getLinkInspectorSnapshot = (linkId: string) => linkById.get(linkId)?.synapse ?? null;
    const aggregateInspectorSnapshots = aggregateLeafLinks.map((link) =>
      resolveGraphLinkInspectorParameters({
        defaults: toNumericRecord(getLinkInspectorSnapshot(link.id)?.defaults ?? {}),
        parameterOverrides: toNumericRecord(link.parameterOverrides),
        effectiveWeight: getLinkInspectorSnapshot(link.id)?.effectiveWeight ?? null,
        effectiveDelayMs: getLinkInspectorSnapshot(link.id)?.effectiveDelayMs ?? null,
      })
    );
    const synapseParameters = resolveGraphLinkInspectorParameters(viewSynapse);
    const aggregateResolvedWeights = aggregateInspectorSnapshots.map((snapshot) => snapshot.resolvedParameters.weight);
    const aggregateResolvedDelays = aggregateInspectorSnapshots.map((snapshot) => snapshot.resolvedParameters.delayMs);
    const aggregateSynapseModelIds = aggregateLeafLinks.map((link) => link.synapseModelId?.trim() ?? '');
    const aggregateDefaultWeights = aggregateInspectorSnapshots.map((snapshot) => snapshot.defaultParameters.weight);
    const aggregateDefaultDelays = aggregateInspectorSnapshots.map((snapshot) => snapshot.defaultParameters.delayMs);
    const aggregateParameterOverrideWeights = aggregateInspectorSnapshots.map((snapshot) => snapshot.parameterOverrides.weight);
    const aggregateParameterOverrideDelays = aggregateInspectorSnapshots.map((snapshot) => snapshot.parameterOverrides.delayMs);
    const batchWeight =
      aggregateResolvedWeights[0] == null
        ? synapseParameters.resolvedParameters.weight
        : aggregateResolvedWeights[0];
    const batchDelayMs =
      aggregateResolvedDelays[0] == null
        ? synapseParameters.resolvedParameters.delayMs
        : aggregateResolvedDelays[0];

    return {
      id: viewLink.id,
      fromNodeId: viewLink.fromNodeId,
      toNodeId: viewLink.toNodeId,
      fromRefNodeId: viewLink.fromRefNodeId,
      toRefNodeId: viewLink.toRefNodeId,
      synapseModelId: viewLink.aggregate
        ? (allValuesEqual(aggregateSynapseModelIds) ? aggregateSynapseModelIds[0] || null : aggregateSynapseModelIds[0] || null)
        : leafLink?.synapseModelId ?? viewSynapse?.synapseModelId ?? null,
      parameterOverrides: viewLink.aggregate
        ? {
            ...(aggregateParameterOverrideWeights[0] == null ? {} : { weight: aggregateParameterOverrideWeights[0] }),
            ...(aggregateParameterOverrideDelays[0] == null ? {} : { delayMs: aggregateParameterOverrideDelays[0] }),
          }
        : synapseParameters.parameterOverrides,
      resolvedParameters: viewLink.aggregate
        ? {
            weight: batchWeight,
            delayMs: batchDelayMs,
          }
        : synapseParameters.resolvedParameters,
      defaultParameters: viewLink.aggregate
        ? {
            weight: allValuesEqual(aggregateDefaultWeights) ? (aggregateDefaultWeights[0] ?? null) : aggregateDefaultWeights[0] ?? null,
            delayMs: allValuesEqual(aggregateDefaultDelays) ? (aggregateDefaultDelays[0] ?? null) : aggregateDefaultDelays[0] ?? null,
          }
        : synapseParameters.defaultParameters,
      weight: viewLink.aggregate ? batchWeight : synapseParameters.resolvedParameters.weight,
      delayMs: viewLink.aggregate ? batchDelayMs : synapseParameters.resolvedParameters.delayMs,
      count: viewLink.count,
      aggregate: viewLink.aggregate,
      inspectable: viewLink.inspectable,
      editable: viewLink.editable,
      leafLinkIds: [...viewLink.leafLinkIds],
    };
  }, [connectionById, linkById, showDetailModal]);

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

  const resetEditorTransientState = useCallback(() => {
    setSelectionState(createEmptySelectionState());
    setSelectionRect(null);
    setShowDetailModal(null);
    setDraftNodePositions({});
    setPendingFocusNodeId(null);
    setPendingFocusLinkId(null);
  }, [setDraftNodePositions, setPendingFocusLinkId, setPendingFocusNodeId, setSelectionState, setShowDetailModal]);

  useEffect(() => {
    if (editorSessionTokenRef.current === graphSessionToken) {
      return;
    }

    editorSessionTokenRef.current = graphSessionToken;
    resetScopedCanvasSessions();
    setNavigationPath(getDefaultNavigationPath(agent));
    resetEditorTransientState();
    setCanvasSession(createDefaultCanvasSessionState());
  }, [agent, graphSessionToken, resetEditorTransientState, resetScopedCanvasSessions, setCanvasSession]);

  useEffect(() => {
    if (hasValidNavigationPath) {
      return;
    }

    setNavigationPath(getDefaultNavigationPath(agent));
    resetEditorTransientState();
  }, [agent, hasValidNavigationPath, resetEditorTransientState]);

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
      resetEditorTransientState();
    },
    [agentViewModel.indexes.pathById, resetEditorTransientState, viewNodeByViewId]
  );

  const navigateToBreadcrumb = useCallback(
    (breadcrumbId: string) => {
      if (breadcrumbId === 'root') {
        setNavigationPath(getDefaultNavigationPath(agent));
      } else {
        const path = agentViewModel.indexes.pathById.get(breadcrumbId);
        if (!path) {
          return;
        }

        setNavigationPath(path);
      }

      resetEditorTransientState();
    },
    [agent, agentViewModel.indexes.pathById, resetEditorTransientState]
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

  const commandSessionEffects = useMemo(
    () => ({
      clearSelection,
      scheduleFocusNode: setPendingFocusNodeId,
      scheduleFocusLink: setPendingFocusLinkId,
      clearSelectionRect: cancelSelectionRect,
      clearDraftNodePositions,
      closeDetailModal,
      dismissDetailModalIf,
    }),
    [
      cancelSelectionRect,
      clearDraftNodePositions,
      clearSelection,
      closeDetailModal,
      dismissDetailModalIf,
      setPendingFocusLinkId,
      setPendingFocusNodeId,
    ]
  );

  const {
    connectSourceNodesToTarget,
    updateNodePositionsInDraft,
    discardNodeDraftPositions,
    persistNodePositions,
    removeSelected,
    addNeuronAt,
    addNeuronGroupAt,
    addInputSignalAt,
    addOutputSignalAt,
    createNeuronAndConnectAt,
    aggregateSelectedNodes,
    ungroupNode,
    toggleGroupExpanded,
    moveNodeOutToParent,
    moveSelectionIntoGroup,
    updateNodeLabelAndParams,
    updateLinkWeight,
    updateAggregateLinks,
  } = useGraphEditorCommands({
    setAgent,
    currentScope,
    currentContainerKind,
    currentChildren: agentViewModel.currentChildren,
    navigationPath,
    indexes: agentViewModel.indexes,
    localLeafIds: agentViewModel.localLeafIds,
    viewNodeByViewId,
    links,
    selectionState,
    draftNodePositions,
    setDraftNodePositions,
    sessionEffects: commandSessionEffects,
  });

  const enterScopeFromNode = useCallback((nodeId: string) => {
    const node = viewNodeByViewId.get(nodeId);
    if (!node) {
      return;
    }

    if (node.navigable) {
      navigateTo(nodeId);
    }
  }, [navigateTo, viewNodeByViewId]);

  const toggleInlineExpansionForNode = useCallback((nodeId: string) => {
    const node = viewNodeByViewId.get(nodeId);
    if (!node) {
      return;
    }

    if (node.kind === 'neuron-group' && node.local && !node.proxy && !node.previewOnly) {
      toggleGroupExpanded(nodeId);
    }
  }, [toggleGroupExpanded, viewNodeByViewId]);

  const activeNeuronParameters = useMemo(() => {
    if (!activeNode || activeNode.kind !== 'neuron') {
      return null;
    }

    const neuronModelId = activeNode.neuron?.neuronModelId?.trim() ?? '';
    const neuronModel =
      neuronModelId.length > 0 ? agent.brain.neuronModels.find((model) => model.id === neuronModelId) : undefined;
    const defaultParameters = neuronModel ? toNumericRecord(neuronModel.params) : {};
    const parameterOverrides = toNumericRecord(activeNode.neuron?.parameterOverrides);

    return {
      a: parameterOverrides.a ?? defaultParameters.a ?? 0.02,
      b: parameterOverrides.b ?? defaultParameters.b ?? 0.2,
      c: parameterOverrides.c ?? defaultParameters.c ?? -65,
      d: parameterOverrides.d ?? defaultParameters.d ?? 8,
      threshold: parameterOverrides.threshold ?? defaultParameters.threshold ?? 30,
    };
  }, [activeNode, agent.brain.neuronModels]);

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
    enterScopeFromNode,
    toggleInlineExpansionForNode,
    connectSourceNodesToTarget,
    updateNodePositionsInDraft,
    discardNodeDraftPositions,
    persistNodePositions,
    removeSelected,
    addNeuronAt,
    addNeuronGroupAt,
    addInputSignalAt,
    addOutputSignalAt,
    createNeuronAndConnectAt,
    aggregateSelectedNodes,
    ungroupNode,
    moveNodeOutToParent,
    moveSelectionIntoGroup,
    clearDraftNodePositions,
    setCanvasOffset: setScopedCanvasOffset,
    setCanvasSession: setScopedCanvasSession,
    setCanvasScale: setScopedCanvasScale,
    syncCanvasViewportForScope,
    updateNodeLabelAndParams,
    updateLinkWeight,
    updateAggregateLinks,
  };
};
