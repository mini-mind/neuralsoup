import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GraphViewNode } from './graphViewTypes';
import { getGraphNodeInteractionDescriptor } from './brainGraphInteractionGrammar';
import { projectGraphScene, type GraphSceneNode } from './graphSceneProjection';
import { useGraphViewSessionController } from './interaction/useGraphViewSessionController';
import type {
  GraphCanvasSessionState,
  GraphCanvasViewport,
  GraphCanvasViewportMetrics,
} from '../../hooks/useSNNTopologyState';
import { getNodeCenter, NODE_PLACEMENT_MARGIN } from './tools/canvasGeometry';
import { isEditableOrInteractiveTarget } from './isEditableOrInteractiveTarget';
import type { SharedCanvasCallbacks, SharedCanvasCapabilities } from './sharedCanvasCore';

interface GraphCanvasAssemblyOptions {
  width: number;
  height: number;
  isActive: boolean;
  currentScope: 'root' | 'child';
  scopeKey: string;
  nodes: GraphViewNode[];
  selectedNodeIds: string[];
  capabilities: SharedCanvasCapabilities;
  canvasViewport: GraphCanvasViewport;
  setCanvasOffset: (offset: GraphCanvasViewport) => void;
  setCanvasSession: (nextSession: GraphCanvasSessionState) => void;
  syncCanvasViewportForScope: (payload: {
    scopeKey: string;
    recommendedViewport: GraphCanvasViewport;
    metrics: GraphCanvasViewportMetrics;
    isActive: boolean;
  }) => void;
  canvasScale: number;
  callbacks: Omit<SharedCanvasCallbacks, 'onViewportChange' | 'onSessionChange'>;
  hasOpenDetailModal: boolean;
}

export const useGraphCanvasAssembly = ({
  width,
  height,
  isActive,
  currentScope,
  scopeKey,
  nodes,
  selectedNodeIds,
  capabilities,
  canvasViewport,
  setCanvasOffset,
  setCanvasSession,
  syncCanvasViewportForScope,
  canvasScale,
  callbacks,
  hasOpenDetailModal,
}: GraphCanvasAssemblyOptions) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const scene = useMemo(
    () => projectGraphScene(nodes, { width, height }),
    [height, nodes, width]
  );
  const sceneNodeByViewId = useMemo(
    () => new Map(scene.list.map((node) => [node.viewId, node] as const)),
    [scene.list]
  );

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

    const focusNodes = scene.list.filter((node) => !node.proxy && (width >= 520 || node.navigable || node.leaf));
    const minFocusX = Math.min(...focusNodes.map((node) => node.sceneX));
    const maxFocusRight = Math.max(...focusNodes.map((node) => node.sceneX + node.width));
    const preferredX = Math.round(width / 2 - (minFocusX + maxFocusRight) / 2);

    return {
      x: getInitialViewportX(focusNodes, preferredX),
      y: 36,
    };
  }, [currentScope, getInitialViewportX, height, scene.list, scene.size.height, scene.size.width, width]);

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
    if (width <= 1 || height <= 1) {
      return;
    }

    syncCanvasViewportForScope({
      scopeKey,
      recommendedViewport: initialViewport,
      metrics: {
        width,
        height,
        originX: scene.origin.x,
        originY: scene.origin.y,
      },
      isActive,
    });
  }, [height, initialViewport, isActive, scene.origin.x, scene.origin.y, scopeKey, syncCanvasViewportForScope, width]);

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

  const projectScenePositionToStoredPosition = useCallback(
    (nodeId: string, x: number, y: number) => {
      const sceneNode = sceneNodeByViewId.get(nodeId);
      if (sceneNode?.expansionParentId) {
        const parentNode = sceneNodeByViewId.get(sceneNode.expansionParentId);
        if (parentNode) {
          return {
            x: x - parentNode.sceneX - sceneNode.expansionOffsetX,
            y: y - parentNode.sceneY - sceneNode.expansionOffsetY,
          };
        }
      }

      return {
        x: x + scene.origin.x,
        y: y + scene.origin.y,
      };
    },
    [scene.origin.x, scene.origin.y, sceneNodeByViewId]
  );

  const projectNodePositionUpdates = useCallback(
    (updates: Array<{ nodeId: string; x: number; y: number }>) =>
      updates.map(({ nodeId, x, y }) => {
        const storedPosition = projectScenePositionToStoredPosition(nodeId, x, y);
        return {
          nodeId,
          x: storedPosition.x,
          y: storedPosition.y,
        };
      }),
    [projectScenePositionToStoredPosition]
  );

  const updateNodePositionsFromSceneDraft = useCallback(
    (updates: Array<{ nodeId: string; x: number; y: number }>) => {
      callbacks.onDraftNodePositionsUpdate(projectNodePositionUpdates(updates));
    },
    [callbacks, projectNodePositionUpdates]
  );

  const persistNodePositionsFromScene = useCallback(
    (updates: Array<{ nodeId: string; x: number; y: number }>) => {
      callbacks.onNodePositionsPersist(projectNodePositionUpdates(updates));
    },
    [callbacks, projectNodePositionUpdates]
  );

  const orchestratorNodes = useMemo(
    () =>
      scene.list.map((node) => {
        const descriptor = getGraphNodeInteractionDescriptor(node);
        return {
          id: node.viewId,
          x: node.sceneX,
          y: node.sceneY,
          width: node.width,
          height: node.height,
          proxy: node.proxy,
          movable: node.movable,
          local: node.local,
          previewOnly: node.previewOnly,
          connectableSource: node.connectableSource,
          ungroupable: node.kind === 'neuron-group' && node.local && !node.proxy && !node.expansionParentId,
          contextMenuGroup: descriptor.contextMenuGroup,
          expanded: node.expanded,
          expansionParentId: node.expansionParentId,
          titleDragHandleOnly: descriptor.titleDragHandleOnly,
        };
      }),
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
          return `${node.viewId}:${Math.round(center.x)},${Math.round(center.y)}`;
        })
        .join('|'),
    [scene.list]
  );

  const nodeViewPositionsSummary = useMemo(
    () =>
      scene.list
        .map((node) => `${node.viewId}:${Math.round(node.x)},${Math.round(node.y)}`)
        .join('|'),
    [scene.list]
  );

  const session = useGraphViewSessionController({
    isActive,
    scopeKey,
    surfaceRef,
    sceneRef,
    nodes: orchestratorNodes,
    sceneOrigin: scene.origin,
    viewport: canvasViewport,
    callbacks: {
      ...callbacks,
      onViewportChange: setCanvasOffset,
      onSessionChange: setCanvasSession,
      onDraftNodePositionsUpdate: updateNodePositionsFromSceneDraft,
      onNodePositionsPersist: persistNodePositionsFromScene,
    },
    scale: canvasScale,
    selectedNodeIds,
    capabilities,
    hasOpenDetailModal,
    isEditableOrInteractiveTarget,
  });

  return {
    surfaceRef,
    sceneRef,
    scene,
    nodeCentersSummary,
    nodeViewPositionsSummary,
    ...session,
  };
};
