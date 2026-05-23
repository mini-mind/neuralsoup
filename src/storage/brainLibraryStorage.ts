import {
  deriveAgentIRVisionCellCount,
  type AgentIR,
  type AgentLibraryItem,
  type AgentMetadata,
  validateAgentIR,
  withDerivedBodyVisionCellCount,
  withVisionCellLayoutMarkers,
} from '../domain/brain';

type AgentPackage = AgentLibraryItem;

export const BRAIN_LIBRARY_STORAGE_KEY = 'neuralsoup.brain-library.v1';
export const BRAIN_LIBRARY_CORRUPT_STORAGE_KEY = 'neuralsoup.brain-library.v1.corrupt';
export const BRAIN_LIBRARY_STATUS_STORAGE_KEY = 'neuralsoup.brain-library.v1.status';

export interface BrainLibraryRecord {
  metadata: AgentMetadata;
  agent: AgentIR;
}

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
  brains: BrainLibraryRecord[];
  status: BrainLibraryLoadStatus;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createAgentLibraryId = (): string => `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type AgentPackageWithLegacyBody = AgentPackage & {
  agent: AgentIR & {
    body: AgentIR['body'] & {
      visionCellCount?: unknown;
    };
  };
};

const stripLegacyVisionCellCount = (agent: AgentIR): AgentIR => {
  const { visionCellCount: _legacyVisionCellCount, ...bodyWithoutLegacyVisionCellCount } = agent.body as AgentIR['body'] & {
    visionCellCount?: unknown;
  };
  return {
    ...agent,
    body: bodyWithoutLegacyVisionCellCount,
  };
};

const normalizeAgentRecordShape = (
  agent: AgentIR,
  metadataOverride?: AgentMetadata
): BrainLibraryRecord => {
  const metadata = metadataOverride ?? { ...agent.metadata };
  const normalizedVisionCellCount = deriveAgentIRVisionCellCount(agent);
  const normalizedAgent = withDerivedBodyVisionCellCount(
    withVisionCellLayoutMarkers(stripLegacyVisionCellCount({
      ...agent,
      metadata,
    }), normalizedVisionCellCount)
  );

  return {
    metadata: { ...metadata },
    agent: {
      ...normalizedAgent,
      metadata: { ...metadata },
    },
  };
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
  return encodeBrainLibraryRecord(
    normalizeAgentRecordShape(candidate.agent, {
      ...candidate.agent.metadata,
    })
  );
};

const normalizeAgentPackage = (candidate: unknown): AgentPackage | null => {
  if (!isAgentPackage(candidate)) {
    return null;
  }

  const legacyVisionCellCount = (() => {
    const value = (candidate as AgentPackageWithLegacyBody).agent.body.visionCellCount;
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
  })();

  const normalizedRecord = normalizeAgentRecordShape(
    legacyVisionCellCount == null
      ? candidate.agent
      : withVisionCellLayoutMarkers(candidate.agent, legacyVisionCellCount)
  );

  return normalizeAgentPackageMetadata({
    ...candidate,
    metadata: normalizedRecord.metadata,
    agent: normalizedRecord.agent,
  });
};

const toBrainLibraryRecord = (candidate: AgentPackage): BrainLibraryRecord =>
  normalizeAgentRecordShape(candidate.agent, {
    ...candidate.agent.metadata,
  });

export const encodeBrainLibraryRecord = (record: BrainLibraryRecord): AgentPackage => ({
  packageVersion: 1,
  ...normalizeAgentRecordShape(record.agent, {
    ...record.agent.metadata,
  }),
});

export const createBrainLibraryItemFromAgent = (name: string, agent: AgentIR): BrainLibraryRecord => {
  const timestamp = new Date().toISOString();
  return normalizeAgentRecordShape(agent, {
    ...agent.metadata,
    id: createAgentLibraryId(),
    name: name.trim() || '未命名 Brain',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
};

export const normalizeImportedAgentPackage = (
  candidate: unknown,
  options?: {
    name?: string;
    existingIds?: Iterable<string>;
  }
): BrainLibraryRecord | null => {
  const normalized = normalizeAgentPackage(candidate);
  if (!normalized) {
    return null;
  }

  const trimmedName = options?.name?.trim();
  const existingIds = new Set(options?.existingIds ?? []);
  const nextId = existingIds.has(normalized.metadata.id) ? createAgentLibraryId() : normalized.metadata.id;
  return normalizeAgentRecordShape(normalized.agent, {
    ...normalized.agent.metadata,
    id: nextId,
    name: trimmedName || normalized.agent.metadata.name,
  });
};

const createStorageEnvelope = (brains: BrainLibraryRecord[]): BrainLibraryStorageEnvelope => ({
  storageVersion: 1,
  savedAt: new Date().toISOString(),
  brains: brains.map(encodeBrainLibraryRecord),
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
    const records = normalizedBrains.map(toBrainLibraryRecord);

    const shouldRewriteStorage = normalizedBrains.some((brain, index) => {
      const persistedBrain = parsed.brains[index];
      return (
        JSON.stringify(encodeBrainLibraryRecord(toBrainLibraryRecord(brain))) !== JSON.stringify(persistedBrain) ||
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
      saveBrainLibrary(records);
    }

    return {
      brains: records,
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

export const loadBrainLibrary = (): BrainLibraryRecord[] => loadBrainLibraryWithStatus().brains;

export const saveBrainLibrary = (brains: BrainLibraryRecord[]): void => {
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

export const upsertBrainLibraryItemAgent = (
  brains: BrainLibraryRecord[],
  brainId: string,
  agent: AgentIR,
  updatedAt?: string
): BrainLibraryRecord[] => {
  const nextUpdatedAt = updatedAt ?? new Date().toISOString();
  return brains.map((brain) =>
    brain.metadata.id === brainId
      ? normalizeAgentRecordShape(agent, {
          ...brain.metadata,
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
    if (brain.metadata.id !== brainId) {
      return brain;
    }

    const updatedAt = new Date().toISOString();
    return normalizeAgentRecordShape(brain.agent, {
      ...brain.metadata,
      name,
      updatedAt,
    });
  });

export const deleteBrainLibraryItem = (brains: BrainLibraryRecord[], brainId: string): BrainLibraryRecord[] =>
  brains.filter((brain) => brain.metadata.id !== brainId);

export const duplicateBrainLibraryItem = (brains: BrainLibraryRecord[], brainId: string): BrainLibraryRecord[] => {
  const sourceBrain = brains.find((brain) => brain.metadata.id === brainId);
  if (!sourceBrain) {
    return brains;
  }
  const timestamp = new Date().toISOString();
  const duplicateId = createAgentLibraryId();

  return [
    ...brains,
    normalizeAgentRecordShape(sourceBrain.agent, {
      ...sourceBrain.metadata,
      id: duplicateId,
      name: `${sourceBrain.metadata.name} 副本`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  ];
};
