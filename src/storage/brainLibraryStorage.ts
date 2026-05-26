import {
  isBrainLibraryStoredRecord,
  type BrainLibraryRecord,
} from './brainLibraryRecord';
import type { WorldRegistry } from '../domain/brain';

export const BRAIN_LIBRARY_STORAGE_KEY = 'neuralsoup.brain-library.v1';
export const BRAIN_LIBRARY_CORRUPT_STORAGE_KEY = 'neuralsoup.brain-library.v1.corrupt';
export const BRAIN_LIBRARY_STATUS_STORAGE_KEY = 'neuralsoup.brain-library.v1.status';

interface BrainLibraryStorageEnvelope {
  storageVersion: 1;
  savedAt: string;
  brains: BrainLibraryRecord[];
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

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowedKeys.includes(key));

const isBrainLibraryStorageEnvelope = (
  value: unknown,
  worldRegistry: WorldRegistry
): value is BrainLibraryStorageEnvelope =>
  isObject(value) &&
  hasOnlyKeys(value, ['storageVersion', 'savedAt', 'brains']) &&
  value.storageVersion === 1 &&
  typeof value.savedAt === 'string' &&
  Array.isArray(value.brains) &&
  value.brains.every((brain) => isBrainLibraryStoredRecord(brain, worldRegistry));

const createStorageEnvelope = (
  brains: BrainLibraryRecord[],
  worldRegistry: WorldRegistry
): BrainLibraryStorageEnvelope => ({
  storageVersion: 1,
  savedAt: new Date().toISOString(),
  brains: brains.map((brain: BrainLibraryRecord) => {
    const brainName = brain.agent.metadata.name;
    if (!isBrainLibraryStoredRecord(brain, worldRegistry)) {
      throw new Error(`Brain "${brainName}" 无法保存：存储记录仅允许顶层 agent 且必须为 canonical AgentIR。`);
    }

    return brain;
  }),
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

export const loadBrainLibraryWithStatus = (worldRegistry: WorldRegistry): BrainLibraryLoadResult => {
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
    if (isBrainLibraryStorageEnvelope(parsed, worldRegistry)) {
      return {
        brains: parsed.brains,
        status: { state: 'ok', message: null },
      };
    }

    backupCorruptStorage(rawValue);
    return {
      brains: [],
      status: {
        state: 'recovered',
        message: 'Brain Library 存储格式无效（仅支持当前 AgentIR 规范），已隔离并重置为空库。',
      },
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

export const loadBrainLibrary = (worldRegistry: WorldRegistry): BrainLibraryRecord[] =>
  loadBrainLibraryWithStatus(worldRegistry).brains;

export const saveBrainLibrary = (brains: BrainLibraryRecord[], worldRegistry: WorldRegistry): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      BRAIN_LIBRARY_STORAGE_KEY,
      JSON.stringify(createStorageEnvelope(brains, worldRegistry))
    );
    window.localStorage.removeItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY);
  } catch (error) {
    throw new Error(
      `Brain Library 保存失败：${error instanceof Error ? error.message : 'LocalStorage 写入失败'}`
    );
  }
};

export type { BrainLibraryRecord } from './brainLibraryRecord';
