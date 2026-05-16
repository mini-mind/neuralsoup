import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { CanvasRenderer } from './CanvasRenderer';
import { useSNNTopologyState } from './hooks/useSNNTopologyState';
import { useSNNTopologyEvents } from './hooks/useSNNTopologyEvents';
import type { BrainGraph } from '../domain/brain';
import { validateBrainGraph } from '../domain/brain';
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
}

const SNNTopologyEditor: React.FC<SNNTopologyEditorProps> = ({
  width,
  height,
  graph: controlledGraph,
  visionCells = 36,
  onGraphChange,
  runtimeStatus
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
  const validationIssues = useMemo(() => validateBrainGraph(graph), [graph]);
  const inputCount = graph.inputs.length;
  const outputCount = graph.outputs.length;
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
    window.addEventListener('keydown', events.handleKeyDown);
    window.addEventListener('mouseup', events.stopInteraction);
    return () => {
      window.removeEventListener('keydown', events.handleKeyDown);
      window.removeEventListener('mouseup', events.stopInteraction);
    };
  }, [events.handleKeyDown, events.stopInteraction]);

  return (
    <div className="snn-topology-editor" data-testid="topology-editor">
      <div className="editor-header">
        <div className="header-left">
          <h4>BrainGraph 拓扑编辑器</h4>
          <span style={{fontSize: '11px', color: '#94a3b8'}}>({width}×{height})</span>
          <div 
            className="help-button" 
            data-tooltip="BrainGraph 拓扑编辑指南:
双击空白处 - 添加新神经元
左键拖拽 - 框选多个神经元或拖拽神经元
Ctrl+左键 - 多选神经元
Ctrl+从输入端口或神经元拖拽 - 创建结构连接
右键拖拽 - 平移画布
Delete键 - 删除选中元素
滚轮 - 缩放画布视图（包括网格）

顶部输入端口和底部输出端口展示当前 BrainGraph 的可接线边界。
此面板编辑拓扑结构本身，不在编辑器内执行独立脉冲模拟。"
          >
            <span>?</span>
          </div>
        </div>
        <div className="editor-controls">
          <div className="control-options" data-testid="topology-execution-mode">BrainGraph 结构预览</div>
        </div>
      </div>
      <div
        className="diagnostic-strip"
        data-testid="topology-runtime-summary"
      >
        <span data-testid="topology-draft-vision-cells">{visionCells}</span>
        <span data-testid="topology-draft-validation-count">{validationIssues.length}</span>
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
      <div
        className="diagnostic-strip"
        data-testid="topology-state-summary"
      >
        <span data-testid="topology-node-count">{nodes.length}</span>
        <span data-testid="topology-synapse-count">{synapses.length}</span>
        <span data-testid="topology-selected-count">{selectedNodes.length}</span>
        <span data-testid="topology-selected-synapse">{selectedSynapse ?? 'none'}</span>
        <span data-testid="topology-vision-cells">{visionCells}</span>
        <span data-testid="topology-input-count">{inputCount}</span>
        <span data-testid="topology-output-count">{outputCount}</span>
        <span data-testid="topology-validation-count">{validationIssues.length}</span>
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
