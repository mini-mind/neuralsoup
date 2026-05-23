import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultAgentIR } from '../../src/domain/brain';
import {
  BRAIN_LIBRARY_CORRUPT_STORAGE_KEY,
  BRAIN_LIBRARY_STATUS_STORAGE_KEY,
  BRAIN_LIBRARY_STORAGE_KEY,
  loadBrainLibraryWithStatus,
  saveBrainLibrary,
} from '../../src/storage/brainLibraryStorage';
import {
  createBrainLibraryItemFromAgent,
  renameBrainLibraryItem,
  upsertBrainLibraryItemAgent,
} from '../../src/storage/brainLibraryRecord';
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

test('Brain Library storage saves and loads v1 record payloads', () => {
  const storage = installMemoryLocalStorage();
  const record = createBrainLibraryItemFromAgent('Stored Brain', createDefaultAgentIR(1, 'Stored Brain'));

  saveBrainLibrary([record]);
  const rawValue = storage.getItem(BRAIN_LIBRARY_STORAGE_KEY);
  assert.ok(rawValue);
  assert.equal(JSON.parse(rawValue).storageVersion, 1);
  assert.equal('packageVersion' in JSON.parse(rawValue).brains[0], false);
  assert.equal('metadata' in JSON.parse(rawValue).brains[0], false);
  assert.equal('visionCellCount' in JSON.parse(rawValue).brains[0].agent.body, false);

  const loaded = loadBrainLibraryWithStatus();
  assert.equal(loaded.status.state, 'ok');
  assert.equal(loaded.brains.length, 1);
  assert.equal(loaded.brains[0].agent.metadata.name, 'Stored Brain');
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

test('Brain Library recovered status survives repeated reads until a successful save clears it', () => {
  const storage = installMemoryLocalStorage();
  storage.setItem(BRAIN_LIBRARY_STORAGE_KEY, '{broken');

  const firstLoad = loadBrainLibraryWithStatus();
  const secondLoad = loadBrainLibraryWithStatus();

  assert.equal(firstLoad.status.state, 'recovered');
  assert.equal(secondLoad.status.state, 'recovered');
  assert.ok(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY));

  saveBrainLibrary([]);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY), null);
});

test('Brain Library storage rejects old array payloads instead of migrating implicitly', () => {
  const storage = installMemoryLocalStorage();
  const brain = createBrainLibraryItemFromAgent('Old Array Brain', createDefaultAgentIR(1, 'Old Array Brain'));
  storage.setItem(BRAIN_LIBRARY_STORAGE_KEY, JSON.stringify([brain]));

  const loaded = loadBrainLibraryWithStatus();

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /存储格式无效/);
  assert.equal(loaded.brains.length, 0);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
});

test('Brain Library storage quarantines structurally invalid non-canonical payloads', () => {
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
  const record = createBrainLibraryItemFromAgent('Too Large', createDefaultAgentIR(1, 'Too Large'));

  assert.throws(
    () => saveBrainLibrary([record]),
    /Brain Library 保存失败：quota exceeded/
  );
});

test('Brain Library storage rewrites canonical records into normalized AgentIR shape on load', () => {
  const storage = installMemoryLocalStorage();
  const agent = createDefaultAgentIR(2, 'Canonical Rewrite');
  const rawStoredRecord = structuredClone({ agent });

  delete (rawStoredRecord.agent.layout?.nodes ?? {})['__body-vision-cell-0'];
  delete (rawStoredRecord.agent.layout?.nodes ?? {})['__body-vision-cell-1'];

  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [rawStoredRecord],
    })
  );

  const loaded = loadBrainLibraryWithStatus();

  assert.equal(loaded.status.state, 'ok');
  assert.equal(loaded.brains.length, 1);

  const persisted = JSON.parse(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY) ?? 'null') as {
    brains: Array<{ agent: { layout?: { nodes?: Record<string, unknown> } } }>;
  };
  assert.ok(persisted.brains[0]?.agent.layout?.nodes?.['__body-vision-cell-0']);
  assert.ok(persisted.brains[0]?.agent.layout?.nodes?.['__body-vision-cell-1']);
});

test('Brain Library canonical record storage rewrites leaked legacy body visionCellCount on canonical payload load', () => {
  const storage = installMemoryLocalStorage();
  const brain = createDefaultAgentIR(2, 'Canonical Legacy Leak');

  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [
        {
          agent: brain,
        },
      ],
    })
  );

  const loaded = loadBrainLibraryWithStatus();

  assert.equal(loaded.status.state, 'ok');
  assert.equal(loaded.brains.length, 1);
  const persisted = JSON.parse(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY) ?? 'null') as {
    brains: Array<{ packageVersion?: number; metadata?: Record<string, unknown>; agent: { body: Record<string, unknown> } }>;
  };
  assert.equal('packageVersion' in persisted.brains[0], false);
  assert.equal('metadata' in persisted.brains[0], false);
  assert.equal('visionCellCount' in persisted.brains[0].agent.body, false);
});

test('renameBrainLibraryItem updates canonical agent metadata only once', () => {
  const record = createBrainLibraryItemFromAgent('Rename Source', createDefaultAgentIR(1, 'Rename Source'));

  const [renamed] = renameBrainLibraryItem([record], record.agent.metadata.id, 'Renamed Brain');
  assert.ok(renamed);
  assert.equal(renamed.agent.metadata.name, 'Renamed Brain');
});

test('upsertBrainLibraryItemAgent updates canonical agent metadata timestamps', () => {
  const record = createBrainLibraryItemFromAgent('Upsert Source', createDefaultAgentIR(1, 'Upsert Source'));
  const replacement = createBrainLibraryItemFromAgent('Replacement Draft', createDefaultAgentIR(1, 'Replacement Draft')).agent;

  const [updated] = upsertBrainLibraryItemAgent([record], record.agent.metadata.id, replacement, '2026-05-23T04:30:00.000Z');
  assert.ok(updated);
  assert.equal(updated.agent.metadata.updatedAt, '2026-05-23T04:30:00.000Z');
});
