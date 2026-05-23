import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultAgentIR, deriveAgentIRVisionCellCount } from '../../src/domain/brain';
import {
  encodeBrainLibraryRecordAsLegacyAgentPackage,
  isLegacyBrainLibraryStorageEnvelope,
  loadLegacyBrainLibraryStorageEnvelope,
  normalizeImportedLegacyBrainExchange,
} from '../../src/compat/brainLibraryCompat';
import { createBrainLibraryItemFromAgent } from '../../src/storage/brainLibraryRecord';
import {
  encodeBrainLibraryRecordForExchange,
  normalizeImportedBrainExchange,
} from '../../src/storage/brainLibraryExchange';
import {
  BRAIN_LIBRARY_CORRUPT_STORAGE_KEY,
  BRAIN_LIBRARY_STATUS_STORAGE_KEY,
  BRAIN_LIBRARY_STORAGE_KEY,
  loadBrainLibraryWithStatus,
} from '../../src/storage/brainLibraryStorage';
import type { AgentLibraryItem } from '../../src/domain/brain';

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
  assert.equal(JSON.parse(JSON.stringify(exported)).agent.body.visionCellCount, 1);
});

test('Brain Library default import normalization rejects legacy AgentPackage compat payloads', () => {
  const brain = createAgentPackage('Import Source', 1);
  const normalized = normalizeImportedBrainExchange(brain, {
    name: 'Imported Brain',
    existingIds: [brain.agent.metadata.id],
  });

  assert.equal(normalized, null);
});

test('Brain Library default import normalization rejects legacy envelopes without top-level metadata', () => {
  const brain = createAgentPackage('Import Without Envelope Metadata', 1);
  const normalized = normalizeImportedBrainExchange({
    packageVersion: 1,
    agent: brain.agent,
  });

  assert.equal(normalized, null);
});

test('explicit compat import normalization accepts legacy AgentPackage envelopes', () => {
  const brain = createAgentPackage('Import Source', 1);
  const normalized = normalizeImportedLegacyBrainExchange(brain, {
    name: 'Imported Brain',
    existingIds: [brain.agent.metadata.id],
  });

  assert.ok(normalized);
  assert.equal(normalized.agent.metadata.name, 'Imported Brain');
  assert.notEqual(normalized.agent.metadata.id, brain.agent.metadata.id);
});

test('explicit compat import normalization accepts legacy envelopes without top-level metadata', () => {
  const brain = createAgentPackage('Import Without Envelope Metadata', 1);
  const normalized = normalizeImportedLegacyBrainExchange({
    packageVersion: 1,
    agent: brain.agent,
  });

  assert.ok(normalized);
  assert.equal(normalized.agent.metadata.name, 'Import Without Envelope Metadata');
});

test('explicit compat storage loader migrates legacy AgentPackage payloads missing body visionCellCount', () => {
  const brain = createAgentPackage('Legacy Agent', 2);
  const legacyBrain = structuredClone(brain) as typeof brain & {
    agent: typeof brain.agent & { body: Omit<typeof brain.agent.body, 'visionCellCount'> };
  };
  delete (legacyBrain.agent.body as { visionCellCount?: number }).visionCellCount;

  const loaded = loadLegacyBrainLibraryStorageEnvelope({
    storageVersion: 1,
    savedAt: new Date().toISOString(),
    brains: [legacyBrain],
  });

  assert.ok(loaded);
  assert.equal(loaded.length, 1);
  assert.equal(deriveAgentIRVisionCellCount(loaded[0].agent), 2);
});

test('explicit compat storage loader preserves sparse legacy vision-cell counts by upgrading to canonical body visionCellCount', () => {
  const brain = createAgentPackage('Sparse Legacy Agent', 36);
  brain.agent.connections = [
    {
      id: 'sparse-input',
      from: { scope: 'bodyInput', nodeId: 'vision-G-2', portId: 'out' },
      to: { scope: 'brain', nodeId: 'neuron-1', portId: 'dendrite' },
      weight: 1,
    },
  ];

  const loaded = loadLegacyBrainLibraryStorageEnvelope({
    storageVersion: 1,
    savedAt: new Date().toISOString(),
    brains: [brain],
  });
  assert.ok(loaded);
  assert.equal(deriveAgentIRVisionCellCount(loaded[0].agent), 36);
  assert.equal(JSON.parse(JSON.stringify(loaded[0])).agent.body.visionCellCount, 36);
});

