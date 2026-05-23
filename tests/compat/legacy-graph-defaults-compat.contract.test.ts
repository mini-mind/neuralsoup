import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidGraphIRDocument,
  validateGraphIRDocument,
} from '../../src/compat/legacyGraphIR';
import type { GraphIRDocument } from '../../src/compat/legacyGraphIR';
import {
  createDefaultGraphIRDocument,
  reconcileGraphIRDocumentVisionCells,
} from '../../src/compat/legacyGraphDefaults';

test('default Graph IR document is valid', () => {
  const document = createDefaultGraphIRDocument(4);

  assert.deepEqual(validateGraphIRDocument(document), []);
  assert.doesNotThrow(() => assertValidGraphIRDocument(document));
});

test('default Graph IR document scales vision input signals with visionCells', () => {
  const smallDocument = createDefaultGraphIRDocument(2);
  const largeDocument = createDefaultGraphIRDocument(5);
  const smallInputAdapter = smallDocument.root.children.find((node) => node.id === 'input-adapter');
  const largeInputAdapter = largeDocument.root.children.find((node) => node.id === 'input-adapter');

  assert.ok(smallInputAdapter && smallInputAdapter.kind === 'adapter');
  assert.ok(largeInputAdapter && largeInputAdapter.kind === 'adapter');
  assert.equal(smallInputAdapter.children.length, 6);
  assert.equal(largeInputAdapter.children.length, 15);
});

test('default Graph IR document contains top-level input and output adapters', () => {
  const document = createDefaultGraphIRDocument(3);
  const inputAdapter = document.root.children.find((node) => node.id === 'input-adapter');
  const outputAdapter = document.root.children.find((node) => node.id === 'output-adapter');

  assert.ok(inputAdapter && inputAdapter.kind === 'adapter');
  assert.ok(outputAdapter && outputAdapter.kind === 'adapter');
  assert.equal(inputAdapter.adapterType, 'input');
  assert.equal(outputAdapter.adapterType, 'output');
  assert.equal(inputAdapter.children.every((node) => node.kind === 'signal' && node.direction === 'input'), true);
  assert.equal(outputAdapter.children.every((node) => node.kind === 'signal' && node.direction === 'output'), true);
  assert.deepEqual(
    outputAdapter.children.map((node) => node.id),
    ['output-turn-left', 'output-move-forward', 'output-turn-right']
  );
});

test('default Graph IR document uses explicit world-facing signal metadata for vision inputs and motor outputs', () => {
  const document = createDefaultGraphIRDocument(2);
  const inputAdapter = document.root.children.find((node) => node.id === 'input-adapter');
  const outputAdapter = document.root.children.find((node) => node.id === 'output-adapter');

  assert.ok(inputAdapter && inputAdapter.kind === 'adapter');
  assert.ok(outputAdapter && outputAdapter.kind === 'adapter');
  assert.equal(inputAdapter.children.every((node) => node.kind === 'signal'), true);
  assert.equal(outputAdapter.children.every((node) => node.kind === 'signal'), true);
  const inputSignals = inputAdapter.children.filter((node) => node.kind === 'signal');
  const outputSignals = outputAdapter.children.filter((node) => node.kind === 'signal');
  assert.deepEqual(
    inputSignals.map((node) => node.signal.id),
    ['vision-r', 'vision-r', 'vision-g', 'vision-g', 'vision-b', 'vision-b']
  );
  assert.deepEqual(
    [...new Set(outputSignals.map((node) => node.signal.id))],
    ['turn-left', 'move-forward', 'turn-right']
  );
  assert.equal(inputSignals.every((node) => node.signal.doc?.includes('World observation channel metadata') === true), true);
  assert.equal(outputSignals.every((node) => node.signal.doc?.includes('World action channel metadata') === true), true);
});

test('default Graph IR document only links leaf nodes', () => {
  const document = createDefaultGraphIRDocument(2);
  const leafNodeIds = new Set<string>();

  const visit = (nodes: GraphIRDocument['root']['children']): void => {
    for (const node of nodes) {
      if (node.kind === 'neuron' || node.kind === 'signal') {
        leafNodeIds.add(node.id);
        continue;
      }

      visit(node.children);
    }
  };

  visit(document.root.children);

  for (const link of document.root.links) {
    assert.equal(leafNodeIds.has(link.from.nodeId), true, `source ${link.from.nodeId} should be leaf`);
    assert.equal(leafNodeIds.has(link.to.nodeId), true, `target ${link.to.nodeId} should be leaf`);
  }
});

