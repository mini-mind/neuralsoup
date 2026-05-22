import { useMemo } from 'react';
import {
  summarizeGraphIRDocument,
  createLegacyGraphBridgeFromAgent,
  validateGraphIRDocument,
  type AgentIR,
  type GraphIRDocument,
} from '../../../domain/brain';
import type { GraphIRRuntimeActivitySnapshot, GraphIRRuntimeStatus } from '../../../types/graphIRRuntime';
import type { GraphCanvasViewport } from '../../hooks/useSNNTopologyState';

interface UseGraphTopologyDiagnosticsModelOptions {
  agent: AgentIR;
  draftDocument?: GraphIRDocument;
  visionCells: number;
  runtimeStatus: GraphIRRuntimeStatus;
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
  draftDocument,
  visionCells,
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
}: UseGraphTopologyDiagnosticsModelOptions) => {
  const document = useMemo(
    () => draftDocument ?? createLegacyGraphBridgeFromAgent(agent).document,
    [agent, draftDocument]
  );
  const draftSummary = useMemo(
    () => runtimeStatus.draftSummary ?? summarizeGraphIRDocument(document),
    [document, runtimeStatus.draftSummary]
  );
  const draftValidationCount = useMemo(
    () => runtimeStatus.draftValidationCount ?? validateGraphIRDocument(document).length,
    [document, runtimeStatus.draftValidationCount]
  );

  return {
    visionCells,
    draftSummary,
    draftValidationCount,
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
