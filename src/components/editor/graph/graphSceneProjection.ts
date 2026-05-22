import type { GraphViewNode } from './graphViewTypes';
import { SCENE_PADDING } from './tools/canvasGeometry';

export interface GraphSceneNode extends GraphViewNode {
  sceneX: number;
  sceneY: number;
}

export interface GraphSceneProjection {
  list: GraphSceneNode[];
  map: Map<string, GraphSceneNode>;
  origin: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
}

export const projectGraphScene = (
  nodes: GraphViewNode[],
  viewport: { width: number; height: number }
): GraphSceneProjection => {
  if (nodes.length === 0) {
    return {
      list: [],
      map: new Map(),
      origin: { x: 0, y: 0 },
      size: {
        width: Math.max(viewport.width, 1),
        height: Math.max(viewport.height, 1),
      },
    };
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  const origin = {
    x: minX - SCENE_PADDING,
    y: minY - SCENE_PADDING,
  };
  const size = {
    width: Math.max(maxX - minX + SCENE_PADDING * 2, viewport.width),
    height: Math.max(maxY - minY + SCENE_PADDING * 2, viewport.height),
  };
  const list = nodes.map((node) => ({
    ...node,
    sceneX: node.x - origin.x,
    sceneY: node.y - origin.y,
  }));

  return {
    list,
    map: new Map(list.map((node) => [node.id, node])),
    origin,
    size,
  };
};
