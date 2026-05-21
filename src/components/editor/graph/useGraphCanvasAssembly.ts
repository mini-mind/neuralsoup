import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GraphViewNode } from './graphViewModel';
import { projectGraphScene, type GraphSceneNode } from './graphSceneProjection';
import { useGraphViewSessionController } from './interaction/useGraphViewSessionController';
import type { GraphCanvasViewport } from '../../hooks/useSNNTopologyState';
import { getNodeCenter, NODE_PLACEMENT_MARGIN } from './tools/canvasGeometry';
import { isEditableOrInteractiveTarget } from './isEditableOrInteractiveTarget';

interface GraphCanvasAssemblyOptions {
  width: number;
  height: number;
  isActive: boolean;
  currentScope: 'root' | 'child';
  scopeKey: string;
  nodes: GraphViewNode[];
  selectedNodeIds: string[];
  canCreateNeuronHere: boolean;
  canAggregateSelection: boolean;
  canvasViewport: GraphCanvasViewport;
  setCanvasOffset: (offset: GraphCanvasViewport) => void;
  canvasScale: number;
  setCanvasScale: (nextScale: number) => void;
  beginSelectionRect: (point: { x: number; y: number }) => void;
  updateSelectionRect: (point: { x: number; y: number }, intersectedNodeIds: string[]) => void;
  cancelSelectionRect: () => void;
  clearSelection: () => void;
  connectSourceNodesToTarget: (sourceNodeIds: string[], targetNodeId: string) => void;
  updateNodePositionsInDraft: (updates: Array<{ nodeId: string; x: number; y: number }>) => void;
  discardNodeDraftPositions: () => void;
  persistNodePositions: (updates: Array<{ nodeId: string; x: number; y: number }>) => void;
  selectNode: (nodeId: string, options?: { additive?: boolean }) => void;
  selectNodes: (nodeIds: string[]) => void;
  closeDetailModal: () => void;
  hasOpenDetailModal: boolean;
  removeSelected: () => void;
}

