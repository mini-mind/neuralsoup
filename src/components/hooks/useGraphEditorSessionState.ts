import { useState } from 'react';
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

export const useGraphEditorSessionState = () => {
  const [selectionState, setSelectionState] = useState<GraphSelectionState>(createEmptySelectionState);
  const [showDetailModal, setShowDetailModal] = useState<DetailModalData | null>(null);
  const [selectionRect, setSelectionRect] = useState<GraphSelectionRect | null>(null);
  const [canvasSession, setCanvasSession] = useState<GraphCanvasSessionState>(createDefaultCanvasSessionState);
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
    canvasSession,
    setCanvasSession,
    canvasViewport: canvasSession.viewport,
    setCanvasViewport: (nextViewport: GraphCanvasViewport) =>
      setCanvasSession((current) => ({
        ...current,
        viewport: nextViewport,
      })),
    canvasScale: canvasSession.scale,
    setCanvasScale: (nextScale: number) =>
      setCanvasSession((current) => ({
        ...current,
        scale: nextScale,
      })),
    draftNodePositions,
    setDraftNodePositions,
    pendingFocusNodeId,
    setPendingFocusNodeId,
    pendingFocusLinkId,
    setPendingFocusLinkId,
  };
};
