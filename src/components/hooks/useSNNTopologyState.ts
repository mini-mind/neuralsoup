import { useState, useCallback } from 'react';
import { SNNNode, SNNSynapse, Receptor, Effector, ReceptorInput, EffectorOutput, ReceptorModality } from '../../types/simulation';

export interface DetailModalData {
  type: 'neuron' | 'synapse' | 'receptor' | 'effector';
  data: any;
}

export interface SelectionState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface ConnectionState {
  from: string;
  fromType: 'node' | 'receptor' | 'effector';
  mouseX: number;
  mouseY: number;
}

export interface DragState {
  type: 'node' | 'receptor' | 'effector';
  id: string;
  offsetX: number;
  offsetY: number;
}

export interface CanvasState {
  offset: { x: number; y: number };
  scale: number;
  isDragging: { startX: number; startY: number } | null;
}

export const useSNNTopologyState = () => {
  // 网络元素状态
  const [nodes, setNodes] = useState<SNNNode[]>([]);
  const [synapses, setSynapses] = useState<SNNSynapse[]>([]);
  const [receptors, setReceptors] = useState<Receptor[]>([]);
  const [effectors, setEffectors] = useState<Effector[]>([]);

  // 选择状态
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedSynapse, setSelectedSynapse] = useState<string | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // 交互状态
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [connecting, setConnecting] = useState<ConnectionState | null>(null);
  const [isSelecting, setIsSelecting] = useState<SelectionState | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<DetailModalData | null>(null);

  // 画布状态
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1.0);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<{ startX: number; startY: number } | null>(null);

  // 控制状态
  const [enablePlayerControlOverride, setEnablePlayerControlOverride] = useState(false);
  
  // 感受器滚动状态
  const [receptorScrollX, setReceptorScrollX] = useState(0);

  // 辅助方法
  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedSynapse(null);
    setSelectedNodes([]);
  }, []);

  const addNode = useCallback((node: SNNNode) => {
    setNodes(prev => [...prev, node]);
  }, []);

  const removeNodes = useCallback((nodeIds: string[]) => {
    setNodes(prev => prev.filter(node => !nodeIds.includes(node.id)));
    setSynapses(prev => prev.filter(synapse => 
      !nodeIds.includes(synapse.from) && !nodeIds.includes(synapse.to)
    ));
  }, []);

  const addSynapse = useCallback((synapse: SNNSynapse) => {
    setSynapses(prev => [...prev, synapse]);
  }, []);

  const removeSynapse = useCallback((synapseId: string) => {
    setSynapses(prev => prev.filter(synapse => synapse.id !== synapseId));
  }, []);

  return {
    // 状态
    nodes,
    synapses,
    receptors,
    effectors,
    selectedNode,
    selectedSynapse,
    selectedNodes,
    hoveredNode,
    dragging,
    connecting,
    isSelecting,
    showDetailModal,
    canvasOffset,
    canvasScale,
    isDraggingCanvas,
    enablePlayerControlOverride,
    receptorScrollX,

    // 设置器
    setNodes,
    setSynapses,
    setReceptors,
    setEffectors,
    setSelectedNode,
    setSelectedSynapse,
    setSelectedNodes,
    setHoveredNode,
    setDragging,
    setConnecting,
    setIsSelecting,
    setShowDetailModal,
    setCanvasOffset,
    setCanvasScale,
    setIsDraggingCanvas,
    setEnablePlayerControlOverride,
    setReceptorScrollX,

    // 辅助方法
    clearSelection,
    addNode,
    removeNodes,
    addSynapse,
    removeSynapse
  };
}; 