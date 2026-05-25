import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisionActionSeedAgentIR, createVisionActionWorldRegistry } from '../../src/host';
import { createBrainLibraryItemFromAgent } from '../../src/storage/brainLibraryRecord';
import {
  encodeBrainLibraryRecordForExchange,
  normalizeImportedBrainExchange,
} from '../../src/storage/brainLibraryExchange';

const WORLD_REGISTRY = createVisionActionWorldRegistry();

const createAgentPackage = (name: string, visionCells: number) => {
  const agent = createVisionActionSeedAgentIR(visionCells, name);
  return {
    packageVersion: 1,
    metadata: { ...agent.metadata },
    agent,
  };
};

test('Brain Library default exchange payload is AgentIR-native and round-trips through import normalization', () => {
  const brain = createAgentPackage('Roundtrip Brain', 1);
  const record = createBrainLibraryItemFromAgent('Roundtrip Brain', brain.agent, WORLD_REGISTRY);
  const exported = encodeBrainLibraryRecordForExchange(record);
  const normalized = normalizeImportedBrainExchange(exported, WORLD_REGISTRY, {
    existingIds: [],
  });

  assert.ok(normalized);
  assert.equal(exported.version, 1);
  assert.equal(exported.kind, 'neuralsoup-agent');
  assert.equal(normalized.agent.metadata.name, 'Roundtrip Brain');
  assert.equal('visionCellCount' in normalized.agent.body, false);
  assert.equal('visionCellCount' in JSON.parse(JSON.stringify(exported)).agent.body, false);
});

test('Brain Library default import normalization rejects legacy AgentPackage compat payloads', () => {
  const brain = createAgentPackage('Import Source', 1);
  const normalized = normalizeImportedBrainExchange(brain, WORLD_REGISTRY, {
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
  }, WORLD_REGISTRY);

  assert.equal(normalized, null);
});
