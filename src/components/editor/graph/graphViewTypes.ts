import type { ModelDefinition, Position } from '../../../domain/brain';

export interface GraphBreadcrumbItem {
  id: string;
  label: string;
}

export interface GraphViewNode {
  id: string;
  refNodeId: string;
  label: string;
  kind: 'adapter' | 'neuron-group' | 'neuron' | 'signal';
  x: number;
  y: number;
  width: number;
  height: number;
  parentId: string | null;
  detail: string;
  editable: boolean;
  navigable: boolean;
  leaf: boolean;
  proxy: boolean;
  movable: boolean;
  local: boolean;
  direction: 'input' | 'output' | 'internal';
  connectableSource: boolean;
  connectableTarget: boolean;
  expanded: boolean;
  expansionParentId: string | null;
  expansionOffsetX: number;
  expansionOffsetY: number;
}

export interface GraphViewLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  weight: number;
  count: number;
  aggregate: boolean;
  leafLinkIds: string[];
  editable: boolean;
}

export interface GraphTopologyIndexes<Node> {
  pathById: Map<string, string[]>;
  nodeById: Map<string, Node>;
}

export interface GraphViewModel<Node, Container> {
  indexes: GraphTopologyIndexes<Node>;
  breadcrumbs: GraphBreadcrumbItem[];
  currentContainer: Container;
  currentChildren: Node[];
  currentScope: 'root' | 'child';
  currentContainerKind: 'root' | 'adapter' | 'neuron-group';
  scopeKey: string;
  localLeafIds: Set<string>;
  nodes: GraphViewNode[];
  viewNodeById: Map<string, GraphViewNode>;
  links: GraphViewLink[];
  activeViewNodeIds: Set<string>;
  modelById: Map<string, ModelDefinition>;
}

export type NodePositionDraftMap = Record<string, Position>;

