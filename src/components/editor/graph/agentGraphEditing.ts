import { collectAgentSignalNodeIds } from '../../../domain/brain';
import type { AgentIR, BrainContainerNode, Position } from '../../../domain/brain';

const updateBrainContainerById = (
  containers: BrainContainerNode[],
  containerId: string,
  updater: (container: BrainContainerNode) => BrainContainerNode
): BrainContainerNode[] =>
  containers.map((container) => (container.id === containerId ? updater(container) : container));

const withLayoutNodePosition = (agent: AgentIR, nodeId: string, position: Position): AgentIR => ({
  ...agent,
  layout: {
    ...(agent.layout ?? {}),
    nodes: {
      ...(agent.layout?.nodes ?? {}),
      [nodeId]: {
        ...(agent.layout?.nodes[nodeId] ?? {}),
        position,
      },
    },
  },
});

export type AgentGraphEditingIssueCode =
  | 'missing-root-container'
  | 'missing-parent-container'
  | 'missing-target-container'
  | 'duplicate-node-id'
  | 'missing-node-reference'
  | 'insufficient-selection'
  | 'child-not-owned-by-parent'
  | 'multiple-owners'
  | 'root-has-parent'
  | 'orphan-container'
  | 'cycle-detected'
  | 'unreachable-container'
  | 'missing-neuron-model-id'
  | 'missing-synapse-model-id';

export interface AgentGraphEditingIssue {
  code: AgentGraphEditingIssueCode;
  message: string;
}

export type AgentGraphEditingResult =
  | {
      ok: true;
      agent: AgentIR;
    }
  | {
      ok: false;
      reason: AgentGraphEditingIssueCode;
      issues: AgentGraphEditingIssue[];
    };

const acceptAgentGraphEdit = (agent: AgentIR): AgentGraphEditingResult => ({
  ok: true,
  agent,
});

const rejectAgentGraphEdit = (issues: AgentGraphEditingIssue[]): AgentGraphEditingResult => ({
  ok: false,
  reason: issues[0].code,
  issues,
});

const createAgentGraphEditingIssue = (
  code: AgentGraphEditingIssueCode,
  message: string
): AgentGraphEditingIssue => ({
  code,
  message,
});

const hasBrainNodeIdCollision = (agent: AgentIR, nodeId: string): boolean =>
  agent.brain.neurons.some((neuron) => neuron.id === nodeId) ||
  agent.brain.containers.some((container) => container.id === nodeId);

const DEFAULT_NEURON_PARAMETER_OVERRIDES = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
} as const;

const DEFAULT_CONNECTION_PARAMETER_OVERRIDES = {
  weight: 0.8,
  delayMs: 0,
} as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const resolveFirstNeuronModelId = (agent: AgentIR): string | null => {
  const firstModel = agent.brain.neuronModels?.find((model) => isNonEmptyString(model.id));
  return firstModel ? firstModel.id : null;
};

const resolveFirstSynapseModelId = (agent: AgentIR): string | null => {
  const firstModel = agent.brain.synapseModels?.find((model) => isNonEmptyString(model.id));
  return firstModel ? firstModel.id : null;
};

