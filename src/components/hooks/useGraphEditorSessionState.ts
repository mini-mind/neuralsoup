import { useCallback, useState } from 'react';
import type { Position } from '../../domain/brain/shared';
import type {
  GraphCanvasSessionState,
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

export const createDefaultCanvasSessionState = (): GraphCanvasSessionState => ({
  viewport: { x: 0, y: 0 },
  scale: 1,
});

export const useGraphSelectionInspectorState = () => {
  const [selectionState, setSelectionState] = useState<GraphSelectionState>(createEmptySelectionState);
  const [showDetailModal, setShowDetailModal] = useState<DetailModalData | null>(null);
  const [selectionRect, setSelectionRect] = useState<GraphSelectionRect | null>(null);

  return {
    selectionState,
    setSelectionState,
    showDetailModal,
    setShowDetailModal,
    selectionRect,
    setSelectionRect,
  };
};

export const useGraphViewportSessionState = () => {
  const [canvasSession, setCanvasSession] = useState<GraphCanvasSessionState>(createDefaultCanvasSessionState);
  const setCanvasViewport = useCallback(
    (nextViewport: GraphCanvasViewport) =>
      setCanvasSession((current) => ({
        ...current,
        viewport: nextViewport,
      })),
    []
  );
  const setCanvasScale = useCallback(
    (nextScale: number) =>
      setCanvasSession((current) => ({
        ...current,
        scale: nextScale,
      })),
    []
  );

  return {
    canvasSession,
    setCanvasSession,
    canvasViewport: canvasSession.viewport,
    setCanvasViewport,
    canvasScale: canvasSession.scale,
    setCanvasScale,
  };
};

export const useGraphDraftPositionState = () => {
  const [draftNodePositions, setDraftNodePositions] = useState<NodePositionDraftMap>({});

  return {
    draftNodePositions,
    setDraftNodePositions,
  };
};

export const useGraphFocusQueueState = () => {
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null);
  const [pendingFocusLinkId, setPendingFocusLinkId] = useState<string | null>(null);

  return {
    pendingFocusNodeId,
    setPendingFocusNodeId,
    pendingFocusLinkId,
    setPendingFocusLinkId,
  };
};
