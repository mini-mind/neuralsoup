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
  agent: AgentIR;
}

interface BrainLibraryStorageEnvelope {
  storageVersion: 1;
  savedAt: string;
  brains: BrainLibraryStoredRecord[];
}

interface BrainLibraryStoredRecord {
  agent: AgentIR;
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

type AgentPackageLike = {
  packageVersion?: unknown;
  metadata?: unknown;
  agent?: unknown;
};

type BrainLibraryStoredRecordLike = {
  packageVersion?: unknown;
  metadata?: unknown;
  agent?: unknown;
};

type AgentPackageMetadataShape = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

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

const normalizeCanonicalAgentRecordShape = (
  agent: AgentIR,
  metadataOverride?: AgentMetadata
): BrainLibraryRecord => {
  const metadata = metadataOverride ?? { ...agent.metadata };
  const normalizedVisionCellCount = deriveAgentIRVisionCellCount(agent, { includeLegacyFallback: false });
  const normalizedAgent = withDerivedBodyVisionCellCount(
    withVisionCellLayoutMarkers(stripLegacyVisionCellCount({
      ...agent,
      metadata,
    }), normalizedVisionCellCount)
  );

  return {
    agent: {
      ...normalizedAgent,
      metadata: { ...metadata },
    },
  };
};

const normalizeImportedAgentRecordShape = (
  agent: AgentIR,
  metadataOverride?: AgentMetadata,
  options?: {
    legacyVisionCellCount?: number | null;
  }
): BrainLibraryRecord => {
  const structuredVisionCellCount = deriveAgentIRVisionCellCount(agent, { includeLegacyFallback: false });
  const effectiveVisionCellCount =
    structuredVisionCellCount > 0
      ? structuredVisionCellCount
      : options?.legacyVisionCellCount != null
        ? options.legacyVisionCellCount
        : deriveAgentIRVisionCellCount(agent);
  const nextAgent =
    effectiveVisionCellCount > structuredVisionCellCount
      ? withVisionCellLayoutMarkers(agent, effectiveVisionCellCount)
      : agent;

  return normalizeCanonicalAgentRecordShape(nextAgent, metadataOverride);
};

const isAgentMetadata = (value: unknown): value is AgentPackageMetadataShape =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string';

const hasValidOptionalTopLevelMetadata = (value: unknown): boolean => value === undefined || isAgentMetadata(value);

const hasValidAgentPayload = (
  agent: unknown,
  options?: {
    allowLegacyVisionCellCount?: boolean;
  }
): agent is AgentIR =>
  isObject(agent) &&
  agent.version === 1 &&
  isAgentMetadata(agent.metadata) &&
  isObject(agent.body) &&
  agent.body.version === 1 &&
  (options?.allowLegacyVisionCellCount === true
    ? agent.body.visionCellCount === undefined ||
      (typeof agent.body.visionCellCount === 'number' &&
        Number.isFinite(agent.body.visionCellCount) &&
        agent.body.visionCellCount >= 0)
    : agent.body.visionCellCount === undefined) &&
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
      isObject(agent.layout.nodes) &&
      (agent.layout.viewportByContainerId === undefined ||
        (isObject(agent.layout.viewportByContainerId) &&
          Object.values(agent.layout.viewportByContainerId).every(
            (viewport) =>
              isObject(viewport) &&
              typeof viewport.x === 'number' &&
              Number.isFinite(viewport.x) &&
              typeof viewport.y === 'number' &&
              Number.isFinite(viewport.y) &&
              typeof viewport.scale === 'number' &&
              Number.isFinite(viewport.scale)
          ))))) &&
  validateAgentIR(agent as unknown as AgentIR).length === 0;

export const isAgentPackage = (value: unknown): value is AgentPackage =>
  isObject(value) &&
  value.packageVersion === 1 &&
  hasValidOptionalTopLevelMetadata((value as AgentPackageLike).metadata) &&
  hasValidAgentPayload((value as AgentPackageLike).agent, { allowLegacyVisionCellCount: true });

const isBrainLibraryStoredRecord = (value: unknown): value is BrainLibraryStoredRecord =>
  isObject(value) &&
  (value as BrainLibraryStoredRecordLike).packageVersion === undefined &&
  (value as BrainLibraryStoredRecordLike).metadata === undefined &&
  hasValidAgentPayload((value as BrainLibraryStoredRecordLike).agent);