const collectBrainStructureIssues = (agent: AgentIR): AgentGraphEditingIssue[] => {
  const issues: AgentGraphEditingIssue[] = [];
  const neuronIds = new Set<string>();
  const containerIds = new Set<string>();
  const signalNodeIds = collectAgentSignalNodeIds(agent);
  const neuronOwners = new Map<string, string[]>();
  const signalOwners = new Map<string, string[]>();
  const containerOwners = new Map<string, string[]>();
  const containersById = new Map<string, BrainContainerNode>();

  for (const neuron of agent.brain.neurons) {
    if (neuronIds.has(neuron.id)) {
      issues.push(
        createAgentGraphEditingIssue('duplicate-node-id', `Brain neuron id "${neuron.id}" is duplicated.`)
      );
      continue;
    }

    neuronIds.add(neuron.id);
  }

  for (const container of agent.brain.containers) {
    if (neuronIds.has(container.id)) {
      issues.push(
        createAgentGraphEditingIssue(
          'duplicate-node-id',
          `Brain container id "${container.id}" collides with neuron id "${container.id}".`
        )
      );
      continue;
    }

    if (containerIds.has(container.id)) {
      issues.push(
        createAgentGraphEditingIssue('duplicate-node-id', `Brain container id "${container.id}" is duplicated.`)
      );
      continue;
    }

    containerIds.add(container.id);
    containersById.set(container.id, container);
  }

  if (!containerIds.has(agent.brain.rootContainerId)) {
    issues.push(
      createAgentGraphEditingIssue(
        'missing-root-container',
        `Brain root container "${agent.brain.rootContainerId}" is missing.`
      )
    );
  }

  for (const container of agent.brain.containers) {
    for (const child of container.children) {
      if (child.scope === 'brain') {
        if (!neuronIds.has(child.nodeId)) {
          issues.push(
            createAgentGraphEditingIssue(
              'missing-node-reference',
              `Brain container "${container.id}" references missing neuron "${child.nodeId}".`
            )
          );
          continue;
        }

        const owners = neuronOwners.get(child.nodeId) ?? [];
        owners.push(container.id);
        neuronOwners.set(child.nodeId, owners);
        continue;
      }

      if (child.scope === 'signal') {
        if (!signalNodeIds.has(child.nodeId)) {
          issues.push(
            createAgentGraphEditingIssue(
              'missing-node-reference',
              `Brain container "${container.id}" references missing signal "${child.nodeId}".`
            )
          );
          continue;
        }

        const owners = signalOwners.get(child.nodeId) ?? [];
        owners.push(container.id);
        signalOwners.set(child.nodeId, owners);
        continue;
      }

      if (!containerIds.has(child.nodeId)) {
        issues.push(
          createAgentGraphEditingIssue(
            'missing-node-reference',
            `Brain container "${container.id}" references missing child container "${child.nodeId}".`
          )
        );
        continue;
      }

      const owners = containerOwners.get(child.nodeId) ?? [];
      owners.push(container.id);
      containerOwners.set(child.nodeId, owners);
    }
  }

  for (const neuronId of neuronIds) {
    const owners = neuronOwners.get(neuronId) ?? [];
    if (owners.length === 0) {
      issues.push(
        createAgentGraphEditingIssue(
          'multiple-owners',
          `Brain neuron "${neuronId}" is not attached to any container.`
        )
      );
      continue;
    }

    if (owners.length > 1) {
      issues.push(
        createAgentGraphEditingIssue(
          'multiple-owners',
          `Brain neuron "${neuronId}" is attached to multiple containers: ${owners.join(', ')}.`
        )
      );
    }
  }

  for (const signalNodeId of signalNodeIds) {
    const owners = signalOwners.get(signalNodeId) ?? [];
    if (owners.length > 1) {
      issues.push(
        createAgentGraphEditingIssue(
          'multiple-owners',
          `Signal "${signalNodeId}" is attached to multiple containers: ${owners.join(', ')}.`
        )
      );
    }
  }

  for (const containerId of containerIds) {
    const owners = containerOwners.get(containerId) ?? [];
    if (containerId === agent.brain.rootContainerId) {
      if (owners.length > 0) {
        issues.push(
          createAgentGraphEditingIssue(
            'root-has-parent',
            `Brain root container "${containerId}" cannot be nested under another container.`
          )
        );
      }
      continue;
    }

    if (owners.length === 0) {
      issues.push(
        createAgentGraphEditingIssue(
          'orphan-container',
          `Brain container "${containerId}" is not attached to any parent container.`
        )
      );
      continue;
    }

    if (owners.length > 1) {
      issues.push(
        createAgentGraphEditingIssue(
          'multiple-owners',
          `Brain container "${containerId}" is attached to multiple parent containers: ${owners.join(', ')}.`
        )
      );
    }
  }

  const visitState = new Map<string, 'visiting' | 'visited'>();
  const visitContainer = (containerId: string, path: string[]): void => {
    const state = visitState.get(containerId);
    if (state === 'visiting') {
      issues.push(
        createAgentGraphEditingIssue('cycle-detected', `Brain container cycle detected: ${[...path, containerId].join(' -> ')}.`)
      );
      return;
    }

    if (state === 'visited') {
      return;
    }

    const container = containersById.get(containerId);
    if (!container) {
      return;
    }

    visitState.set(containerId, 'visiting');
    for (const child of container.children) {
      if (child.scope === 'container') {
        visitContainer(child.nodeId, [...path, containerId]);
      }
    }
    visitState.set(containerId, 'visited');
  };

  if (containerIds.has(agent.brain.rootContainerId)) {
    visitContainer(agent.brain.rootContainerId, []);
  }

  for (const containerId of containerIds) {
    if (!visitState.has(containerId)) {
      issues.push(
        createAgentGraphEditingIssue(
          'unreachable-container',
          `Brain container "${containerId}" is unreachable from root container "${agent.brain.rootContainerId}".`
        )
      );
    }
  }

  return issues;
};

