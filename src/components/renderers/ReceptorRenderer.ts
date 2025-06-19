import { Receptor } from '../../types/simulation';

/**
 * 感受器渲染器
 */
export class ReceptorRenderer {
  static draw(
    ctx: CanvasRenderingContext2D, 
    receptors: Receptor[], 
    receptorX: number, 
    receptorY: number, 
    receptorWidth: number,
    scrollX: number = 0
  ) {
    receptors.forEach(receptor => {
      // 绘制感受器主框架 - 使用深色主题颜色
      ctx.strokeStyle = '#6366f1'; // 主题色边框
      ctx.lineWidth = 2;
      ctx.strokeRect(receptorX, receptorY, receptorWidth, receptor.height);
      
      ctx.fillStyle = 'rgba(99, 102, 241, 0.1)'; // 主题色半透明背景
      ctx.fillRect(receptorX, receptorY, receptorWidth, receptor.height);

      // 设置裁剪区域，实现滚动效果
      ctx.save();
      ctx.beginPath();
      ctx.rect(receptorX, receptorY, receptorWidth, receptor.height);
      ctx.clip();

      // 只绘制视觉模态（简化后的设计）
      const visionModality = receptor.modalities.find(m => m.type === 'vision');
      
      if (visionModality) {
        this.drawSimplifiedVisionModality(ctx, visionModality, receptorX, receptorY, scrollX, receptorWidth);
      }
      
      ctx.restore();
      
      // 绘制滚动条指示器（在裁剪区域之外）
      if (visionModality) {
        this.drawScrollIndicator(ctx, visionModality, receptorX, receptorY, receptorWidth, receptor.height, scrollX);
      }
    });
  }

  private static drawSimplifiedVisionModality(
    ctx: CanvasRenderingContext2D,
    visionModality: any,
    receptorX: number,
    receptorY: number,
    scrollX: number,
    receptorWidth: number
  ) {
    // 绘制简化的输入节点（无文字标签）
    if (visionModality.inputs && visionModality.inputs.length > 0) {
      visionModality.inputs.forEach((input: any) => {
        const inputX = receptorX + input.x - scrollX;
        const inputY = receptorY + input.y;
        
        // 只有在感受器可见区域内才绘制（扩展判断范围确保不截断）
        if (inputX >= receptorX - 12 && inputX <= receptorX + receptorWidth + 12) {
          // 绘制输入节点
          ctx.beginPath();
          ctx.arc(inputX, inputY, 6, 0, 2 * Math.PI);
          ctx.fillStyle = input.voltage > 0 ? '#ffffff' : '#4a5568';
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

          // 只在有电压时显示电压值（无其他文字）
          if (input.voltage > 0) {
            ctx.fillStyle = '#000000';
            ctx.font = '6px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(input.voltage.toFixed(1), inputX, inputY + 2);
          }
        }
      });
    }
  }

  private static drawScrollIndicator(
    ctx: CanvasRenderingContext2D,
    visionModality: any,
    receptorX: number,
    receptorY: number,
    receptorWidth: number,
    receptorHeight: number,
    scrollX: number
  ) {
    if (!visionModality.inputs || visionModality.inputs.length === 0) return;
    
    // 计算内容总宽度
    const visionCells = visionModality.inputs.length / 3; // RGB三个通道
    const contentWidth = 10 * 2 + visionCells * 16; // 起始位置 + 节点数量 * 间距
    
    // 只有当内容宽度超过感受器宽度时才显示滚动条
    if (contentWidth > receptorWidth) {
      const scrollBarHeight = 6;
      const scrollBarY = receptorY + receptorHeight - scrollBarHeight - 3;
      
      // 绘制滚动条背景
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(receptorX + 5, scrollBarY, receptorWidth - 10, scrollBarHeight);
      
      // 绘制滚动条边框
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(receptorX + 5, scrollBarY, receptorWidth - 10, scrollBarHeight);
      
      // 计算滚动条拖拽块的位置和大小
      const scrollableWidth = contentWidth - receptorWidth;
      const scrollProgress = Math.max(0, Math.min(1, scrollX / scrollableWidth));
      const thumbWidth = Math.max(20, (receptorWidth / contentWidth) * (receptorWidth - 10));
      const thumbX = receptorX + 5 + scrollProgress * (receptorWidth - 10 - thumbWidth);
      
      // 绘制滚动条拖拽块
      ctx.fillStyle = '#6366f1'; // 使用主题色
      ctx.fillRect(thumbX, scrollBarY + 1, thumbWidth, scrollBarHeight - 2);
      
      // 绘制拖拽块高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(thumbX, scrollBarY + 1, thumbWidth, 1);
    }
  }

  private static drawVisionModality(
    ctx: CanvasRenderingContext2D,
    visionModality: any,
    currentX: number,
    receptorY: number,
    visionWidth: number
  ) {
    // 绘制视觉模态标题
    ctx.fillStyle = '#ffffff'; // 白色标题
    ctx.font = 'bold 11px Arial'; // 稍大字体
    ctx.textAlign = 'center';
    ctx.fillText(visionModality.label, currentX + visionWidth / 2, receptorY + 16);
    
    // 绘制视觉模态的输入点
    if (visionModality.inputs && visionModality.inputs.length > 0) {
      visionModality.inputs.forEach((input: any) => {
        const inputX = currentX + input.x;
        const inputY = receptorY + 22 + input.y; // 调整位置
        
        // 绘制输入点
        ctx.beginPath();
        ctx.arc(inputX, inputY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = input.voltage > 0 ? '#ef4444' : '#64748b'; // 调整颜色
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

        // 显示电压值
        if (input.voltage > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '6px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(input.voltage.toFixed(1), inputX, inputY + 2);
        }
      });
    }
  }

  private static drawOtherModality(
    ctx: CanvasRenderingContext2D,
    modality: any,
    modalityX: number,
    receptorY: number,
    otherModalityWidth: number
  ) {
    // 绘制模态标题
    ctx.fillStyle = '#94a3b8'; // 浅灰色
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(modality.label, modalityX + otherModalityWidth / 2, receptorY + 16);
    
    // 绘制模态的输入点（如果有）
    if (modality.inputs && modality.inputs.length > 0) {
      modality.inputs.forEach((input: any, inputIndex: number) => {
        const inputX = modalityX + (inputIndex % 2) * 12 + 10;
        const inputY = receptorY + 25 + Math.floor(inputIndex / 2) * 12;
        
        ctx.beginPath();
        ctx.arc(inputX, inputY, 3, 0, 2 * Math.PI);
        ctx.fillStyle = input.voltage > 0 ? '#f59e0b' : '#64748b';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }
} 