test('default Graph IR document keeps default neuron-group semantics', () => {
  const document = createDefaultGraphIRDocument(1);
  const neuronGroup = document.root.children.find((node) => node.id === 'core-neuron-group');
  const neuronModel = document.models.find((model) => model.id === 'izhikevich-neuron');

  assert.ok(neuronGroup && neuronGroup.kind === 'neuron-group');
  assert.equal(neuronGroup.children.length, 4);
  assert.deepEqual(
    neuronGroup.children.map((node) => node.id),
    ['core-input-adapter', 'neuron-1', 'neuron-2', 'core-output-adapter']
  );
  assert.ok(neuronModel);
  assert.deepEqual(
    neuronModel.parameters.map((parameter) => parameter.id),
    ['a', 'b', 'c', 'd', 'threshold']
  );
  assert.deepEqual(
    neuronModel.equations.map((equation) => equation.id),
    ['dv', 'du']
  );
  const emitSpikeStep = neuronModel.update.find((step) => step.id === 'emit-spike');
  assert.ok(emitSpikeStep);
  const spikeResetAssignments = JSON.stringify(emitSpikeStep.body);
  assert.equal(spikeResetAssignments.includes('"target":"v"'), true);
  assert.equal(spikeResetAssignments.includes('"target":"u"'), true);
  assert.equal(spikeResetAssignments.includes('"target":"drive"'), true);
});

test('default Graph IR document keeps default seed connectivity explicit', () => {
  const document = createDefaultGraphIRDocument(1);

  assert.deepEqual(
    document.root.links.map((link) => ({
      id: link.id,
      from: link.from.nodeId,
      to: link.to.nodeId,
      weight: link.weight,
    })),
    [
      {
        id: 'link-vision-R-0-neuron-1',
        from: 'vision-R-0',
        to: 'core-input-R',
        weight: 1,
      },
      {
        id: 'link-vision-G-0-neuron-1',
        from: 'vision-G-0',
        to: 'core-input-G',
        weight: 0.75,
      },
      {
        id: 'link-vision-B-0-neuron-2',
        from: 'vision-B-0',
        to: 'core-input-B',
        weight: 0.75,
      },
      {
        id: 'link-core-input-R-neuron-1',
        from: 'core-input-R',
        to: 'neuron-1',
        weight: 1,
      },
      {
        id: 'link-core-input-G-neuron-1',
        from: 'core-input-G',
        to: 'neuron-1',
        weight: 0.75,
      },
      {
        id: 'link-core-input-B-neuron-2',
        from: 'core-input-B',
        to: 'neuron-2',
        weight: 0.75,
      },
      {
        id: 'link-neuron-1-neuron-2',
        from: 'neuron-1',
        to: 'neuron-2',
        weight: 0.5,
      },
      {
        id: 'link-neuron-1-output-move-forward',
        from: 'neuron-1',
        to: 'core-output-move-forward',
        weight: 1,
      },
      {
        id: 'link-core-output-move-forward-output-move-forward',
        from: 'core-output-move-forward',
        to: 'output-move-forward',
        weight: 1,
      },
      {
        id: 'link-neuron-2-output-turn-left',
        from: 'neuron-2',
        to: 'core-output-turn-left',
        weight: 1,
      },
      {
        id: 'link-core-output-turn-left-output-turn-left',
        from: 'core-output-turn-left',
        to: 'output-turn-left',
        weight: 1,
      },
      {
        id: 'link-neuron-2-output-turn-right',
        from: 'neuron-2',
        to: 'core-output-turn-right',
        weight: 1,
      },
      {
        id: 'link-core-output-turn-right-output-turn-right',
        from: 'core-output-turn-right',
        to: 'output-turn-right',
        weight: 1,
      },
    ]
  );
});

test('reconcileGraphIRDocumentVisionCells preserves custom neuron-group children and local links', () => {
  const document = createDefaultGraphIRDocument(2);
  const coreGroup = document.root.children.find((node) => node.id === 'core-neuron-group');
  assert.ok(coreGroup && coreGroup.kind === 'neuron-group');

  coreGroup.children.push({
    kind: 'neuron',
    id: 'neuron-3',
    label: '神经元3',
    modelId: 'izhikevich-neuron',
    position: { x: 360, y: 220 },
  });
  document.root.links.push({
    id: 'link-neuron-1-neuron-3',
    from: {
      nodeId: 'neuron-1',
      portId: 'axon',
    },
    to: {
      nodeId: 'neuron-3',
      portId: 'dendrite',
    },
    weight: 0.8,
  });

  const reconciled = reconcileGraphIRDocumentVisionCells(document, 3);
  const reconciledCoreGroup = reconciled.root.children.find((node) => node.id === 'core-neuron-group');
  assert.ok(reconciledCoreGroup && reconciledCoreGroup.kind === 'neuron-group');

  assert.equal(reconciledCoreGroup.children.some((child) => child.id === 'neuron-3'), true);
  assert.equal(reconciled.root.links.some((link) => link.id === 'link-neuron-1-neuron-3'), true);
});