const validateAgentGraphEdit = (
  agent: AgentIR,
  buildNextAgent: () => AgentIR,
  preconditions: AgentGraphEditingIssue[] = []
): AgentGraphEditingResult => {
  const currentIssues = collectBrainStructureIssues(agent);
  if (currentIssues.length > 0) {
    return rejectAgentGraphEdit(currentIssues);
  }

  if (preconditions.length > 0) {
    return rejectAgentGraphEdit(preconditions);
  }

  const nextAgent = buildNextAgent();
  const nextIssues = collectBrainStructureIssues(nextAgent);
  if (nextIssues.length > 0) {
    return rejectAgentGraphEdit(nextIssues);
  }

  return acceptAgentGraphEdit(nextAgent);
};

export interface AggregateAgentNodesInput {
  parentContainerId: string;
  selectedNodeIds: string[];
  nextGroupId: string;
  nextGroupLabel: string;
  nextGroupPosition: Position;
  childPositionsById: Record<string, Position>;
  signalNodeIds?: Iterable<string>;
}

const createChildRefForAggregateSelection = (nodeId: string, signalNodeIds: Set<string>) =>
  signalNodeIds.has(nodeId)
    ? ({ scope: 'signal' as const, nodeId })
    : ({ scope: 'brain' as const, nodeId });

export const tryAggregateAgentNodesIntoGroup = (
  agent: AgentIR,
  {
    parentContainerId,
    selectedNodeIds,
    nextGroupId,
    nextGroupLabel,
    nextGroupPosition,
    childPositionsById,
    signalNodeIds = [],
  }: AggregateAgentNodesInput
): AgentGraphEditingResult => {
  const parentContainer = agent.brain.containers.find((container) => container.id === parentContainerId);
  if (!parentContainer) {
    return rejectAgentGraphEdit([
      createAgentGraphEditingIssue(
        'missing-parent-container',
        `Cannot aggregate nodes into missing parent container "${parentContainerId}".`
      ),
    ]);
  }

  const selectedNodeIdsUnique = [...new Set(selectedNodeIds)];
  const preconditions: AgentGraphEditingIssue[] = [];
  if (selectedNodeIdsUnique.length < 2) {
    preconditions.push(
      createAgentGraphEditingIssue('insufficient-selection', 'Cannot aggregate fewer than two selected child nodes.')
    );
  }

  const parentChildIds = new Set(parentContainer.children.map((child) => child.nodeId));
  const signalNodeIdSet = new Set(signalNodeIds);
  const missingSelectedNodeId = selectedNodeIdsUnique.find(
    (nodeId) => !parentChildIds.has(nodeId) && !signalNodeIdSet.has(nodeId)
  );
  if (missingSelectedNodeId) {
    preconditions.push(
      createAgentGraphEditingIssue(
        'child-not-owned-by-parent',
        `Cannot aggregate node "${missingSelectedNodeId}" because it is not a child of container "${parentContainerId}".`
      )
    );
  }

  if (hasBrainNodeIdCollision(agent, nextGroupId)) {
    preconditions.push(
      createAgentGraphEditingIssue(
        'duplicate-node-id',
        `Cannot create group "${nextGroupId}" because that brain node id already exists.`
      )
    );
  }

  const selectedNodeIdSet = new Set(selectedNodeIdsUnique);
  return validateAgentGraphEdit(agent, () => {
    const selectedChildren = selectedNodeIdsUnique
      .map((nodeId) => parentContainer.children.find((child) => child.nodeId === nodeId) ?? createChildRefForAggregateSelection(nodeId, signalNodeIdSet))
      .filter((child): child is BrainContainerNode['children'][number] => child != null);
    const nextParentChildren: BrainContainerNode['children'] = [];
    let inserted = false;
    for (const child of parentContainer.children) {
      if (selectedNodeIdSet.has(child.nodeId)) {
        if (!inserted) {
          nextParentChildren.push({ scope: 'container', nodeId: nextGroupId });
          inserted = true;
        }
        continue;
      }

      nextParentChildren.push(child);
    }

    let nextAgent: AgentIR = {
      ...agent,
      brain: {
        ...agent.brain,
        containers: [
          ...updateBrainContainerById(agent.brain.containers, parentContainerId, (container) => ({
            ...container,
            children: nextParentChildren,
          })),
          {
            id: nextGroupId,
            label: nextGroupLabel,
            children: selectedChildren.map((child) => ({
              ...(child.scope === 'brain' || child.scope === 'container'
                ? child
                : signalNodeIdSet.has(child.nodeId)
                  ? { scope: 'signal' as const, nodeId: child.nodeId }
                  : child),
            })),
          },
        ],
      },
    };

    nextAgent = withLayoutNodePosition(nextAgent, nextGroupId, nextGroupPosition);
    for (const child of selectedChildren) {
      const childPosition = childPositionsById[child.nodeId];
      if (!childPosition) {
        continue;
      }

      nextAgent = withLayoutNodePosition(nextAgent, child.nodeId, childPosition);
    }

    return nextAgent;
  }, preconditions);
};

