export type GraphContextGestureTarget = 'selection' | 'group';
export type GraphSelectionContextMenuMode = 'leaf' | 'selection' | 'none';

interface ResolveNodeContextGestureTargetOptions {
  selectedNodeIds: string[];
  nodeId: string;
  canMoveSelectionOutToParent: boolean;
  contextMenuGroup: boolean;
}

interface ShouldReselectContextNodeOptions {
  selectedNodeIds: string[];
  nodeId: string;
  contextTarget: GraphContextGestureTarget;
}

interface ResolveSelectionContextMenuModeOptions {
  contextNodeCount: number;
  singleNodeLeaf: boolean;
  canAggregateSelection: boolean;
  canMoveSelectionOutToParent: boolean;
}

interface GetGraphContextMenuItemCountOptions {
  kind: 'canvas' | 'selection' | 'group';
  canCreateNodeAtCanvasContext: boolean;
  canCreateSignalAtCanvasContext: boolean;
  canAggregateSelection: boolean;
  canMoveSelectionOutToParent: boolean;
  canUngroupGroupNode: boolean;
  canMoveNodeOutToParent: boolean;
  canMoveSelectionIntoGroup: boolean;
  ungroupable?: boolean;
  selectionMode?: GraphSelectionContextMenuMode;
}

export const resolveNodeContextGestureTarget = ({
  selectedNodeIds,
  nodeId,
  canMoveSelectionOutToParent,
  contextMenuGroup,
}: ResolveNodeContextGestureTargetOptions): GraphContextGestureTarget => {
  const selectionGesture =
    (selectedNodeIds.length > 1 && selectedNodeIds.includes(nodeId)) ||
    (canMoveSelectionOutToParent && selectedNodeIds.length === 1 && selectedNodeIds[0] === nodeId);

  if (selectionGesture) {
    return 'selection';
  }

  return contextMenuGroup ? 'group' : 'selection';
};

export const shouldReselectContextNode = ({
  selectedNodeIds,
  nodeId,
  contextTarget,
}: ShouldReselectContextNodeOptions): boolean => {
  const isSameSingleSelection = selectedNodeIds.length === 1 && selectedNodeIds[0] === nodeId;
  const preservesMultiSelection = contextTarget === 'selection' && selectedNodeIds.length > 1 && selectedNodeIds.includes(nodeId);

  return !isSameSingleSelection && !preservesMultiSelection;
};

export const resolveContextGestureLinkMode = (contextNodeCount: number): 'single' | 'multi' =>
  contextNodeCount > 1 ? 'multi' : 'single';

export const resolveSelectionContextMenuMode = ({
  contextNodeCount,
  singleNodeLeaf,
  canAggregateSelection,
  canMoveSelectionOutToParent,
}: ResolveSelectionContextMenuModeOptions): GraphSelectionContextMenuMode => {
  if (contextNodeCount === 1 && singleNodeLeaf) {
    return 'leaf';
  }

  if (canAggregateSelection || canMoveSelectionOutToParent) {
    return 'selection';
  }

  return 'none';
};

export const getGraphContextMenuItemCount = ({
  kind,
  canCreateNodeAtCanvasContext,
  canCreateSignalAtCanvasContext,
  canAggregateSelection,
  canMoveSelectionOutToParent,
  canUngroupGroupNode,
  canMoveNodeOutToParent,
  canMoveSelectionIntoGroup,
  ungroupable = false,
  selectionMode = 'none',
}: GetGraphContextMenuItemCountOptions): number => {
  if (kind === 'canvas') {
    return (canCreateNodeAtCanvasContext ? 2 : 0) + (canCreateSignalAtCanvasContext ? 2 : 0);
  }

  if (kind === 'selection') {
    if (selectionMode === 'leaf') {
      return 2 + (canMoveSelectionOutToParent ? 1 : 0);
    }

    if (selectionMode === 'selection') {
      return (canAggregateSelection ? 1 : 0) + (canMoveSelectionOutToParent ? 1 : 0);
    }

    return 0;
  }

  return (
    2 +
    (canUngroupGroupNode && ungroupable ? 1 : 0) +
    (canMoveNodeOutToParent ? 1 : 0) +
    (canMoveSelectionIntoGroup ? 1 : 0)
  );
};
