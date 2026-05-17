import React, { useEffect, useMemo } from 'react';
import {
  summarizeGraphIRDocument,
  validateGraphIRDocument,
  type GraphIRDocument,
  type LiteralValue,
} from '../domain/brain';
import type { GraphIRRuntimeStatus } from '../types/graphIRRuntime';
import type { GraphPathItem } from './editor/types';
import NeuronDetailEditor from './NeuronDetailEditor';
import SynapseDetailEditor from './SynapseDetailEditor';
import { useSNNTopologyState } from './hooks/useSNNTopologyState';
import './SNNTopologyEditor.css';

interface SNNTopologyEditorProps {
  width: number;
  height: number;
  document: GraphIRDocument;
  visionCells?: number;
  onDocumentChange?: (document: GraphIRDocument) => void;
  onGraphPathChange?: (graphPath: GraphPathItem[]) => void;
  onGraphPathNavigateRegister?: (navigate: (pathId: string) => void) => void;
  runtimeStatus: GraphIRRuntimeStatus;
  isActive?: boolean;
}

const getNodeCenter = (node: { x: number; y: number; width: number; height: number }) => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

const formatWeight = (weight: number) => (Number.isInteger(weight) ? `${weight}` : weight.toFixed(2));

const isEditableOrInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  ) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest('button, input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
};

