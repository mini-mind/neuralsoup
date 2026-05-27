import type { GraphViewNode } from './graphViewTypes';

export type GraphNodeHitArea = 'node' | 'group-title' | 'group-body';
export type GraphNodeDoubleClickIntent = 'navigate' | 'edit' | 'toggle-expand' | null;

export interface GraphNodeInteractionDescriptor {
  hitArea: GraphNodeHitArea;
  dispatchesNodePointer: boolean;
  titleDragHandleOnly: boolean;
  contextMenuGroup: boolean;
  doubleClickIntent: GraphNodeDoubleClickIntent;
}

const isExpandedRootGroup = (node: GraphViewNode) =>
  node.kind === 'neuron-group' && node.expanded && !node.expansionParentId;

const getDefaultDoubleClickIntent = (node: GraphViewNode): GraphNodeDoubleClickIntent => {
  if (node.kind === 'adapter') {
    return node.adapterNavigable ? 'navigate' : null;
  }

  if (node.navigable) {
    return 'navigate';
  }

  if (node.editable && !node.proxy && !node.previewOnly) {
    return 'edit';
  }

  return null;
};

export const getGraphNodeInteractionDescriptor = (
  node: GraphViewNode,
  hitArea: GraphNodeHitArea = 'node'
): GraphNodeInteractionDescriptor => {
  if (isExpandedRootGroup(node)) {
    if (hitArea === 'group-title') {
      return {
        hitArea,
        dispatchesNodePointer: true,
        titleDragHandleOnly: true,
        contextMenuGroup: true,
        doubleClickIntent: 'toggle-expand',
      };
    }

    if (hitArea === 'group-body') {
      return {
        hitArea,
        dispatchesNodePointer: false,
        titleDragHandleOnly: false,
        contextMenuGroup: false,
        doubleClickIntent: null,
      };
    }

    return {
      hitArea,
      dispatchesNodePointer: false,
      titleDragHandleOnly: false,
      contextMenuGroup: true,
      doubleClickIntent: null,
    };
  }

  return {
    hitArea: 'node',
    dispatchesNodePointer: true,
    titleDragHandleOnly: false,
    contextMenuGroup: !node.leaf && node.local && !node.proxy && !node.expansionParentId,
    doubleClickIntent: getDefaultDoubleClickIntent(node),
  };
};
