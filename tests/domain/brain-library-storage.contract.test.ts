import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisionActionSeedAgentIR, createVisionActionWorldRegistry } from '../../src/host';
import {
  BRAIN_LIBRARY_CORRUPT_STORAGE_KEY,
  BRAIN_LIBRARY_STATUS_STORAGE_KEY,
  BRAIN_LIBRARY_STORAGE_KEY,
  loadBrainLibraryWithStatus,
  saveBrainLibrary,
} from '../../src/storage/brainLibraryStorage';
import {
  createBrainLibraryItemFromAgent,
  isValidBrainLibraryAgentPayload,
  renameBrainLibraryItem,
  upsertBrainLibraryItemAgent,
} from '../../src/storage/brainLibraryRecord';

const WORLD_REGISTRY = createVisionActionWorldRegistry();

const createCanonicalV2Agent = (visionCells: number, name: string) => {
  return createVisionActionSeedAgentIR(visionCells, name);
};
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

test('Brain Library storage saves and loads v2 AgentIR record payloads', () => {
  const storage = installMemoryLocalStorage();
  const record = createBrainLibraryItemFromAgent('Stored Brain', createCanonicalV2Agent(1, 'Stored Brain'), WORLD_REGISTRY);

  saveBrainLibrary([record], WORLD_REGISTRY);
  const rawValue = storage.getItem(BRAIN_LIBRARY_STORAGE_KEY);
  assert.ok(rawValue);
  const parsedRaw = JSON.parse(rawValue);
  assert.equal(parsedRaw.storageVersion, 1);
  assert.equal('version' in parsedRaw.brains[0].agent, false);
  assert.equal('packageVersion' in JSON.parse(rawValue).brains[0], false);
  assert.equal('metadata' in JSON.parse(rawValue).brains[0], false);

  const loaded = loadBrainLibraryWithStatus(WORLD_REGISTRY);
  assert.equal(loaded.status.state, 'ok');
  assert.equal(loaded.brains.length, 1);
  assert.equal(loaded.brains[0].agent.metadata.name, 'Stored Brain');
});

test('Brain Library record creation rejects invalid AgentIR instead of persisting a corrupt entry', () => {
  const invalidAgent = createCanonicalV2Agent(1, 'Invalid Brain');
  invalidAgent.body.outputEndpoints[0] = {
    ...invalidAgent.body.outputEndpoints[0],
    target: 'thruster.$1',
  };

  assert.throws(
    () => createBrainLibraryItemFromAgent('Invalid Brain', invalidAgent, WORLD_REGISTRY),
    /当前 AgentIR 无效/
  );
});

test('Brain Library storage quarantines corrupted JSON payloads', () => {
  const storage = installMemoryLocalStorage();
  storage.setItem(BRAIN_LIBRARY_STORAGE_KEY, '{broken');

  const loaded = loadBrainLibraryWithStatus(WORLD_REGISTRY);

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /JSON 解析失败/);
  assert.equal(loaded.brains.length, 0);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY), null);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
  assert.ok(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY));
  assert.equal(loadBrainLibraryWithStatus(WORLD_REGISTRY).status.state, 'recovered');
  assert.ok(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY));
  saveBrainLibrary([], WORLD_REGISTRY);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY), null);
});

test('Brain Library recovered status survives repeated reads until a successful save clears it', () => {
  const storage = installMemoryLocalStorage();
  storage.setItem(BRAIN_LIBRARY_STORAGE_KEY, '{broken');

  const firstLoad = loadBrainLibraryWithStatus(WORLD_REGISTRY);
  const secondLoad = loadBrainLibraryWithStatus(WORLD_REGISTRY);

  assert.equal(firstLoad.status.state, 'recovered');
  assert.equal(secondLoad.status.state, 'recovered');
  assert.ok(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY));

  saveBrainLibrary([], WORLD_REGISTRY);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY), null);
});

test('Brain Library storage rejects old array payloads instead of migrating implicitly', () => {
  const storage = installMemoryLocalStorage();
  const brain = createBrainLibraryItemFromAgent(
    'Old Array Brain',
    createCanonicalV2Agent(1, 'Old Array Brain'),
    WORLD_REGISTRY
  );
  storage.setItem(BRAIN_LIBRARY_STORAGE_KEY, JSON.stringify([brain]));

  const loaded = loadBrainLibraryWithStatus(WORLD_REGISTRY);

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /存储格式无效/);
  assert.equal(loaded.brains.length, 0);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
});

test('Brain Library storage rejects envelope payloads with unexpected top-level keys', () => {
  const storage = installMemoryLocalStorage();
  const brain = createBrainLibraryItemFromAgent(
    'Unexpected Envelope Key',
    createCanonicalV2Agent(1, 'Unexpected Envelope Key'),
    WORLD_REGISTRY
  );
  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [brain],
      dirty: true,
    })
  );

  const loaded = loadBrainLibraryWithStatus(WORLD_REGISTRY);

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /存储格式无效/);
  assert.equal(loaded.brains.length, 0);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY), null);
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

  const loaded = loadBrainLibraryWithStatus(WORLD_REGISTRY);

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /存储格式无效/);
  assert.equal(loaded.brains.length, 0);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY), null);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
});

