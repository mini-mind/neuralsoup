import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GraphIRValidationError,
  collectNeuronNodes,
  collectSignalNodes,
  compileBrainDefinition,
  createDefaultBodyDefinition,
  createDefaultGraphIRDocument,
  summarizeGraphIRDocument,
  validateGraphIRDocument,
} from '../../src/domain/brain/compat';
import type { GraphIRDocument } from '../../src/domain/brain/compat';

const getRootVisionCells = (document: GraphIRDocument) => {
  const inputAdapter = document.root.children.find((node) => node.id === 'input-adapter' && node.kind === 'adapter');
  return inputAdapter?.kind === 'adapter' ? inputAdapter.children.length / 3 : 1;
};

const compileDefaultBrain = (document: GraphIRDocument) =>
  compileBrainDefinition(document, createDefaultBodyDefinition(getRootVisionCells(document)));

test('default GraphIR document compiles into a runtime program with vision-aligned bindings', () => {
  const document = createDefaultGraphIRDocument(24);
  const program = compileDefaultBrain(document);

  assert.equal(program.inputPorts.length, 72);
  assert.equal(program.outputPorts.length, 3);
  assert.equal(program.neuronNodes.length, 2);
  assert.equal(program.signalNodes.length, 81);
  assert.deepEqual(
    program.outputPorts.map((output) => output.channel),
    ['turn-left', 'move-forward', 'turn-right']
  );
  assert.deepEqual(
    program.outputBindings.map((binding) => binding.channel),
    ['turn-left', 'move-forward', 'turn-right']
  );
});

test('default GraphIR summary reflects leaf topology counts', () => {
  const document = createDefaultGraphIRDocument(4);

  assert.deepEqual(summarizeGraphIRDocument(document), {
    inputSignalCount: 15,
    outputSignalCount: 6,
    neuronCount: 2,
    leafLinkCount: 22,
  });
  assert.equal(collectSignalNodes(document.root.children, 'input').length, 15);
  assert.equal(collectSignalNodes(document.root.children, 'output').length, 6);
  assert.equal(collectNeuronNodes(document.root.children).length, 2);
});

test('validation rejects dangling leaf link node references', () => {
  const document = createDefaultGraphIRDocument(12);
  document.root.links.push({
    id: 'link-missing-target',
    from: {
      nodeId: 'vision-R-0',
      portId: 'out',
    },
    to: {
      nodeId: 'neuron-missing',
      portId: 'dendrite',
    },
    weight: 0.8,
  });

  const issues = validateGraphIRDocument(document);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code, 'missing-link-node');
});

test('validation rejects links that target output-only ports', () => {
  const document = createDefaultGraphIRDocument(8);
  document.root.links.push({
    id: 'link-invalid-direction',
    from: {
      nodeId: 'vision-R-0',
      portId: 'out',
    },
    to: {
      nodeId: 'output-turn-right',
      portId: 'out',
    },
    weight: 1,
  });

  assert.throws(
    () => compileDefaultBrain(document),
    (error: unknown) =>
      error instanceof GraphIRValidationError &&
      error.issues.some((issue) => issue.code === 'invalid-link-direction')
  );
});
