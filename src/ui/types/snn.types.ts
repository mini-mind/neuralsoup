/**
 * SNN (Spiking Neural Network) related type definitions
 * Unified type definitions for SNN components and UI
 */

export interface SNNNode {
  id: string;
  label?: string;
  type: string;
  x: number;
  y: number;
  params?: {
    a: number;
    b: number;
    c: number;
    d: number;
    threshold: number;
  };
  state?: {
    v: number;
    u: number;
    spike: boolean;
    lastSpikeTime: number;
  };
}

export interface SNNEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  weight: number;
  delay?: number;
}

export interface SNNTopology {
  nodes: SNNNode[];
  edges: SNNEdge[];
  canvasOffset?: { x: number; y: number };
  canvasScale?: number;
}

// Re-export commonly used types from editor.types.ts
export type { Vector2D, NodeGroup, InteractionState, SelectionBox, CanvasTransform } from './editor.types';
