import { useMemo } from 'react';
import {
  createLegacyGraphBridgeFromAgent,
  summarizeGraphIRDocument,
  validateGraphIRDocument,
  type AgentIR,
} from '../../../domain/brain';
import type { GraphIRRuntimeActivitySnapshot, GraphIRRuntimeStatus } from '../../../types/graphIRRuntime';
import type { GraphCanvasViewport } from '../../hooks/useSNNTopologyState';

interface UseGraphTopologyDiagnosticsModelOptions {
  agent: AgentIR;
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
  const document = useMemo(() => createLegacyGraphBridgeFromAgent(agent).document, [agent]);
  const draftSummary = useMemo(() => summarizeGraphIRDocument(document), [document]);
  const draftValidationCount = useMemo(() => validateGraphIRDocument(document).length, [document]);

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
