/**
 * 渲染工具函数
 */

// 计算两点间距离
export const calculateDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

// 计算边缘连接点
export const calculateEdgePoint = (
  centerX: number, 
  centerY: number, 
  targetX: number, 
  targetY: number, 
  radius: number
): { x: number; y: number } => {
  const distance = calculateDistance(centerX, centerY, targetX, targetY);
  
  if (distance === 0) {
    return { x: centerX, y: centerY };
  }
  
  const dx = targetX - centerX;
  const dy = targetY - centerY;
  
  return {
    x: centerX + (dx / distance) * radius,
    y: centerY + (dy / distance) * radius
  };
};

// 绘制箭头
export const drawArrow = (
  ctx: CanvasRenderingContext2D, 
  fromX: number, 
  fromY: number, 
  toX: number, 
  toY: number,
  size: number = 10
): void => {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle - Math.PI / 6),
    toY - size * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle + Math.PI / 6),
    toY - size * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
};

// 绘制自连接贝塞尔曲线
export const drawSelfConnection = (
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  loopSize: number = 40,
  weight: number,
  color: string
): void => {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 20);
  
  const cp1X = centerX + loopSize;
  const cp1Y = centerY - loopSize;
  const cp2X = centerX + loopSize;
  const cp2Y = centerY + loopSize;
  const endX = centerX + 20;
  const endY = centerY;
  
  ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
  
  ctx.lineWidth = Math.max(2, Math.abs(weight) * 5);
  ctx.strokeStyle = color;
  ctx.stroke();
  
  // 绘制箭头
  drawArrow(ctx, endX - 5, endY - 5, endX, endY);
};

// 获取权重对应的颜色
export const getWeightColor = (weight: number, isSelected: boolean = false): string => {
  if (isSelected) return '#a855f7'; // 紫色选中
  return weight > 0 ? '#22c55e' : '#ef4444'; // 绿色正权重，红色负权重
};

// 获取神经元边框样式
export const getNeuronBorderStyle = (
  isSelected: boolean,
  isHovered: boolean
): { color: string; width: number } => {
  if (isSelected) {
    return { color: '#a855f7', width: 3 }; // 紫色选中
  } else if (isHovered) {
    return { color: '#fbbf24', width: 4 }; // 黄色hover高亮
  } else {
    return { color: '#3b82f6', width: 2 }; // 蓝色默认
  }
}; 