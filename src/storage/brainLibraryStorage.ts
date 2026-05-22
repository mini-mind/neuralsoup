import {
  createBrainPackage,
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
  brains: BrainPackage[];
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
  brains: BrainPackage[];
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

const isBrainLibraryStorageEnvelope = (value: unknown): value is BrainLibraryStorageEnvelope =>
  isObject(value) &&
  value.storageVersion === 1 &&
  typeof value.savedAt === 'string' &&
  Array.isArray(value.brains) &&
  value.brains.every(isBrainPackage);

const normalizeBrainPackage = (candidate: unknown): BrainPackage | null => {
  if (!isBrainPackage(candidate)) {
    return null;
  }

  return createBrainPackage(candidate.metadata.name, candidate.definition, {
    id: candidate.metadata.id,
    createdAt: candidate.metadata.createdAt,
    updatedAt: candidate.metadata.updatedAt,
    description: candidate.metadata.description,
    tags: candidate.metadata.tags,
    body: candidate.body,
    layout: candidate.layout,
  });
};

export const createBrainLibraryItem = (name: string, definition: BrainDefinition): BrainPackage =>
  createBrainPackage(name, definition);

const createStorageEnvelope = (brains: BrainPackage[]): BrainLibraryStorageEnvelope => ({
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
      brains: parsed.brains.map(normalizeBrainPackage).filter((brain): brain is BrainPackage => brain !== null),
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

export const loadBrainLibrary = (): BrainPackage[] => loadBrainLibraryWithStatus().brains;

export const saveBrainLibrary = (brains: BrainPackage[]): void => {
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
  brains: BrainPackage[],
  brainId: string,
  definition: BrainDefinition,
  body: BodyDefinition
): BrainPackage[] =>
  brains.map((brain) =>
    brain.metadata.id === brainId
      ? createBrainPackage(brain.metadata.name, definition, {
          id: brain.metadata.id,
          createdAt: brain.metadata.createdAt,
          updatedAt: new Date().toISOString(),
          description: brain.metadata.description,
          tags: brain.metadata.tags,
          body,
          layout: brain.layout,
        })
      : brain
  );

export const renameBrainLibraryItem = (
  brains: BrainPackage[],
  brainId: string,
  name: string
): BrainPackage[] =>
  brains.map((brain) =>
    brain.metadata.id === brainId
      ? createBrainPackage(name, brain.definition, {
          id: brain.metadata.id,
          createdAt: brain.metadata.createdAt,
          updatedAt: new Date().toISOString(),
          description: brain.metadata.description,
          tags: brain.metadata.tags,
          body: brain.body,
          layout: brain.layout,
        })
      : brain
  );

export const deleteBrainLibraryItem = (brains: BrainPackage[], brainId: string): BrainPackage[] =>
  brains.filter((brain) => brain.metadata.id !== brainId);

export const duplicateBrainLibraryItem = (brains: BrainPackage[], brainId: string): BrainPackage[] => {
  const sourceBrain = brains.find((brain) => brain.metadata.id === brainId);
  if (!sourceBrain) {
    return brains;
  }

  return [
    ...brains,
    createBrainPackage(`${sourceBrain.metadata.name} 副本`, sourceBrain.definition, {
      description: sourceBrain.metadata.description,
      tags: sourceBrain.metadata.tags,
      body: sourceBrain.body,
      layout: sourceBrain.layout,
    }),
  ];
};
