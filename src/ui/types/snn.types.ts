/**
 * UI层SNN相关类型定义
 * 这些类型专门用于UI层的数据表示和交互
 * 与核心层类型分离，避免耦合
 */

import type { INeuron, ISynapse, NetworkNode, NetworkEdge } from '../../core/types';

// === UI特定的数据结构 ===

/**
 * UI层神经元节点表示
 * 包含位置信息和UI状态，用于可视化编辑器
 */
export interface UINode {
  id: string;
  label?: string;
  type: string;
  x: number;
  y: number;
  selected?: boolean;
  // 可以包含对核心神经元的引用
  neuron?: INeuron;
  // 神经元参数（用于UI编辑）
  params?: {
    a?: number;
    b?: number;
    c?: number;
    d?: number;
    threshold?: number;
  };
  // 神经元状态（用于UI显示）
  state?: {
    v?: number;
    u?: number;
    spike?: boolean;
    lastSpikeTime?: number;
  };
}

/**
 * UI层边连接表示
 * 包含可视化相关的属性
 */
export interface UIEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  weight: number;
  delay?: number;
  selected?: boolean;
  // 可以包含对核心突触的引用
  synapse?: ISynapse;
}

/**
 * UI层拓扑结构
 * 包含画布状态和UI特定的配置
 */
export interface UITopology {
  nodes: UINode[];
  edges: UIEdge[];
  canvasOffset?: { x: number; y: number };
  canvasScale?: number;
}

// === 适配器类型 ===

/**
 * 核心层到UI层的节点适配器
 */
export type NodeAdapter = (networkNode: NetworkNode) => UINode;

/**
 * 核心层到UI层的边适配器
 */
export type EdgeAdapter = (networkEdge: NetworkEdge) => UIEdge;

// Re-export commonly used editor types
export type { Vector2D, NodeGroup, InteractionState, SelectionBox, CanvasTransform } from './editor.types';

// === 向后兼容的类型别名 ===
// 为了不破坏现有代码，提供别名
export type SNNNode = UINode;
export type SNNEdge = UIEdge;
export type SNNTopology = UITopology;
