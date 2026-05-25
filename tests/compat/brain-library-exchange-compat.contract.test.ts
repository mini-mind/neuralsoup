import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVisionActionHostProfile,
  createVisionActionSeedAgentIR,
  createVisionActionWorldRegistry,
} from '../../src/host';
import {
  encodeBrainLibraryRecordAsLegacyAgentPackage,
  isLegacyBrainLibraryStorageEnvelope,
  loadLegacyBrainLibraryStorageEnvelope,
  normalizeImportedLegacyBrainExchange,
} from '../../src/compat/brainLibraryCompat';
import { deriveAgentIRVisionCellCount } from '../../src/compat/legacyVisionCellCount';
import { createBrainLibraryItemFromAgent } from '../../src/storage/brainLibraryRecord';
import {
  BRAIN_LIBRARY_CORRUPT_STORAGE_KEY,
  BRAIN_LIBRARY_STATUS_STORAGE_KEY,
  BRAIN_LIBRARY_STORAGE_KEY,
  loadBrainLibraryWithStatus,
} from '../../src/storage/brainLibraryStorage';
import type { AgentPackage as AgentLibraryItem } from '../../src/compat/legacyBrainPackage';

const WORLD_REGISTRY = createVisionActionWorldRegistry();

const createAgentPackage = (name: string, visionCells: number): AgentLibraryItem => {
  const agent = createVisionActionSeedAgentIR(visionCells, name);
  return {
    packageVersion: 1,
    metadata: { ...agent.metadata },
    agent,
  };
};

test('explicit compat import normalization accepts legacy AgentPackage envelopes', () => {
  const brain = createAgentPackage('Import Source', 1);
  const normalized = normalizeImportedLegacyBrainExchange(brain, WORLD_REGISTRY, {
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
  }, WORLD_REGISTRY);

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
  }, WORLD_REGISTRY);

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
  }, WORLD_REGISTRY);
  assert.ok(loaded);
  assert.equal(deriveAgentIRVisionCellCount(loaded[0].agent), 36);
  assert.equal('visionCellCount' in JSON.parse(JSON.stringify(loaded[0])).agent.body, false);
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
  }, WORLD_REGISTRY);

  assert.ok(loaded);
  assert.equal('visionCellCount' in (loaded[0]?.agent.body ?? {}), false);
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
  }, WORLD_REGISTRY);

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
  }, WORLD_REGISTRY);

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

    const loaded = loadBrainLibraryWithStatus(WORLD_REGISTRY);

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
    }, WORLD_REGISTRY),
    true
  );
});

test('explicit compat Brain Library import respects the caller registry instead of a hidden default registry', () => {
  const customHost = createVisionActionHostProfile({
    turnLeft: 'yaw-left',
    moveForward: 'thrust',
    turnRight: 'yaw-right',
  });
  const legacyAgent = customHost.createSeedAgentIR(1, 'Compat Custom Host');
  const legacyPackage = {
    packageVersion: 1,
    metadata: { ...legacyAgent.metadata },
    agent: legacyAgent,
  };

  const normalized = normalizeImportedLegacyBrainExchange(legacyPackage, customHost.worldRegistry, {
    existingIds: [],
  });

  assert.ok(normalized);
  assert.deepEqual(
    normalized.agent.body.outputRules.map((rule) => rule.nodeIdPattern),
    ['^output-(yaw-left|thrust|yaw-right)$']
  );
});

test('Brain Library legacy export codec remains available as explicit compat surface', () => {
  const brain = createAgentPackage('Legacy Export Brain', 1);
  const record = createBrainLibraryItemFromAgent('Legacy Export Brain', brain.agent, WORLD_REGISTRY);
  const exported = encodeBrainLibraryRecordAsLegacyAgentPackage(record);

  assert.equal(exported.packageVersion, 1);
  assert.equal(exported.metadata.name, 'Legacy Export Brain');
  assert.equal(exported.agent.metadata.name, 'Legacy Export Brain');
});
