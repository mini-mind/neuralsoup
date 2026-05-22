import {
  createAgentPackage,
  createBrainLayoutFromDefinition,
  type AgentIR,
  type AgentPackage,
  type BrainDefinition,
  type BodyDefinition,
  type BrainLayoutDocument,
  type BrainPackage,
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
  value.agent.version === 1;

const isBrainLibraryStorageEnvelope = (value: unknown): value is BrainLibraryStorageEnvelope =>
  isObject(value) &&
  value.storageVersion === 1 &&
  typeof value.savedAt === 'string' &&
  Array.isArray(value.brains) &&
  value.brains.every(isAgentPackage);

const normalizeAgentPackage = (candidate: unknown): AgentPackage | null => (isAgentPackage(candidate) ? candidate : null);

export const createBrainLibraryItem = (name: string, definition: BrainDefinition): AgentPackage =>
  createAgentPackage(name, definition);

export const createBrainLibraryItemFromAgent = (name: string, agent: AgentIR): AgentPackage => {
  const timestamp = new Date().toISOString();
  return {
    packageVersion: 1,
    metadata: {
      ...agent.metadata,
      id: `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim() || '未命名 Brain',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    agent: {
      ...agent,
      metadata: {
        ...agent.metadata,
        id: `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: name.trim() || '未命名 Brain',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
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

    return {
      brains: parsed.brains.map(normalizeAgentPackage).filter((brain): brain is AgentPackage => brain !== null),
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
      ? { ...brain, metadata: { ...brain.metadata, name, updatedAt: new Date().toISOString() } }
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
  const duplicateId = `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
