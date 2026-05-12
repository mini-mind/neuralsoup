import { useCallback } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Effector, EffectorOutput, Receptor, ReceptorInput, SNNSynapse, SNNNode } from '../../types/simulation';
import { CanvasEventHandler } from '../CanvasEventHandler';

interface UseConnectionLogicProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  nodes: SNNNode[];
  receptors: Receptor[];
  effectors: Effector[];
  canvasOffset: { x: number; y: number };
  canvasScale: number;
  receptorScrollX: number;
  connecting: { from: string; fromType: 'node' | 'receptor' | 'effector'; mouseX: number; mouseY: number } | null;
  setConnecting: Dispatch<SetStateAction<{ from: string; fromType: 'node' | 'receptor' | 'effector'; mouseX: number; mouseY: number } | null>>;
  setHoveredNode: (nodeId: string | null) => void;
  addSynapse: (synapse: SNNSynapse) => void;
}

const DEFAULT_SYNAPSE_WEIGHT = 0.8;
const DEFAULT_SYNAPSE_DELAY = 1;

export const useConnectionLogic = ({
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
}: UseConnectionLogicProps) => {
  type ConnectableElement = {
    type: 'neuron' | 'receptor' | 'effector';
    element: SNNNode | ReceptorInput | EffectorOutput;
  };

  const isConnectableElement = (
    element: ReturnType<typeof CanvasEventHandler.detectClickedElement>
  ): element is ConnectableElement => {
    if (!element) {
      return false;
    }

    return element.type === 'neuron' || element.type === 'receptor' || element.type === 'effector';
  };
  
  // 检查是否可以连接到目标
  const canConnectTo = useCallback((element: ConnectableElement) => {
    if (!element || !connecting) return false;
    
    if (connecting.fromType === 'receptor') {
      return element.type === 'neuron';
    } else if (connecting.fromType === 'node') {
      return element.type === 'neuron' || element.type === 'effector';
    }
    return false;
  }, [connecting]);

  // 处理连接过程中的鼠标移动
  const handleConnectionMove = useCallback((x: number, y: number) => {
    if (!connecting) return;

    // 更新连接线的鼠标位置
    setConnecting((prev) => prev ? { ...prev, mouseX: x, mouseY: y } : null);
    
    // 检测hover的节点
    const hoveredElement = CanvasEventHandler.detectClickedElement(x, y, {
      canvasRef,
      nodes,
      receptors,
      effectors,
      canvasOffset,
      canvasScale,
      receptorScrollX
    });
    
    // 设置hover状态
    if (hoveredElement && hoveredElement.type === 'neuron' && isConnectableElement(hoveredElement) && canConnectTo(hoveredElement)) {
      setHoveredNode(hoveredElement.element.id);
    } else {
      setHoveredNode(null);
    }
  }, [connecting, canvasRef, nodes, receptors, effectors, canvasOffset, canvasScale, receptorScrollX, setConnecting, setHoveredNode, canConnectTo]);

  // 开始连接
  const startConnection = useCallback((element: SNNNode | ReceptorInput | EffectorOutput, elementType: 'node' | 'receptor' | 'effector', x: number, y: number) => {
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
      canvasScale,
      receptorScrollX
    });

    if (clicked && isConnectableElement(clicked) && canConnectTo(clicked)) {
      const newSynapse: SNNSynapse = {
        id: `synapse-${Date.now()}`,
        from: connecting.from,
        to: clicked.element.id,
        weight: DEFAULT_SYNAPSE_WEIGHT,
        delay: DEFAULT_SYNAPSE_DELAY
      };
      addSynapse(newSynapse);
    }
    
    setConnecting(null);
    setHoveredNode(null);
  }, [connecting, canvasRef, nodes, receptors, effectors, canvasOffset, canvasScale, receptorScrollX, canConnectTo, addSynapse, setConnecting, setHoveredNode]);

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
