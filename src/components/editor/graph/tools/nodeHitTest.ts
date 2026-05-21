import {
  isPointInsideRect,
  projectSceneNodeToClientRect,
  type GraphPoint,
  type GraphRect,
  type SceneNodeGeometry,
} from './canvasGeometry';

export const findSceneNodeAtClientPoint = (
  nodes: SceneNodeGeometry[],
  clientPoint: GraphPoint,
  sceneRect: Pick<DOMRect, 'left' | 'top'> | null,
  scale: number,
  options?: {
    excludeNodeIds?: string[];
  }
): SceneNodeGeometry | null => {
  const excludedNodeIds = new Set(options?.excludeNodeIds ?? []);

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (excludedNodeIds.has(node.id)) {
      continue;
    }

    if (
      isPointInsideRect(
        clientPoint,
        projectSceneNodeToClientRect(
          {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
          },
          sceneRect,
          scale
        )
      )
    ) {
      return node;
    }
  }

  return null;
};

export const findIntersectedNodeIds = <T extends SceneNodeGeometry>(
  nodes: T[],
  rect: GraphRect,
  predicate?: (node: T) => boolean
) =>
  nodes
    .filter((node) => (predicate ? predicate(node) : true))
    .filter((node) =>
      rect.x <= node.x + node.width &&
      rect.x + rect.width >= node.x &&
      rect.y <= node.y + node.height &&
      rect.y + rect.height >= node.y
    )
    .map((node) => node.id);
