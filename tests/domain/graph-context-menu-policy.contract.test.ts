import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGraphContextMenuItemCount,
  resolveContextGestureLinkMode,
  resolveNodeContextGestureTarget,
  resolveSelectionContextMenuMode,
  shouldReselectContextNode,
} from '../../src/components/editor/graph/interaction/contextMenuPolicy';

test('node context gesture keeps leaf right-click in selection mode for single node actions', () => {
  assert.equal(
    resolveNodeContextGestureTarget({
      selectedNodeIds: [],
      nodeId: 'neuron-1',
      canMoveSelectionOutToParent: false,
      contextMenuGroup: false,
    }),
    'selection'
  );
});

test('node context gesture preserves multi-selection actions when right-clicking an already selected node', () => {
  assert.equal(
    resolveNodeContextGestureTarget({
      selectedNodeIds: ['neuron-1', 'neuron-2'],
      nodeId: 'neuron-2',
      canMoveSelectionOutToParent: false,
      contextMenuGroup: false,
    }),
    'selection'
  );
  assert.equal(
    shouldReselectContextNode({
      selectedNodeIds: ['neuron-1', 'neuron-2'],
      nodeId: 'neuron-2',
      contextTarget: 'selection',
    }),
    false
  );
});

test('node context gesture reselects a different leaf before opening node actions', () => {
  assert.equal(
    shouldReselectContextNode({
      selectedNodeIds: ['neuron-1', 'neuron-2'],
      nodeId: 'signal-1',
      contextTarget: 'selection',
    }),
    true
  );
});

test('selection context menu distinguishes single leaf actions from aggregate selection actions', () => {
  assert.equal(
    resolveSelectionContextMenuMode({
      contextNodeCount: 1,
      singleNodeLeaf: true,
      canAggregateSelection: false,
      canMoveSelectionOutToParent: false,
    }),
    'leaf'
  );
  assert.equal(
    resolveSelectionContextMenuMode({
      contextNodeCount: 2,
      singleNodeLeaf: false,
      canAggregateSelection: true,
      canMoveSelectionOutToParent: false,
    }),
    'selection'
  );
  assert.equal(
    resolveSelectionContextMenuMode({
      contextNodeCount: 1,
      singleNodeLeaf: false,
      canAggregateSelection: false,
      canMoveSelectionOutToParent: false,
    }),
    'none'
  );
});

test('context gesture link mode keeps single node link creation distinct from multi-selection linking', () => {
  assert.equal(resolveContextGestureLinkMode(1), 'single');
  assert.equal(resolveContextGestureLinkMode(2), 'multi');
});

test('context menu item count matches rendered leaf, selection, and group menus', () => {
  assert.equal(
    getGraphContextMenuItemCount({
      kind: 'selection',
      canCreateNodeAtCanvasContext: false,
      canCreateSignalAtCanvasContext: false,
      canAggregateSelection: false,
      canMoveSelectionOutToParent: false,
      canUngroupGroupNode: false,
      canMoveNodeOutToParent: false,
      canMoveSelectionIntoGroup: false,
      selectionMode: 'leaf',
    }),
    2
  );

  assert.equal(
    getGraphContextMenuItemCount({
      kind: 'selection',
      canCreateNodeAtCanvasContext: false,
      canCreateSignalAtCanvasContext: false,
      canAggregateSelection: true,
      canMoveSelectionOutToParent: false,
      canUngroupGroupNode: false,
      canMoveNodeOutToParent: false,
      canMoveSelectionIntoGroup: false,
      selectionMode: 'selection',
    }),
    1
  );

  assert.equal(
    getGraphContextMenuItemCount({
      kind: 'group',
      canCreateNodeAtCanvasContext: false,
      canCreateSignalAtCanvasContext: false,
      canAggregateSelection: false,
      canMoveSelectionOutToParent: false,
      canUngroupGroupNode: true,
      canMoveNodeOutToParent: true,
      canMoveSelectionIntoGroup: true,
      ungroupable: true,
      selectionMode: 'none',
    }),
    5
  );
});
