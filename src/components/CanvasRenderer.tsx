import React from 'react';
import { SNNNode, SNNSynapse, Receptor, Effector, ReceptorModality } from '../types/simulation';
import { ReceptorRenderer } from './renderers/ReceptorRenderer';
import { EffectorRenderer } from './renderers/EffectorRenderer';
import { NeuronRenderer } from './renderers/NeuronRenderer';
import { drawArrow, drawSelfConnection, getWeightColor } from './utils/renderUtils';

interface CanvasRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  nodes: SNNNode[];
  synapses: SNNSynapse[];
  receptors: Receptor[];
  effectors: Effector[];
  selectedNode: string | null;
  selectedSynapse: string | null;
  connecting: {
    from: string;
    fromType: 'node' | 'receptor' | 'effector';
    mouseX: number;
    mouseY: number;
  } | null;
  canvasOffset: { x: number; y: number };
  canvasScale: number;
  isSelecting: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null;
  selectedNodes: string[];
  hoveredNode: string | null;
  receptorScrollX: number;
}

/**
 * 绘制画布内容的工具类
 */
export class CanvasRenderer {
  static draw({
    canvasRef,
    nodes,
    synapses,
    receptors,
    effectors,
    selectedNode,
    selectedSynapse,
    connecting,
    canvasOffset,
    canvasScale,
    isSelecting,
    selectedNodes,
    hoveredNode,
    receptorScrollX
  }: CanvasRendererProps) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布并设置深色背景
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 计算固定位置 - 使用百分比布局确保在可视区域内
    const receptorX = 10; // 稍微增加边距
    const receptorY = 10; // 稍微增加边距
    const receptorWidth = canvas.width - 20; // 减少宽度
    const effectorX = 10; // 稍微增加边距
    const effectorY = canvas.height - 100; // 留更多底部空间，避免被边框遮挡
    const effectorWidth = canvas.width - 20; // 减少宽度

    // 绘制感受器
    ReceptorRenderer.draw(ctx, receptors, receptorX, receptorY, receptorWidth, receptorScrollX);

    // 绘制效应器
    EffectorRenderer.draw(ctx, effectors, effectorX, effectorY, effectorWidth);

    // 绘制突触连接
    this.drawSynapses(ctx, synapses, nodes, receptors, effectors, receptorX, receptorY, effectorX, effectorY, canvasOffset, canvasScale, selectedSynapse, effectorWidth);

    // 绘制神经元
    NeuronRenderer.draw(ctx, nodes, canvasOffset, canvasScale, selectedNode, selectedNodes, hoveredNode);

    // 绘制正在连接的线
    if (connecting) {
      this.drawConnectingLine(ctx, connecting, nodes, receptors, effectors, receptorX, receptorY, effectorX, effectorY, canvasOffset, canvasScale);
    }

    // 绘制框选
    if (isSelecting) {
      this.drawSelectionBox(ctx, isSelecting);
    }