test('explicit compat storage loader preserves explicit legacy body visionCellCount when structural evidence is sparse', () => {
  const brain = createAgentPackage('Explicit Legacy Coverage', 36);
  brain.agent.connections = [
    {
      id: 'sparse-input',
      from: { scope: 'bodyInput', nodeId: 'vision-G-2', portId: 'out' },
      to: { scope: 'brain', nodeId: 'neuron-1', portId: 'dendrite' },
      weight: 1,
    },
  ];

  const loaded = loadLegacyBrainLibraryStorageEnvelope({
    storageVersion: 1,
    savedAt: new Date().toISOString(),
    brains: [brain],
  });

  assert.ok(loaded);
  assert.equal(loaded[0]?.agent.body.visionCellCount, 36);
  assert.equal(deriveAgentIRVisionCellCount(loaded[0]!.agent), 36);
});

test('explicit compat storage loader normalizes legacy top-level metadata to agent metadata truth', () => {
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

  const loaded = loadLegacyBrainLibraryStorageEnvelope({
    storageVersion: 1,
    savedAt: new Date().toISOString(),
    brains: [inconsistentBrain],
  });

  assert.ok(loaded);
  assert.equal(loaded[0].agent.metadata.id, 'agent-level-id');
  assert.equal(loaded[0].agent.metadata.name, 'Agent Level Name');
});

test('explicit compat storage loader accepts legacy payloads without top-level metadata', () => {
  const brain = createAgentPackage('Metadata Optional Brain', 1);
  const brainWithoutTopLevelMetadata = {
    packageVersion: brain.packageVersion,
    agent: brain.agent,
  };

  const loaded = loadLegacyBrainLibraryStorageEnvelope({
    storageVersion: 1,
    savedAt: new Date().toISOString(),
    brains: [brainWithoutTopLevelMetadata],
  });

  assert.ok(loaded);
  assert.equal(loaded[0].agent.metadata.name, 'Metadata Optional Brain');
});

test('production Brain Library storage entrypoint rejects legacy storage envelopes and quarantines them', () => {
  const brain = createAgentPackage('Legacy Storage In Production', 1);
  const legacyEnvelope = {
    storageVersion: 1,
    savedAt: new Date().toISOString(),
    brains: [brain],
  };
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };
  const originalWindow = globalThis.window;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: localStorageMock,
    },
  });

  try {
    localStorageMock.setItem(BRAIN_LIBRARY_STORAGE_KEY, JSON.stringify(legacyEnvelope));

    const loaded = loadBrainLibraryWithStatus();

    assert.deepEqual(loaded.brains, []);
    assert.equal(loaded.status.state, 'recovered');
    assert.ok(loaded.status.message?.includes('格式无效'));
    assert.equal(localStorageMock.getItem(BRAIN_LIBRARY_STORAGE_KEY), null);
    assert.ok(localStorageMock.getItem(BRAIN_LIBRARY_CORRUPT_STORAGE_KEY));
    assert.ok(localStorageMock.getItem(BRAIN_LIBRARY_STATUS_STORAGE_KEY));
  } finally {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});

test('legacy Brain Library storage envelope detection remains available as explicit compat surface', () => {
  const brain = createAgentPackage('Legacy Storage Shape', 1);
  assert.equal(
    isLegacyBrainLibraryStorageEnvelope({
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      brains: [brain],
    }),
    true
  );
});

test('Brain Library legacy export codec remains available as explicit compat surface', () => {
  const brain = createAgentPackage('Legacy Export Brain', 1);
  const record = createBrainLibraryItemFromAgent('Legacy Export Brain', brain.agent);
  const exported = encodeBrainLibraryRecordAsLegacyAgentPackage(record);

  assert.equal(exported.packageVersion, 1);
  assert.equal(exported.metadata.name, 'Legacy Export Brain');
  assert.equal(exported.agent.metadata.name, 'Legacy Export Brain');
});
