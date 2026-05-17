import type { Position } from './shared';

export type LiteralValue =
  | boolean
  | number
  | string
  | null
  | LiteralValue[]
  | { [key: string]: LiteralValue };

export type ValueType = 'boolean' | 'number' | 'string' | 'unknown';

export interface SignalDefinition {
  id: string;
  valueType: ValueType;
  dimensions?: number[];
  doc?: string;
}

export interface VariableDefinition {
  id: string;
  valueType: ValueType;
  defaultValue?: LiteralValue;
  doc?: string;
}

export interface PortDefinition {
  id: string;
  signal: SignalDefinition;
  doc?: string;
}

export type StructuredExpression =
  | {
      kind: 'literal';
      value: LiteralValue;
    }
  | {
      kind: 'reference';
      target: string;
    }
  | {
      kind: 'call';
      callee: string;
      args: StructuredExpression[];
    }
  | {
      kind: 'binary';
      operator: '+' | '-' | '*' | '/' | '==' | '!=' | '<' | '<=' | '>' | '>=';
      left: StructuredExpression;
      right: StructuredExpression;
    };

export type StructuredStatement =
  | {
      kind: 'assign';
      target: string;
      expression: StructuredExpression;
    }
  | {
      kind: 'emit';
      portId: string;
      expression: StructuredExpression;
    }
  | {
      kind: 'if';
      condition: StructuredExpression;
      then: StructuredStatement[];
      otherwise?: StructuredStatement[];
    }
  | {
      kind: 'call';
      callee: string;
      args: StructuredExpression[];
    };

export interface EquationDefinition {
  id: string;
  target: string;
  expression: StructuredExpression;
  doc?: string;
}

export interface ReceiveHandlerDefinition {
  portId: string;
  body: StructuredStatement[];
  doc?: string;
}

export interface UpdateStepDefinition {
  id: string;
  body: StructuredStatement[];
  doc?: string;
}

export interface ModelDefinition {
  id: string;
  kind: 'neuron' | 'signal';
  doc?: string;
  state: VariableDefinition[];
  parameters: VariableDefinition[];
  internals: VariableDefinition[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  equations: EquationDefinition[];
  onReceive: ReceiveHandlerDefinition[];
  update: UpdateStepDefinition[];
}

export interface LeafPortRef {
  nodeId: string;
  portId: string;
}

export interface LeafLink {
  id: string;
  from: LeafPortRef;
  to: LeafPortRef;
  weight: number;
  delayMs?: number;
}

export interface NeuronNode {
  kind: 'neuron';
  id: string;
  label: string;
  modelId: string;
  position?: Position;
  parameterOverrides?: Record<string, LiteralValue>;
}

export interface SignalNode {
  kind: 'signal';
  id: string;
  label: string;
  modelId: string;
  direction: 'input' | 'output';
  // World-facing boundary metadata. Leaf links still validate against the referenced model ports.
  signal: SignalDefinition;
  position?: Position;
  parameterOverrides?: Record<string, LiteralValue>;
}

export interface NeuronGroupNode {
  kind: 'neuron-group';
  id: string;
  label: string;
  children: TopologyNode[];
  position?: Position;
  collapsed?: boolean;
}

export interface AdapterNode {
  kind: 'adapter';
  id: string;
  label: string;
  adapterType: 'input' | 'output' | 'io';
  // Raw IR may come from untrusted serialized data. Validation narrows this to SignalNode[].
  children: TopologyNode[];
  position?: Position;
  collapsed?: boolean;
}

export type TopologyNode = NeuronNode | SignalNode | NeuronGroupNode | AdapterNode;

export interface ValidatedNeuronGroupNode extends Omit<NeuronGroupNode, 'children'> {
  children: ValidatedTopologyNode[];
}

export interface ValidatedAdapterNode extends Omit<AdapterNode, 'children'> {
  children: SignalNode[];
}

export type ValidatedTopologyNode =
  | NeuronNode
  | SignalNode
  | ValidatedNeuronGroupNode
  | ValidatedAdapterNode;

export interface RootGraph {
  id: 'root';
  children: TopologyNode[];
  links: LeafLink[];
}

export interface ValidatedRootGraph extends Omit<RootGraph, 'children'> {
  children: ValidatedTopologyNode[];
}

export interface GraphIRDocument {
  version: 1;
  models: ModelDefinition[];
  root: RootGraph;
}

export interface ValidatedGraphIRDocument extends Omit<GraphIRDocument, 'root'> {
  root: ValidatedRootGraph;
}

export interface AggregateLinkView {
  fromNodeId: string;
  toNodeId: string;
  leafLinkIds: string[];
  count: number;
  totalWeight: number;
}

export interface GraphIRDocumentSummary {
  inputSignalCount: number;
  outputSignalCount: number;
  neuronCount: number;
  leafLinkCount: number;
}

export type GraphIRValidationIssueCode =
  | 'duplicate-model-id'
  | 'duplicate-model-port-id'
  | 'duplicate-model-variable-id'
  | 'duplicate-topology-node-id'
  | 'duplicate-leaf-link-id'
  | 'duplicate-leaf-link-endpoints'
  | 'missing-node-model'
  | 'invalid-node-model-kind'
  | 'adapter-not-root-child'
  | 'adapter-child-not-signal'
  | 'missing-link-node'
  | 'missing-link-port'
  | 'non-leaf-link-endpoint'
  | 'invalid-link-direction'
  | 'mismatched-link-signal'
  | 'runtime-binding-error';

export interface GraphIRValidationIssue {
  code: GraphIRValidationIssueCode;
  message: string;
}

interface IndexedTopologyNode {
  node: TopologyNode;
  leaf: boolean;
}

const collectDuplicateValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return [...duplicates];
};

