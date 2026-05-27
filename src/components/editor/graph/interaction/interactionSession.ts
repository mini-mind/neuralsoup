import type { GraphPoint } from '../tools/canvasGeometry';
import type { GraphSelectionContextMenuMode } from './contextMenuPolicy';

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
      surfaceTarget: 'canvas';
      startClient: GraphPoint;
      startScene: GraphPoint;
    }
  | {
      type: 'context-gesture';
      contextTarget: 'canvas' | 'selection' | 'group';
      startClient: GraphPoint;
      startScene: GraphPoint;
      startOffset: GraphPoint;
      contextNodeIds: string[];
      sourceNodeIds: string[];
      sourceScenePoint: GraphPoint | null;
      singleNodeLeaf: boolean;
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

export type GraphContextMenuState =
  | {
      kind: 'canvas';
      client: GraphPoint;
      scene: GraphPoint;
      nodeIds: [];
    }
  | {
      kind: 'selection';
      client: GraphPoint;
      scene: GraphPoint;
      nodeIds: string[];
      selectionMode: Exclude<GraphSelectionContextMenuMode, 'none'>;
    }
  | {
      kind: 'group';
      client: GraphPoint;
      scene: GraphPoint;
      nodeIds: [string];
    };
