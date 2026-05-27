import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type { GraphInteractionOrchestratorResult } from './useGraphInteractionOrchestrator';
import { useGraphInteractionOrchestrator } from './useGraphInteractionOrchestrator';
import type { GraphPoint, GraphViewport, SceneNodeGeometry } from '../tools/canvasGeometry';
import type { SharedCanvasCallbacks, SharedCanvasCapabilities } from '../sharedCanvasCore';
import { getGraphContextMenuItemCount } from './contextMenuPolicy';

interface GraphViewSessionControllerNode extends SceneNodeGeometry {
  proxy: boolean;
  movable: boolean;
  local: boolean;
  previewOnly: boolean;
  rootExpandedProjection: boolean;
  connectableSource: boolean;
  ungroupable: boolean;
  contextMenuGroup: boolean;
  expanded: boolean;
  expansionParentId: string | null;
  titleDragHandleOnly: boolean;
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
  callbacks: Pick<
    SharedCanvasCallbacks,
    | 'onViewportChange'
    | 'onSessionChange'
    | 'onSelectionBoxStart'
    | 'onSelectionBoxUpdate'
    | 'onSelectionBoxCancel'
    | 'onSelectionClear'
    | 'onConnectNodes'
    | 'onCreateNodeAndConnectAt'
    | 'onDraftNodePositionsUpdate'
    | 'onDraftNodePositionsDiscard'
    | 'onNodePositionsPersist'
    | 'onNodeSelect'
    | 'onNodesSelect'
    | 'onDetailClose'
    | 'onSelectionRemove'
  >;
  scale: number;
  selectedNodeIds: string[];
  capabilities: Pick<
    SharedCanvasCapabilities,
    | 'canCreateNodeAtCanvasContext'
    | 'canCreateSignalAtCanvasContext'
    | 'canAggregateSelection'
    | 'canMoveSelectionOutToParent'
    | 'canUngroupGroupNode'
    | 'canMoveNodeOutToParent'
    | 'canMoveSelectionIntoGroup'
  >;
  isEditableOrInteractiveTarget: (target: EventTarget | null) => boolean;
}

interface CancelGraphViewSessionOptions {
  closeDetailModal?: boolean;
}

const CONTEXT_MENU_MARGIN = 8;
const CONTEXT_MENU_WIDTH = 136;
const CONTEXT_MENU_ITEM_HEIGHT = 26;
const CONTEXT_MENU_VERTICAL_PADDING = 4;

export const useGraphViewSessionController = ({
  isActive,
  scopeKey,
  surfaceRef,
  sceneRef,
  hasOpenDetailModal,
  nodes,
  sceneOrigin,
  viewport,
  callbacks,
  scale,
  selectedNodeIds,
  capabilities,
  isEditableOrInteractiveTarget,
}: GraphViewSessionControllerOptions) => {
  const scopeRef = useRef<string | null>(null);
  const orchestrator = useGraphInteractionOrchestrator({
    isActive,
    surfaceRef,
    sceneRef,
    nodes,
    sceneOrigin,
    viewport,
    callbacks,
    scale,
    selectedNodeIds,
    capabilities,
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
        callbacks.onDetailClose();
      }

      setInteractionState(null);
      callbacks.onDraftNodePositionsDiscard();
      callbacks.onSelectionBoxCancel();
      closeContextMenu();
    },
    [callbacks, closeContextMenu, setInteractionState]
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

      callbacks.onSelectionRemove();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [callbacks, cancelSession, contextMenu, hasOpenDetailModal, interaction, isActive, isEditableOrInteractiveTarget, surfaceRef]);

  const contextMenuPosition = useMemo(() => {
    if (!contextMenu) {
      return null;
    }

    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    const contextMenuNode =
      contextMenu.kind === 'group' && contextMenu.nodeIds.length === 1
        ? nodes.find((node) => node.id === contextMenu.nodeIds[0]) ?? null
        : null;
    const menuItemCount = getGraphContextMenuItemCount({
      kind: contextMenu.kind,
      canCreateNodeAtCanvasContext: capabilities.canCreateNodeAtCanvasContext,
      canCreateSignalAtCanvasContext: capabilities.canCreateSignalAtCanvasContext,
      canAggregateSelection: capabilities.canAggregateSelection,
      canMoveSelectionOutToParent: capabilities.canMoveSelectionOutToParent,
      canUngroupGroupNode: capabilities.canUngroupGroupNode,
      canMoveNodeOutToParent: capabilities.canMoveNodeOutToParent,
      canMoveSelectionIntoGroup: capabilities.canMoveSelectionIntoGroup,
      ungroupable: Boolean(contextMenuNode?.ungroupable),
      selectionMode: contextMenu.kind === 'selection' ? contextMenu.selectionMode : 'none',
    });
    const menuHeight = menuItemCount * CONTEXT_MENU_ITEM_HEIGHT + CONTEXT_MENU_VERTICAL_PADDING;

    return {
      x: Math.max(
        CONTEXT_MENU_MARGIN,
        Math.min(contextMenu.client.x - rect.left, rect.width - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN)
      ),
      y: Math.max(
        CONTEXT_MENU_MARGIN,
        Math.min(contextMenu.client.y - rect.top, rect.height - menuHeight - CONTEXT_MENU_MARGIN)
      ),
    };
  }, [capabilities, contextMenu, nodes, surfaceRef]);

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
