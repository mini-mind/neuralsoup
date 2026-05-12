import { SNNNode, SNNSynapse, Receptor, Effector } from '../types/simulation';
import {
  EDITOR_LAYOUT,
  getEffectorFrame,
  getEffectorOutputPosition,
  getNodeCenter,
  getReceptorFrame,
  getReceptorInputPosition
} from './utils/editorGeometry';

interface CanvasEventHandlerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  nodes: SNNNode[];
  receptors: Receptor[];
  effectors: Effector[];
  canvasOffset: { x: number; y: number };
  canvasScale?: number;
  receptorScrollX?: number;
}

interface ClickedElement {
  type: 'neuron' | 'receptor' | 'receptor-area' | 'effector';
  element: any;
}

/**
 * 画布事件处理工具类
 */
export class CanvasEventHandler {
  private static readonly SELF_SYNAPSE_LOOP_SIZE = 40;

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
    { canvasRef, nodes, receptors, effectors, canvasOffset, canvasScale = 1.0, receptorScrollX = 0 }: CanvasEventHandlerProps
  ): ClickedElement | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const receptorFrame = getReceptorFrame(canvas, receptors[0]);
    
    for (const receptor of receptors) {
      if (
        x >= receptorFrame.x &&
        x <= receptorFrame.x + receptorFrame.width &&
        y >= receptorFrame.y &&
        y <= receptorFrame.y + receptor.height
      ) {
        // 检测输入点击（仅在激活的模态中）
        const activeModality = receptor.modalities.find(m => m.type === receptor.activeModality);
        if (activeModality && activeModality.isExpanded) {
          for (const input of activeModality.inputs) {
            const position = getReceptorInputPosition(receptorFrame, input, receptorScrollX);
            const distance = Math.sqrt((x - position.x) ** 2 + (y - position.y) ** 2);
            
            if (distance <= EDITOR_LAYOUT.receptorInputRadius) {
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

    const effectorFrame = getEffectorFrame(canvas, effectors[0]);
    
    for (const effector of effectors) {
      for (const output of effector.outputs) {
        const position = getEffectorOutputPosition(effectorFrame, output);
        const distance = Math.sqrt((x - position.x) ** 2 + (y - position.y) ** 2);
        
        if (distance <= EDITOR_LAYOUT.effectorOutputRadius) {
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
        const center = getNodeCenter(node, canvasOffset, canvasScale);
        const distance = Math.sqrt((x - center.x) ** 2 + (y - center.y) ** 2);
        
        if (distance <= EDITOR_LAYOUT.nodeRadius) {
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
    { canvasRef, nodes, receptors, effectors, canvasOffset, canvasScale = 1.0, receptorScrollX = 0 }: CanvasEventHandlerProps
  ): SNNSynapse | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const receptorFrame = getReceptorFrame(canvas, receptors[0]);
    const effectorFrame = getEffectorFrame(canvas, effectors[0]);

    for (const synapse of synapses) {
      if (synapse.from === synapse.to) {
        const selfLoopDistance = this.distanceToSelfLoop(x, y, synapse, nodes, canvasOffset, canvasScale);
        if (selfLoopDistance <= 8) {
          return synapse;
        }
        continue;
      }

      const { fromX, fromY, toX, toY } = this.getSynapseEndpoints(
        synapse, nodes, receptors, effectors, receptorFrame, effectorFrame, canvasOffset, canvasScale, receptorScrollX
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

  private static distanceToSelfLoop(
    px: number,
    py: number,
    synapse: SNNSynapse,
    nodes: SNNNode[],
    canvasOffset: { x: number; y: number },
    canvasScale: number
  ): number {
    const node = nodes.find(candidate => candidate.id === synapse.from);
    if (!node) {
      return Infinity;
    }

    const center = getNodeCenter(node, canvasOffset, canvasScale);
    const loopPoints = [
      { x: center.x, y: center.y - 20 },
      { x: center.x + CanvasEventHandler.SELF_SYNAPSE_LOOP_SIZE, y: center.y - CanvasEventHandler.SELF_SYNAPSE_LOOP_SIZE },
      { x: center.x + CanvasEventHandler.SELF_SYNAPSE_LOOP_SIZE, y: center.y + CanvasEventHandler.SELF_SYNAPSE_LOOP_SIZE },
      { x: center.x + 20, y: center.y }
    ];

    let minDistance = Infinity;
    for (let i = 0; i < loopPoints.length - 1; i++) {
      const start = loopPoints[i];
      const end = loopPoints[i + 1];
      minDistance = Math.min(
        minDistance,
        this.distanceToLine(px, py, start.x, start.y, end.x, end.y)
      );
    }

    return minDistance;
  }

  /**
   * 获取突触连接的端点位置
   */
  private static getSynapseEndpoints(
    synapse: SNNSynapse, 
    nodes: SNNNode[], 
    receptors: Receptor[], 
    effectors: Effector[],
    receptorFrame: { x: number; y: number; width: number; height: number },
    effectorFrame: { x: number; y: number; width: number; height: number },
    canvasOffset: { x: number; y: number },
    canvasScale: number,
    receptorScrollX: number
  ) {
    const fromNode = nodes.find(n => n.id === synapse.from);
    let fromReceptor = null;
    let fromInput = null;
    let fromEffector = null;
    let fromOutput = null;
    
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

    if (!fromReceptor && !fromInput) {
      for (const effector of effectors) {
        const output = effector.outputs.find(o => o.id === synapse.from);
        if (output) {
          fromEffector = effector;
          fromOutput = output;
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
      const center = getNodeCenter(fromNode, canvasOffset, canvasScale);
      fromX = center.x;
      fromY = center.y;
    } else if (fromReceptor && fromInput) {
      const position = getReceptorInputPosition(receptorFrame, fromInput, receptorScrollX);
      fromX = position.x;
      fromY = position.y;
    } else if (fromEffector && fromOutput) {
      const position = getEffectorOutputPosition(effectorFrame, fromOutput);
      fromX = position.x;
      fromY = position.y;
    }

    // 确定终点
    if (toNode) {
      const center = getNodeCenter(toNode, canvasOffset, canvasScale);
      toX = center.x;
      toY = center.y;
    } else if (toEffector) {
      const outputIndex = toEffector.outputs.findIndex(o => o.id === synapse.to);
      if (outputIndex !== -1) {
        const output = toEffector.outputs[outputIndex];
        const position = getEffectorOutputPosition(effectorFrame, output);
        toX = position.x;
        toY = position.y;
      }
    }

    return { fromX, fromY, toX, toY };
  }
} 
