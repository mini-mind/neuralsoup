import { useCallback } from 'react';
import { SNNNode, SNNSynapse } from '../../types/simulation';
import { CanvasEventHandler } from '../CanvasEventHandler';
import { useSNNTopologyState } from './useSNNTopologyState';
import { useConnectionLogic } from './useConnectionLogic';

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
    selectedNodes,
    connecting,
    isSelecting,
    isDraggingCanvas,
    dragging,
    canvasOffset,
    canvasScale,
    setNodes,
    setSynapses,
    setReceptors,
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
    connecting,
    setConnecting,
    setHoveredNode,
    addSynapse
  });

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
    const clicked = CanvasEventHandler.detectClickedElement(x, y, {
      canvasRef,
      nodes,
      receptors,
      effectors,
      canvasOffset,
      canvasScale
    });

    if (e.button === 2) { // 右键
      e.preventDefault();
      // 右键仅用于画布拖拽
      setIsDraggingCanvas({ startX: x, startY: y });
    } else if (e.button === 0) { // 左键
      if (e.ctrlKey && clicked) {
        // Ctrl+左键开始连接模式
        if (clicked.type === 'neuron') {
          connectionLogic.startConnection(clicked.element, 'node', x, y);
        } else if (clicked.type === 'receptor') {
          connectionLogic.startConnection(clicked.element, 'receptor', x, y);
        } else if (clicked.type === 'effector') {
          connectionLogic.startConnection(clicked.element, 'effector', x, y);
        }
      }
      if (clicked) {
        if (clicked.type === 'receptor-tab' && clicked.modalityIndex !== undefined) {
          const modality = clicked.element.modalities[clicked.modalityIndex];
          setReceptors(prevReceptors => 
            prevReceptors.map(receptor => 
              receptor.id === clicked.element.id 
                ? {
                    ...receptor,
                    activeModality: modality.type,
                    modalities: receptor.modalities.map((m, i) => ({
                      ...m,
                      isExpanded: i === clicked.modalityIndex
                    }))
                  }
                : receptor
            )
          );
        } else if (clicked.type === 'neuron') {
          if (e.ctrlKey) {
            setSelectedNodes(prev => 
              prev.includes(clicked.element.id) 
                ? prev.filter(id => id !== clicked.element.id)
                : [...prev, clicked.element.id]
            );
          } else {
            setSelectedNode(clicked.element.id);
            setSelectedNodes([clicked.element.id]);
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
          canvasScale
        });
        
        if (clickedSynapse) {
          setSelectedSynapse(clickedSynapse.id);
        } else {
          clearSelection();
          setIsSelecting({ startX: x, startY: y, currentX: x, currentY: y });
        }
      }
    }
  }, [canvasRef, nodes, synapses, receptors, effectors, canvasOffset, canvasScale, setReceptors, setSelectedNode, setSelectedNodes, setDragging, setConnecting, setSelectedSynapse, setIsDraggingCanvas, setIsSelecting, clearSelection]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
    
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
  }, [canvasRef, connecting, connectionLogic, isSelecting, isDraggingCanvas, dragging, selectedNodes, nodes, canvasOffset, canvasScale, setIsSelecting, setCanvasOffset, setIsDraggingCanvas, setNodes]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (connecting) {
      const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
      connectionLogic.finishConnection(x, y);
    }
    
    if (isSelecting) {
      const { startX, startY, currentX, currentY } = isSelecting;
      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);
      
      const selectedInBox = nodes
        .filter(node => node.type === 'neuron')
        .filter(node => {
          const nodeX = (node.x + canvasOffset.x) * canvasScale + 25;
          const nodeY = (node.y + canvasOffset.y) * canvasScale + 25;
          return nodeX >= minX && nodeX <= maxX && nodeY >= minY && nodeY <= maxY;
        })
        .map(node => node.id);
      
      setSelectedNodes(selectedInBox);
      setIsSelecting(null);
    }
    
    setDragging(null);
    setIsDraggingCanvas(null);
  }, [canvasRef, connecting, connectionLogic, isSelecting, nodes, receptors, effectors, canvasOffset, canvasScale, setSelectedNodes, setIsSelecting, setDragging, setIsDraggingCanvas]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
    const clicked = CanvasEventHandler.detectClickedElement(x, y, {
      canvasRef,
      nodes,
      receptors,
      effectors,
      canvasOffset,
      canvasScale
    });

    if (clicked && clicked.type === 'neuron') {
      state.setShowDetailModal({ type: 'neuron', data: clicked.element });
    } else if (state.selectedSynapse) {
      const synapse = synapses.find(s => s.id === state.selectedSynapse);
      if (synapse) {
        state.setShowDetailModal({ type: 'synapse', data: synapse });
      }
    } else {
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
  }, [canvasRef, nodes, synapses, receptors, effectors, canvasOffset, canvasScale, state, addNode]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const { x, y } = CanvasEventHandler.getMousePos(e, canvasRef);
    
    // 检测是否在感受器区域内
    const receptorY = 10;
    const receptorHeight = 60;
    const isInReceptorArea = y >= receptorY && y <= receptorY + receptorHeight;
    
    if (isInReceptorArea && receptors.length > 0) {
      // 感受器区域内进行横向滚动
      const scrollSpeed = 20;
      const deltaX = e.deltaY > 0 ? scrollSpeed : -scrollSpeed;
      
      // 计算内容宽度
      const visionModality = receptors[0].modalities.find(m => m.type === 'vision');
      if (visionModality) {
        const visionCells = visionModality.inputs.length / 3; // RGB三个通道
        const contentWidth = 10 * 2 + visionCells * 16; // 起始位置 + 节点数量 * 间距
        const receptorWidth = canvasRef.current ? canvasRef.current.width - 20 : 400;
        const maxScrollX = Math.max(0, contentWidth - receptorWidth);
        
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
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNodes.length > 0) {
        removeNodes(selectedNodes);
        setSelectedNodes([]);
        setSelectedNode(null);
      } else if (selectedNode) {
        removeNodes([selectedNode]);
        setSelectedNode(null);
      } else if (state.selectedSynapse) {
        removeSynapse(state.selectedSynapse);
        state.setSelectedSynapse(null);
      }
    } else if (e.key === 'c' || e.key === 'C') {
      if (selectedNode) {
        const node = nodes.find(n => n.id === selectedNode);
        if (node) {
          const nodeX = (node.x + canvasOffset.x) * canvasScale + 25;
          const nodeY = (node.y + canvasOffset.y) * canvasScale + 25;
          setConnecting({ from: selectedNode, fromType: 'node', mouseX: nodeX, mouseY: nodeY });
        }
      }
    }
  }, [selectedNode, selectedNodes, nodes, canvasOffset, canvasScale, state, removeNodes, removeSynapse, setSelectedNodes, setSelectedNode, setConnecting]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    handleWheel,
    handleContextMenu,
    handleKeyDown
  };
}; 