const isBrainLibraryStorageEnvelope = (value: unknown): value is BrainLibraryStorageEnvelope =>
  isObject(value) &&
  value.storageVersion === 1 &&
  typeof value.savedAt === 'string' &&
  Array.isArray(value.brains) &&
  value.brains.every(isBrainLibraryStoredRecord);

const isLegacyBrainLibraryStorageEnvelope = (
  value: unknown
): value is { storageVersion: 1; savedAt: string; brains: AgentPackage[] } =>
  isObject(value) &&
  value.storageVersion === 1 &&
  typeof value.savedAt === 'string' &&
  Array.isArray(value.brains) &&
  value.brains.every(isAgentPackage);

const normalizeAgentPackageMetadata = (candidate: AgentPackage): AgentPackage => {
  return encodeBrainLibraryRecord(
    normalizeCanonicalAgentRecordShape(candidate.agent, {
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

  const normalizedRecord = normalizeImportedAgentRecordShape(candidate.agent, undefined, {
    legacyVisionCellCount,
  });

  return normalizeAgentPackageMetadata({
    ...candidate,
    metadata: normalizedRecord.agent.metadata,
    agent: normalizedRecord.agent,
  });
};

const toBrainLibraryRecord = (candidate: { agent: AgentIR }): BrainLibraryRecord =>
  normalizeCanonicalAgentRecordShape(candidate.agent, {
    ...candidate.agent.metadata,
  });

export const encodeBrainLibraryRecord = (record: BrainLibraryRecord): AgentPackage => {
  const normalized = normalizeCanonicalAgentRecordShape(record.agent, {
    ...record.agent.metadata,
  });

  return {
    packageVersion: 1,
    metadata: { ...normalized.agent.metadata },
    agent: normalized.agent,
  };
};

export const createBrainLibraryItemFromAgent = (name: string, agent: AgentIR): BrainLibraryRecord => {
  const timestamp = new Date().toISOString();
  return normalizeCanonicalAgentRecordShape(agent, {
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
  const nextId = existingIds.has(normalized.agent.metadata.id) ? createAgentLibraryId() : normalized.agent.metadata.id;
  return normalizeCanonicalAgentRecordShape(normalized.agent, {
    ...normalized.agent.metadata,
    id: nextId,
    name: trimmedName || normalized.agent.metadata.name,
  });
};

const createStorageEnvelope = (brains: BrainLibraryRecord[]): BrainLibraryStorageEnvelope => ({
  storageVersion: 1,
  savedAt: new Date().toISOString(),
  brains: brains.map((brain) => toBrainLibraryRecord(brain)),
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
    if (isBrainLibraryStorageEnvelope(parsed)) {
      const records = parsed.brains.map(toBrainLibraryRecord);
      const shouldRewriteStorage = parsed.brains.some((brain, index) => {
        const normalized = toBrainLibraryRecord(brain);
        return JSON.stringify(normalized) !== JSON.stringify(records[index]);
      });

      if (shouldRewriteStorage) {
        saveBrainLibrary(records);
      }

      return {
        brains: records,
        status: { state: 'ok', message: null },
      };
    }

    if (isLegacyBrainLibraryStorageEnvelope(parsed)) {
      const normalizedBrains = parsed.brains
        .map(normalizeAgentPackage)
        .filter((brain): brain is AgentPackage => brain !== null);
      const records = normalizedBrains.map(toBrainLibraryRecord);
      saveBrainLibrary(records);
      return {
        brains: records,
        status: { state: 'ok', message: null },
      };
    }

    {
      backupCorruptStorage(rawValue);
      return {
        brains: [],
        status: {
          state: 'recovered',
          message: 'Brain Library 存储格式无效，已隔离损坏数据并重置为空库。',
        },
      };
    }
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
    brain.agent.metadata.id === brainId
      ? normalizeCanonicalAgentRecordShape(agent, {
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
    return normalizeCanonicalAgentRecordShape(brain.agent, {
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
    normalizeCanonicalAgentRecordShape(sourceBrain.agent, {
      ...sourceBrain.agent.metadata,
      id: duplicateId,
      name: `${sourceBrain.agent.metadata.name} 副本`,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  ];
};
