import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GraphIRValidationError,
  collectNeuronNodes,
  collectSignalNodes,
  summarizeGraphIRDocument,
  validateGraphIRDocument,
  type GraphIRDocument,
} from '../../src/domain/brain/ir';
import { createDefaultGraphIRDocument } from '../../src/compat/legacyGraphDefaults';
import { compileLegacyBrainDefinition } from '../../src/compat/legacyBrainCompiler';
import { createDefaultLegacyBodyDefinition } from '../../src/compat/legacyBrainPackage';
import type { LegacyBrainProgram } from '../../src/compat/legacyBrainProgram';

const getLegacyRootVisionCells = (document: GraphIRDocument) => {
  const inputAdapter = document.root.children.find((node) => node.id === 'input-adapter' && node.kind === 'adapter');
  return inputAdapter?.kind === 'adapter' ? inputAdapter.children.length / 3 : 1;
};

const compileDefaultLegacyBrain = (document: GraphIRDocument) =>
  compileLegacyBrainDefinition(document, createDefaultLegacyBodyDefinition(getLegacyRootVisionCells(document)));

test('legacy GraphIR document compiles into a compat runtime program with vision-aligned bindings', () => {
  const document = createDefaultGraphIRDocument(24);
  const program: LegacyBrainProgram = compileDefaultLegacyBrain(document);

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
  assert.equal('compiledAgentProgram' in (program as LegacyBrainProgram & Record<string, unknown>), false);
  assert.equal('legacyGraphIR' in (program as LegacyBrainProgram & Record<string, unknown>), false);
});

test('compileLegacyBrainDefinition rejects legacy drafts whose lowering drops bridge links', () => {
  const document = createDefaultGraphIRDocument(1);
  document.root.links.push({
    id: 'output-to-neuron',
    from: { nodeId: 'output-turn-left', portId: 'out' },
    to: { nodeId: 'neuron-1', portId: 'dendrite' },
    weight: 1,
  });

  assert.throws(
    () => compileDefaultLegacyBrain(document),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('Legacy GraphIR compilation cannot preserve legacy draft link')
  );
});

test('default legacy GraphIR summary reflects leaf topology counts', () => {
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

test('legacy GraphIR validation rejects dangling leaf link node references', () => {
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

test('legacy GraphIR validation rejects links that target output-only ports', () => {
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
    () => compileDefaultLegacyBrain(document),
    (error: unknown) =>
      error instanceof GraphIRValidationError &&
      error.issues.some((issue) => issue.code === 'invalid-link-direction')
  );
});
