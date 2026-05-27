import React from 'react';
import NeuronDetailEditor from '../../NeuronDetailEditor';
import ConnectionDetailEditor from '../../ConnectionDetailEditor';
import GroupDetailEditor from '../../GroupDetailEditor';
import SignalDetailEditor from '../../SignalDetailEditor';
import type { GraphNodeUpdatePayload } from './graphNodeUpdate';
import type { DetailModalData, GraphLinkDetailData } from '../../hooks/useSNNTopologyState';
import type { AgentGraphViewNodeRecord } from './agentGraphViewModel';
import type { IzhikevichNeuronParameters } from '../../../domain/brain/shared';
import { resolveConnectionOverridePayload } from '../../ConnectionDetailEditor';

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
  onUpdateLink: (
    linkId: string,
    payload:
      | number
      | {
          weight: number;
          delayMs?: number;
          synapseModelId?: string;
          parameterOverrides?: {
            weight?: number;
            delayMs?: number;
          };
        }
  ) => void;
}

const DEFAULT_NEURON_OVERRIDES: IzhikevichNeuronParameters = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
};

const resolveNeuronDefaults = (
  _activeNode: AgentGraphViewNodeRecord,
  activeNeuronParameters: {
    a: number;
    b: number;
    c: number;
    d: number;
    threshold: number;
  } | null
): IzhikevichNeuronParameters => {
  return {
    a: activeNeuronParameters?.a ?? DEFAULT_NEURON_OVERRIDES.a,
    b: activeNeuronParameters?.b ?? DEFAULT_NEURON_OVERRIDES.b,
    c: activeNeuronParameters?.c ?? DEFAULT_NEURON_OVERRIDES.c,
    d: activeNeuronParameters?.d ?? DEFAULT_NEURON_OVERRIDES.d,
    threshold: activeNeuronParameters?.threshold ?? DEFAULT_NEURON_OVERRIDES.threshold,
  };
};

const resolveNeuronEffectiveForEditor = (
  activeNode: AgentGraphViewNodeRecord,
  activeNeuronParameters: {
    a: number;
    b: number;
    c: number;
    d: number;
    threshold: number;
  } | null
): IzhikevichNeuronParameters => {
  const defaults = resolveNeuronDefaults(activeNode, activeNeuronParameters);
  return {
    a: activeNode.neuron?.parameterOverrides?.a ?? defaults.a,
    b: activeNode.neuron?.parameterOverrides?.b ?? defaults.b,
    c: activeNode.neuron?.parameterOverrides?.c ?? defaults.c,
    d: activeNode.neuron?.parameterOverrides?.d ?? defaults.d,
    threshold: activeNode.neuron?.parameterOverrides?.threshold ?? defaults.threshold,
  };
};

