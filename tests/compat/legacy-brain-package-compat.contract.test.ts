import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLegacyAgentPackage,
  createDefaultLegacyBodyDefinition,
  createLegacyBrainLayoutFromDefinition,
  createLegacyBrainPackage,
  getLegacyBodyVisionCellCount,
  isLegacyBrainPackage,
} from '../../src/compat/legacyBrainPackage';
import { createDefaultGraphIRDocument } from '../../src/compat/legacyGraphDefaults';

test('createDefaultLegacyBodyDefinition maps vision cells and motor channels into explicit body signals', () => {
  const body = createDefaultLegacyBodyDefinition(2);

  assert.equal(body.inputSignals.length, 6);
  assert.equal(body.outputSignals.length, 3);
  assert.equal(body.brainBindings.inputs.length, 6);
  assert.equal(body.brainBindings.outputs.length, 3);
  assert.deepEqual(
    body.brainBindings.outputs.map((binding) => binding.brainSignalNodeId),
    ['output-turn-left', 'output-move-forward', 'output-turn-right']
  );
});

test('getLegacyBodyVisionCellCount derives the world vision width from body input signals', () => {
  assert.equal(getLegacyBodyVisionCellCount(createDefaultLegacyBodyDefinition(0)), 0);
  assert.equal(getLegacyBodyVisionCellCount(createDefaultLegacyBodyDefinition(24)), 24);
});

test('createLegacyBrainLayoutFromDefinition extracts node position and collapsed state into layout document', () => {
  const document = createDefaultGraphIRDocument(1);
  const layout = createLegacyBrainLayoutFromDefinition(document);

  assert.equal(layout.version, 1);
  assert.ok(layout.nodes['input-adapter']);
  assert.ok(layout.nodes['core-neuron-group']);
});

test('createLegacyBrainPackage wraps legacy GraphIR definition with compat metadata, layout, and body', () => {
  const document = createDefaultGraphIRDocument(2);
  const brainPackage = createLegacyBrainPackage('Test Brain', document);

  assert.equal(brainPackage.packageVersion, 1);
  assert.equal(brainPackage.metadata.name, 'Test Brain');
  assert.equal(brainPackage.definition, document);
  assert.ok(brainPackage.layout);
  assert.ok(brainPackage.body);
  assert.equal(brainPackage.body?.brainBindings.inputs.length, 6);
});

test('createLegacyAgentPackage rejects legacy drafts whose lowering drops bridge links', () => {
  const document = createDefaultGraphIRDocument(1);
  document.root.links.push({
    id: 'output-to-neuron',
    from: { nodeId: 'output-turn-left', portId: 'out' },
    to: { nodeId: 'neuron-1', portId: 'dendrite' },
    weight: 1,
  });

  assert.throws(
    () => createLegacyAgentPackage('Lossy Agent', document),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('Legacy Agent package creation cannot preserve legacy draft link')
  );
});

test('isLegacyBrainPackage keeps compat package validation strict instead of backfilling defaults', () => {
  const document = createDefaultGraphIRDocument(1);
  const brainPackage = createLegacyBrainPackage('Strict Brain', document);

  assert.equal(isLegacyBrainPackage(brainPackage), true);
  assert.equal(isLegacyBrainPackage({ ...brainPackage, body: undefined }), false);
  assert.equal(isLegacyBrainPackage({ ...brainPackage, layout: undefined }), false);
});
