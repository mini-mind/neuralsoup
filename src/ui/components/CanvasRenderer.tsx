import React from "react";
// 类型定义可以暂时保留或移至shared/interfaces
interface SNNNode {
  id: string;
  x: number;
  y: number;
  type: 'neuron' | 'receptor' | 'effector';
  [key: string]: any;
}
interface SNNSynapse {
  id: string;
  from: string;
  to: string;
  weight: number;
}
interface SNNTopology {
  nodes: SNNNode[];
  synapses: SNNSynapse[];
  canvasOffset: { x: number; y: number };
  canvasScale: number;
  // 其他UI状态，如选择、连接等，也可以放在这里
}

interface CanvasRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  snnTopology: SNNTopology;
}

/**
 * 绘制画布内容的工具类 (重构后)
 */
export class CanvasRenderer {
  static draw({ canvasRef, snnTopology }: CanvasRendererProps) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 清空画布并设置深色背景
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    this.drawGrid(ctx, canvas.width, canvas.height, snnTopology.canvasOffset, snnTopology.canvasScale);

    // 简化渲染逻辑：遍历所有节点并绘制
    snnTopology.nodes.forEach(node => {
      const { x, y } = this.worldToCanvas(node, snnTopology.canvasOffset, snnTopology.canvasScale);
      
      ctx.beginPath();
      ctx.arc(x, y, 10 * snnTopology.canvasScale, 0, 2 * Math.PI);
      
      switch(node.type) {
        case 'neuron':
          ctx.fillStyle = 'skyblue';
          break;
        case 'receptor':
          ctx.fillStyle = 'lightgreen';
          break;
        case 'effector':
          ctx.fillStyle = 'salmon';
          break;
        default:
          ctx.fillStyle = 'grey';
      }
      
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.stroke();
    });

    // 简化突触渲染
    snnTopology.synapses.forEach(synapse => {
      const fromNode = snnTopology.nodes.find(n => n.id === synapse.from);
      const toNode = snnTopology.nodes.find(n => n.id === synapse.to);

      if (fromNode && toNode) {
        const fromPos = this.worldToCanvas(fromNode, snnTopology.canvasOffset, snnTopology.canvasScale);
        const toPos = this.worldToCanvas(toNode, snnTopology.canvasOffset, snnTopology.canvasScale);

        ctx.beginPath();
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = Math.max(1, Math.abs(synapse.weight) * 2) * snnTopology.canvasScale;
        ctx.stroke();
      }
    });
  }

  private static worldToCanvas(
    pos: { x: number, y: number },
    offset: { x: number, y: number },
    scale: number
  ) {
    return {
      x: pos.x * scale + offset.x,
      y: pos.y * scale + offset.y
    };
  }

  private static drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    canvasOffset: { x: number; y: number },
    canvasScale: number,
  ) {
    const gridSize = 50 * canvasScale;
    const offsetX = canvasOffset.x % gridSize;
    const offsetY = canvasOffset.y % gridSize;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
}
