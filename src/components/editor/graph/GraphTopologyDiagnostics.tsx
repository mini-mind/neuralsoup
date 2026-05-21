import React from 'react';
import type { GraphIRRuntimeActivitySnapshot, GraphIRRuntimeStatus } from '../../../types/graphIRRuntime';
import type { GraphCanvasViewport } from '../../hooks/useSNNTopologyState';

interface GraphTopologyDiagnosticsProps {
  visionCells: number;
  draftSummary: {
    inputSignalCount: number;
    outputSignalCount: number;
    neuronCount: number;
    leafLinkCount: number;
  };
  draftValidationCount: number;
  runtimeStatus: GraphIRRuntimeStatus;
  runtimeActivity: GraphIRRuntimeActivitySnapshot;
  nodeCount: number;
  synapseCount: number;
  selectedCount: number;
  selectedNodeId: string | null;
  selectedLinkId: string | null;
  nodeCentersSummary: string;
  nodeViewPositionsSummary: string;
  currentScope: 'root' | 'child';
  canvasViewport: GraphCanvasViewport;
  canvasScale: number;
}

const GraphTopologyDiagnostics: React.FC<GraphTopologyDiagnosticsProps> = ({
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
  nodeViewPositionsSummary,
  currentScope,
  canvasViewport,
  canvasScale,
}) => {
  const runtimeStatusLabel = runtimeStatus.state === 'applied' ? '已安装' : '安装失败';
  const runtimeMessage = runtimeStatus.message ?? '';

  return (
    <>
      <div className="topology-meta-hidden" data-testid="topology-runtime-summary" aria-hidden="true">
        <span data-testid="topology-draft-vision-cells">{visionCells}</span>
        <span data-testid="topology-draft-input-count">{draftSummary.inputSignalCount}</span>
        <span data-testid="topology-draft-output-count">{draftSummary.outputSignalCount}</span>
        <span data-testid="topology-draft-neuron-count">{draftSummary.neuronCount}</span>
        <span data-testid="topology-draft-synapse-count">{draftSummary.leafLinkCount}</span>
        <span data-testid="topology-draft-validation-count">{draftValidationCount}</span>
        <span data-testid="topology-runtime-state">{runtimeStatus.state}</span>
        <span data-testid="topology-runtime-status-label">{runtimeStatusLabel}</span>
        <span data-testid="topology-runtime-validation-count">{runtimeStatus.issues.length}</span>
        <span data-testid="topology-runtime-input-count">{runtimeStatus.appliedSummary.inputSignalCount}</span>
        <span data-testid="topology-runtime-output-count">{runtimeStatus.appliedSummary.outputSignalCount}</span>
        <span data-testid="topology-runtime-neuron-count">{runtimeStatus.appliedSummary.neuronCount}</span>
        <span data-testid="topology-runtime-synapse-count">{runtimeStatus.appliedSummary.leafLinkCount}</span>
        <span data-testid="topology-runtime-message">{runtimeMessage}</span>
        <span data-testid="topology-runtime-active-node-count">{runtimeActivity.activeNodeIds.length}</span>
        <span data-testid="topology-runtime-active-node-ids">{runtimeActivity.activeNodeIds.join('|')}</span>
      </div>

      <div className="topology-meta-hidden" data-testid="topology-state-summary" aria-hidden="true">
        <span data-testid="topology-node-count">{nodeCount}</span>
        <span data-testid="topology-synapse-count">{synapseCount}</span>
        <span data-testid="topology-selected-count">{selectedCount}</span>
        <span data-testid="topology-selected-node">{selectedNodeId ?? 'none'}</span>
        <span data-testid="topology-selected-link">{selectedLinkId ?? 'none'}</span>
        <span data-testid="topology-selected-synapse">{selectedLinkId ?? 'none'}</span>
        <span data-testid="topology-vision-cells">{visionCells}</span>
        <span data-testid="topology-input-count">{draftSummary.inputSignalCount}</span>
        <span data-testid="topology-output-count">{draftSummary.outputSignalCount}</span>
        <span data-testid="topology-validation-count">{draftValidationCount}</span>
        <span data-testid="topology-node-centers">{nodeCentersSummary}</span>
        <span data-testid="topology-node-view-positions">{nodeViewPositionsSummary}</span>
        <span data-testid="topology-scope">{currentScope}</span>
        <span data-testid="topology-canvas-offset">{`${Math.round(canvasViewport.x)},${Math.round(canvasViewport.y)}`}</span>
        <span data-testid="topology-canvas-scale">{canvasScale.toFixed(2)}</span>
      </div>
    </>
  );
};

export default GraphTopologyDiagnostics;
