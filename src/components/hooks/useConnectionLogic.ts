import { useCallback } from 'react';
import { SNNSynapse } from '../../types/simulation';
import { CanvasEventHandler } from '../CanvasEventHandler';

interface UseConnectionLogicProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  nodes: any[];
  receptors: any[];
  effectors: any[];
  canvasOffset: { x: number; y: number };
  canvasScale: number;
  connecting: any;
  setConnecting: (connecting: any) => void;
  setHoveredNode: (nodeId: string | null) => void;
  addSynapse: (synapse: SNNSynapse) => void;
}

export const useConnectionLogic = ({
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
}: UseConnectionLogicProps) => {
  
  // 检查是否可以连接到目标
  const canConnectTo = useCallback((element: any) => {
    if (!element || !connecting) return false;
    
    if (connecting.fromType === 'receptor') {
      return element.type === 'neuron' || element.type === 'effector';
    } else if (connecting.fromType === 'node') {
      return element.type === 'neuron' || element.type === 'effector';
    } else if (connecting.fromType === 'effector') {
      return element.type === 'neuron';
    }
    return false;
  }, [connecting]);

  // 处理连接过程中的鼠标移动
  const handleConnectionMove = useCallback((x: number, y: number) => {
    if (!connecting) return;

    // 更新连接线的鼠标位置
    setConnecting((prev: any) => prev ? { ...prev, mouseX: x, mouseY: y } : null);
    
    // 检测hover的节点
    const hoveredElement = CanvasEventHandler.detectClickedElement(x, y, {
      canvasRef,
      nodes,
      receptors,
      effectors,
      canvasOffset,
      canvasScale
    });
    
    // 设置hover状态
    if (hoveredElement && hoveredElement.type === 'neuron' && canConnectTo(hoveredElement)) {
      setHoveredNode(hoveredElement.element.id);
    } else {
      setHoveredNode(null);
    }
  }, [connecting, canvasRef, nodes, receptors, effectors, canvasOffset, canvasScale, setConnecting, setHoveredNode, canConnectTo]);

  // 开始连接
  const startConnection = useCallback((element: any, elementType: string, x: number, y: number) => {
    setConnecting({ 
      from: element.id, 
      fromType: elementType, 
      mouseX: x, 
      mouseY: y 
    });
  }, [setConnecting]);

  // 完成连接
  const finishConnection = useCallback((x: number, y: number) => {
    if (!connecting) return;

    const clicked = CanvasEventHandler.detectClickedElement(x, y, {
      canvasRef,
      nodes,
      receptors,
      effectors,
      canvasOffset,
      canvasScale
    });

    if (clicked && canConnectTo(clicked)) {
      const newSynapse: SNNSynapse = {
        id: `synapse-${Date.now()}`,
        from: connecting.from,
        to: clicked.element.id,
        weight: Math.random() * 2 - 1,
        delay: Math.random() * 5 + 1
      };
      addSynapse(newSynapse);
    }
    
    setConnecting(null);
    setHoveredNode(null);
  }, [connecting, canvasRef, nodes, receptors, effectors, canvasOffset, canvasScale, canConnectTo, addSynapse, setConnecting, setHoveredNode]);

  // 取消连接
  const cancelConnection = useCallback(() => {
    setConnecting(null);
    setHoveredNode(null);
  }, [setConnecting, setHoveredNode]);

  return {
    canConnectTo,
    handleConnectionMove,
    startConnection,
    finishConnection,
    cancelConnection
  };
}; 