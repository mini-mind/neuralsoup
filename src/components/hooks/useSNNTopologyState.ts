import { useState, useCallback } from 'react';
import { SNNNode, SNNSynapse, Receptor, Effector } from '../../types/simulation';

export interface DetailModalData {
  type: 'neuron' | 'synapse';
  id: string;
}

export interface SelectionStateData {
  nodeIds: string[];
  synapseId: string | null;
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

export interface ConnectionDragState {
  element: any;
  fromType: 'node' | 'receptor' | 'effector';
  startX: number;
  startY: number;
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
  const [selection, setSelection] = useState<SelectionStateData>({
    nodeIds: [],
    synapseId: null
  });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // 交互状态
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [connecting, setConnecting] = useState<ConnectionState | null>(null);
  const [pendingConnection, setPendingConnection] = useState<ConnectionDragState | null>(null);
  const [isSelecting, setIsSelecting] = useState<SelectionState | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<DetailModalData | null>(null);

  // 画布状态
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1.0);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<{ startX: number; startY: number } | null>(null);

  // 控制状态
  // 感受器滚动状态
  const [receptorScrollX, setReceptorScrollX] = useState(0);

  const selectedNodes = selection.nodeIds;
  const selectedNode = selection.nodeIds.length === 1 ? selection.nodeIds[0] : null;
  const selectedSynapse = selection.synapseId;

  // 辅助方法
  const clearSelection = useCallback(() => {
    setSelection({
      nodeIds: [],
      synapseId: null
    });
  }, []);

  const setSelectedNode = useCallback((nodeId: string | null) => {
    setSelection({
      nodeIds: nodeId ? [nodeId] : [],
      synapseId: null
    });
  }, []);

  const setSelectedNodes = useCallback((nodeIds: string[]) => {
    setSelection({
      nodeIds,
      synapseId: null
    });
  }, []);

  const setSelectedSynapse = useCallback((synapseId: string | null) => {
    setSelection({
      nodeIds: [],
      synapseId
    });
  }, []);

  const resetInteractionState = useCallback(() => {
    clearSelection();
    setHoveredNode(null);
    setDragging(null);
    setConnecting(null);
    setPendingConnection(null);
    setIsSelecting(null);
    setShowDetailModal(null);
    setReceptorScrollX(0);
  }, [clearSelection]);

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
    selection,
    selectedNode,
    selectedSynapse,
    selectedNodes,
    hoveredNode,
    dragging,
    connecting,
    pendingConnection,
    isSelecting,
    showDetailModal,
    canvasOffset,
    canvasScale,
    isDraggingCanvas,
    receptorScrollX,

    // 设置器
    setNodes,
    setSynapses,
    setReceptors,
    setEffectors,
    setSelection,
    setSelectedNode,
    setSelectedSynapse,
    setSelectedNodes,
    setHoveredNode,
    setDragging,
    setConnecting,
    setPendingConnection,
    setIsSelecting,
    setShowDetailModal,
    setCanvasOffset,
    setCanvasScale,
    setIsDraggingCanvas,
    setReceptorScrollX,

    // 辅助方法
    clearSelection,
    resetInteractionState,
    addNode,
    removeNodes,
    addSynapse,
    removeSynapse
  };
}; 
