/**
 * 图编辑器相关类型定义
 */

export interface GraphEditorProps {
  width: number;
  height: number;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  visible: boolean;
}

export interface InteractionState {
  isDragging: boolean;
  isSelecting: boolean;
  isPanning: boolean;
  isCreatingEdge: boolean;
  dragStartPos: { x: number; y: number };
  draggedNodes: string[];
  edgeStartNodeId: string | null;
  lastMousePos: { x: number; y: number };
  selectedNodes: string[];
  selectedEdges: string[];
  selectedGroups: string[];
  draggedGroups: string[];
}

export interface NodeGroup {
  id: string;
  type: string; // 不再限制类型，可以是任意字符串
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  nodes: string[]; // 包含的节点ID列表
  neurons: string[]; // 神经元ID列表，用于折叠检查
  managedEdges?: ManagedEdge[]; // 收起时托管的边信息
  pluginInstance?: any; // 关联的插件实例（如果是插件组）
}

export interface ManagedEdge {
  edgeId: string;
  originalFromNodeId: string;
  originalToNodeId: string;
  isFromNodeInGroup: boolean; // 起点是否在组内
  isToNodeInGroup: boolean; // 终点是否在组内
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface CanvasTransform {
  offset: Vector2D;
  scale: number;
}

export interface GraphNode {
  id: string;
  label?: string;
  type: string;
  x: number;
  y: number;
  data?: any; // 节点的业务数据
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight?: number;
  data?: any; // 边的业务数据
} 