import { useMemo } from 'react';
import {
  type AgentIR,
} from '../../../domain/brain';
import type { AgentDraftStatus, AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from '../../../types/agentRuntime';
import type { GraphCanvasViewport } from '../../hooks/useSNNTopologyState';

interface UseGraphTopologyDiagnosticsModelOptions {
  agent: AgentIR;
  visionCells: number;
  runtimeStatus: AgentRuntimeStatus;
  draftStatus: AgentDraftStatus;
  runtimeActivity: AgentRuntimeActivitySnapshot;
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
