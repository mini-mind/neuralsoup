import { useState, useCallback, useRef, useEffect, type SetStateAction } from 'react';
import type { BrainGraph } from '../../domain/brain';
import { SNNNode, SNNSynapse, Receptor, Effector } from '../../types/simulation';
import {
  createEffectorFromGraph,
  createNodesFromGraph,
  createReceptorFromGraph,
  createSynapsesFromGraph,
  updateGraphNeuronsFromNodes,
  updateGraphSynapsesFromEditorSynapses,
} from '../utils/defaultSNNData';

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

interface UseSNNTopologyStateOptions {
  graph: BrainGraph;
  onGraphChange?: (graph: BrainGraph) => void;
}

export const useSNNTopologyState = ({ graph, onGraphChange }: UseSNNTopologyStateOptions) => {
  const graphRef = useRef(graph);

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  const setGraph = useCallback((value: SetStateAction<BrainGraph>) => {
    const previousGraph = graphRef.current;
    const nextGraph = typeof value === 'function' ? value(previousGraph) : value;

    if (nextGraph === previousGraph) {
      return;
    }

    graphRef.current = nextGraph;
    onGraphChange?.(nextGraph);
  }, [onGraphChange]);

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
  const nodes = createNodesFromGraph(graph);
  const synapses = createSynapsesFromGraph(graph);
  const receptors: Receptor[] = [createReceptorFromGraph(graph)];
  const effectors: Effector[] = [createEffectorFromGraph(graph)];

  const setNodes = useCallback((value: SetStateAction<SNNNode[]>) => {
    setGraph((prevGraph) => {
      const prevNodes = createNodesFromGraph(prevGraph);
      const nextNodes = typeof value === 'function' ? value(prevNodes) : value;
      return updateGraphNeuronsFromNodes(prevGraph, nextNodes);
    });
  }, [setGraph]);

  const setSynapses = useCallback((value: SetStateAction<SNNSynapse[]>) => {
    setGraph((prevGraph) => {
      const prevSynapses = createSynapsesFromGraph(prevGraph);
      const nextSynapses = typeof value === 'function' ? value(prevSynapses) : value;
      return updateGraphSynapsesFromEditorSynapses(prevGraph, nextSynapses);
    });
  }, [setGraph]);

  const setReceptors = useCallback((_value: SetStateAction<Receptor[]>) => {
    // Receptors are derived from BrainGraph inputs and are not independently mutable.
  }, []);

  const setEffectors = useCallback((_value: SetStateAction<Effector[]>) => {
    // Effectors are derived from BrainGraph outputs and are not independently mutable.
  }, []);

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
    setNodes((prev) => [...prev, node]);
  }, [setNodes]);

  const removeNodes = useCallback((nodeIds: string[]) => {
    setNodes((prev) => prev.filter((node) => !nodeIds.includes(node.id)));
    setSynapses((prev) => prev.filter((synapse) =>
      !nodeIds.includes(synapse.from) && !nodeIds.includes(synapse.to)
    ));
  }, [setNodes, setSynapses]);

  const addSynapse = useCallback((synapse: SNNSynapse) => {
    setSynapses((prev) => [...prev, synapse]);
  }, [setSynapses]);

  const removeSynapse = useCallback((synapseId: string) => {
    setSynapses((prev) => prev.filter((synapse) => synapse.id !== synapseId));
  }, [setSynapses]);

  return {
    // 状态
    graph,
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
    setGraph,
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
