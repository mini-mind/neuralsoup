import {
  type AgentIR,
  type AgentMetadata,
  type WorldRegistry,
  validateAgentIR,
} from '../domain/brain';

export interface BrainLibraryRecord {
  agent: AgentIR;
}

type AgentMetadataShape = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowedKeys.includes(key));

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const createAgentLibraryId = (): string => `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isCanonicalLayoutNodeState = (value: unknown): boolean =>
  isObject(value) &&
  hasOnlyKeys(value, ['position', 'collapsed']) &&
  (value.position === undefined ||
    (isObject(value.position) &&
      hasOnlyKeys(value.position, ['x', 'y']) &&
      isFiniteNumber(value.position.x) &&
      isFiniteNumber(value.position.y))) &&
  (value.collapsed === undefined || typeof value.collapsed === 'boolean');

const isCanonicalAgentMetadataShape = (value: unknown): value is AgentMetadataShape =>
  isAgentMetadata(value) &&
  hasOnlyKeys(value, ['id', 'name', 'description', 'tags', 'createdAt', 'updatedAt']) &&
  ((value as { description?: unknown }).description === undefined ||
    typeof (value as { description?: unknown }).description === 'string') &&
  ((value as { tags?: unknown[] }).tags === undefined ||
    (Array.isArray((value as { tags?: unknown[] }).tags) &&
      ((value as { tags?: unknown[] }).tags ?? []).every((tag) => typeof tag === 'string')));

const isCanonicalBodyInputEndpointShape = (value: unknown): boolean =>
  isObject(value) &&
  hasOnlyKeys(value, ['id', 'source', 'worldPort', 'scale']) &&
  typeof value.id === 'string' &&
  typeof value.source === 'string' &&
  (value.worldPort === undefined || typeof value.worldPort === 'string') &&
  isFiniteNumber(value.scale);

const isCanonicalBodyOutputEndpointShape = (value: unknown): boolean =>
  isObject(value) &&
  hasOnlyKeys(value, ['id', 'target', 'worldPort', 'decayPerSecond']) &&
  typeof value.id === 'string' &&
  typeof value.target === 'string' &&
  (value.worldPort === undefined || typeof value.worldPort === 'string') &&
  isFiniteNumber(value.decayPerSecond);

const isCanonicalBodyMappingShape = (value: unknown): boolean =>
  isObject(value) &&
  hasOnlyKeys(value, ['id', 'kind', 'endpointId', 'nodeId']) &&
  typeof value.id === 'string' &&
  (value.kind === 'input' || value.kind === 'output') &&
  typeof value.endpointId === 'string' &&
  typeof value.nodeId === 'string';

const isCanonicalAgentShape = (agent: unknown): boolean => {
  if (!isObject(agent)) {
    return false;
  }

  if (!hasOnlyKeys(agent, ['metadata', 'body', 'brain', 'connections', 'layout'])) {
    return false;
  }

  if (!isCanonicalAgentMetadataShape(agent.metadata)) {
    return false;
  }

  if (
    !isObject(agent.body) ||
    !hasOnlyKeys(agent.body, ['inputEndpoints', 'outputEndpoints', 'mappings']) ||
    !Array.isArray(agent.body.inputEndpoints) ||
    !agent.body.inputEndpoints.every((endpoint) => isCanonicalBodyInputEndpointShape(endpoint)) ||
    !Array.isArray(agent.body.outputEndpoints) ||
    !agent.body.outputEndpoints.every((endpoint) => isCanonicalBodyOutputEndpointShape(endpoint)) ||
    !Array.isArray(agent.body.mappings) ||
    !agent.body.mappings.every((mapping) => isCanonicalBodyMappingShape(mapping))
  ) {
    return false;
  }

  if (
    !isObject(agent.brain) ||
    !hasOnlyKeys(agent.brain, ['neuronModels', 'synapseModels', 'neurons', 'containers', 'rootContainerId']) ||
    typeof agent.brain.rootContainerId !== 'string' ||
    !Array.isArray(agent.brain.neuronModels) ||
    agent.brain.neuronModels.length < 1 ||
    !Array.isArray(agent.brain.synapseModels) ||
    agent.brain.synapseModels.length < 1 ||
    !Array.isArray(agent.brain.neurons) ||
    !Array.isArray(agent.brain.containers)
  ) {
    return false;
  }

  if (
    !agent.brain.neurons.every(
      (neuron) =>
        isObject(neuron) &&
        hasOnlyKeys(neuron, ['id', 'label', 'neuronModelId', 'parameterOverrides', 'initialState']) &&
        typeof neuron.id === 'string' &&
        (neuron.label === undefined || typeof neuron.label === 'string') &&
        typeof neuron.neuronModelId === 'string' &&
        neuron.neuronModelId.trim().length > 0 &&
        (neuron.parameterOverrides === undefined || isObject(neuron.parameterOverrides)) &&
        isObject(neuron.initialState) &&
        hasOnlyKeys(neuron.initialState, ['v', 'u']) &&
        isFiniteNumber(neuron.initialState.v) &&
        (neuron.initialState.u === undefined || isFiniteNumber(neuron.initialState.u))
    )
  ) {
    return false;
  }

  if (
    !agent.brain.containers.every(
      (container) =>
        isObject(container) &&
        hasOnlyKeys(container, ['id', 'label', 'children']) &&
        typeof container.id === 'string' &&
        (container.label === undefined || typeof container.label === 'string') &&
        Array.isArray(container.children) &&
        container.children.every(
          (child) =>
            isObject(child) &&
            hasOnlyKeys(child, ['scope', 'nodeId']) &&
            (child.scope === 'brain' || child.scope === 'container') &&
            typeof child.nodeId === 'string'
        )
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(agent.connections) ||
    !agent.connections.every(
      (connection) =>
        isObject(connection) &&
        hasOnlyKeys(connection, [
          'id',
          'from',
          'to',
          'synapseModelId',
          'parameterOverrides',
        ]) &&
        typeof connection.id === 'string' &&
        typeof connection.synapseModelId === 'string' &&
        connection.synapseModelId.trim().length > 0 &&
        (connection.parameterOverrides === undefined || isObject(connection.parameterOverrides)) &&
        isObject(connection.from) &&
        hasOnlyKeys(connection.from, ['scope', 'nodeId', 'portId']) &&
        ['bodyInput', 'bodyOutput', 'brain'].includes(String(connection.from.scope)) &&
        typeof connection.from.nodeId === 'string' &&
        (connection.from.portId === undefined || typeof connection.from.portId === 'string') &&
        isObject(connection.to) &&
        hasOnlyKeys(connection.to, ['scope', 'nodeId', 'portId']) &&
        ['bodyInput', 'bodyOutput', 'brain'].includes(String(connection.to.scope)) &&
        typeof connection.to.nodeId === 'string' &&
        (connection.to.portId === undefined || typeof connection.to.portId === 'string')
    )
  ) {
    return false;
  }

  if (agent.layout === undefined) {
    return true;
  }

  return (
    isObject(agent.layout) &&
    hasOnlyKeys(agent.layout, ['nodes']) &&
    isObject(agent.layout.nodes) &&
    Object.values(agent.layout.nodes).every((nodeState) => isCanonicalLayoutNodeState(nodeState))
  );
};

const cloneCanonicalAgent = (agent: AgentIR): AgentIR => ({
  ...agent,
  metadata: {
    ...agent.metadata,
    description: agent.metadata.description,
    tags: agent.metadata.tags ? [...agent.metadata.tags] : undefined,
  },
  body: {
    ...agent.body,
    inputEndpoints: agent.body.inputEndpoints.map((endpoint) => ({ ...endpoint })),
    outputEndpoints: agent.body.outputEndpoints.map((endpoint) => ({ ...endpoint })),
    mappings: agent.body.mappings.map((mapping) => ({ ...mapping })),
  },
  brain: {
    ...agent.brain,
    neuronModels: agent.brain.neuronModels.map((model) => ({
      id: model.id,
      family: model.family,
      label: model.label,
      params: { ...model.params },
    })),
    synapseModels: structuredClone(agent.brain.synapseModels),
    neurons: agent.brain.neurons.map((neuron) => ({
      ...neuron,
      parameterOverrides: neuron.parameterOverrides ? { ...neuron.parameterOverrides } : undefined,
      initialState: { ...neuron.initialState },
    })),
    containers: agent.brain.containers.map((container) => ({
      ...container,
      children: container.children.map((child) => ({ ...child })),
    })),
  },
  connections: agent.connections.map((connection) => ({
    ...connection,
    parameterOverrides: connection.parameterOverrides ? { ...connection.parameterOverrides } : undefined,
    from: { ...connection.from },
    to: { ...connection.to },
  })),
  layout: agent.layout
    ? {
        ...agent.layout,
        nodes: Object.fromEntries(
          Object.entries(agent.layout.nodes).map(([nodeId, state]) => [
            nodeId,
            { ...state, position: state.position ? { ...state.position } : undefined },
          ])
        ),
      }
    : undefined,
});

export const isAgentMetadata = (value: unknown): value is AgentMetadataShape =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string';

export const isValidBrainLibraryAgentPayload = (
  agent: unknown,
  worldRegistry: WorldRegistry
): agent is AgentIR =>
  isCanonicalAgentShape(agent) &&
  validateAgentIR(agent as unknown as AgentIR, worldRegistry).length === 0;

export const isBrainLibraryStoredRecord = (
  value: unknown,
  worldRegistry: WorldRegistry
): value is BrainLibraryRecord =>
  isObject(value) &&
  hasOnlyKeys(value, ['agent']) &&
  (value as { packageVersion?: unknown }).packageVersion === undefined &&
  (value as { metadata?: unknown }).metadata === undefined &&
  isValidBrainLibraryAgentPayload((value as { agent?: unknown }).agent, worldRegistry);

export const normalizeCanonicalBrainLibraryRecord = (
  agent: AgentIR,
  metadataOverride?: AgentMetadata
): BrainLibraryRecord => {
  const metadata = metadataOverride ?? { ...agent.metadata };
  const normalizedAgent = cloneCanonicalAgent({
    ...agent,
    metadata,
  });

  return {
    agent: {
      ...normalizedAgent,
      metadata: { ...metadata },
    },
  };
};

const assertValidBrainLibraryAgent = (
  agent: AgentIR,
  worldRegistry: WorldRegistry,
  context: string
): void => {
  if (!isCanonicalAgentShape(agent)) {
    throw new Error(`Brain Library ${context}失败：仅支持当前 AgentIR 规范。`);
  }

  const issues = validateAgentIR(agent, worldRegistry);
  if (issues.length === 0) {
    return;
  }

  throw new Error(
    `Brain Library ${context}失败：当前 AgentIR 无效。${issues.map((issue) => issue.message).join(' | ')}`
  );
};

export const createBrainLibraryItemFromAgent = (
  name: string,
  agent: AgentIR,
  worldRegistry: WorldRegistry
): BrainLibraryRecord => {
  assertValidBrainLibraryAgent(agent, worldRegistry, '保存');
  const timestamp = new Date().toISOString();
  return normalizeCanonicalBrainLibraryRecord(agent, {
    ...agent.metadata,
    id: createAgentLibraryId(),
    name: name.trim() || '未命名 Brain',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
};

export const upsertBrainLibraryItemAgent = (
  brains: BrainLibraryRecord[],
  brainId: string,
  agent: AgentIR,
  worldRegistry: WorldRegistry,
  updatedAt?: string
): BrainLibraryRecord[] => {
  assertValidBrainLibraryAgent(agent, worldRegistry, '写入');
  const nextUpdatedAt = updatedAt ?? new Date().toISOString();
  return brains.map((brain) =>
    brain.agent.metadata.id === brainId
      ? normalizeCanonicalBrainLibraryRecord(agent, {
          ...brain.agent.metadata,
          updatedAt: nextUpdatedAt,
        })
      : brain
  );
};

export const renameBrainLibraryItem = (
  brains: BrainLibraryRecord[],
  brainId: string,
  name: string
): BrainLibraryRecord[] =>
  brains.map((brain) => {
    if (brain.agent.metadata.id !== brainId) {
      return brain;
    }

    const updatedAt = new Date().toISOString();
    return normalizeCanonicalBrainLibraryRecord(brain.agent, {
      ...brain.agent.metadata,
      name,
      updatedAt,
    });
  });

export const deleteBrainLibraryItem = (brains: BrainLibraryRecord[], brainId: string): BrainLibraryRecord[] =>
  brains.filter((brain) => brain.agent.metadata.id !== brainId);

export const duplicateBrainLibraryItem = (brains: BrainLibraryRecord[], brainId: string): BrainLibraryRecord[] => {
  const sourceBrain = brains.find((brain) => brain.agent.metadata.id === brainId);
  if (!sourceBrain) {
    return brains;
  }

  const timestamp = new Date().toISOString();
  const duplicateId = createAgentLibraryId();

  return [
    ...brains,
    normalizeCanonicalBrainLibraryRecord(sourceBrain.agent, {
      ...sourceBrain.agent.metadata,
      id: duplicateId,
      name: `${sourceBrain.agent.metadata.name} 副本`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  ];
};
