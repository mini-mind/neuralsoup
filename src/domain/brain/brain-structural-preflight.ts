import type { BrainContainerChildRef, BrainContainerNode, BrainIR, BrainNeuronNode } from './agent-ir';

export type BrainStructuralIssueCode =
  | 'missing-root-container'
  | 'duplicate-node-id'
  | 'missing-child-ref'
  | 'multiple-container-ownership'
  | 'container-cycle'
  | 'unreachable-container';

export interface BrainStructuralIssue {
  code: BrainStructuralIssueCode;
  message: string;
  nodeId?: string;
  containerId?: string;
  ownerContainerId?: string;
  conflictingOwnerContainerId?: string;
  childScope?: BrainContainerChildRef['scope'];
}

export interface BrainStructuralPreflight {
  ok: boolean;
  issues: BrainStructuralIssue[];
  rootContainer: BrainContainerNode | null;
  neuronById: Map<string, BrainNeuronNode>;
  containerById: Map<string, BrainContainerNode>;
  childRefsByContainerId: Map<string, BrainContainerChildRef[]>;
  ownerContainerIdByNodeId: Map<string, string>;
  reachableContainerIds: Set<string>;
  unreachableContainerIds: Set<string>;
  cycleContainerIds: Set<string>;
}

const CHILD_TARGET_SCOPE_LABEL: Record<BrainContainerChildRef['scope'], string> = {
  brain: 'neuron',
  container: 'container',
};

const getChildTargetKey = (childRef: BrainContainerChildRef) => `${childRef.scope}:${childRef.nodeId}`;

const getIssueKey = (issue: BrainStructuralIssue) =>
  [
    issue.code,
    issue.nodeId ?? '',
    issue.containerId ?? '',
    issue.ownerContainerId ?? '',
    issue.conflictingOwnerContainerId ?? '',
    issue.childScope ?? '',
  ].join('|');

