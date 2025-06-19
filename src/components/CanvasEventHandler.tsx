import { SNNNode, SNNSynapse, Receptor, Effector } from '../types/simulation';

interface CanvasEventHandlerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  nodes: SNNNode[];
  receptors: Receptor[];
  effectors: Effector[];
  canvasOffset: { x: number; y: number };
  canvasScale?: number;
}

interface ClickedElement {
  type: 'neuron' | 'synapse' | 'receptor' | 'receptor-tab' | 'receptor-area' | 'effector';
  element: any;
  modalityIndex?: number;
}

/**
 * 画布事件处理工具类
 */
export class CanvasEventHandler {
  /**
   * 获取鼠标位置
   */
  static getMousePos(e: React.MouseEvent<HTMLCanvasElement>, canvasRef: React.RefObject<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * 检测点击的元素
   */
  static detectClickedElement(
    x: number, 
    y: number, 
    { canvasRef, nodes, receptors, effectors, canvasOffset, canvasScale = 1.0 }: CanvasEventHandlerProps
  ): ClickedElement | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // 检测感受器 - 占满宽度的布局
    const receptorX = 20;
    const receptorY = 20;
    const receptorWidth = canvas.width - 40;
    
    for (const receptor of receptors) {
      if (x >= receptorX && x <= receptorX + receptorWidth &&
          y >= receptorY && y <= receptorY + receptor.height) {
        
        // 检测模态标签点击
        const tabHeight = 30;
        const tabWidth = receptorWidth / receptor.modalities.length;
        
        if (y >= receptorY && y <= receptorY + tabHeight) {
          const tabIndex = Math.floor((x - receptorX) / tabWidth);
          if (tabIndex >= 0 && tabIndex < receptor.modalities.length) {
            return {
              type: 'receptor-tab' as const,
              element: receptor,
              modalityIndex: tabIndex
            };
          }
        }
        
        // 检测输入点击（仅在激活的模态中）
        const activeModality = receptor.modalities.find(m => m.type === receptor.activeModality);
        if (activeModality && activeModality.isExpanded) {
          for (const input of activeModality.inputs) {
            const inputX = receptorX + input.x;
            const inputY = receptorY + tabHeight + input.y;
            const distance = Math.sqrt((x - inputX) ** 2 + (y - inputY) ** 2);
            
            if (distance <= 5) { // 5像素半径
              return {
                type: 'receptor' as const,
                element: input
              };
            }
          }
        }
        
        return {
          type: 'receptor-area' as const,
          element: receptor
        };
      }
    }

    // 检测效应器 - 占满宽度的布局
    const effectorX = 20;
    const effectorY = canvas.height - 120;
    const effectorWidth = canvas.width - 40;
    
    for (const effector of effectors) {
      for (let index = 0; index < effector.outputs.length; index++) {
        const output = effector.outputs[index];
        const spacing = effectorWidth / (effector.outputs.length + 1);
        const outputX = effectorX + spacing * (index + 1);
        const outputY = effectorY + output.y;
        const distance = Math.sqrt((x - outputX) ** 2 + (y - outputY) ** 2);
        
        if (distance <= 10) { // 10像素半径
          return {
            type: 'effector' as const,
            element: output
          };
        }
      }
    }

    // 检测神经元 - 应用缩放
    for (const node of nodes) {
      if (node.type === 'neuron') {
        const nodeX = (node.x + canvasOffset.x) * canvasScale;
        const nodeY = (node.y + canvasOffset.y) * canvasScale;
        const distance = Math.sqrt((x - nodeX - 25) ** 2 + (y - nodeY - 25) ** 2);
        
        if (distance <= 25) { // 25像素半径
          return {
            type: 'neuron' as const,
            element: node
          };
        }
      }
    }

    return null;
  }

  /**
   * 检测点击的突触
   */
  static detectClickedSynapse(
    x: number, 
    y: number, 
    synapses: SNNSynapse[],
    { canvasRef, nodes, receptors, effectors, canvasOffset, canvasScale = 1.0 }: CanvasEventHandlerProps
  ): SNNSynapse | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const receptorX = 20;
    const receptorY = 20;
    const receptorWidth = canvas.width - 40;
    const effectorX = 20;
    const effectorY = canvas.height - 120;
    const effectorWidth = canvas.width - 40;

    for (const synapse of synapses) {
      const { fromX, fromY, toX, toY } = this.getSynapseEndpoints(
        synapse, nodes, receptors, effectors, receptorX, receptorY, effectorX, effectorY, canvasOffset, canvasScale, effectorWidth
      );
      
      const distance = this.distanceToLine(x, y, fromX, fromY, toX, toY);
      if (distance <= 5) { // 5像素容差
        return synapse;
      }
    }

    return null;
  }

  /**
   * 计算点到线段的距离
   */
  private static distanceToLine(
    px: number, py: number, 
    x1: number, y1: number, 
    x2: number, y2: number
  ): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    let param = dot / lenSq;
    
    if (param < 0) {
      return Math.sqrt(A * A + B * B);
    } else if (param > 1) {
      const E = px - x2;
      const F = py - y2;
      return Math.sqrt(E * E + F * F);
    } else {
      const closestX = x1 + param * C;
      const closestY = y1 + param * D;
      const dx = px - closestX;
      const dy = py - closestY;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }

  /**
   * 获取突触连接的端点位置
   */
  private static getSynapseEndpoints(
    synapse: SNNSynapse, 
    nodes: SNNNode[], 
    receptors: Receptor[], 
    effectors: Effector[],
    receptorX: number, 
    receptorY: number, 
    effectorX: number, 
    effectorY: number,
    canvasOffset: { x: number; y: number },
    canvasScale: number,
    effectorWidth?: number
  ) {
    const fromNode = nodes.find(n => n.id === synapse.from);
    let fromReceptor = null;
    let fromInput = null;
    
    // 查找感受器输入点
    for (const receptor of receptors) {
      const activeModality = receptor.modalities.find(m => m.type === receptor.activeModality);
      if (activeModality) {
        const input = activeModality.inputs.find(i => i.id === synapse.from);
        if (input) {
          fromReceptor = receptor;
          fromInput = input;
          break;
        }
      }
    }
    
    const toNode = nodes.find(n => n.id === synapse.to);
    const toEffector = effectors.find(e => 
      e.outputs.some(output => output.id === synapse.to)
    );

    let fromX = 0, fromY = 0, toX = 0, toY = 0;

    // 确定起点
    if (fromNode) {
      fromX = (fromNode.x + canvasOffset.x) * canvasScale + 25;
      fromY = (fromNode.y + canvasOffset.y) * canvasScale + 25;
    } else if (fromReceptor && fromInput) {
      fromX = receptorX + fromInput.x;
      fromY = receptorY + 30 + fromInput.y; // 30为标签高度
    }

    // 确定终点
    if (toNode) {
      toX = (toNode.x + canvasOffset.x) * canvasScale + 25;
      toY = (toNode.y + canvasOffset.y) * canvasScale + 25;
    } else if (toEffector) {
      const outputIndex = toEffector.outputs.findIndex(o => o.id === synapse.to);
      if (outputIndex !== -1) {
        const output = toEffector.outputs[outputIndex];
        const spacing = (effectorWidth || 760) / (toEffector.outputs.length + 1); // 使用传入的宽度或默认值
        toX = effectorX + spacing * (outputIndex + 1);
        toY = effectorY + output.y;
      }
    }

    return { fromX, fromY, toX, toY };
  }
} 