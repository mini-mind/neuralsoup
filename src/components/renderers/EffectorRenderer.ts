import { Effector } from '../../types/simulation';

/**
 * 效应器渲染器
 */
export class EffectorRenderer {
  static draw(
    ctx: CanvasRenderingContext2D, 
    effectors: Effector[], 
    effectorX: number, 
    effectorY: number, 
    effectorWidth: number
  ) {
    effectors.forEach(effector => {
      // 绘制效应器主框架 - 使用深色主题颜色
      ctx.strokeStyle = '#f59e0b'; // 黄色边框
      ctx.lineWidth = 2;
      ctx.strokeRect(effectorX, effectorY, effectorWidth, effector.height);
      
      ctx.fillStyle = 'rgba(245, 158, 11, 0.1)'; // 黄色半透明背景
      ctx.fillRect(effectorX, effectorY, effectorWidth, effector.height);

      // 绘制效应器标题
      ctx.fillStyle = '#ffffff'; // 白色标题
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('运动输出', effectorX + effectorWidth / 2, effectorY + 16);

      // 绘制输出节点
      effector.outputs.forEach((output, outputIndex) => {
        const outputX = effectorX + output.x;
        const outputY = effectorY + output.y;
        
        // 绘制输出圆圈
        ctx.beginPath();
        ctx.arc(outputX, outputY, 12, 0, 2 * Math.PI);
        
        // 根据信号强度设置颜色
        const intensity = Math.min(1, Math.abs(output.signal));
        ctx.fillStyle = `rgba(245, 158, 11, ${0.3 + intensity * 0.7})`; // 黄色渐变
        ctx.fill();
        
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制输出标签（在圆圈下方）
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(output.label, outputX, outputY + 25);

        // 显示信号值
        if (Math.abs(output.signal) > 0.01) {
          ctx.fillStyle = '#1e1e1e'; // 深色文字
          ctx.font = 'bold 8px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(output.signal.toFixed(2), outputX, outputY + 2);
        }
      });
    });
  }
} 