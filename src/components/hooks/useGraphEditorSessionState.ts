import { useState } from 'react';
import type { Position } from '../../domain/brain';
import type {
  DetailModalData,
  GraphCanvasViewport,
  GraphSelectionRect,
  GraphSelectionState,
} from './useSNNTopologyState';

export type NodePositionDraftMap = Record<string, Position>;

export const createEmptySelectionState = (): GraphSelectionState => ({
  nodeIds: [],
  focusNodeId: null,
  linkId: null,
});

export const useGraphEditorSessionState = () => {
  const [selectionState, setSelectionState] = useState<GraphSelectionState>(createEmptySelectionState);
  const [showDetailModal, setShowDetailModal] = useState<DetailModalData | null>(null);
  const [selectionRect, setSelectionRect] = useState<GraphSelectionRect | null>(null);
  const [canvasViewport, setCanvasViewport] = useState<GraphCanvasViewport>({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [draftNodePositions, setDraftNodePositions] = useState<NodePositionDraftMap>({});
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null);
  const [pendingFocusLinkId, setPendingFocusLinkId] = useState<string | null>(null);

  return {
    selectionState,
    setSelectionState,
    showDetailModal,
    setShowDetailModal,
    selectionRect,
    setSelectionRect,
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
  };
};