export const useGraphCanvasAssembly = ({
  width,
  height,
  isActive,
  currentScope,
  scopeKey,
  nodes,
  selectedNodeIds,
  canCreateNeuronHere,
  canAggregateSelection,
  canvasViewport,
  setCanvasOffset,
  canvasScale,
  setCanvasScale,
  beginSelectionRect,
  updateSelectionRect,
  cancelSelectionRect,
  clearSelection,
  connectSourceNodesToTarget,
  updateNodePositionsInDraft,
  discardNodeDraftPositions,
  persistNodePositions,
  selectNode,
  selectNodes,
  closeDetailModal,
  hasOpenDetailModal,
  removeSelected,
}: GraphCanvasAssemblyOptions) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const scene = useMemo(
    () => projectGraphScene(nodes, { width, height }),
    [height, nodes, width]
  );
  const sceneOriginRef = useRef(scene.origin);
  const scopeKeyRef = useRef<string | null>(null);
  const initializedViewportScopeKeyRef = useRef<string | null>(null);
  const viewportMetricsRef = useRef<{ width: number; height: number; originX: number; originY: number } | null>(null);

  useEffect(() => {
    sceneOriginRef.current = scene.origin;
  }, [scene.origin]);

  const getInitialViewportX = useCallback(
    (focusNodes: GraphSceneNode[], preferredX: number) => {
      if (focusNodes.length === 0) {
        return preferredX;
      }

      const minX = Math.min(...focusNodes.map((node) => node.sceneX));
      const maxRight = Math.max(...focusNodes.map((node) => node.sceneX + node.width));
      const minViewportX = NODE_PLACEMENT_MARGIN - minX;
      const maxViewportX = width - NODE_PLACEMENT_MARGIN - maxRight;

      if (minViewportX <= maxViewportX) {
        return Math.max(minViewportX, Math.min(preferredX, maxViewportX));
      }

      return Math.round(width / 2 - (minX + maxRight) / 2);
    },
    [width]
  );

  const initialViewport = useMemo(() => {
    if (currentScope === 'root') {
      const focusNodes = scene.list.filter((node) => node.direction !== 'output');
      return {
        x: getInitialViewportX(focusNodes, Math.round((width - scene.size.width) / 2)),
        y: Math.round((height - scene.size.height) / 2),
      };
    }

    const focusNodes = scene.list.filter((node) => !node.proxy || node.direction === 'input');
    const minFocusX = Math.min(...focusNodes.map((node) => node.sceneX));
    const maxFocusRight = Math.max(...focusNodes.map((node) => node.sceneX + node.width));
    const preferredX = Math.round(width / 2 - (minFocusX + maxFocusRight) / 2);

    return {
      x: getInitialViewportX(focusNodes, preferredX),
      y: 36,
    };
  }, [currentScope, getInitialViewportX, height, scene.list, scene.size.height, scene.size.width, width]);

  useEffect(() => {
    if (width <= 1 || height <= 1) {
      return;
    }

    if (initializedViewportScopeKeyRef.current === scopeKey) {
      return;
    }

    setCanvasOffset(initialViewport);
    initializedViewportScopeKeyRef.current = scopeKey;
    viewportMetricsRef.current = {
      width,
      height,
      originX: scene.origin.x,
      originY: scene.origin.y,
    };
  }, [height, initialViewport, scene.origin.x, scene.origin.y, scopeKey, setCanvasOffset, width]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    if (surface.scrollLeft !== 0) {
      surface.scrollLeft = 0;
    }
    if (surface.scrollTop !== 0) {
      surface.scrollTop = 0;
    }
  }, [scopeKey, surfaceRef]);

  useEffect(() => {
    const nextMetrics = {
      width,
      height,
      originX: scene.origin.x,
      originY: scene.origin.y,
    };
    const previousScopeKey = scopeKeyRef.current;
    scopeKeyRef.current = scopeKey;
    if (previousScopeKey !== scopeKey) {
      initializedViewportScopeKeyRef.current = null;
      viewportMetricsRef.current = nextMetrics;
      return;
    }

    const previousMetrics = viewportMetricsRef.current;
    if (!previousMetrics) {
      viewportMetricsRef.current = nextMetrics;
      return;
    }

    // Ignore the bootstrap resize from the placeholder 1x1 viewport to the
    // first measured panel size; otherwise the canvas is incorrectly re-centered.
    if (previousMetrics.width <= 1 || previousMetrics.height <= 1) {
      viewportMetricsRef.current = nextMetrics;
      return;
    }

    if (!isActive) {
      viewportMetricsRef.current = nextMetrics;
      return;
    }

    const deltaX =
      (width - previousMetrics.width) / 2 + (scene.origin.x - previousMetrics.originX) * canvasScale;
    const deltaY =
      (height - previousMetrics.height) / 2 + (scene.origin.y - previousMetrics.originY) * canvasScale;
    if (deltaX === 0 && deltaY === 0) {
      viewportMetricsRef.current = nextMetrics;
      return;
    }

    setCanvasOffset({
      x: canvasViewport.x + deltaX,
      y: canvasViewport.y + deltaY,
    });
    viewportMetricsRef.current = nextMetrics;
  }, [canvasScale, canvasViewport.x, canvasViewport.y, height, isActive, scene.origin.x, scene.origin.y, scopeKey, setCanvasOffset, width]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    const resetNativeScroll = () => {
      if (surface.scrollLeft !== 0) {
        surface.scrollLeft = 0;
      }
      if (surface.scrollTop !== 0) {
        surface.scrollTop = 0;
      }
    };

    resetNativeScroll();
    surface.addEventListener('scroll', resetNativeScroll, { passive: true });
    return () => {
      surface.removeEventListener('scroll', resetNativeScroll);
    };
  }, [surfaceRef]);

  const updateNodePositionsFromSceneDraft = useCallback(
    (updates: Array<{ nodeId: string; x: number; y: number }>) => {
      updateNodePositionsInDraft(
        updates.map(({ nodeId, x, y }) => ({
          nodeId,
          x: x + sceneOriginRef.current.x,
          y: y + sceneOriginRef.current.y,
        }))
      );
    },
    [updateNodePositionsInDraft]
  );

  const persistNodePositionsFromScene = useCallback(
    (updates: Array<{ nodeId: string; x: number; y: number }>) => {
      persistNodePositions(
        updates.map(({ nodeId, x, y }) => ({
          nodeId,
          x: x + sceneOriginRef.current.x,
          y: y + sceneOriginRef.current.y,
        }))
      );
    },
    [persistNodePositions]
  );

  const orchestratorNodes = useMemo(
    () =>
      scene.list.map((node) => ({
        id: node.id,
        x: node.sceneX,
        y: node.sceneY,
        width: node.width,
        height: node.height,
        proxy: node.proxy,
        movable: node.movable,
        local: node.local,
        connectableSource: node.connectableSource,
      })),
    [scene.list]
  );

  const nodeCentersSummary = useMemo(
    () =>
      scene.list
        .map((node) => {
          const center = getNodeCenter({
            x: node.sceneX,
            y: node.sceneY,
            width: node.width,
            height: node.height,
          });
          return `${node.id}:${Math.round(center.x)},${Math.round(center.y)}`;
        })
        .join('|'),
    [scene.list]
  );

  const session = useGraphViewSessionController({
    isActive,
    scopeKey,
    surfaceRef,
    sceneRef,
    nodes: orchestratorNodes,
    sceneSize: scene.size,
    sceneOrigin: scene.origin,
    viewport: canvasViewport,
    setViewport: setCanvasOffset,
    scale: canvasScale,
    setScale: setCanvasScale,
    selectedNodeIds,
    canCreateNeuronHere,
    canAggregateSelection,
    beginSelectionRect,
    updateSelectionRect,
    cancelSelectionRect,
    clearSelection,
    connectSourceNodesToTarget,
    updateNodePositionsInDraft: updateNodePositionsFromSceneDraft,
    discardNodeDraftPositions,
    persistNodePositions: persistNodePositionsFromScene,
    selectNode,
    selectNodes,
    closeDetailModal,
    hasOpenDetailModal,
    isEditableOrInteractiveTarget,
    removeSelected,
  });

  return {
    surfaceRef,
    sceneRef,
    scene,
    nodeCentersSummary,
    ...session,
  };
};