    // 添加网格背景（可选）
    this.drawGrid(ctx, canvas.width, canvas.height, canvasOffset, canvasScale);
  }

  private static drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, canvasOffset: { x: number; y: number }, canvasScale: number) {
    const gridSize = 50 * canvasScale; // 网格大小随缩放变化
    const offsetX = (canvasOffset.x * canvasScale) % gridSize;
    const offsetY = (canvasOffset.y * canvasScale) % gridSize;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    
    // 绘制垂直线
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // 绘制水平线
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private static drawSynapses(
    ctx: CanvasRenderingContext2D, 
    synapses: SNNSynapse[], 
    nodes: SNNNode[], 
    receptors: Receptor[], 
    effectors: Effector[],
    receptorX: number, 
    receptorY: number, 
    effectorX: number, 
    effectorY: number,
    canvasOffset: { x: number; y: number },
    canvasScale: number,
    selectedSynapse: string | null,
    effectorWidth: number
  ) {
    synapses.forEach(synapse => {
      const { fromX, fromY, toX, toY } = this.getSynapseEndpoints(
        synapse, nodes, receptors, effectors, receptorX, receptorY, effectorX, effectorY, canvasOffset, canvasScale, effectorWidth
      );

      // 检查是否是自连接（同一个节点）
      const isSelfConnection = synapse.from === synapse.to;
      
      if (isSelfConnection) {
        // 绘制自连接的曲线
        const centerX = fromX;
        const centerY = fromY;
        const loopSize = 40;
        
        ctx.beginPath();
        // 创建一个自连的曲线，从节点顶部出发绕一圈回到右侧
        ctx.moveTo(centerX, centerY - 20); // 从节点顶部开始
        
        // 使用贝塞尔曲线创建自连环
        const cp1X = centerX + loopSize; // 控制点1
        const cp1Y = centerY - loopSize;
        const cp2X = centerX + loopSize; // 控制点2  
        const cp2Y = centerY + loopSize;
        const endX = centerX + 20; // 终点在节点右侧
        const endY = centerY;
        
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
        
        const weight = Math.abs(synapse.weight);
        ctx.lineWidth = Math.max(2, weight * 5); // 使用粗细表示权重
        ctx.strokeStyle = selectedSynapse === synapse.id ? '#a855f7' : // 紫色选中
                         synapse.weight > 0 ? '#22c55e' : '#ef4444'; // 绿色正权重，红色负权重
        ctx.stroke();
        
        // 绘制箭头 - 指向节点右侧
        drawArrow(ctx, endX - 5, endY - 5, endX, endY);
      } else {
        // 绘制普通连接线
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        
        const weight = Math.abs(synapse.weight);
        ctx.lineWidth = Math.max(2, weight * 5); // 使用粗细表示权重，增加系数
        ctx.strokeStyle = selectedSynapse === synapse.id ? '#a855f7' : // 紫色选中
                         synapse.weight > 0 ? '#22c55e' : '#ef4444'; // 绿色正权重，红色负权重
        ctx.stroke();

        // 绘制箭头
        drawArrow(ctx, fromX, fromY, toX, toY);
      }
    });
  }



  private static drawConnectingLine(
    ctx: CanvasRenderingContext2D, 
    connecting: { from: string; fromType: 'node' | 'receptor' | 'effector'; mouseX: number; mouseY: number },
    nodes: SNNNode[], 
    receptors: Receptor[], 
    effectors: Effector[],
    receptorX: number, 
    receptorY: number, 
    effectorX: number,
    effectorY: number,
    canvasOffset: { x: number; y: number },
    canvasScale: number
  ) {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#a855f7'; // 紫色连接线
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    let fromX = 0, fromY = 0;
    if (connecting.fromType === 'node') {
      const fromNode = nodes.find(n => n.id === connecting.from);
      if (fromNode) {
        fromX = (fromNode.x + canvasOffset.x) * canvasScale + 25;
        fromY = (fromNode.y + canvasOffset.y) * canvasScale + 25;
      }
    } else if (connecting.fromType === 'receptor') {
      // 查找感受器输入点
      for (const receptor of receptors) {
        const activeModality = receptor.modalities.find(m => m.type === receptor.activeModality);
        if (activeModality) {
          const input = activeModality.inputs.find(i => i.id === connecting.from);
          if (input) {
            fromX = receptorX + input.x;
            fromY = receptorY + input.y;
            break;
          }
        }
      }
    } else if (connecting.fromType === 'effector') {
      // 查找效应器输出点
      for (const effector of effectors) {
        const output = effector.outputs.find(o => o.id === connecting.from);
        if (output) {
          fromX = effectorX + output.x;
          fromY = effectorY + output.y;
          break;
        }
      }
    }
    
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(connecting.mouseX, connecting.mouseY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

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
    effectorWidth: number
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
    
    // 查找效应器输出点
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
    let fromCenterX = 0, fromCenterY = 0, toCenterX = 0, toCenterY = 0;

    // 确定起点中心
    if (fromNode) {
      fromCenterX = (fromNode.x + canvasOffset.x) * canvasScale + 25;
      fromCenterY = (fromNode.y + canvasOffset.y) * canvasScale + 25;
    } else if (fromReceptor && fromInput) {
      fromCenterX = receptorX + fromInput.x;
      fromCenterY = receptorY + fromInput.y;
    } else if (fromEffector && fromOutput) {
      fromCenterX = effectorX + fromOutput.x;
      fromCenterY = effectorY + fromOutput.y;
    }

    // 确定终点中心
    if (toNode) {
      toCenterX = (toNode.x + canvasOffset.x) * canvasScale + 25;
      toCenterY = (toNode.y + canvasOffset.y) * canvasScale + 25;
    } else if (toEffector) {
      const output = toEffector.outputs.find(o => o.id === synapse.to);
      if (output) {
        toCenterX = effectorX + output.x;
        toCenterY = effectorY + output.y;
      }
    }

    // 计算边缘位置
    if (fromNode && toNode) {
      // 神经元到神经元 - 计算边缘接触点
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const nodeRadius = 20; // 神经元半径
        fromX = fromCenterX + (dx / distance) * nodeRadius;
        fromY = fromCenterY + (dy / distance) * nodeRadius;
        toX = toCenterX - (dx / distance) * nodeRadius;
        toY = toCenterY - (dy / distance) * nodeRadius;
      } else {
        // 自连接情况
        fromX = fromCenterX;
        fromY = fromCenterY;
        toX = toCenterX;
        toY = toCenterY;
      }
    } else if (fromReceptor && fromInput && toNode) {
      // 感受器到神经元 - 从感受器输入点边缘到神经元边缘
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const inputRadius = 6; // 输入点半径
        const nodeRadius = 20; // 神经元半径
        fromX = fromCenterX + (dx / distance) * inputRadius;
        fromY = fromCenterY + (dy / distance) * inputRadius;
        toX = toCenterX - (dx / distance) * nodeRadius;
        toY = toCenterY - (dy / distance) * nodeRadius;
      } else {
        fromX = fromCenterX;
        fromY = fromCenterY;
        toX = toCenterX;
        toY = toCenterY;
      }
    } else if (fromNode && toEffector) {
      // 神经元到效应器 - 从神经元边缘到效应器输出点边缘
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const nodeRadius = 20; // 神经元半径
        const outputRadius = 12; // 输出点半径
        fromX = fromCenterX + (dx / distance) * nodeRadius;
        fromY = fromCenterY + (dy / distance) * nodeRadius;
        toX = toCenterX - (dx / distance) * outputRadius;
        toY = toCenterY - (dy / distance) * outputRadius;
      } else {
        fromX = fromCenterX;
        fromY = fromCenterY;
        toX = toCenterX;
        toY = toCenterY;
      }
    } else if (fromEffector && fromOutput && toNode) {
      // 效应器到神经元 - 从效应器输出点边缘到神经元边缘
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const outputRadius = 12; // 输出点半径
        const nodeRadius = 20; // 神经元半径
        fromX = fromCenterX + (dx / distance) * outputRadius;
        fromY = fromCenterY + (dy / distance) * outputRadius;
        toX = toCenterX - (dx / distance) * nodeRadius;
        toY = toCenterY - (dy / distance) * nodeRadius;
      } else {
        fromX = fromCenterX;
        fromY = fromCenterY;
        toX = toCenterX;
        toY = toCenterY;
      }
    } else {
      // 其他情况使用中心点
      fromX = fromCenterX;
      fromY = fromCenterY;
      toX = toCenterX;
      toY = toCenterY;
    }

    return { fromX, fromY, toX, toY };
  }



  private static drawSelectionBox(ctx: CanvasRenderingContext2D, isSelecting: { startX: number; startY: number; currentX: number; currentY: number }) {
    const { startX, startY, currentX, currentY } = isSelecting;
    const minX = Math.min(startX, currentX);
    const minY = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    ctx.strokeRect(minX, minY, width, height);
    
    ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
    ctx.fillRect(minX, minY, width, height);
    
    ctx.setLineDash([]);
  }
} 