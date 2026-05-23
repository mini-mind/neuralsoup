import React from 'react';
import type { AgentDraftStatus, AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from '../../../types/agentRuntime';
import type { GraphCanvasViewport } from '../../hooks/useSNNTopologyState';

interface GraphTopologyDiagnosticsProps {
  visionCells: number;
  draftStatus: AgentDraftStatus;
  canonicalSummary: {
    inputSignalCount: number;
    outputSignalCount: number;
    neuronCount: number;
    leafLinkCount: number;
  };
  draftValidationCount: number;
  runtimeStatus: AgentRuntimeStatus;
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

const GraphTopologyDiagnostics: React.FC<GraphTopologyDiagnosticsProps> = ({
  visionCells,
  draftStatus,
  canonicalSummary,
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
}) => {
  const runtimeStatusLabel = runtimeStatus.state === 'applied' ? '已安装' : '安装失败';
  const runtimeMessage = runtimeStatus.message ?? '';
  const draftStatusLabel = draftStatus.state === 'structurally-valid' ? '结构有效' : '草稿非法';
  const draftMessage = draftStatus.message ?? '';

  return (
    <>
      <div className="topology-meta-hidden" data-testid="topology-runtime-summary" aria-hidden="true">
        <span data-testid="topology-draft-vision-cells">{visionCells}</span>
        <span data-testid="topology-draft-state">{draftStatus.state}</span>
        <span data-testid="topology-draft-status-label">{draftStatusLabel}</span>
        <span data-testid="topology-draft-input-count">{canonicalSummary.inputSignalCount}</span>
        <span data-testid="topology-draft-output-count">{canonicalSummary.outputSignalCount}</span>
        <span data-testid="topology-draft-neuron-count">{canonicalSummary.neuronCount}</span>
        <span data-testid="topology-draft-connection-count">{canonicalSummary.leafLinkCount}</span>
        <span data-testid="topology-draft-validation-count">{draftValidationCount}</span>
        <span data-testid="topology-draft-message">{draftMessage}</span>
        <span data-testid="topology-runtime-state">{runtimeStatus.state}</span>
        <span data-testid="topology-runtime-status-label">{runtimeStatusLabel}</span>
        <span data-testid="topology-runtime-validation-count">{runtimeStatus.issues.length}</span>
        <span data-testid="topology-runtime-input-count">{runtimeStatus.appliedSummary.inputSignalCount}</span>
        <span data-testid="topology-runtime-output-count">{runtimeStatus.appliedSummary.outputSignalCount}</span>
        <span data-testid="topology-runtime-neuron-count">{runtimeStatus.appliedSummary.neuronCount}</span>
        <span data-testid="topology-runtime-connection-count">{runtimeStatus.appliedSummary.leafLinkCount}</span>
        <span data-testid="topology-runtime-message">{runtimeMessage}</span>
        <span data-testid="topology-runtime-active-node-count">{runtimeActivity.activeNodeIds.length}</span>
        <span data-testid="topology-runtime-active-node-ids">{runtimeActivity.activeNodeIds.join('|')}</span>
      </div>

      <div className="topology-meta-hidden" data-testid="topology-state-summary" aria-hidden="true">
        <span data-testid="topology-node-count">{nodeCount}</span>
        <span data-testid="topology-connection-count">{connectionCount}</span>
        <span data-testid="topology-selected-count">{selectedCount}</span>
        <span data-testid="topology-selected-node">{selectedNodeId ?? 'none'}</span>
        <span data-testid="topology-selected-link">{selectedLinkId ?? 'none'}</span>
        <span data-testid="topology-vision-cells">{visionCells}</span>
        <span data-testid="topology-canonical-input-count">{canonicalSummary.inputSignalCount}</span>
        <span data-testid="topology-canonical-output-count">{canonicalSummary.outputSignalCount}</span>
        <span data-testid="topology-canonical-validation-count">{draftValidationCount}</span>
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