const resolveAggregateEditableConnection = (activeLink: GraphLinkDetailData) => {
  const defaultParameters = activeLink.defaultParameters;
  const resolvedParameters = {
    weight: activeLink.weight,
    delayMs: activeLink.delayMs,
  };

  return {
    id: activeLink.id,
    from: activeLink.fromNodeId,
    to: activeLink.toNodeId,
    synapseModelId: activeLink.synapseModelId ?? '',
    parameterOverrides: resolveConnectionOverridePayload({
      defaultParameters,
      nextWeightValue: resolvedParameters.weight,
      nextDelayMsValue: resolvedParameters.delayMs,
    }).parameterOverrides,
    resolvedParameters,
    defaultParameters,
  };
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
        {detailModal.type === 'node' && activeNode?.kind === 'neuron' && (
          <NeuronDetailEditor
            neuron={{
              id: activeNode.id,
              label: activeNode.label,
              neuronModelId: activeNode.neuron?.neuronModelId ?? '',
              parameterOverrides: resolveNeuronEffectiveForEditor(activeNode, activeNeuronParameters),
              initialState: activeNode.neuron?.initialState,
            }}
            onUpdate={(updatedNeuron) => {
              const defaultParameters = resolveNeuronDefaults(activeNode, activeNeuronParameters);
              const nextOverrides = updatedNeuron.parameterOverrides;
              const parameterOverrides: Record<string, number> = {};
              if (nextOverrides.a !== defaultParameters.a) {
                parameterOverrides.a = nextOverrides.a;
              }
              if (nextOverrides.b !== defaultParameters.b) {
                parameterOverrides.b = nextOverrides.b;
              }
              if (nextOverrides.c !== defaultParameters.c) {
                parameterOverrides.c = nextOverrides.c;
              }
              if (nextOverrides.d !== defaultParameters.d) {
                parameterOverrides.d = nextOverrides.d;
              }
              if (nextOverrides.threshold !== defaultParameters.threshold) {
                parameterOverrides.threshold = nextOverrides.threshold;
              }
              const nextPayload: GraphNodeUpdatePayload & {
                neuronModelId?: string;
              } = {
                label: updatedNeuron.label,
                neuronModelId: updatedNeuron.neuronModelId,
                parameterOverrides,
                initialState: updatedNeuron.initialState,
              };
              onUpdateNode(activeNode.id, nextPayload);
            }}
          />
        )}
        {detailModal.type === 'node' && activeNode?.kind === 'signal' && (
          <SignalDetailEditor
            signal={{
              id: activeNode.id,
              label: activeNode.label,
              direction: activeNode.endpoint?.scope === 'bodyInput' ? 'input' : 'output',
              source: activeNode.endpoint?.scope === 'bodyInput' ? activeNode.endpoint.source : undefined,
              target: activeNode.endpoint?.scope === 'bodyOutput' ? activeNode.endpoint.target : undefined,
              scale: activeNode.endpoint?.scope === 'bodyInput' ? activeNode.endpoint.scale : undefined,
              decayPerSecond:
                activeNode.endpoint?.scope === 'bodyOutput' ? activeNode.endpoint.decayPerSecond : undefined,
            }}
            onUpdate={(updatedSignal) => {
              onUpdateNode(activeNode.id, {
                label: updatedSignal.label,
                nodeKind: 'signal',
                source: updatedSignal.source,
                target: updatedSignal.target,
                scale: updatedSignal.scale,
                decayPerSecond: updatedSignal.decayPerSecond,
              });
            }}
          />
        )}
        {detailModal.type === 'node' && activeNode?.kind === 'neuron-group' && (
          <GroupDetailEditor
            group={{
              id: activeNode.id,
              label: activeNode.label,
            }}
            onUpdate={(updatedGroup) => {
              onUpdateNode(activeNode.id, {
                label: updatedGroup.label,
                nodeKind: 'neuron-group',
              });
            }}
          />
        )}
        {detailModal.type === 'link' && activeLink && !activeLink.aggregate && activeLink.editable && (
          <ConnectionDetailEditor
            connection={{
              id: activeLink.id,
              from: activeLink.fromNodeId,
              to: activeLink.toNodeId,
              synapseModelId: activeLink.synapseModelId ?? '',
              parameterOverrides: {
                ...(activeLink.parameterOverrides.weight == null ? {} : { weight: activeLink.parameterOverrides.weight }),
                ...(activeLink.parameterOverrides.delayMs == null ? {} : { delayMs: activeLink.parameterOverrides.delayMs }),
              },
              resolvedParameters: {
                weight: activeLink.resolvedParameters.weight,
                delayMs: activeLink.resolvedParameters.delayMs,
              },
              defaultParameters: {
                weight: activeLink.defaultParameters.weight,
                delayMs: activeLink.defaultParameters.delayMs,
              },
            }}
            onUpdate={(updatedConnection) => {
              onUpdateLink(activeLink.id, {
                weight: updatedConnection.resolvedParameters.weight,
                delayMs: updatedConnection.resolvedParameters.delayMs,
                synapseModelId: updatedConnection.synapseModelId,
                parameterOverrides: {
                  ...(updatedConnection.parameterOverrides.weight == null
                    ? {}
                    : { weight: updatedConnection.parameterOverrides.weight }),
                  ...(updatedConnection.parameterOverrides.delayMs == null
                    ? {}
                    : { delayMs: updatedConnection.parameterOverrides.delayMs }),
                },
              });
            }}
          />
        )}
        {detailModal.type === 'link' && activeLink && !activeLink.aggregate && !activeLink.editable && (
          <div className="topology-aggregate-link-detail" data-testid="topology-link-readonly-detail">
            <div data-testid="topology-link-readonly-from">{activeLink.fromNodeId}</div>
            <div data-testid="topology-link-readonly-to">{activeLink.toNodeId}</div>
            <div data-testid="topology-link-readonly-note">该链路来自 Body IR 预览端点，只读不可编辑。</div>
          </div>
        )}
        {detailModal.type === 'link' && activeLink && activeLink.aggregate && (
          <div className="topology-aggregate-link-detail" data-testid="topology-aggregate-link-detail">
            <div data-testid="topology-aggregate-link-from">{activeLink.fromNodeId}</div>
            <div data-testid="topology-aggregate-link-to">{activeLink.toNodeId}</div>
            <div data-testid="topology-aggregate-link-from-ref">{activeLink.fromRefNodeId}</div>
            <div data-testid="topology-aggregate-link-to-ref">{activeLink.toRefNodeId}</div>
            <div data-testid="topology-aggregate-link-count">{String(activeLink.count)}</div>
            <div data-testid="topology-aggregate-link-weight">{formatAggregateWeight(activeLink.weight)}</div>
            <div data-testid="topology-aggregate-link-leaf-ids">{activeLink.leafLinkIds.join('|')}</div>
            <ConnectionDetailEditor
              connection={resolveAggregateEditableConnection(activeLink)}
              onUpdate={(updatedConnection) => {
                onUpdateLink(activeLink.id, {
                  weight: updatedConnection.resolvedParameters.weight,
                  delayMs: updatedConnection.resolvedParameters.delayMs,
                  synapseModelId: updatedConnection.synapseModelId,
                  parameterOverrides: {
                    ...(updatedConnection.parameterOverrides.weight == null
                      ? {}
                      : { weight: updatedConnection.parameterOverrides.weight }),
                    ...(updatedConnection.parameterOverrides.delayMs == null
                      ? {}
                      : { delayMs: updatedConnection.parameterOverrides.delayMs }),
                  },
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const formatAggregateWeight = (weight: number) => (Number.isInteger(weight) ? `${weight}` : weight.toFixed(2));

export default GraphDetailModal;
