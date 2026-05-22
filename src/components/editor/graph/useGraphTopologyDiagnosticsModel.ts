import { useMemo } from 'react';
import {
  type AgentIR,
  type GraphIRDocument,
} from '../../../domain/brain';
import type { GraphIRDraftStatus, GraphIRRuntimeActivitySnapshot, GraphIRRuntimeStatus } from '../../../types/graphIRRuntime';
import type { GraphCanvasViewport } from '../../hooks/useSNNTopologyState';

interface UseGraphTopologyDiagnosticsModelOptions {
  agent: AgentIR;
  document: GraphIRDocument;
  visionCells: number;
  runtimeStatus: GraphIRRuntimeStatus;
  draftStatus: GraphIRDraftStatus;
  runtimeActivity: GraphIRRuntimeActivitySnapshot;
  nodeCount: number;
  connectionCount: number;
  selectedCount: number;
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  nodeCentersSummary: string;
  nodeViewPositionsSummary: string;
  currentScope: 'root' | 'child';
  canvasViewport: GraphCanvasViewport;
  canvasScale: number;
}

export const useGraphTopologyDiagnosticsModel = ({
  agent,
  document,
  visionCells,
  runtimeStatus,
  draftStatus,
  runtimeActivity,
  nodeCount,
  connectionCount,
  selectedCount,
  selectedNodeId,
  selectedLinkId,
  nodeCentersSummary,
  nodeViewPositionsSummary,
  currentScope,
  canvasViewport,
  canvasScale,
}: UseGraphTopologyDiagnosticsModelOptions) => {
  void agent;
  const draftSummary = useMemo(() => draftStatus.summary, [draftStatus.summary]);
  const draftValidationCount = useMemo(() => draftStatus.issues.length, [draftStatus.issues.length]);

  return {
    visionCells,
    document,
    draftSummary,
    draftValidationCount,
    draftStatus,
    runtimeStatus,
    runtimeActivity,
    nodeCount,
    connectionCount,
    selectedCount,
    selectedNodeId,
    selectedLinkId,
    nodeCentersSummary,
    nodeViewPositionsSummary,
    currentScope,
    canvasViewport,
    canvasScale,
  };
};