const collectModelValidationIssues = (model: ModelDefinition): GraphIRValidationIssue[] => {
  const issues: GraphIRValidationIssue[] = [];
  const duplicateVariableIds = collectDuplicateValues([
    ...model.state.map((variable) => variable.id),
    ...model.parameters.map((variable) => variable.id),
    ...model.internals.map((variable) => variable.id),
  ]);
  const duplicatePortIds = collectDuplicateValues([
    ...model.inputs.map((port) => port.id),
    ...model.outputs.map((port) => port.id),
  ]);

  for (const duplicateVariableId of duplicateVariableIds) {
    issues.push({
      code: 'duplicate-model-variable-id',
      message: `Model "${model.id}" has duplicated variable ID "${duplicateVariableId}".`,
    });
  }

  for (const duplicatePortId of duplicatePortIds) {
    issues.push({
      code: 'duplicate-model-port-id',
      message: `Model "${model.id}" has duplicated port ID "${duplicatePortId}".`,
    });
  }

  return issues;
};

const isLeafNode = (node: TopologyNode): node is NeuronNode | SignalNode =>
  node.kind === 'neuron' || node.kind === 'signal';

const compareSignalDefinitions = (left: SignalDefinition, right: SignalDefinition): boolean => {
  if (left.id !== right.id || left.valueType !== right.valueType) {
    return false;
  }

  const leftDimensions = left.dimensions ?? [];
  const rightDimensions = right.dimensions ?? [];

  if (leftDimensions.length !== rightDimensions.length) {
    return false;
  }

  return leftDimensions.every((dimension, index) => dimension === rightDimensions[index]);
};

const walkTopology = (
  nodes: TopologyNode[],
  parentKind: 'root' | 'neuron-group' | 'adapter',
  nodeIndex: Map<string, IndexedTopologyNode>,
  issues: GraphIRValidationIssue[]
): void => {
  for (const node of nodes) {
    if (nodeIndex.has(node.id)) {
      issues.push({
        code: 'duplicate-topology-node-id',
        message: `Topology node ID "${node.id}" is duplicated.`,
      });
    } else {
      nodeIndex.set(node.id, {
        node,
        leaf: isLeafNode(node),
      });
    }

    if (node.kind === 'adapter' && parentKind !== 'root') {
      issues.push({
        code: 'adapter-not-root-child',
        message: `Adapter node "${node.id}" must be a direct child of root.`,
      });
    }

    if (node.kind === 'neuron-group') {
      walkTopology(node.children, 'neuron-group', nodeIndex, issues);
      continue;
    }

    if (node.kind === 'adapter') {
      for (const child of node.children) {
        if (child.kind !== 'signal') {
          issues.push({
            code: 'adapter-child-not-signal',
            message: `Adapter node "${node.id}" can only contain signal children, found "${child.kind}" in "${child.id}".`,
          });
        }
      }

      walkTopology(node.children, 'adapter', nodeIndex, issues);
    }
  }
};

