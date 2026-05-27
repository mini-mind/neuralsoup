import type { GraphCanvasSessionState, GraphCanvasViewport } from '../../hooks/useSNNTopologyState';
import type { GraphPoint } from './tools/canvasGeometry';

export interface SharedCanvasCapabilities {
  canCreateNodeAtCanvasContext: boolean;
  canCreateSignalAtCanvasContext: boolean;
  canAggregateSelection: boolean;
  canUngroupGroupNode: boolean;
  canMoveNodeOutToParent: boolean;
  canMoveSelectionIntoGroup: boolean;
  canMoveSelectionOutToParent: boolean;
}

export interface SharedCanvasCallbacks {
  onViewportChange: (offset: GraphCanvasViewport) => void;
  onSessionChange: (nextSession: GraphCanvasSessionState) => void;
  onSelectionBoxStart: (point: GraphPoint) => void;
  onSelectionBoxUpdate: (point: GraphPoint, intersectedNodeIds: string[]) => void;
  onSelectionBoxCancel: () => void;
  onSelectionClear: () => void;
  onConnectNodes: (sourceNodeIds: string[], targetNodeId: string) => void;
  onCreateNodeAndConnectAt: (sourceNodeIds: string[], x: number, y: number) => void;
  onDraftNodePositionsUpdate: (updates: Array<{ nodeId: string; x: number; y: number }>) => void;
  onDraftNodePositionsDiscard: () => void;
  onNodePositionsPersist: (updates: Array<{ nodeId: string; x: number; y: number }>) => void;
  onNodeSelect: (nodeId: string, options?: { additive?: boolean }) => void;
  onNodesSelect: (nodeIds: string[]) => void;
  onDetailClose: () => void;
  onSelectionRemove: () => void;
}
