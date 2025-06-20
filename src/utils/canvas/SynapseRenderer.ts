/**
 * 突触渲染器 - 绘制神经网络突触连接
 */

import { SNNSynapse, SNNNode, Receptor, Effector } from '../../types/simulation';
import { drawArrow } from '../renderUtils';

interface SynapseRenderProps {
  synapses: SNNSynapse[];
  nodes: SNNNode[];
  receptors: Receptor[];
  effectors: Effector[];
  receptorX: number;
  receptorY: number;
  effectorX: number;
  effectorY: number;
  canvasOffset: { x: number; y: number };
  canvasScale: number;
  selectedSynapse: string | null;
  effectorWidth: number;
}

export class SynapseRenderer {
  /**
   * 绘制所有突触连接
   */
  static draw(ctx: CanvasRenderingContext2D, props: SynapseRenderProps): void {
    props.synapses.forEach(synapse => {
      const { fromX, fromY, toX, toY } = this.getSynapseEndpoints(synapse, props);

      // 检查是否是自连接
      const isSelfConnection = synapse.from === synapse.to;
      
      if (isSelfConnection) {
        this.drawSelfConnection(ctx, fromX, fromY, synapse, props.selectedSynapse);
      } else {
        this.drawNormalConnection(ctx, fromX, fromY, toX, toY, synapse, props.selectedSynapse);
      }
    });
  }

  /**
   * 绘制自连接
   */
  private static drawSelfConnection(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    synapse: SNNSynapse,
    selectedSynapse: string | null
  ): void {
    const loopSize = 40;
    
    ctx.beginPath();
    // 从节点顶部开始
    ctx.moveTo(centerX, centerY - 20);
    
    // 使用贝塞尔曲线创建自连环
    const cp1X = centerX + loopSize;
    const cp1Y = centerY - loopSize;
    const cp2X = centerX + loopSize;
    const cp2Y = centerY + loopSize;
    const endX = centerX + 20;
    const endY = centerY;
    
    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
    
    const weight = Math.abs(synapse.weight);
    ctx.lineWidth = Math.max(2, weight * 5);
    ctx.strokeStyle = selectedSynapse === synapse.id ? '#a855f7' :
                     synapse.weight > 0 ? '#22c55e' : '#ef4444';
    ctx.stroke();
    
    // 绘制箭头
    drawArrow(ctx, endX - 5, endY - 5, endX, endY);
  }

  /**
   * 绘制普通连接
   */
  private static drawNormalConnection(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    synapse: SNNSynapse,
    selectedSynapse: string | null
  ): void {
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    
    const weight = Math.abs(synapse.weight);
    ctx.lineWidth = Math.max(2, weight * 5);
    ctx.strokeStyle = selectedSynapse === synapse.id ? '#a855f7' :
                     synapse.weight > 0 ? '#22c55e' : '#ef4444';
    ctx.stroke();

    // 绘制箭头
    drawArrow(ctx, fromX, fromY, toX, toY);
  }

  /**
   * 获取突触连接的端点坐标
   */
  private static getSynapseEndpoints(synapse: SNNSynapse, props: SynapseRenderProps) {
    // 查找起始点
    let fromX = 0, fromY = 0;
    const fromNode = props.nodes.find(n => n.id === synapse.from);
    const fromReceptor = props.receptors.find(r => r.id === synapse.from);
    
    if (fromNode) {
      fromX = (fromNode.x + props.canvasOffset.x) * props.canvasScale;
      fromY = (fromNode.y + props.canvasOffset.y) * props.canvasScale;
    } else if (fromReceptor) {
      const receptorIndex = props.receptors.indexOf(fromReceptor);
      const receptorSpacing = props.receptorX / Math.max(1, props.receptors.length);
      fromX = props.receptorX + receptorIndex * receptorSpacing + receptorSpacing / 2;
      fromY = props.receptorY + 30;
    }

    // 查找终点
    let toX = 0, toY = 0;
    const toNode = props.nodes.find(n => n.id === synapse.to);
    const toEffector = props.effectors.find(e => e.id === synapse.to);
    
    if (toNode) {
      toX = (toNode.x + props.canvasOffset.x) * props.canvasScale;
      toY = (toNode.y + props.canvasOffset.y) * props.canvasScale;
    } else if (toEffector) {
      const effectorIndex = props.effectors.indexOf(toEffector);
      const effectorSpacing = props.effectorWidth / Math.max(1, props.effectors.length);
      toX = props.effectorX + effectorIndex * effectorSpacing + effectorSpacing / 2;
      toY = props.effectorY;
    }

    return { fromX, fromY, toX, toY };
  }
} 