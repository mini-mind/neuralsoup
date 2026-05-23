import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultAgentIR, deriveAgentIRVisionCellCount } from '../../src/domain/brain';
import { createBrainLibraryItemFromAgent } from '../../src/storage/brainLibraryRecord';
import {
  encodeBrainLibraryRecordAsLegacyAgentPackage,
  encodeBrainLibraryRecordForExchange,
  normalizeImportedBrainExchange,
} from '../../src/storage/brainLibraryExchange';
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

test('Brain Library legacy export codec remains available as explicit compat surface', () => {
  const brain = createAgentPackage('Legacy Export Brain', 1);
  const record = createBrainLibraryItemFromAgent('Legacy Export Brain', brain.agent);
  const exported = encodeBrainLibraryRecordAsLegacyAgentPackage(record);

  assert.equal(exported.packageVersion, 1);
  assert.equal(exported.metadata.name, 'Legacy Export Brain');
  assert.equal(exported.agent.metadata.name, 'Legacy Export Brain');
});