export const aggregateAgentNodesIntoGroup = (agent: AgentIR, input: AggregateAgentNodesInput): AgentIR => {
  const result = tryAggregateAgentNodesIntoGroup(agent, input);
  return result.ok ? result.agent : agent;
};

export const tryUngroupAgentContainer = (
  agent: AgentIR,
  parentContainerId: string,
  targetGroupId: string
): AgentGraphEditingResult => {
  const parentContainer = agent.brain.containers.find((container) => container.id === parentContainerId);
  if (!parentContainer) {
    return rejectAgentGraphEdit([
      createAgentGraphEditingIssue(
        'missing-parent-container',
        `Cannot ungroup from missing parent container "${parentContainerId}".`
      ),
    ]);
  }

  const targetContainer = agent.brain.containers.find((container) => container.id === targetGroupId);
  if (!targetContainer) {
    return rejectAgentGraphEdit([
      createAgentGraphEditingIssue(
        'missing-target-container',
        `Cannot ungroup missing target container "${targetGroupId}".`
      ),
    ]);
  }

  const targetIndex = parentContainer.children.findIndex(
    (child) => child.scope === 'container' && child.nodeId === targetGroupId
  );
  const preconditions =
    targetIndex < 0
      ? [
          createAgentGraphEditingIssue(
            'child-not-owned-by-parent',
            `Cannot ungroup container "${targetGroupId}" because it is not nested under "${parentContainerId}".`
          ),
        ]
      : [];

  return validateAgentGraphEdit(agent, () => {
    const nextParentChildren = [
      ...parentContainer.children.slice(0, targetIndex),
      ...targetContainer.children.map((child) => ({ ...child })),
      ...parentContainer.children.slice(targetIndex + 1),
    ];
    const targetGroupPosition = agent.layout?.nodes[targetGroupId]?.position ?? { x: 0, y: 0 };

    let nextAgent: AgentIR = {
      ...agent,
      brain: {
        ...agent.brain,
        containers: updateBrainContainerById(
          agent.brain.containers.filter((container) => container.id !== targetGroupId),
          parentContainerId,
          (container) => ({
            ...container,
            children: nextParentChildren,
          })
        ),
      },
      layout: agent.layout
        ? {
            ...agent.layout,
            nodes: Object.fromEntries(
              Object.entries(agent.layout.nodes).filter(([nodeId]) => nodeId !== targetGroupId)
            ),
          }
        : undefined,
    };

    for (const child of targetContainer.children) {
      const childPosition = nextAgent.layout?.nodes[child.nodeId]?.position ?? { x: 0, y: 0 };
      nextAgent = withLayoutNodePosition(nextAgent, child.nodeId, {
        x: targetGroupPosition.x + childPosition.x,
        y: targetGroupPosition.y + childPosition.y,
      });
    }

    return nextAgent;
  }, preconditions);
};

export const ungroupAgentContainer = (agent: AgentIR, parentContainerId: string, targetGroupId: string): AgentIR => {
  const result = tryUngroupAgentContainer(agent, parentContainerId, targetGroupId);
  return result.ok ? result.agent : agent;
};

