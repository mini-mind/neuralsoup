/**
 * 网格渲染器 - 绘制画布背景网格
 */

export class GridRenderer {
  /**
   * 绘制网格背景
   */
  static draw(
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    canvasOffset: { x: number; y: number }, 
    canvasScale: number
  ): void {
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
} 