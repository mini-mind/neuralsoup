import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentPackage, createDefaultGraphIRDocument } from '../../src/domain/brain/compat';
import {
  BRAIN_LIBRARY_CORRUPT_STORAGE_KEY,
  BRAIN_LIBRARY_STATUS_STORAGE_KEY,
  BRAIN_LIBRARY_STORAGE_KEY,
  createBrainLibraryItemFromAgent,
  encodeBrainLibraryRecord,
  loadBrainLibraryWithStatus,
  normalizeImportedAgentPackage,
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
  const record = createBrainLibraryItemFromAgent('Stored Brain', brain.agent);

  saveBrainLibrary([record]);
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
  const record = createBrainLibraryItemFromAgent('Too Large', createAgentPackage('Too Large', createDefaultGraphIRDocument(1)).agent);

  assert.throws(
    () => saveBrainLibrary([record]),
    /Brain Library 保存失败：quota exceeded/
  );
});

test('Brain Library storage migrates legacy AgentPackage payloads missing body visionCellCount', () => {
  const storage = installMemoryLocalStorage();
  const brain = createAgentPackage('Legacy Agent', createDefaultGraphIRDocument(2));
  const legacyBrain = structuredClone(brain) as typeof brain & {
    agent: typeof brain.agent & { body: Omit<typeof brain.agent.body, 'visionCellCount'> };
  };
  delete (legacyBrain.agent.body as { visionCellCount?: number }).visionCellCount;

  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [legacyBrain],
    })
  );

  const loaded = loadBrainLibraryWithStatus();

  assert.equal(loaded.status.state, 'ok');
  assert.equal(loaded.brains.length, 1);
  assert.equal(loaded.brains[0].agent.body.visionCellCount, 2);

  const persisted = JSON.parse(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY) ?? 'null') as {
    brains: Array<{ agent: { body: { visionCellCount: number } } }>;
  };
  assert.equal(persisted.brains[0].agent.body.visionCellCount, 2);
});

test('Brain Library storage normalizes top-level metadata to agent metadata truth', () => {
  const storage = installMemoryLocalStorage();
  const brain = createAgentPackage('Metadata Brain', createDefaultGraphIRDocument(1));
  const inconsistentBrain = {
    ...brain,
    metadata: {
      ...brain.metadata,
      id: 'top-level-id',
      name: 'Top Level Name',
    },
    agent: {
      ...brain.agent,
      metadata: {
        ...brain.agent.metadata,
        id: 'agent-level-id',
        name: 'Agent Level Name',
      },
    },
  };

  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [inconsistentBrain],
    })
  );

  const loaded = loadBrainLibraryWithStatus();

  assert.equal(loaded.status.state, 'ok');
  assert.equal(loaded.brains[0].metadata.id, 'agent-level-id');
  assert.equal(loaded.brains[0].metadata.name, 'Agent Level Name');
  assert.equal(loaded.brains[0].agent.metadata.id, 'agent-level-id');
  assert.equal(loaded.brains[0].agent.metadata.name, 'Agent Level Name');

  const persisted = JSON.parse(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY) ?? 'null') as {
    brains: Array<{ metadata: { id: string; name: string }; agent: { metadata: { id: string; name: string } } }>;
  };
  assert.equal(persisted.brains[0].metadata.id, 'agent-level-id');
  assert.equal(persisted.brains[0].metadata.name, 'Agent Level Name');
});

test('normalizeImportedAgentPackage applies import name and rewrites conflicting ids', () => {
  const brain = createAgentPackage('Import Source', createDefaultGraphIRDocument(1));
  const normalized = normalizeImportedAgentPackage(brain, {
    name: 'Imported Brain',
    existingIds: [brain.metadata.id],
  });

  assert.ok(normalized);
  assert.equal(normalized.metadata.name, 'Imported Brain');
  assert.equal(normalized.agent.metadata.name, 'Imported Brain');
  assert.notEqual(normalized.metadata.id, brain.metadata.id);
  assert.equal(normalized.metadata.id, normalized.agent.metadata.id);
});

test('Brain Library export payload can round-trip through import normalization', () => {
  const brain = createAgentPackage('Roundtrip Brain', createDefaultGraphIRDocument(1));
  const record = createBrainLibraryItemFromAgent('Roundtrip Brain', brain.agent);
  const exported = encodeBrainLibraryRecord(record);
  const normalized = normalizeImportedAgentPackage(exported, {
    existingIds: [],
  });

  assert.ok(normalized);
  assert.equal(normalized.metadata.name, 'Roundtrip Brain');
  assert.equal(normalized.agent.metadata.name, 'Roundtrip Brain');
  assert.equal(normalized.agent.body.visionCellCount, brain.agent.body.visionCellCount);
});
