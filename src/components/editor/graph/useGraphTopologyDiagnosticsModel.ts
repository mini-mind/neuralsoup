import { useMemo } from 'react';
import {
  type AgentIRSummary,
  type AgentIR,
} from '../../../domain/brain';
import type { AgentDraftStatus, AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from '../../../types/agentRuntime';
import type { GraphCanvasViewport } from '../../hooks/useSNNTopologyState';

interface UseGraphTopologyDiagnosticsModelOptions {
  agent: AgentIR;
  visionCells: number;
  installedSummary: AgentIRSummary;
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
  installedSummary,
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
  void installedSummary;
  const canonicalSummary = useMemo(() => draftStatus.summary, [draftStatus.summary]);
  const canonicalValidationCount = useMemo(() => draftStatus.issues.length, [draftStatus.issues.length]);

  return {
    visionCells,
    canonicalSummary,
    canonicalValidationCount,
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
