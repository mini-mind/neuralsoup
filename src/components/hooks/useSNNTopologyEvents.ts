import { useCallback } from 'react';
import { SNNNode } from '../../types/simulation';
import { CanvasEventHandler } from '../CanvasEventHandler';
import { useSNNTopologyState } from './useSNNTopologyState';
import { useConnectionLogic } from './useConnectionLogic';
import {
  getNodeCenter,
  getReceptorFrame,
  getVisionContentWidth
} from '../utils/editorGeometry';

interface UseSNNTopologyEventsProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  state: ReturnType<typeof useSNNTopologyState>;
}

export const useSNNTopologyEvents = ({ canvasRef, state }: UseSNNTopologyEventsProps) => {
  const {
    nodes,
    synapses,
    receptors,
    effectors,
    selectedNode,
    selectedSynapse,
    selectedNodes,
    connecting,
    isSelecting,
    isDraggingCanvas,
    dragging,
    canvasOffset,
    canvasScale,
    receptorScrollX,
    setNodes,
    setSelectedNode,
    setSelectedNodes,
    setDragging,
    setConnecting,
    setIsSelecting,
    setSelectedSynapse,
    setCanvasOffset,
    setCanvasScale,
    setIsDraggingCanvas,
    setHoveredNode,
    clearSelection,
    addNode,
    removeNodes,
    addSynapse,
    removeSynapse
  } = state;

  // 使用连接逻辑hook
  const connectionLogic = useConnectionLogic({
    canvasRef,
    nodes,
    receptors,
    effectors,
    canvasOffset,
    canvasScale,
    receptorScrollX,
    connecting,
    setConnecting,
    setHoveredNode,
    addSynapse
  });

  const stopInteraction = useCallback(() => {
    state.setPendingConnection(null);
    setDragging(null);
    setIsDraggingCanvas(null);
    setIsSelecting(null);
    if (connecting) {
      connectionLogic.cancelConnection();
    }
  }, [connecting, connectionLogic, setDragging, setIsDraggingCanvas, setIsSelecting, state]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
    const clicked = CanvasEventHandler.detectClickedElement(x, y, {
      canvasRef,
      nodes,
      receptors,
      effectors,
      canvasOffset,
      canvasScale,
      receptorScrollX
    });

    if (e.button === 2) { // 右键
      e.preventDefault();
      // 右键仅用于画布拖拽
      setIsDraggingCanvas({ startX: x, startY: y });
    } else if (e.button === 0) { // 左键
      if (clicked) {
        if (clicked.type === 'neuron' || clicked.type === 'receptor' || clicked.type === 'effector') {
          if (e.ctrlKey) {
            const fromType =
              clicked.type === 'receptor'
                ? 'receptor'
                : clicked.type === 'effector'
                  ? 'effector'
                  : 'node';
            state.setPendingConnection({
              element: clicked.element,
              fromType,
              startX: x,
              startY: y
            });
            if (clicked.type === 'neuron') {
              const nextSelection = selectedNodes.includes(clicked.element.id)
                ? selectedNodes.filter(id => id !== clicked.element.id)
                : [...selectedNodes, clicked.element.id];
              setSelectedNodes(nextSelection);
            } else {
              clearSelection();
            }
          } else if (clicked.type === 'neuron') {
            setSelectedNode(clicked.element.id);
            setDragging({
              type: 'node',
              id: clicked.element.id,
              offsetX: x - (clicked.element.x + canvasOffset.x) * canvasScale,
              offsetY: y - (clicked.element.y + canvasOffset.y) * canvasScale
            });
          }
        }
      } else {
        const clickedSynapse = CanvasEventHandler.detectClickedSynapse(x, y, synapses, {
          canvasRef,
          nodes,
          receptors,
          effectors,
          canvasOffset,
          canvasScale,
          receptorScrollX
        });
        
        if (clickedSynapse) {
          setSelectedSynapse(clickedSynapse.id);
        } else {
          clearSelection();
          setIsSelecting({ startX: x, startY: y, currentX: x, currentY: y });
        }
      }
    }
  }, [canvasRef, nodes, synapses, receptors, effectors, selectedNodes, canvasOffset, canvasScale, receptorScrollX, setSelectedNode, setSelectedNodes, setDragging, setSelectedSynapse, setIsDraggingCanvas, setIsSelecting, clearSelection, state]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
    
    if (state.pendingConnection && !connecting) {
      const deltaX = x - state.pendingConnection.startX;
      const deltaY = y - state.pendingConnection.startY;
      if (Math.hypot(deltaX, deltaY) >= 8) {
        connectionLogic.startConnection(state.pendingConnection.element, state.pendingConnection.fromType, state.pendingConnection.startX, state.pendingConnection.startY);
        state.setPendingConnection(null);
      }
    }

    if (connecting) {
      connectionLogic.handleConnectionMove(x, y);
    }
    
    if (isSelecting) {
      setIsSelecting(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
      return;
    }
    
    if (isDraggingCanvas) {
      const deltaX = x - isDraggingCanvas.startX;
      const deltaY = y - isDraggingCanvas.startY;
      setCanvasOffset(prev => ({
        x: prev.x + deltaX / canvasScale,
        y: prev.y + deltaY / canvasScale
      }));
      setIsDraggingCanvas({ startX: x, startY: y });
      return;
    }
    
    if (!dragging) return;

    if (dragging.type === 'node') {
      if (selectedNodes.includes(dragging.id)) {
        const deltaX = (x - dragging.offsetX) / canvasScale - canvasOffset.x;
        const deltaY = (y - dragging.offsetY) / canvasScale - canvasOffset.y;
        const originalNode = nodes.find(n => n.id === dragging.id);
        if (originalNode) {
          const offsetX = deltaX - originalNode.x;
          const offsetY = deltaY - originalNode.y;
          
          setNodes(prevNodes => 
            prevNodes.map(node => 
              selectedNodes.includes(node.id)
                ? { ...node, x: node.x + offsetX, y: node.y + offsetY }
                : node
            )
          );
        }
      } else {
        setNodes(prevNodes => 
          prevNodes.map(node => 
            node.id === dragging.id
              ? { 
                  ...node, 
                  x: (x - dragging.offsetX) / canvasScale - canvasOffset.x, 
                  y: (y - dragging.offsetY) / canvasScale - canvasOffset.y 
                }
              : node
          )
        );
      }
    }
  }, [canvasRef, connecting, connectionLogic, isSelecting, isDraggingCanvas, dragging, selectedNodes, nodes, canvasOffset, canvasScale, setIsSelecting, setCanvasOffset, setIsDraggingCanvas, setNodes, state]);

  const completePointerInteraction = useCallback((x: number, y: number) => {
    if (connecting) {
      connectionLogic.finishConnection(x, y);
    }
    state.setPendingConnection(null);
    
    if (isSelecting) {
      const { startX, startY, currentX, currentY } = isSelecting;
      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);
      
      const selectedInBox = nodes
        .filter(node => node.type === 'neuron')
        .filter(node => {
          const center = getNodeCenter(node, canvasOffset, canvasScale);
          return center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY;
        })
        .map(node => node.id);
      
      setSelectedNodes(selectedInBox);
      setIsSelecting(null);
    }
    
    setDragging(null);
    setIsDraggingCanvas(null);
  }, [connecting, connectionLogic, isSelecting, nodes, canvasOffset, canvasScale, setSelectedNodes, setIsSelecting, setDragging, setIsDraggingCanvas, state]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
    completePointerInteraction(x, y);
  }, [canvasRef, completePointerInteraction]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
    const clicked = CanvasEventHandler.detectClickedElement(x, y, {
      canvasRef,
      nodes,
      receptors,
      effectors,
      canvasOffset,
      canvasScale,
      receptorScrollX
    });
    const clickedSynapse = CanvasEventHandler.detectClickedSynapse(x, y, synapses, {
      canvasRef,
      nodes,
      receptors,
      effectors,
      canvasOffset,
      canvasScale,
      receptorScrollX
    });

    if (clicked && clicked.type === 'neuron') {
      state.setShowDetailModal({ type: 'neuron', data: clicked.element });
    } else if (clickedSynapse) {
      const synapse = synapses.find(s => s.id === clickedSynapse.id);
      if (synapse) {
        state.setShowDetailModal({ type: 'synapse', data: synapse });
      }
    } else if (!clicked) {
      const newNode: SNNNode = {
        id: `neuron-${Date.now()}`,
        x: x / canvasScale - canvasOffset.x - 25,
        y: y / canvasScale - canvasOffset.y - 25,
        type: 'neuron',
        label: `神经元${nodes.length + 1}`,
        params: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
        state: { v: -65, u: 0, spike: false, lastSpikeTime: 0 }
      };
      addNode(newNode);
    }
  }, [canvasRef, nodes, synapses, receptors, effectors, canvasOffset, canvasScale, receptorScrollX, state, addNode]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
    const canvas = canvasRef.current;
    const receptorFrame = canvas ? getReceptorFrame(canvas, receptors[0]) : null;
    const isInReceptorArea = receptorFrame
      ? y >= receptorFrame.y && y <= receptorFrame.y + receptorFrame.height
      : false;
    
    if (isInReceptorArea && receptors.length > 0) {
      // 感受器区域内进行横向滚动
      const scrollSpeed = 20;
      const deltaX = e.deltaY > 0 ? scrollSpeed : -scrollSpeed;
      
      // 计算内容宽度
      const visionModality = receptors[0].modalities.find(m => m.type === 'vision');
      if (visionModality && receptorFrame) {
        const contentWidth = getVisionContentWidth(visionModality.inputs);
        const maxScrollX = Math.max(0, contentWidth - receptorFrame.width);
        
        state.setReceptorScrollX(prev => Math.max(0, Math.min(maxScrollX, prev + deltaX)));
      }
    } else {
      // 其他区域进行缩放
      const zoomIntensity = 0.1;
      const wheel = e.deltaY < 0 ? 1 : -1;
      const zoom = Math.exp(wheel * zoomIntensity);
      
      const newScale = Math.max(0.5, Math.min(3.0, canvasScale * zoom));
      
      const factor = newScale / canvasScale - 1;
      setCanvasOffset(prev => ({
        x: prev.x - (x / canvasScale - prev.x) * factor,
        y: prev.y - (y / canvasScale - prev.y) * factor
      }));
      
      setCanvasScale(newScale);
    }
  }, [canvasRef, canvasScale, receptors, state, setCanvasOffset, setCanvasScale]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();

      if (selectedNodes.length > 0) {
        removeNodes(selectedNodes);
        clearSelection();
      } else if (selectedSynapse) {
        removeSynapse(selectedSynapse);
        clearSelection();
      }
    } else if (e.key === 'c' || e.key === 'C') {
      if (selectedNode) {
        const node = nodes.find(n => n.id === selectedNode);
        if (node) {
          const center = getNodeCenter(node, canvasOffset, canvasScale);
          setConnecting({ from: selectedNode, fromType: 'node', mouseX: center.x, mouseY: center.y });
        }
      }
    }
  }, [selectedNode, selectedNodes, selectedSynapse, nodes, canvasOffset, canvasScale, removeNodes, removeSynapse, clearSelection, setConnecting]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    stopInteraction,
    handleDoubleClick,
    handleWheel,
    handleContextMenu,
    handleKeyDown
  };
}; 