test('Brain Library storage rejects canonical records with unexpected top-level keys', () => {
  const storage = installMemoryLocalStorage();
  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [
        {
          agent: createCanonicalV2Agent(1, 'Record Dirty Key'),
          dirty: true,
        },
      ],
    })
  );

  const loaded = loadBrainLibraryWithStatus(WORLD_REGISTRY);

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /存储格式无效/);
  assert.equal(loaded.brains.length, 0);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY), null);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
});

test('Brain Library storage reports LocalStorage capacity write failures', () => {
  const storage = installMemoryLocalStorage();
  storage.failWrites = true;
  const record = createBrainLibraryItemFromAgent('Too Large', createCanonicalV2Agent(1, 'Too Large'), WORLD_REGISTRY);

  assert.throws(
    () => saveBrainLibrary([record], WORLD_REGISTRY),
    /Brain Library 保存失败：quota exceeded/
  );
});

test('Brain Library save rejects records with unexpected top-level keys instead of persisting them', () => {
  installMemoryLocalStorage();
  const record = createBrainLibraryItemFromAgent(
    'Save Dirty Key',
    createCanonicalV2Agent(1, 'Save Dirty Key'),
    WORLD_REGISTRY
  );
  const dirtyRecord = {
    ...record,
    dirty: true,
  };

  assert.throws(
    () => saveBrainLibrary([dirtyRecord as unknown as typeof record], WORLD_REGISTRY),
    /存储记录仅允许顶层 agent/
  );
});

test('Brain Library storage rejects canonical-envelope payloads when AgentIR is non-canonical', () => {
  const storage = installMemoryLocalStorage();
  const agent = createCanonicalV2Agent(2, 'Canonical Rewrite');
  const rawStoredRecord = structuredClone({ agent });

  rawStoredRecord.agent.layout ??= { nodes: {} };
  (rawStoredRecord.agent.layout.nodes as Record<string, Record<string, unknown>>)['neuron-1'] = {
    ...((rawStoredRecord.agent.layout.nodes as Record<string, Record<string, unknown>>)['neuron-1'] ?? {}),
    position: { x: 50, y: 150 },
    collapsed: false,
    size: { width: 999, height: 777 },
    expanded: true,
  };
  (rawStoredRecord.agent.layout as typeof rawStoredRecord.agent.layout & {
    viewportByContainerId?: Record<string, { x: number; y: number; scale: number }>;
  }).viewportByContainerId = {
    root: { x: 12, y: 34, scale: 1.5 },
  };

  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [rawStoredRecord],
    })
  );

  const loaded = loadBrainLibraryWithStatus(WORLD_REGISTRY);

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /仅支持当前 AgentIR 规范/);
  assert.equal(loaded.brains.length, 0);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY), null);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
});

test('Brain Library record creation rejects non-canonical layout fields instead of stripping them', () => {
  const agent = createCanonicalV2Agent(1, 'Layout Payload Validation');
  const candidate = {
    ...agent,
    layout: {
      nodes: {
        ...(agent.layout?.nodes ?? {}),
      },
      viewportByContainerId: {
        root: { x: 10, y: 20, scale: 1.2 },
      },
    },
  } as typeof agent & {
    layout: typeof agent.layout & {
      viewportByContainerId: Record<string, { x: number; y: number; scale: number }>;
    };
  };

  assert.equal(isValidBrainLibraryAgentPayload(candidate, WORLD_REGISTRY), false);
  assert.throws(
    () => createBrainLibraryItemFromAgent('Normalized Layout', candidate, WORLD_REGISTRY),
    /仅支持当前 AgentIR 规范/
  );
});

test('Brain Library canonical record storage rejects leaked non-canonical body fields on load', () => {
  const storage = installMemoryLocalStorage();
  const brain = createCanonicalV2Agent(2, 'Canonical Legacy Leak');
  const leakedBrain = {
    ...brain,
    body: {
      ...brain.body,
      visionCellCount: 2,
    },
  };

  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [
        {
          agent: leakedBrain,
        },
      ],
    })
  );

  const loaded = loadBrainLibraryWithStatus(WORLD_REGISTRY);

  assert.equal(loaded.status.state, 'recovered');
  assert.match(loaded.status.message ?? '', /仅支持当前 AgentIR 规范/);
  assert.equal(loaded.brains.length, 0);
  assert.equal(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY), null);
  assert.ok(storage.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
});

test('renameBrainLibraryItem updates canonical agent metadata only once', () => {
  const record = createBrainLibraryItemFromAgent('Rename Source', createCanonicalV2Agent(1, 'Rename Source'), WORLD_REGISTRY);

  const [renamed] = renameBrainLibraryItem([record], record.agent.metadata.id, 'Renamed Brain');
  assert.ok(renamed);
  assert.equal(renamed.agent.metadata.name, 'Renamed Brain');
});

test('upsertBrainLibraryItemAgent updates canonical agent metadata timestamps', () => {
  const record = createBrainLibraryItemFromAgent('Upsert Source', createCanonicalV2Agent(1, 'Upsert Source'), WORLD_REGISTRY);
  const replacement = createBrainLibraryItemFromAgent(
    'Replacement Draft',
    createCanonicalV2Agent(1, 'Replacement Draft'),
    WORLD_REGISTRY
  ).agent;

  const [updated] = upsertBrainLibraryItemAgent(
    [record],
    record.agent.metadata.id,
    replacement,
    WORLD_REGISTRY,
    '2026-05-23T04:30:00.000Z'
  );
  assert.ok(updated);
  assert.equal(updated.agent.metadata.updatedAt, '2026-05-23T04:30:00.000Z');
});
