import { SNNNode } from '../../types/simulation';

/**
 * 神经元渲染器
 */
export class NeuronRenderer {
  private static readonly CORE_RADIUS = 3;

  static draw(
    ctx: CanvasRenderingContext2D,
    nodes: SNNNode[],
    canvasOffset: { x: number; y: number },
    canvasScale: number,
    selectedNodes: string[],
    hoveredNode: string | null = null
  ) {
    nodes.forEach((node) => {
      if (node.type !== 'neuron') {
        return;
      }

      const x = (node.x + canvasOffset.x) * canvasScale;
      const y = (node.y + canvasOffset.y) * canvasScale;
      const centerX = x + 25;
      const centerY = y + 25;
      const isSelected = selectedNodes.includes(node.id);
      const isHovered = hoveredNode === node.id;
      const activeColor = isSelected ? '#ef6464' : isHovered ? '#d2d2d2' : '#bfbfbf';

      ctx.beginPath();
      ctx.arc(centerX, centerY, this.CORE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = activeColor;
      ctx.shadowBlur = isSelected || isHovered ? 10 : 0;
      ctx.shadowColor = isSelected ? 'rgba(239, 100, 100, 0.65)' : 'rgba(255, 255, 255, 0.35)';
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }
}
