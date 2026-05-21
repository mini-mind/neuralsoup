import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type { GraphInteractionOrchestratorResult } from './useGraphInteractionOrchestrator';
import { useGraphInteractionOrchestrator } from './useGraphInteractionOrchestrator';
import type { GraphPoint, GraphViewport, SceneNodeGeometry } from '../tools/canvasGeometry';

interface GraphViewSessionControllerNode extends SceneNodeGeometry {
  proxy: boolean;
  movable: boolean;
  local: boolean;
  connectableSource: boolean;
  ungroupable: boolean;
}

interface GraphViewSessionControllerOptions {
  isActive: boolean;
  scopeKey: string;
  surfaceRef: RefObject<HTMLDivElement>;
  sceneRef: RefObject<HTMLDivElement>;
  hasOpenDetailModal: boolean;
  nodes: GraphViewSessionControllerNode[];
  sceneOrigin: GraphPoint;
  viewport: GraphViewport;
  setViewport: (nextViewport: GraphViewport) => void;
  scale: number;
  setScale: (nextScale: number) => void;
  selectedNodeIds: string[];
  canCreateNeuronHere: boolean;
  canAggregateSelection: boolean;
  canUngroupSelection: boolean;
  beginSelectionRect: (point: GraphPoint) => void;
  updateSelectionRect: (point: GraphPoint, intersectedNodeIds: string[]) => void;
  cancelSelectionRect: () => void;
  clearSelection: () => void;
  connectSourceNodesToTarget: (sourceNodeIds: string[], targetNodeId: string) => void;
  updateNodePositionsInDraft: (updates: Array<{ nodeId: string; x: number; y: number }>) => void;
  discardNodeDraftPositions: () => void;
  persistNodePositions: (updates: Array<{ nodeId: string; x: number; y: number }>) => void;
  selectNode: (nodeId: string, options?: { additive?: boolean }) => void;
  selectNodes: (nodeIds: string[]) => void;
  closeDetailModal: () => void;
  isEditableOrInteractiveTarget: (target: EventTarget | null) => boolean;
  removeSelected: () => void;
}

interface CancelGraphViewSessionOptions {
  closeDetailModal?: boolean;
}

const CONTEXT_MENU_MARGIN = 8;
const CONTEXT_MENU_WIDTH = 136;
const CONTEXT_MENU_HEIGHT = 44;

export const useGraphViewSessionController = ({
  isActive,
  scopeKey,
  surfaceRef,
  sceneRef,
  hasOpenDetailModal,
  nodes,
  sceneOrigin,
  viewport,
  setViewport,
  scale,
  setScale,
  selectedNodeIds,
  canCreateNeuronHere,
  canAggregateSelection,
  canUngroupSelection,
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
  isEditableOrInteractiveTarget,
  removeSelected,
}: GraphViewSessionControllerOptions) => {
  const scopeRef = useRef<string | null>(null);
  const orchestrator = useGraphInteractionOrchestrator({
    isActive,
    surfaceRef,
    sceneRef,
    nodes,
    sceneOrigin,
    viewport,
    setViewport,
    scale,
    setScale,
    selectedNodeIds,
    canCreateNeuronHere,
    canAggregateSelection,
    canUngroupSelection,
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
  });
  const {
    interaction,
    contextMenu,
    closeContextMenu,
    setInteractionState,
    handleCanvasWheel,
    handleCanvasMouseDown,
    handleCanvasContextMenu,
    handleNodeMouseDown,
    handleNodeContextMenu,
  } = orchestrator;

  const cancelSession = useCallback(
    (options?: CancelGraphViewSessionOptions) => {
      if (options?.closeDetailModal) {
        closeDetailModal();
      }

      setInteractionState(null);
      discardNodeDraftPositions();
      cancelSelectionRect();
      closeContextMenu();
    },
    [
      cancelSelectionRect,
      closeContextMenu,
      closeDetailModal,
      discardNodeDraftPositions,
      setInteractionState,
    ]
  );

  useEffect(() => {
    const previousScopeKey = scopeRef.current;
    scopeRef.current = scopeKey;

    if (previousScopeKey == null || previousScopeKey === scopeKey) {
      return;
    }

    cancelSession();
  }, [cancelSession, scopeKey]);

  useEffect(() => {
    if (isActive) {
      return;
    }

    cancelSession();
  }, [cancelSession, isActive]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    surface.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => {
      surface.removeEventListener('wheel', handleCanvasWheel);
    };
  }, [handleCanvasWheel, surfaceRef]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const editorRoot = surfaceRef.current?.closest('.snn-topology-editor');
      const targetElement =
        event.target instanceof Element ? event.target : document.activeElement instanceof Element ? document.activeElement : null;
      const withinEditor = Boolean(editorRoot && targetElement && editorRoot.contains(targetElement));

      if (event.key !== 'Delete' && event.key !== 'Backspace' && event.key !== 'Escape') {
        return;
      }

      if (event.key === 'Escape') {
        if (!withinEditor && !interaction && !contextMenu && !hasOpenDetailModal) {
          return;
        }
        cancelSession({ closeDetailModal: true });
        return;
      }

      if (!withinEditor || isEditableOrInteractiveTarget(event.target)) {
        return;
      }

      removeSelected();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelSession, contextMenu, hasOpenDetailModal, interaction, isActive, isEditableOrInteractiveTarget, removeSelected, surfaceRef]);

  const contextMenuPosition = useMemo(() => {
    if (!contextMenu) {
      return null;
    }

    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    return {
      x: Math.max(
        CONTEXT_MENU_MARGIN,
        Math.min(contextMenu.client.x - rect.left, rect.width - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN)
      ),
      y: Math.max(
        CONTEXT_MENU_MARGIN,
        Math.min(contextMenu.client.y - rect.top, rect.height - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN)
      ),
    };
  }, [contextMenu, surfaceRef]);

  const pendingLinkLine = useMemo(() => {
    if (interaction?.type !== 'linking') {
      return null;
    }

    return {
      from: interaction.sourceScenePoint,
      to: interaction.currentScenePoint,
    };
  }, [interaction]);

  return {
    interaction,
    contextMenu,
    contextMenuPosition,
    pendingLinkLine,
    closeContextMenu,
    cancelSession,
    setInteractionState,
    handleCanvasMouseDown,
    handleCanvasContextMenu,
    handleNodeMouseDown,
    handleNodeContextMenu,
  } satisfies Omit<GraphInteractionOrchestratorResult, 'handleCanvasWheel' | 'setContextMenu'> & {
    contextMenuPosition: { x: number; y: number } | null;
    pendingLinkLine: { from: GraphPoint; to: GraphPoint } | null;
    cancelSession: (options?: CancelGraphViewSessionOptions) => void;
  };
};
