import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentPackage, createDefaultGraphIRDocument } from '../../src/domain/brain';
import {
  BRAIN_LIBRARY_CORRUPT_STORAGE_KEY,
  BRAIN_LIBRARY_STATUS_STORAGE_KEY,
  BRAIN_LIBRARY_STORAGE_KEY,
  loadBrainLibraryWithStatus,
  saveBrainLibrary,
} from '../../src/storage/brainLibraryStorage';

class MemoryStorage {
  private values = new Map<string, string>();
  public failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('quota exceeded');
    }

    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const installMemoryLocalStorage = () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: storage,
    },
  });
  return storage;
};

test('Brain Library storage saves and loads v1 envelope payloads', () => {
  const storage = installMemoryLocalStorage();
  const brain = createAgentPackage('Stored Brain', createDefaultGraphIRDocument(1));

  saveBrainLibrary([brain]);
  const rawValue = storage.getItem(BRAIN_LIBRARY_STORAGE_KEY);
  assert.ok(rawValue);
  assert.equal(JSON.parse(rawValue).storageVersion, 1);

  const loaded = loadBrainLibraryWithStatus();
  assert.equal(loaded.status.state, 'ok');
  assert.equal(loaded.brains.length, 1);
  assert.equal(loaded.brains[0].metadata.name, 'Stored Brain');
});

test('Brain Library storage quarantines corrupted JSON payloads', () => {
  const storage = installMemoryLocalStorage();
  storage.setItem(BRAIN_LIBRARY_STORAGE_KEY, '{broken');

  const loaded = loadBrainLibraryWithStatus();

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /JSON 解析失败/);
  assert.equal(loaded.brains.length, 0);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY), null);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
  assert.ok(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY));
  assert.equal(loadBrainLibraryWithStatus().status.state, 'recovered');
  assert.ok(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY));
  saveBrainLibrary([]);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY), null);
});

test('Brain Library storage rejects old array payloads instead of migrating implicitly', () => {
  const storage = installMemoryLocalStorage();
  const brain = createAgentPackage('Old Array Brain', createDefaultGraphIRDocument(1));
  storage.setItem(BRAIN_LIBRARY_STORAGE_KEY, JSON.stringify([brain]));

  const loaded = loadBrainLibraryWithStatus();

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /存储格式无效/);
  assert.equal(loaded.brains.length, 0);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
});

test('Brain Library storage quarantines structurally invalid AgentPackage payloads', () => {
  const storage = installMemoryLocalStorage();
  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [
        {
          packageVersion: 1,
          metadata: {
            id: 'broken-agent',
            name: 'Broken Agent',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          agent: {
            version: 1,
          },
        },
      ],
    })
  );

  const loaded = loadBrainLibraryWithStatus();

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /存储格式无效/);
  assert.equal(loaded.brains.length, 0);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY), null);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
});

test('Brain Library storage reports LocalStorage capacity write failures', () => {
  const storage = installMemoryLocalStorage();
  storage.failWrites = true;

  assert.throws(
    () => saveBrainLibrary([createAgentPackage('Too Large', createDefaultGraphIRDocument(1))]),
    /Brain Library 保存失败：quota exceeded/
  );
});
