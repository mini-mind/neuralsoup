import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrainLayoutFromDefinition,
  createBrainPackage,
  createDefaultBodyDefinition,
  createDefaultGraphIRDocument,
  getBodyVisionCellCount,
  isBrainPackage,
} from '../../src/domain/brain/compat';

test('createDefaultBodyDefinition maps vision cells and motor channels into explicit body signals', () => {
  const body = createDefaultBodyDefinition(2);

  assert.equal(body.inputSignals.length, 6);
  assert.equal(body.outputSignals.length, 3);
  assert.equal(body.brainBindings.inputs.length, 6);
  assert.equal(body.brainBindings.outputs.length, 3);
  assert.deepEqual(
    body.brainBindings.outputs.map((binding) => binding.brainSignalNodeId),
    ['output-turn-left', 'output-move-forward', 'output-turn-right']
  );
});

test('getBodyVisionCellCount derives the world vision width from body input signals', () => {
  assert.equal(getBodyVisionCellCount(createDefaultBodyDefinition(0)), 0);
  assert.equal(getBodyVisionCellCount(createDefaultBodyDefinition(24)), 24);
});

test('createBrainLayoutFromDefinition extracts node position and collapsed state into layout document', () => {
  const document = createDefaultGraphIRDocument(1);
  const layout = createBrainLayoutFromDefinition(document);

  assert.equal(layout.version, 1);
  assert.ok(layout.nodes['input-adapter']);
  assert.ok(layout.nodes['core-neuron-group']);
});

test('createBrainPackage wraps brain definition with metadata, layout, and default body', () => {
  const document = createDefaultGraphIRDocument(2);
  const brainPackage = createBrainPackage('Test Brain', document);

  assert.equal(brainPackage.packageVersion, 1);
  assert.equal(brainPackage.metadata.name, 'Test Brain');
  assert.equal(brainPackage.definition, document);
  assert.ok(brainPackage.layout);
  assert.ok(brainPackage.body);
  assert.equal(brainPackage.body?.brainBindings.inputs.length, 6);
});

test('isBrainPackage requires complete package body and layout instead of backfilling compatibility defaults', () => {
  const document = createDefaultGraphIRDocument(1);
  const brainPackage = createBrainPackage('Strict Brain', document);

  assert.equal(isBrainPackage(brainPackage), true);
  assert.equal(isBrainPackage({ ...brainPackage, body: undefined }), false);
  assert.equal(isBrainPackage({ ...brainPackage, layout: undefined }), false);
});
