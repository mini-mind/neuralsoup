import { Vector2D, CanvasTransform } from '../types/editor.types';

/**
 * 几何计算工具函数
 */

/**
 * 坐标转换：从画布坐标转换为世界坐标
 */
export const canvasToWorld = (canvasPos: Vector2D, transform: CanvasTransform): Vector2D => ({
  x: (canvasPos.x - transform.offset.x) / transform.scale,
  y: (canvasPos.y - transform.offset.y) / transform.scale,
});

/**
 * 坐标转换：从世界坐标转换为画布坐标
 */
export const worldToCanvas = (worldPos: Vector2D, transform: CanvasTransform): Vector2D => ({
  x: worldPos.x * transform.scale + transform.offset.x,
  y: worldPos.y * transform.scale + transform.offset.y,
});

/**
 * 计算点到线段的距离
 */
export const distanceToLineSegment = (
  point: Vector2D, 
  lineStart: Vector2D, 
  lineEnd: Vector2D
): number => {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number, yy: number;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * 计算两点之间的距离
 */
export const distance = (p1: Vector2D, p2: Vector2D): number => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * 检查点是否在矩形内
 */
export const isPointInRect = (
  point: Vector2D, 
  rect: { x: number; y: number; width: number; height: number }
): boolean => {
  return point.x >= rect.x && 
         point.x <= rect.x + rect.width &&
         point.y >= rect.y && 
         point.y <= rect.y + rect.height;
}; 