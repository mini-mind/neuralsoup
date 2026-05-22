import test from 'node:test';
import assert from 'node:assert/strict';
import type { AgentIR } from '../../src/domain/brain';
import { aggregateAgentNodesIntoGroup, ungroupAgentContainer } from '../../src/components/editor/graph/agentGraphEditing';

const createEditingAgent = (): AgentIR => ({
  version: 1,
  metadata: {
    id: 'agent-editing-test',
    name: 'Agent Editing Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  body: {
    version: 1,
    inputRules: [],
    outputRules: [],
  },
  brain: {
    version: 1,
    rootContainerId: 'root-group',
    neurons: [
      {
        id: 'neuron-1',
        label: 'Neuron 1',
        model: 'izhikevich',
        params: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
        initialState: { v: -65 },
      },
      {
        id: 'neuron-2',
        label: 'Neuron 2',
        model: 'izhikevich',
        params: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
        initialState: { v: -65 },
      },
      {
        id: 'neuron-3',
        label: 'Neuron 3',
        model: 'izhikevich',
        params: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
        initialState: { v: -65 },
      },
    ],
    containers: [
      {
        id: 'root-group',
        label: 'Root',
        children: [
          { scope: 'brain', nodeId: 'neuron-1' },
          { scope: 'brain', nodeId: 'neuron-2' },
          { scope: 'brain', nodeId: 'neuron-3' },
        ],
      },
    ],
  },
  connections: [],
  layout: {
    version: 1,
    nodes: {
      'neuron-1': { position: { x: 120, y: 80 } },
      'neuron-2': { position: { x: 200, y: 140 } },
      'neuron-3': { position: { x: 320, y: 260 } },
    },
  },
});

test('aggregateAgentNodesIntoGroup rewrites parent children and stores child positions relative to the new group', () => {
  const next = aggregateAgentNodesIntoGroup(createEditingAgent(), {
    parentContainerId: 'root-group',
    selectedNodeIds: ['neuron-1', 'neuron-2'],
    nextGroupId: 'group-1',
    nextGroupLabel: '神经元组1',
    nextGroupPosition: { x: 120, y: 80 },
    childPositionsById: {
      'neuron-1': { x: 0, y: 0 },
      'neuron-2': { x: 80, y: 60 },
    },
  });

  const root = next.brain.containers.find((container) => container.id === 'root-group');
  const group = next.brain.containers.find((container) => container.id === 'group-1');

  assert.ok(root);
  assert.ok(group);
  assert.deepEqual(root.children, [
    { scope: 'container', nodeId: 'group-1' },
    { scope: 'brain', nodeId: 'neuron-3' },
  ]);
  assert.deepEqual(group.children, [
    { scope: 'brain', nodeId: 'neuron-1' },
    { scope: 'brain', nodeId: 'neuron-2' },
  ]);
  assert.deepEqual(next.layout?.nodes['group-1']?.position, { x: 120, y: 80 });
  assert.deepEqual(next.layout?.nodes['neuron-1']?.position, { x: 0, y: 0 });
  assert.deepEqual(next.layout?.nodes['neuron-2']?.position, { x: 80, y: 60 });
});

test('ungroupAgentContainer restores grouped children into parent scope and reprojects absolute positions', () => {
  const aggregated = aggregateAgentNodesIntoGroup(createEditingAgent(), {
    parentContainerId: 'root-group',
    selectedNodeIds: ['neuron-1', 'neuron-2'],
    nextGroupId: 'group-1',
    nextGroupLabel: '神经元组1',
    nextGroupPosition: { x: 120, y: 80 },
    childPositionsById: {
      'neuron-1': { x: 0, y: 0 },
      'neuron-2': { x: 80, y: 60 },
    },
  });
  const next = ungroupAgentContainer(aggregated, 'root-group', 'group-1');

  const root = next.brain.containers.find((container) => container.id === 'root-group');
  const group = next.brain.containers.find((container) => container.id === 'group-1');

  assert.ok(root);
  assert.equal(group, undefined);
  assert.deepEqual(root.children, [
    { scope: 'brain', nodeId: 'neuron-1' },
    { scope: 'brain', nodeId: 'neuron-2' },
    { scope: 'brain', nodeId: 'neuron-3' },
  ]);
  assert.equal(next.layout?.nodes['group-1'], undefined);
  assert.deepEqual(next.layout?.nodes['neuron-1']?.position, { x: 120, y: 80 });
  assert.deepEqual(next.layout?.nodes['neuron-2']?.position, { x: 200, y: 140 });
});
