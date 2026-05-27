export interface GraphLinkPolicyNode {
  refNodeId: string;
  kind: 'adapter' | 'neuron-group' | 'neuron' | 'signal';
  leaf: boolean;
  proxy: boolean;
  local: boolean;
  previewOnly?: boolean;
  rootExpandedProjection?: boolean;
  direction: 'input' | 'output' | 'internal';
}

export interface GraphLinkCapabilities {
  canSource: boolean;
  canTarget: boolean;
}

export const getGraphLinkCapabilities = (
  node: GraphLinkPolicyNode,
  currentScope: 'root' | 'child'
): GraphLinkCapabilities => {
  const interactiveLeaf =
    node.leaf &&
    node.local &&
    (currentScope === 'child' || currentScope === 'root' || node.rootExpandedProjection === true) &&
    node.previewOnly !== true;
  if (!interactiveLeaf) {
    return {
      canSource: false,
      canTarget: false,
    };
  }

  if (node.proxy) {
    return {
      canSource: node.direction === 'input',
      canTarget: node.direction === 'output',
    };
  }

  if (node.kind === 'neuron') {
    return {
      canSource: true,
      canTarget: true,
    };
  }

  if (node.kind === 'signal') {
    return {
      canSource: node.direction === 'input',
      canTarget: node.direction === 'output',
    };
  }

  return {
    canSource: false,
    canTarget: false,
  };
};

export const canGraphNodeInitiateLink = (
  node: GraphLinkPolicyNode,
  currentScope: 'root' | 'child'
) => getGraphLinkCapabilities(node, currentScope).canSource;

export const canGraphNodeReceiveLink = (
  node: GraphLinkPolicyNode,
  currentScope: 'root' | 'child'
) => getGraphLinkCapabilities(node, currentScope).canTarget;

export const canGraphNodesConnect = ({
  sourceNode,
  targetNode,
  currentScope,
  localLeafIds,
}: {
  sourceNode: GraphLinkPolicyNode;
  targetNode: GraphLinkPolicyNode;
  currentScope: 'root' | 'child';
  localLeafIds: Set<string>;
}) => {
  if (!canGraphNodeInitiateLink(sourceNode, currentScope)) {
    return false;
  }

  if (!canGraphNodeReceiveLink(targetNode, currentScope)) {
    return false;
  }

  if (sourceNode.refNodeId === targetNode.refNodeId) {
    return false;
  }

  const sourceIsLocalLeaf = localLeafIds.has(sourceNode.refNodeId);
  const targetIsLocalLeaf = localLeafIds.has(targetNode.refNodeId);

  return sourceIsLocalLeaf || targetIsLocalLeaf;
};
