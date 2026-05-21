import type { GraphPoint } from '../tools/canvasGeometry';

export type GraphInteractionState =
  | {
      type: 'pressing';
      nodeId: string;
      additive: boolean;
      startClient: GraphPoint;
      startScene: GraphPoint;
    }
  | {
      type: 'surface-pressing';
      surfaceTarget: 'canvas' | 'link';
      startClient: GraphPoint;
      startScene: GraphPoint;
    }
  | {
      type: 'context-gesture';
      contextTarget: 'canvas' | 'selection';
      startClient: GraphPoint;
      startScene: GraphPoint;
      startOffset: GraphPoint;
      sourceNodeIds: string[];
      sourceScenePoint: GraphPoint | null;
      moved: boolean;
    }
  | {
      type: 'panning';
      startClient: GraphPoint;
      startOffset: GraphPoint;
      moved: boolean;
    }
  | {
      type: 'selecting';
      startScene: GraphPoint;
      currentScene: GraphPoint;
      moved: boolean;
    }
  | {
      type: 'moving';
      startClient: GraphPoint;
      startScene: GraphPoint;
      startOrigin: GraphPoint;
      nodeIds: string[];
      basePositions: Record<string, GraphPoint>;
      currentPositions: Record<string, GraphPoint>;
      moved: boolean;
    }
  | {
      type: 'linking';
      sourceNodeIds: string[];
      mode: 'single' | 'multi';
      sourceScenePoint: GraphPoint;
      currentScenePoint: GraphPoint;
      moved: boolean;
    };

export interface GraphContextMenuState {
  kind: 'canvas' | 'selection';
  client: GraphPoint;
  scene: GraphPoint;
  nodeIds: string[];
}
