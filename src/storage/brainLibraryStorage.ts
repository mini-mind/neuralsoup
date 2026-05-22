import {
  createAgentPackage,
  createBrainLayoutFromDefinition,
  type AgentIR,
  type AgentPackage,
  type BrainDefinition,
  type BodyDefinition,
  type BrainLayoutDocument,
  type BrainPackage,
  validateAgentIR,
} from '../domain/brain';

export const BRAIN_LIBRARY_STORAGE_KEY = 'neuralsoup.brain-library.v1';
export const BRAIN_LIBRARY_CORRUPT_STORAGE_KEY = 'neuralsoup.brain-library.v1.corrupt';
export const BRAIN_LIBRARY_STATUS_STORAGE_KEY = 'neuralsoup.brain-library.v1.status';

interface BrainLibraryStorageEnvelope {
  storageVersion: 1;
  savedAt: string;
  brains: AgentPackage[];
}

export type BrainLibraryLoadStatus =
  | {
      state: 'ok';
      message: null;
    }
  | {
      state: 'empty';
      message: null;
    }
  | {
      state: 'recovered';
      message: string;
    };

export interface BrainLibraryLoadResult {
  brains: AgentPackage[];
  status: BrainLibraryLoadStatus;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createAgentLibraryId = (): string => `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const inferVisionCellCountFromAgent = (agent: AgentIR): number =>
  agent.connections.reduce((maxCount, connection) => {
    const endpoints = [connection.from, connection.to];
    for (const endpoint of endpoints) {
      if (endpoint.scope !== 'bodyInput') {
        continue;
      }
      const match = endpoint.nodeId.match(/^vision-[RGB]-(\d+)$/);
      if (!match) {
        continue;
      }
      maxCount = Math.max(maxCount, Number.parseInt(match[1], 10) + 1);
    }
    return maxCount;
  }, 0);

const isBrainDefinition = (value: unknown): value is BrainDefinition => {
  if (!isObject(value)) {
    return false;
  }

  const root = value.root;
  return (
    value.version === 1 &&
    Array.isArray(value.models) &&
    isObject(root) &&
    root.id === 'root' &&
    Array.isArray(root.children) &&
    Array.isArray(root.links)
  );
};

const isBrainLayoutDocument = (value: unknown): value is BrainLayoutDocument =>
  isObject(value) && value.version === 1 && isObject(value.nodes);

const isBodyInputSignal = (value: unknown): boolean =>
  isObject(value) &&
  typeof value.id === 'string' &&
  isObject(value.source) &&
  value.source.kind === 'vision-cell' &&
  ['R', 'G', 'B'].includes(String(value.source.channel)) &&
  typeof value.source.cellIndex === 'number';

const isBodyOutputSignal = (value: unknown): boolean =>
  isObject(value) &&
  typeof value.id === 'string' &&
  isObject(value.target) &&
  value.target.kind === 'action-channel' &&
  ['turn-left', 'move-forward', 'turn-right'].includes(String(value.target.channel));

const isBodyInputBinding = (value: unknown): boolean =>
  isObject(value) &&
  typeof value.bodySignalId === 'string' &&
  typeof value.brainSignalNodeId === 'string';

const isBodyOutputBinding = (value: unknown): boolean =>
  isObject(value) &&
  typeof value.bodySignalId === 'string' &&
  typeof value.brainSignalNodeId === 'string';

const isBodyDefinition = (value: unknown): value is BodyDefinition =>
  isObject(value) &&
  value.version === 1 &&
  Array.isArray(value.inputSignals) &&
  value.inputSignals.every(isBodyInputSignal) &&
  Array.isArray(value.outputSignals) &&
  value.outputSignals.every(isBodyOutputSignal) &&
  isObject(value.brainBindings) &&
  Array.isArray(value.brainBindings.inputs) &&
  value.brainBindings.inputs.every(isBodyInputBinding) &&
  Array.isArray(value.brainBindings.outputs) &&
  value.brainBindings.outputs.every(isBodyOutputBinding);

export const isBrainPackage = (value: unknown): value is BrainPackage => {
  if (!isObject(value) || value.packageVersion !== 1 || !isObject(value.metadata)) {
    return false;
  }

  return (
    typeof value.metadata.id === 'string' &&
    typeof value.metadata.name === 'string' &&
    typeof value.metadata.createdAt === 'string' &&
    typeof value.metadata.updatedAt === 'string' &&
    isBrainDefinition(value.definition) &&
    isBrainLayoutDocument(value.layout) &&
    isBodyDefinition(value.body)
  );
};

export const isAgentPackage = (value: unknown): value is AgentPackage =>
  isObject(value) &&
  value.packageVersion === 1 &&
  isObject(value.metadata) &&
  typeof value.metadata.id === 'string' &&
  typeof value.metadata.name === 'string' &&
  typeof value.metadata.createdAt === 'string' &&
  typeof value.metadata.updatedAt === 'string' &&
  isObject(value.agent) &&
  value.agent.version === 1 &&
  isObject(value.agent.metadata) &&
  typeof value.agent.metadata.id === 'string' &&
  typeof value.agent.metadata.name === 'string' &&
  typeof value.agent.metadata.createdAt === 'string' &&
  typeof value.agent.metadata.updatedAt === 'string' &&
  isObject(value.agent.body) &&
  value.agent.body.version === 1 &&
  (value.agent.body.visionCellCount === undefined ||
    (typeof value.agent.body.visionCellCount === 'number' &&
      Number.isFinite(value.agent.body.visionCellCount) &&
      value.agent.body.visionCellCount >= 0)) &&
  Array.isArray(value.agent.body.inputRules) &&
  value.agent.body.inputRules.every(
    (rule) =>
      isObject(rule) &&
      typeof rule.id === 'string' &&
      typeof rule.nodeIdPattern === 'string' &&
      typeof rule.sourceTemplate === 'string' &&
      typeof rule.scale === 'number' &&
      Number.isFinite(rule.scale)
  ) &&
  Array.isArray(value.agent.body.outputRules) &&
  value.agent.body.outputRules.every(
    (rule) =>
      isObject(rule) &&
      typeof rule.id === 'string' &&
      typeof rule.nodeIdPattern === 'string' &&
      typeof rule.targetTemplate === 'string' &&
      typeof rule.decayPerSecond === 'number' &&
      Number.isFinite(rule.decayPerSecond)
  ) &&
  isObject(value.agent.brain) &&
  value.agent.brain.version === 1 &&
  typeof value.agent.brain.rootContainerId === 'string' &&
  Array.isArray(value.agent.brain.neurons) &&
  value.agent.brain.neurons.every(
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
  Array.isArray(value.agent.brain.containers) &&
  value.agent.brain.containers.every(
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
  Array.isArray(value.agent.connections) &&
  value.agent.connections.every(
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
  (value.agent.layout === undefined ||
    (isObject(value.agent.layout) &&
      value.agent.layout.version === 1 &&
      isObject(value.agent.layout.nodes) &&
      (value.agent.layout.viewportByContainerId === undefined ||
        (isObject(value.agent.layout.viewportByContainerId) &&
          Object.values(value.agent.layout.viewportByContainerId).every(
            (viewport) =>
              isObject(viewport) &&
              typeof viewport.x === 'number' &&
              Number.isFinite(viewport.x) &&
              typeof viewport.y === 'number' &&
              Number.isFinite(viewport.y) &&
              typeof viewport.scale === 'number' &&
              Number.isFinite(viewport.scale)
          ))))) &&
  validateAgentIR(value.agent as unknown as AgentIR).length === 0;

const isBrainLibraryStorageEnvelope = (value: unknown): value is BrainLibraryStorageEnvelope =>
  isObject(value) &&
  value.storageVersion === 1 &&
  typeof value.savedAt === 'string' &&
  Array.isArray(value.brains) &&
  value.brains.every(isAgentPackage);

const normalizeAgentPackageMetadata = (candidate: AgentPackage): AgentPackage => {
  const metadata = {
    ...candidate.agent.metadata,
  };

  return {
    ...candidate,
    metadata,
    agent: {
      ...candidate.agent,
      metadata,
    },
  };
};

const normalizeAgentPackage = (candidate: unknown): AgentPackage | null => {
  if (!isAgentPackage(candidate)) {
    return null;
  }

  const visionCellCount =
    typeof candidate.agent.body.visionCellCount === 'number'
      ? candidate.agent.body.visionCellCount
      : inferVisionCellCountFromAgent(candidate.agent as AgentIR);

  const normalizedVisionCellCount = Math.max(visionCellCount, 0);

  return normalizeAgentPackageMetadata({
    ...candidate,
    agent: {
      ...candidate.agent,
      body: {
        ...candidate.agent.body,
        visionCellCount: normalizedVisionCellCount,
      },
    },
  });
};

export const createBrainLibraryItem = (name: string, definition: BrainDefinition): AgentPackage =>
  createAgentPackage(name, definition);

export const createBrainLibraryItemFromAgent = (name: string, agent: AgentIR): AgentPackage => {
  const timestamp = new Date().toISOString();
  const metadata = {
    ...agent.metadata,
    id: createAgentLibraryId(),
    name: name.trim() || '未命名 Brain',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    packageVersion: 1,
    metadata,
    agent: {
      ...agent,
      metadata,
    },
  };
};

export const normalizeImportedAgentPackage = (
  candidate: unknown,
  options?: {
    name?: string;
    existingIds?: Iterable<string>;
  }
): AgentPackage | null => {
  const normalized = normalizeAgentPackage(candidate);
  if (!normalized) {
    return null;
  }

  const trimmedName = options?.name?.trim();
  const existingIds = new Set(options?.existingIds ?? []);
  const nextId = existingIds.has(normalized.metadata.id) ? createAgentLibraryId() : normalized.metadata.id;
  const metadata = {
    ...normalized.agent.metadata,
    id: nextId,
    name: trimmedName || normalized.agent.metadata.name,
  };

  return {
    ...normalized,
    metadata,
    agent: {
      ...normalized.agent,
      metadata,
    },
  };
};

const createStorageEnvelope = (brains: AgentPackage[]): BrainLibraryStorageEnvelope => ({
  storageVersion: 1,
  savedAt: new Date().toISOString(),
  brains,
});

const backupCorruptStorage = (rawValue: string): void => {
  const recoveredAt = new Date().toISOString();
  try {
    window.localStorage.setItem(
      BRAIN_LIBRARY_CORRUPT_STORAGE_KEY,
      JSON.stringify({
        recoveredAt,
        rawValue,
      })
    );
    window.localStorage.setItem(
      BRAIN_LIBRARY_STATUS_STORAGE_KEY,
      JSON.stringify({
        recoveredAt,
        message: 'Brain Library 存储已隔离损坏数据并重置为空库。',
      })
    );
    window.localStorage.removeItem(BRAIN_LIBRARY_STORAGE_KEY);
  } catch {
    window.localStorage.removeItem(BRAIN_LIBRARY_STORAGE_KEY);
  }
};

const consumeStoredStatusMessage = (): string | null => {
  const rawValue = window.localStorage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as { message?: unknown };
    return typeof parsed.message === 'string' ? parsed.message : null;
  } catch {
    return null;
  }
};

export const loadBrainLibraryWithStatus = (): BrainLibraryLoadResult => {
  if (typeof window === 'undefined') {
    return {
      brains: [],
      status: { state: 'empty', message: null },
    };
  }

  const storedStatusMessage = consumeStoredStatusMessage();
  const rawValue = window.localStorage.getItem(BRAIN_LIBRARY_STORAGE_KEY);
  if (!rawValue) {
    return {
      brains: [],
      status: storedStatusMessage
        ? { state: 'recovered', message: storedStatusMessage }
        : { state: 'empty', message: null },
    };
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!isBrainLibraryStorageEnvelope(parsed)) {
      backupCorruptStorage(rawValue);
      return {
        brains: [],
        status: {
          state: 'recovered',
          message: 'Brain Library 存储格式无效，已隔离损坏数据并重置为空库。',
        },
      };
    }

    const normalizedBrains = parsed.brains
      .map(normalizeAgentPackage)
      .filter((brain): brain is AgentPackage => brain !== null);

    const shouldRewriteStorage = normalizedBrains.some((brain, index) => {
      const persistedBrain = parsed.brains[index];
      return (
        brain.agent.body.visionCellCount !== persistedBrain?.agent?.body?.visionCellCount ||
        brain.metadata.id !== persistedBrain?.metadata?.id ||
        brain.metadata.name !== persistedBrain?.metadata?.name ||
        brain.metadata.createdAt !== persistedBrain?.metadata?.createdAt ||
        brain.metadata.updatedAt !== persistedBrain?.metadata?.updatedAt ||
        brain.agent.metadata.id !== persistedBrain?.agent?.metadata?.id ||
        brain.agent.metadata.name !== persistedBrain?.agent?.metadata?.name ||
        brain.agent.metadata.createdAt !== persistedBrain?.agent?.metadata?.createdAt ||
        brain.agent.metadata.updatedAt !== persistedBrain?.agent?.metadata?.updatedAt
      );
    });
    if (shouldRewriteStorage) {
      saveBrainLibrary(normalizedBrains);
    }

    return {
      brains: normalizedBrains,
      status: { state: 'ok', message: null },
    };
  } catch {
    backupCorruptStorage(rawValue);
    return {
      brains: [],
      status: {
        state: 'recovered',
        message: 'Brain Library JSON 解析失败，已隔离损坏数据并重置为空库。',
      },
    };
  }
};

export const loadBrainLibrary = (): AgentPackage[] => loadBrainLibraryWithStatus().brains;

export const saveBrainLibrary = (brains: AgentPackage[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(BRAIN_LIBRARY_STORAGE_KEY, JSON.stringify(createStorageEnvelope(brains)));
    window.localStorage.removeItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY);
  } catch (error) {
    throw new Error(
      `Brain Library 保存失败：${error instanceof Error ? error.message : 'LocalStorage 写入失败'}`
    );
  }
};

export const upsertBrainLibraryItemDefinition = (
  brains: AgentPackage[],
  brainId: string,
  definition: BrainDefinition,
  body: BodyDefinition,
  updatedAt?: string
): AgentPackage[] =>
  brains.map((brain) =>
    brain.metadata.id === brainId
      ? createAgentPackage(brain.metadata.name, definition, {
          id: brain.metadata.id,
          createdAt: brain.metadata.createdAt,
          updatedAt: updatedAt ?? new Date().toISOString(),
          description: brain.metadata.description,
          tags: brain.metadata.tags,
          body,
          layout: createBrainLayoutFromDefinition(definition),
        })
      : brain
  );

export const upsertBrainLibraryItemAgent = (
  brains: AgentPackage[],
  brainId: string,
  agent: AgentIR,
  updatedAt?: string
): AgentPackage[] => {
  const nextUpdatedAt = updatedAt ?? new Date().toISOString();
  return brains.map((brain) =>
    brain.metadata.id === brainId
      ? {
          ...brain,
          metadata: {
            ...brain.metadata,
            updatedAt: nextUpdatedAt,
          },
          agent: {
            ...agent,
            metadata: {
              ...brain.metadata,
              updatedAt: nextUpdatedAt,
            },
          },
        }
      : brain
  );
};

export const renameBrainLibraryItem = (
  brains: AgentPackage[],
  brainId: string,
  name: string
): AgentPackage[] =>
  brains.map((brain) =>
    brain.metadata.id === brainId
      ? {
          ...brain,
          metadata: { ...brain.metadata, name, updatedAt: new Date().toISOString() },
          agent: {
            ...brain.agent,
            metadata: {
              ...brain.agent.metadata,
              name,
              updatedAt: new Date().toISOString(),
            },
          },
        }
      : brain
  );

export const deleteBrainLibraryItem = (brains: AgentPackage[], brainId: string): AgentPackage[] =>
  brains.filter((brain) => brain.metadata.id !== brainId);

export const duplicateBrainLibraryItem = (brains: AgentPackage[], brainId: string): AgentPackage[] => {
  const sourceBrain = brains.find((brain) => brain.metadata.id === brainId);
  if (!sourceBrain) {
    return brains;
  }
  const timestamp = new Date().toISOString();
  const duplicateId = createAgentLibraryId();

  return [
    ...brains,
    {
      packageVersion: 1,
      metadata: {
        ...sourceBrain.metadata,
        id: duplicateId,
        name: `${sourceBrain.metadata.name} 副本`,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      agent: {
        ...sourceBrain.agent,
        metadata: {
          ...sourceBrain.agent.metadata,
          id: duplicateId,
          name: `${sourceBrain.metadata.name} 副本`,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    },
  ];
};
