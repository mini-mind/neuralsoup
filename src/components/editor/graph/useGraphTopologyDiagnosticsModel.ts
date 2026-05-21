import { useMemo } from 'react';
import {
  summarizeGraphIRDocument,
  validateGraphIRDocument,
  type GraphIRDocument,
} from '../../../domain/brain';
import type { GraphIRRuntimeActivitySnapshot, GraphIRRuntimeStatus } from '../../../types/graphIRRuntime';
import type { GraphCanvasViewport } from '../../hooks/useSNNTopologyState';

interface UseGraphTopologyDiagnosticsModelOptions {
  document: GraphIRDocument;
  visionCells: number;
  runtimeStatus: GraphIRRuntimeStatus;
  runtimeActivity: GraphIRRuntimeActivitySnapshot;
  nodeCount: number;
  synapseCount: number;
  selectedCount: number;
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  nodeCentersSummary: string;
  currentScope: 'root' | 'child';
  canvasViewport: GraphCanvasViewport;
  canvasScale: number;
}

export const useGraphTopologyDiagnosticsModel = ({
  document,
  visionCells,
  runtimeStatus,
  runtimeActivity,
  nodeCount,
  synapseCount,
  selectedCount,
  selectedNodeId,
  selectedLinkId,
  nodeCentersSummary,
  currentScope,
  canvasViewport,
  canvasScale,
}: UseGraphTopologyDiagnosticsModelOptions) => {
  const draftSummary = useMemo(() => summarizeGraphIRDocument(document), [document]);
  const draftValidationCount = useMemo(() => validateGraphIRDocument(document).length, [document]);

  return {
    visionCells,
    draftSummary,
    draftValidationCount,
    runtimeStatus,
    runtimeActivity,
    nodeCount,
    synapseCount,
    selectedCount,
    selectedNodeId,
    selectedLinkId,
    nodeCentersSummary,
    currentScope,
    canvasViewport,
    canvasScale,
  };
};
