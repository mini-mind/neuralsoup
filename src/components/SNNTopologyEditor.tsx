import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { CanvasRenderer } from './CanvasRenderer';
import { useSNNTopologyState } from './hooks/useSNNTopologyState';
import { useSNNTopologyEvents } from './hooks/useSNNTopologyEvents';
import type { BrainGraph } from '../domain/brain';
import { getNodeCenter } from './utils/editorGeometry';
import NeuronDetailEditor from './NeuronDetailEditor';
import SynapseDetailEditor from './SynapseDetailEditor';
import type { BrainGraphRuntimeStatus } from '../types/brainGraphRuntime';
import './SNNTopologyEditor.css';

interface SNNTopologyEditorProps {
  width: number;
  height: number;
  graph: BrainGraph;
  visionCells?: number;
  onGraphChange?: (graph: BrainGraph) => void;
  runtimeStatus: BrainGraphRuntimeStatus;
  isActive?: boolean;
}

const SNNTopologyEditor: React.FC<SNNTopologyEditorProps> = ({
  width,
  height,
  graph: controlledGraph,
  visionCells = 36,
  onGraphChange,
  runtimeStatus,
  isActive = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useSNNTopologyState({ graph: controlledGraph, onGraphChange });
  const events = useSNNTopologyEvents({ canvasRef, state });

  const {
    graph,
    nodes,
    synapses,
    receptors,
    effectors,
    selectedSynapse,
    connecting,
    canvasOffset,
    canvasScale,
    isSelecting,
    selectedNodes,
    hoveredNode,
    showDetailModal,
    receptorScrollX,
    setNodes,
    setSynapses,
    setShowDetailModal
  } = state;

  const activeNeuron = useMemo(
    () => showDetailModal?.type === 'neuron'
      ? nodes.find(node => node.id === showDetailModal.id) ?? null
      : null,
    [nodes, showDetailModal]
  );
  const activeSynapse = useMemo(
    () => showDetailModal?.type === 'synapse'
      ? synapses.find(synapse => synapse.id === showDetailModal.id) ?? null
      : null,
    [showDetailModal, synapses]
  );
  const nodeCentersSummary = useMemo(
    () => nodes.map((node) => {
      const center = getNodeCenter(node, canvasOffset, canvasScale);
      return `${node.id}:${Math.round(center.x)},${Math.round(center.y)}`;
    }).join('|'),
    [canvasOffset, canvasScale, nodes]
  );
  const runtimeStatusLabel = runtimeStatus.state === 'applied' ? '已安装' : '安装失败';

  useEffect(() => {
    if (!showDetailModal) {
      return;
    }

    if (showDetailModal.type === 'neuron' && !activeNeuron) {
      setShowDetailModal(null);
    }

    if (showDetailModal.type === 'synapse' && !activeSynapse) {
      setShowDetailModal(null);
    }
  }, [activeNeuron, activeSynapse, setShowDetailModal, showDetailModal]);

  // 绘制画布内容
  const draw = useCallback(() => {
    CanvasRenderer.draw({
      canvasRef,
      nodes,
      synapses,
      receptors,
      effectors,
      selectedSynapse,
      connecting,
      canvasOffset,
      canvasScale,
      isSelecting,
      selectedNodes,
      hoveredNode,
      receptorScrollX
    });
  }, [nodes, synapses, receptors, effectors, selectedSynapse, connecting, canvasOffset, canvasScale, isSelecting, selectedNodes, hoveredNode, receptorScrollX]);

  // 画布重绘
  useEffect(() => {
    draw();
  }, [draw]);

  // 添加键盘事件监听
  useEffect(() => {
    if (!isActive) {
      return;
    }

    window.addEventListener('keydown', events.handleKeyDown);
    window.addEventListener('mouseup', events.stopInteraction);
    return () => {
      window.removeEventListener('keydown', events.handleKeyDown);
      window.removeEventListener('mouseup', events.stopInteraction);
    };
  }, [events.handleKeyDown, events.stopInteraction, isActive]);

  return (
    <div className="snn-topology-editor" data-testid="topology-editor">
      <div className="topology-meta-hidden" data-testid="topology-runtime-summary" aria-hidden="true">
        <span data-testid="topology-draft-vision-cells">{visionCells}</span>
        <span data-testid="topology-draft-validation-count">{0}</span>
        <span data-testid="topology-runtime-state">{runtimeStatus.state}</span>
        <span data-testid="topology-runtime-status-label">{runtimeStatusLabel}</span>
        <span data-testid="topology-runtime-validation-count">{runtimeStatus.issues.length}</span>
        <span data-testid="topology-runtime-input-count">{runtimeStatus.appliedGraph.inputs.length}</span>
        <span data-testid="topology-runtime-synapse-count">{runtimeStatus.appliedGraph.synapses.length}</span>
        <span data-testid="topology-runtime-message">{runtimeStatus.message ?? ''}</span>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        data-testid="topology-canvas"
        onMouseDown={events.handleMouseDown}
        onMouseMove={events.handleMouseMove}
        onMouseUp={events.handleMouseUp}
        onDoubleClick={events.handleDoubleClick}
        onWheel={events.handleWheel}
        onContextMenu={events.handleContextMenu}
        className="topology-canvas"
        tabIndex={0}
        style={{ outline: 'none' }}
      />
      <div className="topology-meta-hidden" data-testid="topology-state-summary" aria-hidden="true">
        <span data-testid="topology-node-count">{nodes.length}</span>
        <span data-testid="topology-synapse-count">{synapses.length}</span>
        <span data-testid="topology-selected-count">{selectedNodes.length}</span>
        <span data-testid="topology-selected-synapse">{selectedSynapse ?? 'none'}</span>
        <span data-testid="topology-vision-cells">{visionCells}</span>
        <span data-testid="topology-input-count">{graph.inputs.length}</span>
        <span data-testid="topology-output-count">{graph.outputs.length}</span>
        <span data-testid="topology-validation-count">{0}</span>
        <span data-testid="topology-node-centers">{nodeCentersSummary}</span>
      </div>
      
      {showDetailModal && (
        <div className="modal-overlay" data-testid="topology-detail-modal-overlay" onClick={() => setShowDetailModal(null)}>
          <div className="modal-content" data-testid="topology-detail-modal" onClick={e => e.stopPropagation()}>
            {showDetailModal.type === 'neuron' && activeNeuron && (
              <NeuronDetailEditor
                neuron={activeNeuron}
                onUpdate={(updatedNeuron) => {
                  setNodes(prev => prev.map(node =>
                    node.id === updatedNeuron.id ? updatedNeuron : node
                  ));
                }}
              />
            )}
            {showDetailModal.type === 'synapse' && activeSynapse && (
              <SynapseDetailEditor
                synapse={activeSynapse}
                onUpdate={(updatedSynapse) => {
                  setSynapses(prev => prev.map(synapse =>
                    synapse.id === updatedSynapse.id ? updatedSynapse : synapse
                  ));
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SNNTopologyEditor; 
