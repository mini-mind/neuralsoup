/**
 * 连接渲染器 - 绘制连接线和选择框
 */

import { SNNNode, Receptor, Effector } from '../../types/simulation';

interface ConnectionContext {
  nodes: SNNNode[];
  receptors: Receptor[];
  effectors: Effector[];
  receptorX: number;
  receptorY: number;
  effectorX: number;
  effectorY: number;
  canvasOffset: { x: number; y: number };
  canvasScale: number;
}

export class ConnectionRenderer {
  /**
   * 绘制正在连接的线
   */
  static drawConnectingLine(
    ctx: CanvasRenderingContext2D, 
    connecting: {
      from: string;
      fromType: 'node' | 'receptor' | 'effector';
      mouseX: number;
      mouseY: number;
    },
    context: ConnectionContext
  ): void {
    const { fromX, fromY } = this.getConnectionStartPoint(connecting, context);
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(connecting.mouseX, connecting.mouseY);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * 绘制选择框
   */
  static drawSelectionBox(
    ctx: CanvasRenderingContext2D, 
    isSelecting: {
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    }
  ): void {
    const width = isSelecting.currentX - isSelecting.startX;
    const height = isSelecting.currentY - isSelecting.startY;
    
    ctx.strokeStyle = '#a855f7';
    ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    ctx.fillRect(isSelecting.startX, isSelecting.startY, width, height);
    ctx.strokeRect(isSelecting.startX, isSelecting.startY, width, height);
    
    ctx.setLineDash([]);
  }

  /**
   * 获取连接起始点坐标
   */
  private static getConnectionStartPoint(
    connecting: {
      from: string;
      fromType: 'node' | 'receptor' | 'effector';
      mouseX: number;
      mouseY: number;
    },
    context: ConnectionContext
  ): { fromX: number; fromY: number } {
    let fromX = 0, fromY = 0;

    if (connecting.fromType === 'node') {
      const fromNode = context.nodes.find(n => n.id === connecting.from);
      if (fromNode) {
        fromX = (fromNode.x + context.canvasOffset.x) * context.canvasScale;
        fromY = (fromNode.y + context.canvasOffset.y) * context.canvasScale;
      }
    } else if (connecting.fromType === 'receptor') {
      const fromReceptor = context.receptors.find(r => r.id === connecting.from);
      if (fromReceptor) {
        const receptorIndex = context.receptors.indexOf(fromReceptor);
        const receptorSpacing = context.receptorX / Math.max(1, context.receptors.length);
        fromX = context.receptorX + receptorIndex * receptorSpacing + receptorSpacing / 2;
        fromY = context.receptorY + 30;
      }
    } else if (connecting.fromType === 'effector') {
      const fromEffector = context.effectors.find(e => e.id === connecting.from);
      if (fromEffector) {
        const effectorIndex = context.effectors.indexOf(fromEffector);
        const effectorSpacing = context.effectorX / Math.max(1, context.effectors.length);
        fromX = context.effectorX + effectorIndex * effectorSpacing + effectorSpacing / 2;
        fromY = context.effectorY;
      }
    }

    return { fromX, fromY };
  }
} 