const getNodeModelId = (node: TopologyNode): string | null => {
  if (node.kind === 'neuron' || node.kind === 'signal') {
    return node.modelId;
  }

  return null;
};

const collectTopologyModelIssues = (
  nodes: Iterable<IndexedTopologyNode>,
  modelsById: Map<string, ModelDefinition>
): GraphIRValidationIssue[] => {
  const issues: GraphIRValidationIssue[] = [];

  for (const indexedNode of nodes) {
    const modelId = getNodeModelId(indexedNode.node);
    if (!modelId) {
      continue;
    }

    const model = modelsById.get(modelId);
    if (!model) {
      issues.push({
        code: 'missing-node-model',
        message: `Node "${indexedNode.node.id}" references missing model "${modelId}".`,
      });
      continue;
    }

    if (indexedNode.node.kind === 'neuron' && model.kind !== 'neuron') {
      issues.push({
        code: 'invalid-node-model-kind',
        message: `Neuron node "${indexedNode.node.id}" must reference a neuron model, got "${model.kind}" from "${modelId}".`,
      });
    }

    if (indexedNode.node.kind === 'signal' && model.kind !== 'signal') {
      issues.push({
        code: 'invalid-node-model-kind',
        message: `Signal node "${indexedNode.node.id}" must reference a signal model, got "${model.kind}" from "${modelId}".`,
      });
    }
  }

  return issues;
};

export class GraphIRValidationError extends Error {
  public readonly issues: GraphIRValidationIssue[];

  constructor(issues: GraphIRValidationIssue[]) {
    super(`Graph IR validation failed: ${issues.map((issue) => issue.message).join(' | ')}`);
    this.name = 'GraphIRValidationError';
    this.issues = issues;
  }
}

