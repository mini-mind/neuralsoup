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

const createAgentLibraryId = (): string => `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const stripNonCanonicalLayoutState = (agent: AgentIR): AgentIR => {
  const nextAgent: AgentIR = {
    ...agent,
    body: {
      version: 1,
      inputRules: [...agent.body.inputRules],
      outputRules: [...agent.body.outputRules],
    },
  };

  if (!agent.layout) {
    return nextAgent;
  }

  return {
    ...nextAgent,
    layout: {
      version: 1,
      nodes: Object.fromEntries(
        Object.entries(agent.layout.nodes).map(([nodeId, state]) => [
          nodeId,
          {
            position: state.position ? { ...state.position } : undefined,
            collapsed: state.collapsed,
          },
        ])
      ),
    },
  };
};

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
  isObject(agent) &&
  agent.version === 1 &&
  isAgentMetadata(agent.metadata) &&
  isObject(agent.body) &&
  agent.body.version === 1 &&
  Array.isArray(agent.body.inputRules) &&
  agent.body.inputRules.every(
    (rule) =>
      isObject(rule) &&
      typeof rule.id === 'string' &&
      typeof rule.nodeIdPattern === 'string' &&
      typeof rule.sourceTemplate === 'string' &&
      typeof rule.scale === 'number' &&
      Number.isFinite(rule.scale)
  ) &&
  Array.isArray(agent.body.outputRules) &&
  agent.body.outputRules.every(
    (rule) =>
      isObject(rule) &&
      typeof rule.id === 'string' &&
      typeof rule.nodeIdPattern === 'string' &&
      typeof rule.targetTemplate === 'string' &&
      typeof rule.decayPerSecond === 'number' &&
      Number.isFinite(rule.decayPerSecond)
  ) &&
  isObject(agent.brain) &&
  agent.brain.version === 1 &&
  typeof agent.brain.rootContainerId === 'string' &&
  Array.isArray(agent.brain.neurons) &&
  agent.brain.neurons.every(
    (neuron) =>
      isObject(neuron) &&
      typeof neuron.id === 'string' &&
      typeof neuron.label === 'string' &&
      neuron.model === 'izhikevich' &&
      isObject(neuron.params) &&
      typeof neuron.params.a === 'number' &&
      Number.isFinite(neuron.params.a) &&
      typeof neuron.params.b === 'number' &&
      Number.isFinite(neuron.params.b) &&
      typeof neuron.params.c === 'number' &&
      Number.isFinite(neuron.params.c) &&
      typeof neuron.params.d === 'number' &&
      Number.isFinite(neuron.params.d) &&
      typeof neuron.params.threshold === 'number' &&
      Number.isFinite(neuron.params.threshold) &&
      isObject(neuron.initialState) &&
      typeof neuron.initialState.v === 'number' &&
      Number.isFinite(neuron.initialState.v) &&
      (neuron.initialState.u === undefined ||
        (typeof neuron.initialState.u === 'number' && Number.isFinite(neuron.initialState.u)))
  ) &&
  Array.isArray(agent.brain.containers) &&
  agent.brain.containers.every(
    (container) =>
      isObject(container) &&
      typeof container.id === 'string' &&
      (container.label === undefined || typeof container.label === 'string') &&
      Array.isArray(container.children) &&
      container.children.every(
        (child) =>
          isObject(child) &&
          (child.scope === 'brain' || child.scope === 'container') &&
          typeof child.nodeId === 'string'
      )
  ) &&
  Array.isArray(agent.connections) &&
  agent.connections.every(
    (connection) =>
      isObject(connection) &&
      typeof connection.id === 'string' &&
      isObject(connection.from) &&
      ['bodyInput', 'bodyOutput', 'brain'].includes(String(connection.from.scope)) &&
      typeof connection.from.nodeId === 'string' &&
      (connection.from.portId === undefined || typeof connection.from.portId === 'string') &&
      isObject(connection.to) &&
      ['bodyInput', 'bodyOutput', 'brain'].includes(String(connection.to.scope)) &&
      typeof connection.to.nodeId === 'string' &&
      (connection.to.portId === undefined || typeof connection.to.portId === 'string') &&
      typeof connection.weight === 'number' &&
      Number.isFinite(connection.weight) &&
      (connection.delayMs === undefined ||
        (typeof connection.delayMs === 'number' && Number.isFinite(connection.delayMs)))
  ) &&
  (agent.layout === undefined ||
    (isObject(agent.layout) &&
      agent.layout.version === 1 &&
      isObject(agent.layout.nodes))) &&
  validateAgentIR(agent as unknown as AgentIR, worldRegistry).length === 0;

export const isBrainLibraryStoredRecord = (
  value: unknown,
  worldRegistry: WorldRegistry
): value is BrainLibraryRecord =>
  isObject(value) &&
  (value as { packageVersion?: unknown }).packageVersion === undefined &&
  (value as { metadata?: unknown }).metadata === undefined &&
  isValidBrainLibraryAgentPayload((value as { agent?: unknown }).agent, worldRegistry);

export const normalizeCanonicalBrainLibraryRecord = (
  agent: AgentIR,
  metadataOverride?: AgentMetadata
): BrainLibraryRecord => {
  const metadata = metadataOverride ?? { ...agent.metadata };
  const normalizedAgent = stripNonCanonicalLayoutState(
    {
      ...agent,
      metadata,
    }
  );

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
