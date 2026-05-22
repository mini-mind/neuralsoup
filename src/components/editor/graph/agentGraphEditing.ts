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
    version: 1,
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

export interface AggregateAgentNodesInput {
  parentContainerId: string;
  selectedNodeIds: string[];
  nextGroupId: string;
  nextGroupLabel: string;
  nextGroupPosition: Position;
  childPositionsById: Record<string, Position>;
}

export const aggregateAgentNodesIntoGroup = (
  agent: AgentIR,
  {
    parentContainerId,
    selectedNodeIds,
    nextGroupId,
    nextGroupLabel,
    nextGroupPosition,
    childPositionsById,
  }: AggregateAgentNodesInput
): AgentIR => {
  const selectedNodeIdSet = new Set(selectedNodeIds);
  const parentContainer = agent.brain.containers.find((container) => container.id === parentContainerId);
  if (!parentContainer) {
    return agent;
  }

  const selectedChildren = parentContainer.children.filter((child) => selectedNodeIdSet.has(child.nodeId));
  if (selectedChildren.length < 2) {
    return agent;
  }

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
          children: selectedChildren.map((child) => ({ ...child })),
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
};

export const ungroupAgentContainer = (
  agent: AgentIR,
  parentContainerId: string,
  targetGroupId: string
): AgentIR => {
  const parentContainer = agent.brain.containers.find((container) => container.id === parentContainerId);
  const targetContainer = agent.brain.containers.find((container) => container.id === targetGroupId);
  if (!parentContainer || !targetContainer) {
    return agent;
  }

  const targetIndex = parentContainer.children.findIndex(
    (child) => child.scope === 'container' && child.nodeId === targetGroupId
  );
  if (targetIndex < 0) {
    return agent;
  }

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
};

export interface CreateNeuronAndConnectInput {
  parentContainerId: string;
  nextNeuronId: string;
  nextNeuronLabel: string;
  nextNeuronPosition: Position;
  connections: AgentIR['connections'];
}

export const createNeuronAndConnectInContainer = (
  agent: AgentIR,
  {
    parentContainerId,
    nextNeuronId,
    nextNeuronLabel,
    nextNeuronPosition,
    connections,
  }: CreateNeuronAndConnectInput
): AgentIR => {
  const parentContainer = agent.brain.containers.find((container) => container.id === parentContainerId);
  if (!parentContainer) {
    return agent;
  }

  let nextAgent: AgentIR = {
    ...agent,
    brain: {
      ...agent.brain,
      neurons: [
        ...agent.brain.neurons,
        {
          id: nextNeuronId,
          label: nextNeuronLabel,
          model: 'izhikevich',
          params: {
            a: 0.02,
            b: 0.2,
            c: -65,
            d: 8,
            threshold: 30,
          },
          initialState: {
            v: -65,
          },
        },
      ],
      containers: updateBrainContainerById(agent.brain.containers, parentContainerId, (container) => ({
        ...container,
        children: [...container.children, { scope: 'brain', nodeId: nextNeuronId }],
      })),
    },
    connections: [...agent.connections, ...connections],
  };

  nextAgent = withLayoutNodePosition(nextAgent, nextNeuronId, nextNeuronPosition);
  return nextAgent;
};