export const preflightBrainStructure = (brain: BrainIR): BrainStructuralPreflight => {
  const issues: BrainStructuralIssue[] = [];
  const seenIssueKeys = new Set<string>();
  const neuronById = new Map<string, BrainNeuronNode>();
  const containerById = new Map<string, BrainContainerNode>();
  const ownerContainerIdByNodeId = new Map<string, string>();
  const childRefsByContainerId = new Map<string, BrainContainerChildRef[]>();
  const validContainerChildIdsByContainerId = new Map<string, string[]>();
  const reachableContainerIds = new Set<string>();
  const cycleContainerIds = new Set<string>();
  const globalNodeIdKindById = new Map<string, 'neuron' | 'container'>();

  const pushIssue = (issue: BrainStructuralIssue) => {
    const key = getIssueKey(issue);
    if (seenIssueKeys.has(key)) {
      return;
    }

    seenIssueKeys.add(key);
    issues.push(issue);
  };

  const registerNodeId = (nodeId: string, kind: 'neuron' | 'container') => {
    const existingKind = globalNodeIdKindById.get(nodeId);
    if (existingKind) {
      pushIssue({
        code: 'duplicate-node-id',
        nodeId,
        message:
          existingKind === kind
            ? `Duplicate ${kind} id "${nodeId}" detected.`
            : `Duplicate node id "${nodeId}" is shared by a ${existingKind} and a ${kind}.`,
      });
      return;
    }

    globalNodeIdKindById.set(nodeId, kind);
  };

  for (const neuron of brain.neurons) {
    registerNodeId(neuron.id, 'neuron');
    if (!neuronById.has(neuron.id)) {
      neuronById.set(neuron.id, neuron);
    }
  }

  const canonicalContainers: BrainContainerNode[] = [];
  for (const container of brain.containers) {
    registerNodeId(container.id, 'container');
    if (containerById.has(container.id)) {
      continue;
    }

    containerById.set(container.id, container);
    canonicalContainers.push(container);
  }

  for (const container of canonicalContainers) {
    const canonicalChildren: BrainContainerChildRef[] = [];
    const localChildKeys = new Set<string>();
    const validContainerChildIds: string[] = [];

    for (const childRef of container.children) {
      const targetExists =
        childRef.scope === 'brain' ? neuronById.has(childRef.nodeId) : containerById.has(childRef.nodeId);
      if (!targetExists) {
        pushIssue({
          code: 'missing-child-ref',
          containerId: container.id,
          nodeId: childRef.nodeId,
          childScope: childRef.scope,
          message: `Container "${container.id}" references missing ${CHILD_TARGET_SCOPE_LABEL[childRef.scope]} "${childRef.nodeId}".`,
        });
        continue;
      }

      if (childRef.scope === 'container') {
        validContainerChildIds.push(childRef.nodeId);
      }

      const childKey = getChildTargetKey(childRef);
      if (localChildKeys.has(childKey)) {
        continue;
      }
      localChildKeys.add(childKey);

      if (childRef.scope === 'container' && childRef.nodeId === brain.rootContainerId) {
        canonicalChildren.push(childRef);
        continue;
      }

      const existingOwnerContainerId = ownerContainerIdByNodeId.get(childRef.nodeId);
      if (existingOwnerContainerId && existingOwnerContainerId !== container.id) {
        pushIssue({
          code: 'multiple-container-ownership',
          nodeId: childRef.nodeId,
          containerId: container.id,
          ownerContainerId: existingOwnerContainerId,
          conflictingOwnerContainerId: container.id,
          childScope: childRef.scope,
          message: `Node "${childRef.nodeId}" is owned by both "${existingOwnerContainerId}" and "${container.id}".`,
        });
        continue;
      }

      if (!existingOwnerContainerId) {
        ownerContainerIdByNodeId.set(childRef.nodeId, container.id);
      }

      canonicalChildren.push(childRef);
    }

    childRefsByContainerId.set(container.id, canonicalChildren);
    validContainerChildIdsByContainerId.set(container.id, validContainerChildIds);
  }

  const cycleEdgeKeys = new Set<string>();
  const visitStateByContainerId = new Map<string, 0 | 1 | 2>();
  const traversalTrail: string[] = [];

  const visitContainerForCycles = (containerId: string) => {
    visitStateByContainerId.set(containerId, 1);
    traversalTrail.push(containerId);

    for (const childContainerId of validContainerChildIdsByContainerId.get(containerId) ?? []) {
      const childState = visitStateByContainerId.get(childContainerId) ?? 0;
      if (childState === 0) {
        visitContainerForCycles(childContainerId);
        continue;
      }

      if (childState !== 1) {
        continue;
      }

      const cycleStartIndex = traversalTrail.indexOf(childContainerId);
      const cyclePath = cycleStartIndex >= 0 ? traversalTrail.slice(cycleStartIndex) : [childContainerId];
      for (const cycleContainerId of cyclePath) {
        cycleContainerIds.add(cycleContainerId);
      }

      const cycleEdgeKey = `${containerId}->${childContainerId}`;
      if (cycleEdgeKeys.has(cycleEdgeKey)) {
        continue;
      }

      cycleEdgeKeys.add(cycleEdgeKey);
      pushIssue({
        code: 'container-cycle',
        containerId,
        nodeId: childContainerId,
        childScope: 'container',
        message: `Container cycle detected: ${[...cyclePath, childContainerId].join(' -> ')}.`,
      });
    }

    traversalTrail.pop();
    visitStateByContainerId.set(containerId, 2);
  };

  for (const container of canonicalContainers) {
    if ((visitStateByContainerId.get(container.id) ?? 0) === 0) {
      visitContainerForCycles(container.id);
    }
  }

  const rootContainer = containerById.get(brain.rootContainerId) ?? null;
  if (!rootContainer) {
    pushIssue({
      code: 'missing-root-container',
      nodeId: brain.rootContainerId,
      message: `Root container "${brain.rootContainerId}" is missing.`,
    });
  } else {
    const stack = [rootContainer.id];
    while (stack.length > 0) {
      const containerId = stack.pop()!;
      if (reachableContainerIds.has(containerId)) {
        continue;
      }

      reachableContainerIds.add(containerId);
      for (const childRef of childRefsByContainerId.get(containerId) ?? []) {
        if (childRef.scope === 'container') {
          stack.push(childRef.nodeId);
        }
      }
    }
  }

  const unreachableContainerIds = new Set<string>();
  for (const container of canonicalContainers) {
    if (reachableContainerIds.has(container.id)) {
      continue;
    }

    unreachableContainerIds.add(container.id);
    pushIssue({
      code: 'unreachable-container',
      containerId: container.id,
      nodeId: container.id,
      message: `Container "${container.id}" is unreachable from root "${brain.rootContainerId}".`,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    rootContainer,
    neuronById,
    containerById,
    childRefsByContainerId,
    ownerContainerIdByNodeId,
    reachableContainerIds,
    unreachableContainerIds,
    cycleContainerIds,
  };
};
