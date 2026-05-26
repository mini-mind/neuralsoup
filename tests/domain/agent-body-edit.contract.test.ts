import test from 'node:test';
import assert from 'node:assert/strict';
import type { BodyIR } from '../../src/domain/brain';
import { mutateBodyIR } from '../../src/domain/brain';

const createBody = (): BodyIR => ({
  inputEndpoints: [
    { id: 'in-1', source: 'vision.G.0', worldPort: 'vision', scale: 1 },
    { id: 'in-2', source: 'vision.R.1', worldPort: 'vision', scale: 1 },
  ],
  outputEndpoints: [{ id: 'out-1', target: 'action.turn-left', worldPort: 'action', decayPerSecond: 1 }],
  mappings: [
    { id: 'map-in-1', kind: 'input', endpointId: 'in-1', nodeId: 'sensor-0' },
    { id: 'map-out-1', kind: 'output', endpointId: 'out-1', nodeId: 'effector-left' },
  ],
});

test('mutateBodyIR replaces mapping for node as atomic domain operation', () => {
  const body = createBody();
  const result = mutateBodyIR(body, [
    {
      type: 'mapping.replace-for-node',
      scope: 'input',
      nodeId: 'sensor-0',
      mapping: { id: 'map-in-2', kind: 'input', endpointId: 'in-2', nodeId: 'sensor-0' },
    },
  ]);

  assert.equal(result.changed, true);
  assert.deepEqual(
    result.body.mappings.filter((mapping) => mapping.kind === 'input'),
    [{ id: 'map-in-2', kind: 'input', endpointId: 'in-2', nodeId: 'sensor-0' }]
  );
});

test('mutateBodyIR can remove endpoint and prune related mappings in one mutation', () => {
  const body = createBody();
  const result = mutateBodyIR(body, [
    {
      type: 'input-endpoint.remove',
      endpointId: 'in-1',
      pruneMappings: true,
    },
  ]);

  assert.equal(result.changed, true);
  assert.deepEqual(
    result.body.inputEndpoints.map((endpoint) => endpoint.id),
    ['in-2']
  );
  assert.equal(
    result.body.mappings.some((mapping) => mapping.kind === 'input' && mapping.endpointId === 'in-1'),
    false
  );
});

test('mutateBodyIR supports no-op updates without fabricating changes', () => {
  const body = createBody();
  const result = mutateBodyIR(body, [
    {
      type: 'mapping.upsert',
      mapping: { id: 'map-in-1', kind: 'input', endpointId: 'in-1', nodeId: 'sensor-0' },
    },
    {
      type: 'mapping.remove',
      mappingId: 'missing',
    },
  ]);

  assert.equal(result.changed, false);
  assert.deepEqual(result.body, body);
});