const SNNTopologyEditor: React.FC<SNNTopologyEditorProps> = ({
  width,
  height,
  document,
  visionCells = 36,
  onDocumentChange,
  onGraphPathChange,
  onGraphPathNavigateRegister,
  runtimeStatus,
  isActive = true,
}) => {
  const state = useSNNTopologyState({ document, onDocumentChange });
  const {
    breadcrumbs,
    currentScope,
    nodes,
    links,
    selection,
    pendingLinkSourceId,
    showDetailModal,
    activeNode,
    activeLink,
    activeNeuronParameters,
    navigateTo,
    navigateToBreadcrumb,
    selectNode,
    selectLink,
    openNodeDetail,
    openLinkDetail,
    closeDetailModal,
    startLinkCreation,
    finishLinkCreation,
    cancelPendingLink,
    removeSelected,
    addNeuronAt,
    updateNodeLabelAndParams,
    updateLinkWeight,
  } = state;

  useEffect(() => {
    if (!isActive) {
      cancelPendingLink();
    }
  }, [cancelPendingLink, isActive]);

  useEffect(() => {
    onGraphPathChange?.(breadcrumbs.map((item) => ({ id: item.id, label: item.label })));
  }, [breadcrumbs, onGraphPathChange]);

  useEffect(() => {
    if (!onGraphPathNavigateRegister) {
      return;
    }

    onGraphPathNavigateRegister(navigateToBreadcrumb);
  }, [navigateToBreadcrumb, onGraphPathNavigateRegister]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace' && event.key !== 'Escape') {
        return;
      }

      if (event.key === 'Escape') {
        cancelPendingLink();
        closeDetailModal();
        return;
      }

      if (isEditableOrInteractiveTarget(event.target)) {
        return;
      }

      removeSelected();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cancelPendingLink, closeDetailModal, isActive, removeSelected]);

  const nodeCentersSummary = useMemo(
    () =>
      nodes
        .map((node) => {
          const center = getNodeCenter(node);
          return `${node.id}:${Math.round(center.x)},${Math.round(center.y)}`;
        })
        .join('|'),
    [nodes]
  );

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const draftSummary = useMemo(() => summarizeGraphIRDocument(document), [document]);
  const draftIssues = useMemo(() => validateGraphIRDocument(document), [document]);
  const hasSelection = selection.nodeId !== null || selection.linkId !== null;
  const runtimeValidationCount = runtimeStatus.issues.length;
  const runtimeMessage = runtimeStatus.message ?? '';
  const runtimeStatusLabel = runtimeStatus.state === 'applied' ? '已安装' : '安装失败';

  return (
    <div className="snn-topology-editor" data-testid="topology-editor">
      <div className="topology-meta-hidden" data-testid="topology-runtime-summary" aria-hidden="true">
        <span data-testid="topology-draft-vision-cells">{visionCells}</span>
        <span data-testid="topology-draft-input-count">{draftSummary.inputSignalCount}</span>
        <span data-testid="topology-draft-output-count">{draftSummary.outputSignalCount}</span>
        <span data-testid="topology-draft-neuron-count">{draftSummary.neuronCount}</span>
        <span data-testid="topology-draft-synapse-count">{draftSummary.leafLinkCount}</span>
        <span data-testid="topology-draft-validation-count">{draftIssues.length}</span>
        <span data-testid="topology-runtime-state">{runtimeStatus.state}</span>
        <span data-testid="topology-runtime-status-label">{runtimeStatusLabel}</span>
        <span data-testid="topology-runtime-validation-count">{runtimeValidationCount}</span>
        <span data-testid="topology-runtime-input-count">{runtimeStatus.appliedSummary.inputSignalCount}</span>
        <span data-testid="topology-runtime-output-count">{runtimeStatus.appliedSummary.outputSignalCount}</span>
        <span data-testid="topology-runtime-neuron-count">{runtimeStatus.appliedSummary.neuronCount}</span>
        <span data-testid="topology-runtime-synapse-count">{runtimeStatus.appliedSummary.leafLinkCount}</span>
        <span data-testid="topology-runtime-message">{runtimeMessage}</span>
      </div>

      <div
        className="topology-surface"
        data-testid="topology-canvas"
        style={{
          width: Math.max(width, 1),
          height: Math.max(height, 1),
        }}
        onClick={() => {
          selectNode(null);
          selectLink(null);
          cancelPendingLink();
        }}
        onDoubleClick={(event) => {
          if (currentScope === 'child') {
            const rect = event.currentTarget.getBoundingClientRect();
            addNeuronAt(event.clientX - rect.left, event.clientY - rect.top);
          }
        }}
      >
        {pendingLinkSourceId && (
          <div className="topology-pending-link" data-testid="topology-pending-link">
            选择目标叶子节点完成连接
          </div>
        )}

        <svg className="topology-links" aria-hidden="true">
          {links.map((link) => {
            const fromNode = nodeMap.get(link.fromNodeId);
            const toNode = nodeMap.get(link.toNodeId);
            if (!fromNode || !toNode) {
              return null;
            }

            const from = getNodeCenter(fromNode);
            const to = getNodeCenter(toNode);
            const selected = selection.linkId === link.id;

            return (
              <g
                key={link.id}
                className={`topology-link ${link.aggregate ? 'is-aggregate' : 'is-leaf'} ${selected ? 'is-selected' : ''}`}
                data-testid={`topology-link-${link.id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  selectLink(link.id);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (!link.aggregate) {
                    openLinkDetail(link.id);
                  }
                }}
              >
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>
                  {link.aggregate ? `${link.count} links` : `w ${formatWeight(link.weight)}`}
                </text>
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => {
          const selected = selection.nodeId === node.id;
          const pending = pendingLinkSourceId === node.id;
          const canNavigate = node.navigable;
          const canStartLink =
            currentScope === 'child' &&
            ((node.proxy && node.direction === 'input') || (!node.proxy && (node.direction === 'input' || node.direction === 'internal')));
          const canFinishLink =
            currentScope === 'child' &&
            pendingLinkSourceId !== null &&
            pendingLinkSourceId !== node.id &&
            (node.direction === 'output' || node.direction === 'internal');

          return (
            <div
              key={node.id}
              className={[
                'topology-node',
                `is-${node.kind}`,
                selected ? 'is-selected' : '',
                pending ? 'is-pending' : '',
                node.proxy ? 'is-proxy' : '',
              ].join(' ')}
              data-testid={`topology-node-${node.id}`}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (pendingLinkSourceId && canFinishLink) {
                  finishLinkCreation(node.id);
                  return;
                }

                selectNode(node.id);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (canNavigate) {
                  navigateTo(node.refNodeId);
                  return;
                }

                if (node.editable && !node.proxy) {
                  openNodeDetail(node.refNodeId);
                }
              }}
            >
              <div className="topology-node-label">{node.label}</div>
              <div className="topology-node-kind">{node.kind}</div>
              <div className="topology-node-detail">{node.detail}</div>
              <div className="topology-node-actions">
                {canNavigate && (
                  <button
                    type="button"
                    data-testid={`topology-enter-${node.refNodeId}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      navigateTo(node.refNodeId);
                    }}
                  >
                    进入
                  </button>
                )}
                {canStartLink && (
                  <button
                    type="button"
                    data-testid={`topology-start-link-${node.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      startLinkCreation(node.id);
                    }}
                  >
                    连接
                  </button>
                )}
                {node.editable && !node.proxy && (
                  <button
                    type="button"
                    data-testid={`topology-edit-${node.refNodeId}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openNodeDetail(node.refNodeId);
                    }}
                  >
                    编辑
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="topology-meta-hidden" data-testid="topology-state-summary" aria-hidden="true">
        <span data-testid="topology-node-count">{nodes.length}</span>
        <span data-testid="topology-synapse-count">{links.filter((link) => !link.aggregate).length}</span>
        <span data-testid="topology-selected-count">{hasSelection ? 1 : 0}</span>
        <span data-testid="topology-selected-node">{selection.nodeId ?? 'none'}</span>
        <span data-testid="topology-selected-link">{selection.linkId ?? 'none'}</span>
        <span data-testid="topology-selected-synapse">{selection.linkId ?? 'none'}</span>
        <span data-testid="topology-vision-cells">{visionCells}</span>
        <span data-testid="topology-input-count">{draftSummary.inputSignalCount}</span>
        <span data-testid="topology-output-count">{draftSummary.outputSignalCount}</span>
        <span data-testid="topology-validation-count">{draftIssues.length}</span>
        <span data-testid="topology-node-centers">{nodeCentersSummary}</span>
        <span data-testid="topology-scope">{currentScope}</span>
      </div>

      {showDetailModal && (
        <div
          className="modal-overlay"
          data-testid="topology-detail-modal-overlay"
          onClick={closeDetailModal}
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
                onClick={closeDetailModal}
              >
                关闭
              </button>
            </div>
            {showDetailModal.type === 'node' && activeNode && activeNode.kind === 'neuron' && activeNeuronParameters && (
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
                  updateNodeLabelAndParams(activeNode.id, {
                    label: updatedNeuron.label,
                    parameterOverrides,
                  });
                }}
              />
            )}
            {showDetailModal.type === 'node' && activeNode && activeNode.kind === 'signal' && (
              <NeuronDetailEditor
                neuron={{
                  id: activeNode.id,
                  label: activeNode.label,
                  params: DEFAULT_SIGNAL_PARAMS,
                  readonly: true,
                  description: 'Signal adapter leaf 仅编辑标签；参数由模型层定义。',
                }}
                onUpdate={(updatedNeuron) => {
                  updateNodeLabelAndParams(activeNode.id, {
                    label: updatedNeuron.label,
                  });
                }}
              />
            )}
            {showDetailModal.type === 'link' && activeLink && (
              <SynapseDetailEditor
                synapse={{
                  id: activeLink.id,
                  from: activeLink.from.nodeId,
                  to: activeLink.to.nodeId,
                  weight: activeLink.weight,
                }}
                onUpdate={(updatedSynapse) => {
                  updateLinkWeight(activeLink.id, updatedSynapse.weight);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DEFAULT_SIGNAL_PARAMS = {
  a: 0,
  b: 0,
  c: 0,
  d: 0,
  threshold: 0,
};

export default SNNTopologyEditor;
