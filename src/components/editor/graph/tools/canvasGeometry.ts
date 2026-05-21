export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphRect extends GraphPoint {
  width: number;
  height: number;
}

export interface GraphSize {
  width: number;
  height: number;
}

export interface GraphViewport extends GraphPoint {}

export interface SceneNodeGeometry extends GraphRect {
  id: string;
}

export const SCENE_PADDING = 120;
export const DRAG_THRESHOLD = 3;
export const ZOOM_STEP = 1.2;
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 3;
export const NODE_PLACEMENT_MARGIN = 24;

export const getNodeCenter = (node: GraphRect): GraphPoint => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

export const hasMovedPastThreshold = (start: GraphPoint, end: GraphPoint) =>
  Math.abs(end.x - start.x) > DRAG_THRESHOLD || Math.abs(end.y - start.y) > DRAG_THRESHOLD;

export const hasPointerDelta = (start: GraphPoint, end: GraphPoint) =>
  start.x !== end.x || start.y !== end.y;

export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const normalizeRect = (rect: GraphRect): GraphRect => ({
  x: rect.width >= 0 ? rect.x : rect.x + rect.width,
  y: rect.height >= 0 ? rect.y : rect.y + rect.height,
  width: Math.abs(rect.width),
  height: Math.abs(rect.height),
});

export const rectIntersectsRect = (rect: GraphRect, node: GraphRect) =>
  rect.x <= node.x + node.width &&
  rect.x + rect.width >= node.x &&
  rect.y <= node.y + node.height &&
  rect.y + rect.height >= node.y;

export const isPointInsideRect = (point: GraphPoint, rect: GraphRect) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

export const clampNodePlacement = (
  point: GraphPoint,
  node: GraphSize,
  scene: GraphSize
): GraphPoint => ({
  x: Math.min(
    Math.max(NODE_PLACEMENT_MARGIN, Math.round(point.x)),
    Math.max(NODE_PLACEMENT_MARGIN, Math.round(scene.width - node.width - NODE_PLACEMENT_MARGIN))
  ),
  y: Math.min(
    Math.max(NODE_PLACEMENT_MARGIN, Math.round(point.y)),
    Math.max(NODE_PLACEMENT_MARGIN, Math.round(scene.height - node.height - NODE_PLACEMENT_MARGIN))
  ),
});

export const getScenePointFromClient = (
  client: GraphPoint,
  surfaceRect: Pick<DOMRect, 'left' | 'top'> | null,
  viewport: GraphViewport,
  scale: number
): GraphPoint => {
  if (!surfaceRect) {
    return { x: 0, y: 0 };
  }

  return {
    x: (client.x - surfaceRect.left - viewport.x) / scale,
    y: (client.y - surfaceRect.top - viewport.y) / scale,
  };
};

export const projectSceneNodeToClientRect = (
  node: GraphRect,
  sceneRect: Pick<DOMRect, 'left' | 'top'> | null,
  scale: number
): GraphRect => ({
  x: (sceneRect?.left ?? 0) + node.x * scale,
  y: (sceneRect?.top ?? 0) + node.y * scale,
  width: node.width * scale,
  height: node.height * scale,
});
