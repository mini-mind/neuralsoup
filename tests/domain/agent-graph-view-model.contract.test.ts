import test from 'node:test';
import assert from 'node:assert/strict';
import type { AgentIR } from '../../src/domain/brain';
import { buildAgentGraphViewModel } from '../../src/components/editor/graph/agentGraphViewModel';

const createTestAgent = (): AgentIR => ({
  version: 1,
  metadata: {
    id: 'agent-test',
    name: 'Agent Test',
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
        params: {
          a: 0.02,
          b: 0.2,
          c: -65,
          d: 8,
          threshold: 30,
        },
        initialState: {
          v: -65,
        },
      },
      {
        id: 'neuron-2',
        label: 'Neuron 2',
        model: 'izhikevich',
        params: {
          a: 0.02,
          b: 0.2,
          c: -65,
          d: 8,
          threshold: 30,
        },
        initialState: {
          v: -65,
        },
      },
    ],
    containers: [
      {
        id: 'root-group',
        label: 'Root',
        children: [{ scope: 'container', nodeId: 'expanded-group' }],
      },
      {
        id: 'expanded-group',
        label: 'Expanded',
        children: [
          { scope: 'brain', nodeId: 'neuron-1' },
          { scope: 'brain', nodeId: 'neuron-2' },
        ],
      },
    ],
  },
  connections: [
    {
      id: 'connection-1',
      from: { scope: 'brain', nodeId: 'neuron-1' },
      to: { scope: 'brain', nodeId: 'neuron-2' },
      weight: 0.5,
    },
  ],
  layout: {
    version: 1,
    nodes: {
      'expanded-group': {
        position: { x: 100, y: 120 },
        collapsed: false,
      },
      'neuron-1': {
        position: { x: 0, y: 0 },
      },
      'neuron-2': {
        position: { x: 80, y: 0 },
      },
    },
  },
});

test('agent graph view expanded children are addressable by both id and viewId', () => {
  const viewModel = buildAgentGraphViewModel({
    agent: createTestAgent(),
    navigationPath: ['core-neuron-group'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  const expandedChild = viewModel.nodes.find((node) => node.viewId === 'expanded-group::neuron-1');
  assert.ok(expandedChild);
  assert.equal(viewModel.viewNodeById.get('neuron-1'), expandedChild);
  assert.equal(viewModel.viewNodeById.get('expanded-group::neuron-1'), expandedChild);
});

test('agent graph view expanded children use viewId for active highlights', () => {
  const viewModel = buildAgentGraphViewModel({
    agent: createTestAgent(),
    navigationPath: ['core-neuron-group'],
    draftNodePositions: {},
    runtimeActiveNodeIds: ['neuron-1'],
  });

  assert.equal(viewModel.activeViewNodeIds.has('expanded-group::neuron-1'), true);
  assert.equal(viewModel.activeViewNodeIds.has('neuron-1'), false);
});
