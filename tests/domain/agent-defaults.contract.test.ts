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
