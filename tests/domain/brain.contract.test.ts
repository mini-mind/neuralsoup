import test from 'node:test';
import assert from 'node:assert/strict';
import { BrainGraphValidationError, compileBrainGraph, createDefaultBrainGraph, validateBrainGraph } from '../../src/domain/brain';

test('default brain graph compiles into a program with vision-aligned ports', () => {
  const graph = createDefaultBrainGraph(24);
  const program = compileBrainGraph(graph);

  assert.equal(program.inputPorts.length, 72);
  assert.equal(program.outputPorts.length, 3);
  assert.equal(program.neuronNodes.length, 2);
  assert.deepEqual(
    program.outputPorts.map((output) => output.channel),
    ['turn-left', 'move-forward', 'turn-right']
  );
});

test('validation rejects dangling synapse references', () => {
  const graph = createDefaultBrainGraph(12);
  graph.synapses.push({
    id: 'synapse-missing-target',
    from: 'vision-R-0',
    to: 'neuron-missing',
    weight: 0.8,
  });

  const issues = validateBrainGraph(graph);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.code, 'missing-synapse-target');
});

test('validation rejects output-to-output or output-source synapses', () => {
  const graph = createDefaultBrainGraph(8);
  graph.synapses.push({
    id: 'synapse-invalid-direction',
    from: 'output-turn-left',
    to: 'output-turn-right',
    weight: 1,
  });

  assert.throws(
    () => compileBrainGraph(graph),
    (error: unknown) =>
      error instanceof BrainGraphValidationError &&
      error.issues.some((issue) => issue.includes('invalid direction output -> output'))
  );
});