export interface CreateNeuronAndConnectInput {
  parentContainerId: string;
  nextNeuronId: string;
  nextNeuronLabel: string;
  nextNeuronPosition: Position;
  connections: Array<
    Omit<AgentIR['connections'][number], 'synapseModelId'> & {
      synapseModelId?: string;
    }
  >;
  neuronModelId?: string;
  neuronParameterOverrides?: Record<string, number>;
  neuronInitialState?: {
    v: number;
    u?: number;
  };
}

export const tryCreateNeuronAndConnectInContainer = (
  agent: AgentIR,
  {
    parentContainerId,
    nextNeuronId,
    nextNeuronLabel,
    nextNeuronPosition,
    connections,
    neuronModelId,
    neuronParameterOverrides,
    neuronInitialState,
  }: CreateNeuronAndConnectInput
): AgentGraphEditingResult => {
  const parentContainer = agent.brain.containers.find((container) => container.id === parentContainerId);
  if (!parentContainer) {
    return rejectAgentGraphEdit([
      createAgentGraphEditingIssue(
        'missing-parent-container',
        `Cannot create neuron inside missing parent container "${parentContainerId}".`
      ),
    ]);
  }

  const resolvedNeuronModelId = neuronModelId?.trim() || resolveFirstNeuronModelId(agent);
  const resolvedSynapseModelId = resolveFirstSynapseModelId(agent);
  const neuronModelIdExplicitlyProvided = neuronModelId !== undefined;
  const neuronModelIdInvalidWhenProvided = neuronModelIdExplicitlyProvided && !isNonEmptyString(neuronModelId);
  const preconditions: AgentGraphEditingIssue[] = [];
  if (neuronModelIdInvalidWhenProvided) {
    preconditions.push(
      createAgentGraphEditingIssue(
        'missing-neuron-model-id',
        `Cannot create neuron "${nextNeuronId}" because the provided neuron model id is empty or invalid.`
      )
    );
  }
  if (hasBrainNodeIdCollision(agent, nextNeuronId)) {
    preconditions.push(
      createAgentGraphEditingIssue(
        'duplicate-node-id',
        `Cannot create neuron "${nextNeuronId}" because that brain node id already exists.`
      )
    );
  }
  if (!resolvedNeuronModelId) {
    preconditions.push(
      createAgentGraphEditingIssue(
        'missing-neuron-model-id',
        `Cannot create neuron "${nextNeuronId}" because no valid neuron model id is available.`
      )
    );
  }
  if (connections.length > 0 && !resolvedSynapseModelId) {
    preconditions.push(
      createAgentGraphEditingIssue(
        'missing-synapse-model-id',
        `Cannot create connections for neuron "${nextNeuronId}" because no valid synapse model id is available.`
      )
    );
  }

  return validateAgentGraphEdit(agent, () => {
    const safeNeuronModelId = resolvedNeuronModelId as string;
    const safeSynapseModelId = resolvedSynapseModelId as string;
    const nextInitialState = neuronInitialState ?? {
      v: -65,
    };
    let nextAgent: AgentIR = {
      ...agent,
      brain: {
        ...agent.brain,
        neurons: [
          ...agent.brain.neurons,
          {
            id: nextNeuronId,
            label: nextNeuronLabel,
            neuronModelId: safeNeuronModelId,
            parameterOverrides: {
              ...(neuronParameterOverrides ?? DEFAULT_NEURON_PARAMETER_OVERRIDES),
            },
            initialState: nextInitialState,
          },
        ],
        containers: updateBrainContainerById(agent.brain.containers, parentContainerId, (container) => ({
          ...container,
          children: [...container.children, { scope: 'brain', nodeId: nextNeuronId }],
        })),
      },
      connections: [
        ...agent.connections,
        ...connections.map((connection) => {
          const mergedOverrides: Record<string, number> = {
            ...DEFAULT_CONNECTION_PARAMETER_OVERRIDES,
            ...((connection.parameterOverrides as Record<string, number> | undefined) ?? {}),
          };
          return {
            ...connection,
            synapseModelId: safeSynapseModelId,
            parameterOverrides: mergedOverrides,
          };
        }),
      ],
    };

    nextAgent = withLayoutNodePosition(nextAgent, nextNeuronId, nextNeuronPosition);
    return nextAgent;
  }, preconditions);
};

