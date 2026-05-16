import { Receptor } from '../../types/simulation';
import { EditorFrame, EDITOR_LAYOUT, getVisionContentWidth } from '../utils/editorGeometry';

/**
 * 感受器渲染器
 */
export class ReceptorRenderer {
  static draw(
    ctx: CanvasRenderingContext2D, 
    receptors: Receptor[], 
    frame: EditorFrame,
    scrollX: number = 0
  ) {
    receptors.forEach(receptor => {
      // 绘制感受器主框架 - 使用深色主题颜色
      ctx.strokeStyle = '#6366f1'; // 主题色边框
      ctx.lineWidth = 2;
      ctx.strokeRect(frame.x, frame.y, frame.width, receptor.height);
      
      ctx.fillStyle = 'rgba(99, 102, 241, 0.1)'; // 主题色半透明背景
      ctx.fillRect(frame.x, frame.y, frame.width, receptor.height);

      // 设置裁剪区域，实现滚动效果
      ctx.save();
      ctx.beginPath();
      ctx.rect(frame.x, frame.y, frame.width, receptor.height);
      ctx.clip();

      // 只绘制视觉模态（简化后的设计）
      const visionModality = receptor.modalities.find(m => m.type === 'vision');
      
      if (visionModality) {
        this.drawSimplifiedVisionModality(ctx, visionModality, frame, scrollX);
      }
      
      ctx.restore();
      
      // 绘制滚动条指示器（在裁剪区域之外）
      if (visionModality) {
        this.drawScrollIndicator(ctx, visionModality, frame, receptor.height, scrollX);
      }
    });
  }

  private static drawSimplifiedVisionModality(
    ctx: CanvasRenderingContext2D,
    visionModality: any,
    frame: EditorFrame,
    scrollX: number
  ) {
    // 绘制简化的输入节点（无文字标签）
    if (visionModality.inputs && visionModality.inputs.length > 0) {
      visionModality.inputs.forEach((input: any) => {
        const inputX = frame.x + input.x - scrollX;
        const inputY = frame.y + input.y;
        
        // 只有在感受器可见区域内才绘制（扩展判断范围确保不截断）
        if (
          inputX >= frame.x - EDITOR_LAYOUT.inputOverflowPadding &&
          inputX <= frame.x + frame.width + EDITOR_LAYOUT.inputOverflowPadding
        ) {
          // 绘制输入节点
          ctx.beginPath();
          ctx.arc(inputX, inputY, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          
          // 根据RGB类型设置边界颜色
          let borderColor = '#94a3b8';
          if (input.colorType === 'R') {
            borderColor = '#ef4444'; // 红色
          } else if (input.colorType === 'G') {
            borderColor = '#22c55e'; // 绿色
          } else if (input.colorType === 'B') {
            borderColor = '#3b82f6'; // 蓝色
          }
          
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }
  }

  private static drawScrollIndicator(
    ctx: CanvasRenderingContext2D,
    visionModality: any,
    frame: EditorFrame,
    receptorHeight: number,
    scrollX: number
  ) {
    if (!visionModality.inputs || visionModality.inputs.length === 0) return;
    
    // 计算内容总宽度
    const contentWidth = getVisionContentWidth(visionModality.inputs);
    
    // 只有当内容宽度超过感受器宽度时才显示滚动条
    if (contentWidth > frame.width) {
      const scrollBarHeight = EDITOR_LAYOUT.scrollBarHeight;
      const scrollBarY = frame.y + receptorHeight - scrollBarHeight - EDITOR_LAYOUT.scrollBarBottomGap;
      
      // 绘制滚动条背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(frame.x + EDITOR_LAYOUT.scrollBarInset, scrollBarY, frame.width - EDITOR_LAYOUT.scrollBarInset * 2, scrollBarHeight);
      
      // 绘制滚动条边框
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(frame.x + EDITOR_LAYOUT.scrollBarInset, scrollBarY, frame.width - EDITOR_LAYOUT.scrollBarInset * 2, scrollBarHeight);
      
      // 计算滚动条拖拽块的位置和大小
      const scrollableWidth = contentWidth - frame.width;
      const scrollProgress = Math.max(0, Math.min(1, scrollX / scrollableWidth));
      const trackWidth = frame.width - EDITOR_LAYOUT.scrollBarInset * 2;
      const thumbWidth = Math.max(20, (frame.width / contentWidth) * trackWidth);
      const thumbX = frame.x + EDITOR_LAYOUT.scrollBarInset + scrollProgress * (trackWidth - thumbWidth);
      
      // 绘制滚动条拖拽块
      ctx.fillStyle = '#6366f1'; // 使用主题色
      ctx.fillRect(thumbX, scrollBarY + 1, thumbWidth, scrollBarHeight - 2);
      
      // 绘制拖拽块高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(thumbX, scrollBarY + 1, thumbWidth, 1);
    }
  }
}
