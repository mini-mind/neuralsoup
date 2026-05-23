import React from 'react';
import NeuronDetailEditor from '../../NeuronDetailEditor';
import ConnectionDetailEditor from '../../ConnectionDetailEditor';
import type { GraphNodeUpdatePayload } from './graphNodeUpdate';
import type { DetailModalData, GraphLinkDetailData } from '../../hooks/useSNNTopologyState';
import type { AgentGraphViewNodeRecord } from './agentGraphViewModel';

interface GraphDetailModalProps {
  detailModal: DetailModalData | null;
  activeNode: AgentGraphViewNodeRecord | null;
  activeLink: GraphLinkDetailData | null;
  activeNeuronParameters: {
    a: number;
    b: number;
    c: number;
    d: number;
    threshold: number;
  } | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, payload: GraphNodeUpdatePayload) => void;
  onUpdateLink: (linkId: string, weight: number) => void;
}

const DEFAULT_SIGNAL_PARAMS = {
  a: 0,
  b: 0,
  c: 0,
  d: 0,
  threshold: 0,
};

const GraphDetailModal: React.FC<GraphDetailModalProps> = ({
  detailModal,
  activeNode,
  activeLink,
  activeNeuronParameters,
  onClose,
  onUpdateNode,
  onUpdateLink,
}) => {
  if (!detailModal) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      data-testid="topology-detail-modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-content"
        data-testid="topology-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="topology-detail-header">
          <button
            type="button"
            className="topology-detail-close"
            data-testid="topology-detail-close"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        {detailModal.type === 'node' && activeNode?.kind === 'neuron' && activeNeuronParameters && (
          <NeuronDetailEditor
            neuron={{
              id: activeNode.id,
              label: activeNode.label,
              params: activeNeuronParameters,
              initialState: activeNode.neuron?.initialState,
            }}
            onUpdate={(updatedNeuron) => {
              const parameterOverrides = {
                a: updatedNeuron.params.a,
                b: updatedNeuron.params.b,
                c: updatedNeuron.params.c,
                d: updatedNeuron.params.d,
                threshold: updatedNeuron.params.threshold,
              };
              onUpdateNode(activeNode.id, {
                label: updatedNeuron.label,
                parameterOverrides,
                initialState: updatedNeuron.initialState,
              });
            }}
          />
        )}
        {detailModal.type === 'node' && activeNode?.kind === 'signal' && (
          <NeuronDetailEditor
            neuron={{
              id: activeNode.id,
              label: activeNode.label,
              params: DEFAULT_SIGNAL_PARAMS,
              readonly: true,
              description: 'Signal adapter leaf 当前为只读；标签与映射规则请在 Settings > Body IR 中编辑。',
            }}
            onUpdate={() => {}}
          />
        )}
        {detailModal.type === 'link' && activeLink && !activeLink.aggregate && (
          <ConnectionDetailEditor
            connection={{
              id: activeLink.id,
              from: activeLink.fromNodeId,
              to: activeLink.toNodeId,
              weight: activeLink.weight,
            }}
            onUpdate={(updatedConnection) => {
              onUpdateLink(activeLink.id, updatedConnection.weight);
            }}
          />
        )}
        {detailModal.type === 'link' && activeLink && activeLink.aggregate && (
          <div className="topology-aggregate-link-detail" data-testid="topology-aggregate-link-detail">
            <div data-testid="topology-aggregate-link-from">{activeLink.fromNodeId}</div>
            <div data-testid="topology-aggregate-link-to">{activeLink.toNodeId}</div>
            <div data-testid="topology-aggregate-link-from-ref">{activeLink.fromRefNodeId}</div>
            <div data-testid="topology-aggregate-link-to-ref">{activeLink.toRefNodeId}</div>
            <div data-testid="topology-aggregate-link-count">{String(activeLink.count)}</div>
            <div data-testid="topology-aggregate-link-weight">{formatAggregateWeight(activeLink.weight)}</div>
            <div data-testid="topology-aggregate-link-readonly">只读摘要链路</div>
            <div data-testid="topology-aggregate-link-leaf-ids">{activeLink.leafLinkIds.join('|')}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const formatAggregateWeight = (weight: number) => (Number.isInteger(weight) ? `${weight}` : weight.toFixed(2));

export default GraphDetailModal;
