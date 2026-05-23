import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultAgentIR, deriveAgentIRVisionCellCount } from '../../src/domain/brain';
import { createBrainLibraryItemFromAgent } from '../../src/storage/brainLibraryRecord';
import {
  BRAIN_LIBRARY_STORAGE_KEY,
  loadBrainLibraryWithStatus,
} from '../../src/storage/brainLibraryStorage';
import {
  encodeBrainLibraryRecordAsLegacyAgentPackage,
  encodeBrainLibraryRecordForExchange,
  normalizeImportedBrainExchange,
} from '../../src/storage/brainLibraryExchange';
import type { AgentLibraryItem } from '../../src/domain/brain';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
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

const createAgentPackage = (name: string, visionCells: number): AgentLibraryItem => {
  const agent = createDefaultAgentIR(visionCells, name);
  return {
    packageVersion: 1,
    metadata: { ...agent.metadata },
    agent,
  };
};

test('Brain Library default exchange payload is AgentIR-native and round-trips through import normalization', () => {
  const brain = createAgentPackage('Roundtrip Brain', 1);
  const record = createBrainLibraryItemFromAgent('Roundtrip Brain', brain.agent);
  const exported = encodeBrainLibraryRecordForExchange(record);
  const normalized = normalizeImportedBrainExchange(exported, {
    existingIds: [],
  });

  assert.ok(normalized);
  assert.equal(exported.version, 1);
  assert.equal(exported.kind, 'neuralsoup-agent');
  assert.equal(normalized.agent.metadata.name, 'Roundtrip Brain');
  assert.equal(deriveAgentIRVisionCellCount(normalized.agent), brain.agent.body.visionCellCount);
  assert.equal('visionCellCount' in JSON.parse(JSON.stringify(exported)).agent.body, false);
});

test('Brain Library import normalization accepts legacy AgentPackage envelopes as compat input', () => {
  const brain = createAgentPackage('Import Source', 1);
  const normalized = normalizeImportedBrainExchange(brain, {
    name: 'Imported Brain',
    existingIds: [brain.agent.metadata.id],
  });

  assert.ok(normalized);
  assert.equal(normalized.agent.metadata.name, 'Imported Brain');
  assert.notEqual(normalized.agent.metadata.id, brain.agent.metadata.id);
});

test('Brain Library import normalization accepts legacy envelopes without top-level metadata', () => {
  const brain = createAgentPackage('Import Without Envelope Metadata', 1);
  const normalized = normalizeImportedBrainExchange({
    packageVersion: 1,
    agent: brain.agent,
  });

  assert.ok(normalized);
  assert.equal(normalized.agent.metadata.name, 'Import Without Envelope Metadata');
});

test('Brain Library storage migrates legacy AgentPackage payloads missing body visionCellCount', () => {
  const storage = installMemoryLocalStorage();
  const brain = createAgentPackage('Legacy Agent', 2);
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
  assert.equal(deriveAgentIRVisionCellCount(loaded.brains[0].agent), 2);

  const persisted = JSON.parse(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY) ?? 'null') as {
    brains: Array<{ packageVersion?: number; metadata?: Record<string, unknown>; agent: { body: Record<string, unknown> } }>;
  };
  assert.equal('packageVersion' in persisted.brains[0], false);
  assert.equal('metadata' in persisted.brains[0], false);
  assert.equal('visionCellCount' in persisted.brains[0].agent.body, false);
});

test('Brain Library storage preserves sparse legacy vision-cell counts without writing body visionCellCount', () => {
  const storage = installMemoryLocalStorage();
  const brain = createAgentPackage('Sparse Legacy Agent', 36);
  brain.agent.connections = [
    {
      id: 'sparse-input',
      from: { scope: 'bodyInput', nodeId: 'vision-G-2', portId: 'out' },
      to: { scope: 'brain', nodeId: 'neuron-1', portId: 'dendrite' },
      weight: 1,
    },
  ];

  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [brain],
    })
  );

  const loaded = loadBrainLibraryWithStatus();
  assert.equal(loaded.status.state, 'ok');
  assert.equal(deriveAgentIRVisionCellCount(loaded.brains[0].agent), 36);

  const persisted = JSON.parse(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY) ?? 'null') as {
    brains: Array<{ packageVersion?: number; metadata?: Record<string, unknown>; agent: { body: Record<string, unknown>; layout?: { nodes?: Record<string, unknown> } } }>;
  };
  assert.equal('packageVersion' in persisted.brains[0], false);
  assert.equal('metadata' in persisted.brains[0], false);
  assert.equal('visionCellCount' in persisted.brains[0].agent.body, false);
  assert.ok(persisted.brains[0].agent.layout?.nodes?.['__body-vision-cell-35']);
});

test('Brain Library storage normalizes legacy top-level metadata to agent metadata truth', () => {
  const storage = installMemoryLocalStorage();
  const brain = createAgentPackage('Metadata Brain', 1);
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
  assert.equal(loaded.brains[0].agent.metadata.id, 'agent-level-id');
  assert.equal(loaded.brains[0].agent.metadata.name, 'Agent Level Name');

  const persisted = JSON.parse(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY) ?? 'null') as {
    brains: Array<{ metadata?: { id: string; name: string }; agent: { metadata: { id: string; name: string } } }>;
  };
  assert.equal(persisted.brains[0].metadata, undefined);
  assert.equal(persisted.brains[0].agent.metadata.id, 'agent-level-id');
  assert.equal(persisted.brains[0].agent.metadata.name, 'Agent Level Name');
});

test('Brain Library storage accepts legacy payloads without top-level metadata and rewrites canonical records', () => {
  const storage = installMemoryLocalStorage();
  const brain = createAgentPackage('Metadata Optional Brain', 1);
  const brainWithoutTopLevelMetadata = {
    packageVersion: brain.packageVersion,
    agent: brain.agent,
  };

  storage.setItem(
    BRAIN_LIBRARY_STORAGE_KEY,
    JSON.stringify({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [brainWithoutTopLevelMetadata],
    })
  );

  const loaded = loadBrainLibraryWithStatus();

  assert.equal(loaded.status.state, 'ok');
  assert.equal(loaded.brains[0].agent.metadata.name, 'Metadata Optional Brain');

  const persisted = JSON.parse(storage.getItem(BRAIN_LIBRARY_STORAGE_KEY) ?? 'null') as {
    brains: Array<{ metadata?: { id: string; name: string }; agent: { metadata: { id: string; name: string } } }>;
  };
  assert.equal(persisted.brains[0].metadata, undefined);
  assert.equal(persisted.brains[0].agent.metadata.id, loaded.brains[0].agent.metadata.id);
  assert.equal(persisted.brains[0].agent.metadata.name, loaded.brains[0].agent.metadata.name);
});

test('Brain Library legacy export codec remains available as explicit compat surface', () => {
  const brain = createAgentPackage('Legacy Export Brain', 1);
  const record = createBrainLibraryItemFromAgent('Legacy Export Brain', brain.agent);
  const exported = encodeBrainLibraryRecordAsLegacyAgentPackage(record);

  assert.equal(exported.packageVersion, 1);
  assert.equal(exported.metadata.name, 'Legacy Export Brain');
  assert.equal(exported.agent.metadata.name, 'Legacy Export Brain');
});
