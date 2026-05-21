import React from 'react';
import type { LiteralValue, TopologyNode } from '../../../domain/brain';
import NeuronDetailEditor from '../../NeuronDetailEditor';
import SynapseDetailEditor from '../../SynapseDetailEditor';
import type { DetailModalData } from '../../hooks/useSNNTopologyState';

interface GraphLeafLink {
  id: string;
  from: {
    nodeId: string;
  };
  to: {
    nodeId: string;
  };
  weight: number;
}

interface GraphDetailModalProps {
  detailModal: DetailModalData | null;
  activeNode: TopologyNode | null;
  activeLink: GraphLeafLink | null;
  activeNeuronParameters: {
    a: number;
    b: number;
    c: number;
    d: number;
    threshold: number;
  } | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, payload: { label: string; parameterOverrides?: Record<string, LiteralValue> }) => void;
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
            }}
            onUpdate={(updatedNeuron) => {
              const parameterOverrides: Record<string, LiteralValue> = {
                a: updatedNeuron.params.a,
                b: updatedNeuron.params.b,
                c: updatedNeuron.params.c,
                d: updatedNeuron.params.d,
                threshold: updatedNeuron.params.threshold,
              };
              onUpdateNode(activeNode.id, {
                label: updatedNeuron.label,
                parameterOverrides,
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
              description: 'Signal adapter leaf 仅编辑标签；参数由模型层定义。',
            }}
            onUpdate={(updatedNeuron) => {
              onUpdateNode(activeNode.id, {
                label: updatedNeuron.label,
              });
            }}
          />
        )}
        {detailModal.type === 'link' && activeLink && (
          <SynapseDetailEditor
            synapse={{
              id: activeLink.id,
              from: activeLink.from.nodeId,
              to: activeLink.to.nodeId,
              weight: activeLink.weight,
            }}
            onUpdate={(updatedSynapse) => {
              onUpdateLink(activeLink.id, updatedSynapse.weight);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default GraphDetailModal;
