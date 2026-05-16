import { SNNNode } from '../../types/simulation';

/**
 * 神经元渲染器
 */
export class NeuronRenderer {
  static draw(
    ctx: CanvasRenderingContext2D, 
    nodes: SNNNode[], 
    canvasOffset: { x: number; y: number }, 
    canvasScale: number, 
    selectedNodes: string[],
    hoveredNode: string | null = null
  ) {
    nodes.forEach(node => {
      if (node.type === 'neuron') {
        const x = (node.x + canvasOffset.x) * canvasScale;
        const y = (node.y + canvasOffset.y) * canvasScale;
        
        // 绘制神经元圆圈
        ctx.beginPath();
        ctx.arc(x + 25, y + 25, 20, 0, 2 * Math.PI);
        
        ctx.fillStyle = selectedNodes.includes(node.id) ? '#a855f7' : // 紫色选中
                       'rgba(59, 130, 246, 0.72)';
        ctx.fill();
        
        // 绘制边框 - 添加hover高亮效果
        const isSelected = selectedNodes.includes(node.id);
        const isHovered = hoveredNode === node.id;
        
        if (isSelected) {
          ctx.strokeStyle = '#a855f7'; // 紫色选中
          ctx.lineWidth = 3;
        } else if (isHovered) {
          ctx.strokeStyle = '#fbbf24'; // 黄色hover高亮
          ctx.lineWidth = 4; // 更粗的边框表示可连接
        } else {
          ctx.strokeStyle = '#3b82f6'; // 蓝色默认
          ctx.lineWidth = 2;
        }
        ctx.stroke();
        
        // 绘制标签
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(node.label || `N${node.id}`, x + 25, y + 60);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(node.id, x + 25, y + 75);
      }
    });
  }
} 
