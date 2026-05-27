import type { Position } from '../../../domain/brain/shared';

export interface GraphBreadcrumbItem {
  id: string;
  label: string;
}

export interface GraphViewNode {
  id: string;
  viewId: string;
  refNodeId: string;
  rootContainer: boolean;
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
  previewOnly: boolean;
  direction: 'input' | 'output' | 'internal';
  connectableSource: boolean;
  connectableTarget: boolean;
  expanded: boolean;
  expansionParentId: string | null;
  expansionOffsetX: number;
  expansionOffsetY: number;
  runtimeInstalled: boolean;
  runtimeInstalledLeafCount: number;
  adapterNavigable: boolean;
}

export interface GraphViewLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromRefNodeId: string;
  toRefNodeId: string;
  weight: number;
  weightDisplay?: string;
  count: number;
  aggregate: boolean;
  leafLinkIds: string[];
  inspectable: boolean;
  editable: boolean;
  synapse?: {
    resolutionStatus:
      | 'resolved'
      | 'missing-synapse-model-id'
      | 'missing-synapse-model'
      | 'missing-effective-weight'
      | 'missing-effective-delay';
    synapseModelId: string | null;
    synapseModelLabel: string | null;
    synapseKind:
      | 'static-current'
      | 'single-exp-conductance'
      | 'dual-exp-conductance'
      | 'dual-exp-stdp'
      | 'dual-exp-stp'
      | null;
    defaults: Record<string, number>;
    parameterOverrides: Record<string, number>;
    effectiveParameters: Record<string, number>;
    effectiveWeight: number | null;
    effectiveDelayMs: number | null;
    effectiveDelayMsDisplay: string;
  } | null;
  synapseSummary?: {
    synapseModelIds: string[];
    resolvedWeightCount: number;
    unresolvedWeightCount: number;
    resolvedWeightTotal: number;
  } | null;
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
  viewNodeByViewId: Map<string, GraphViewNode>;
  links: GraphViewLink[];
  activeViewNodeIds: Set<string>;
}

export type NodePositionDraftMap = Record<string, Position>;