export const validateGraphIRDocument = (document: GraphIRDocument): GraphIRValidationIssue[] => {
  const issues: GraphIRValidationIssue[] = [];
  const duplicateModelIds = collectDuplicateValues(document.models.map((model) => model.id));

  for (const duplicateModelId of duplicateModelIds) {
    issues.push({
      code: 'duplicate-model-id',
      message: `Model ID "${duplicateModelId}" is duplicated.`,
    });
  }

  for (const model of document.models) {
    issues.push(...collectModelValidationIssues(model));
  }

  const modelsById = new Map<string, ModelDefinition>();
  for (const model of document.models) {
    if (!modelsById.has(model.id)) {
      modelsById.set(model.id, model);
    }
  }

  const nodeIndex = new Map<string, IndexedTopologyNode>();
  walkTopology(document.root.children, 'root', nodeIndex, issues);
  issues.push(...collectTopologyModelIssues(nodeIndex.values(), modelsById));

  const duplicateLinkIds = collectDuplicateValues(document.root.links.map((link) => link.id));
  for (const duplicateLinkId of duplicateLinkIds) {
    issues.push({
      code: 'duplicate-leaf-link-id',
      message: `Leaf link ID "${duplicateLinkId}" is duplicated.`,
    });
  }

  const seenLeafLinkEndpoints = new Set<string>();
  const duplicateLeafLinkEndpoints = new Set<string>();
  for (const link of document.root.links) {
    const endpointKey = `${link.from.nodeId}:${link.from.portId}->${link.to.nodeId}:${link.to.portId}`;
    if (seenLeafLinkEndpoints.has(endpointKey)) {
      duplicateLeafLinkEndpoints.add(endpointKey);
      continue;
    }

    seenLeafLinkEndpoints.add(endpointKey);
  }

  for (const duplicateEndpointKey of duplicateLeafLinkEndpoints) {
    issues.push({
      code: 'duplicate-leaf-link-endpoints',
      message: `Leaf link endpoints "${duplicateEndpointKey}" are duplicated.`,
    });
  }

  for (const link of document.root.links) {
    const sourceEntry = nodeIndex.get(link.from.nodeId);
    const targetEntry = nodeIndex.get(link.to.nodeId);

    if (!sourceEntry) {
      issues.push({
        code: 'missing-link-node',
        message: `Leaf link "${link.id}" references missing source node "${link.from.nodeId}".`,
      });
    }

    if (!targetEntry) {
      issues.push({
        code: 'missing-link-node',
        message: `Leaf link "${link.id}" references missing target node "${link.to.nodeId}".`,
      });
    }

    if (!sourceEntry || !targetEntry) {
      continue;
    }

    if (!sourceEntry.leaf) {
      issues.push({
        code: 'non-leaf-link-endpoint',
        message: `Leaf link "${link.id}" source "${link.from.nodeId}" must reference a leaf node.`,
      });
    }

    if (!targetEntry.leaf) {
      issues.push({
        code: 'non-leaf-link-endpoint',
        message: `Leaf link "${link.id}" target "${link.to.nodeId}" must reference a leaf node.`,
      });
    }

    if (!sourceEntry.leaf || !targetEntry.leaf) {
      continue;
    }

    const sourceNode = sourceEntry.node;
    const targetNode = targetEntry.node;
    if (!isLeafNode(sourceNode) || !isLeafNode(targetNode)) {
      continue;
    }

    const sourceModel = modelsById.get(sourceNode.modelId);
    const targetModel = modelsById.get(targetNode.modelId);

    if (!sourceModel || !targetModel) {
      continue;
    }

    const sourceOutputPort = sourceModel.outputs.find((port) => port.id === link.from.portId);
    const sourceInputPort = sourceModel.inputs.find((port) => port.id === link.from.portId);

    if (!sourceOutputPort && sourceInputPort) {
      issues.push({
        code: 'invalid-link-direction',
        message: `Leaf link "${link.id}" source port "${link.from.portId}" on node "${link.from.nodeId}" is not an output port.`,
      });
    } else if (!sourceOutputPort) {
      issues.push({
        code: 'missing-link-port',
        message: `Leaf link "${link.id}" references missing source port "${link.from.portId}" on node "${link.from.nodeId}".`,
      });
    }

    const targetInputPort = targetModel.inputs.find((port) => port.id === link.to.portId);
    const targetOutputPort = targetModel.outputs.find((port) => port.id === link.to.portId);

    if (!targetInputPort && targetOutputPort) {
      issues.push({
        code: 'invalid-link-direction',
        message: `Leaf link "${link.id}" target port "${link.to.portId}" on node "${link.to.nodeId}" is not an input port.`,
      });
    } else if (!targetInputPort) {
      issues.push({
        code: 'missing-link-port',
        message: `Leaf link "${link.id}" references missing target port "${link.to.portId}" on node "${link.to.nodeId}".`,
      });
    }

    if (!sourceOutputPort || !targetInputPort) {
      continue;
    }

    if (!compareSignalDefinitions(sourceOutputPort.signal, targetInputPort.signal)) {
      issues.push({
        code: 'mismatched-link-signal',
        message: `Leaf link "${link.id}" connects incompatible signals "${sourceOutputPort.signal.id}" and "${targetInputPort.signal.id}".`,
      });
    }
  }

  return issues;
};

export const assertValidGraphIRDocument = (
  document: GraphIRDocument
): asserts document is ValidatedGraphIRDocument => {
  const issues = validateGraphIRDocument(document);
  if (issues.length > 0) {
    throw new GraphIRValidationError(issues);
  }
};

export const collectLeafNodes = (nodes: TopologyNode[]): Array<NeuronNode | SignalNode> => {
  const leaves: Array<NeuronNode | SignalNode> = [];

  const visit = (candidates: TopologyNode[]): void => {
    for (const candidate of candidates) {
      if (candidate.kind === 'neuron' || candidate.kind === 'signal') {
        leaves.push(candidate);
        continue;
      }

      visit(candidate.children);
    }
  };

  visit(nodes);
  return leaves;
};

export const collectSignalNodes = (
  nodes: TopologyNode[],
  direction?: 'input' | 'output'
): SignalNode[] =>
  collectLeafNodes(nodes).filter(
    (node): node is SignalNode =>
      node.kind === 'signal' && (direction === undefined || node.direction === direction)
  );

export const collectNeuronNodes = (nodes: TopologyNode[]): NeuronNode[] =>
  collectLeafNodes(nodes).filter((node): node is NeuronNode => node.kind === 'neuron');

export const summarizeGraphIRDocument = (document: GraphIRDocument): GraphIRDocumentSummary => ({
  inputSignalCount: collectSignalNodes(document.root.children, 'input').length,
  outputSignalCount: collectSignalNodes(document.root.children, 'output').length,
  neuronCount: collectNeuronNodes(document.root.children).length,
  leafLinkCount: document.root.links.length,
});