export const createNeuronAndConnectInContainer = (agent: AgentIR, input: CreateNeuronAndConnectInput): AgentIR => {
  const result = tryCreateNeuronAndConnectInContainer(agent, input);
  return result.ok ? result.agent : agent;
};

export interface ReparentAgentNodeInput {
  nodeId: string;
  fromContainerId: string;
  toContainerId: string;
  nextPosition?: Position;
  signalNodeIds?: Iterable<string>;
}

const isContainerAncestorOf = (
  containersById: Map<string, BrainContainerNode>,
  ancestorId: string,
  targetContainerId: string
): boolean => {
  const target = containersById.get(targetContainerId);
  if (!target) {
    return false;
  }

  for (const child of target.children) {
    if (child.scope !== 'container') {
      continue;
    }
    if (child.nodeId === ancestorId) {
      return true;
    }
    if (isContainerAncestorOf(containersById, ancestorId, child.nodeId)) {
      return true;
    }
  }

  return false;
};

export const tryReparentAgentNode = (
  agent: AgentIR,
  { nodeId, fromContainerId, toContainerId, nextPosition, signalNodeIds = [] }: ReparentAgentNodeInput
): AgentGraphEditingResult => {
  const fromContainer = agent.brain.containers.find((container) => container.id === fromContainerId);
  if (!fromContainer) {
    return rejectAgentGraphEdit([
      createAgentGraphEditingIssue(
        'missing-parent-container',
        `Cannot move node "${nodeId}" from missing container "${fromContainerId}".`
      ),
    ]);
  }

  const toContainer = agent.brain.containers.find((container) => container.id === toContainerId);
  if (!toContainer) {
    return rejectAgentGraphEdit([
      createAgentGraphEditingIssue(
        'missing-target-container',
        `Cannot move node "${nodeId}" into missing container "${toContainerId}".`
      ),
    ]);
  }

  const signalNodeIdSet = new Set(signalNodeIds);
  const movingChild =
    fromContainer.children.find((child) => child.nodeId === nodeId) ??
    (signalNodeIdSet.has(nodeId) ? { scope: 'signal' as const, nodeId } : null);
  const preconditions: AgentGraphEditingIssue[] = [];
  if (!movingChild) {
    preconditions.push(
      createAgentGraphEditingIssue(
        'child-not-owned-by-parent',
        `Cannot move node "${nodeId}" because it is not owned by "${fromContainerId}".`
      )
    );
  }

  if (fromContainerId === toContainerId) {
    preconditions.push(
      createAgentGraphEditingIssue(
        'child-not-owned-by-parent',
        `Cannot move node "${nodeId}" into the same container "${toContainerId}".`
      )
    );
  }

  if (toContainer.children.some((child) => child.nodeId === nodeId)) {
    preconditions.push(
      createAgentGraphEditingIssue(
        'duplicate-node-id',
        `Cannot move node "${nodeId}" into "${toContainerId}" because it already owns that child reference.`
      )
    );
  }

  if (movingChild?.scope === 'container') {
    const containersById = new Map(agent.brain.containers.map((container) => [container.id, container]));
    if (nodeId === toContainerId || isContainerAncestorOf(containersById, toContainerId, nodeId)) {
      preconditions.push(
        createAgentGraphEditingIssue(
          'cycle-detected',
          `Cannot move container "${nodeId}" into descendant container "${toContainerId}".`
        )
      );
    }
  }

  if (preconditions.length > 0) {
    return rejectAgentGraphEdit(preconditions);
  }

  return validateAgentGraphEdit(agent, () => {
    let nextAgent: AgentIR = {
      ...agent,
      brain: {
        ...agent.brain,
        containers: updateBrainContainerById(
          updateBrainContainerById(agent.brain.containers, fromContainerId, (container) => ({
            ...container,
            children: container.children.filter((child) => child.nodeId !== nodeId),
          })),
          toContainerId,
          (container) => ({
            ...container,
            children: [...container.children, { ...(movingChild as NonNullable<typeof movingChild>) }],
          })
        ),
      },
    };

    if (nextPosition) {
      nextAgent = withLayoutNodePosition(nextAgent, nodeId, nextPosition);
    }

    return nextAgent;
  });
};

export const reparentAgentNode = (agent: AgentIR, input: ReparentAgentNodeInput): AgentIR => {
  const result = tryReparentAgentNode(agent, input);
  return result.ok ? result.agent : agent;
};
