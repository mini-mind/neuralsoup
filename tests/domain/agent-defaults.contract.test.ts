import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultAgentIR, deriveAgentIRVisionCellCount, summarizeAgentIR, validateAgentIR } from '../../src/domain/brain';

test('default AgentIR seed is valid and exposes vision-aligned body and runtime counts', () => {
  const agent = createDefaultAgentIR(4, 'Seed Agent');

  assert.equal(agent.metadata.name, 'Seed Agent');
  assert.equal(deriveAgentIRVisionCellCount(agent), 4);
  assert.deepEqual(validateAgentIR(agent), []);
  assert.deepEqual(summarizeAgentIR(agent), {
    inputSignalCount: 15,
    outputSignalCount: 3,
    neuronCount: 2,
    leafLinkCount: agent.connections.length,
  });
});

test('default AgentIR seed layout does not persist compat-only bridge nodes', () => {
  const agent = createDefaultAgentIR(4, 'Seed Agent');
  const layoutNodeIds = new Set(Object.keys(agent.layout?.nodes ?? {}));

  assert.equal(layoutNodeIds.has('core-input-adapter'), false);
  assert.equal(layoutNodeIds.has('core-output-adapter'), false);
  assert.equal(layoutNodeIds.has('core-input-R'), false);
  assert.equal(layoutNodeIds.has('core-input-G'), false);
  assert.equal(layoutNodeIds.has('core-input-B'), false);
  assert.equal(layoutNodeIds.has('core-output-turn-left'), false);
  assert.equal(layoutNodeIds.has('core-output-move-forward'), false);
  assert.equal(layoutNodeIds.has('core-output-turn-right'), false);
  assert.equal(layoutNodeIds.has('input-adapter'), false);
  assert.equal(layoutNodeIds.has('output-adapter'), false);
  assert.equal(layoutNodeIds.has('core-neuron-group'), true);
  assert.equal(layoutNodeIds.has('neuron-1'), true);
  assert.equal(layoutNodeIds.has('neuron-2'), true);
});
