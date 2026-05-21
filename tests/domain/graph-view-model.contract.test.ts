import test from 'node:test';
import assert from 'node:assert/strict';
import type { GraphIRDocument, ModelDefinition } from '../../src/domain/brain';
import { buildGraphViewModel } from '../../src/components/editor/graph/graphViewModel';

const TEST_MODELS: ModelDefinition[] = [
  {
    id: 'test-neuron',
    kind: 'neuron',
    doc: 'Test neuron.',
    state: [],
    parameters: [],
    internals: [],
    inputs: [{ id: 'dendrite', signal: { id: 'spike', valueType: 'number' } }],
    outputs: [{ id: 'axon', signal: { id: 'spike', valueType: 'number' } }],
    equations: [],
    onReceive: [],
    update: [],
  },
  {
    id: 'test-signal',
    kind: 'signal',
    doc: 'Test signal.',
    state: [],
    parameters: [],
    internals: [],
    inputs: [{ id: 'in', signal: { id: 'spike', valueType: 'number' } }],
    outputs: [{ id: 'out', signal: { id: 'spike', valueType: 'number' } }],
    equations: [],
    onReceive: [],
    update: [],
  },
];

test('graph view child scope keeps only direct children and local direct leaf links visible', () => {
  const document: GraphIRDocument = {
    version: 1,
    models: TEST_MODELS,
    root: {
      id: 'root',
      children: [
        {
          kind: 'neuron-group',
          id: 'core-neuron-group',
          label: 'Core',
          children: [
            { kind: 'neuron', id: 'neuron-1', label: 'Neuron 1', modelId: 'test-neuron' },
            { kind: 'neuron', id: 'neuron-2', label: 'Neuron 2', modelId: 'test-neuron' },
          ],
        },
        {
          kind: 'adapter',
          id: 'input-adapter',
          label: 'Input',
          adapterType: 'input',
          children: [
            {
              kind: 'signal',
              id: 'vision-in',
              label: 'Vision',
              modelId: 'test-signal',
              direction: 'input',
              signal: { id: 'spike', valueType: 'number' },
            },
          ],
        },
      ],
      links: [
        {
          id: 'link-external-input',
          from: { nodeId: 'vision-in', portId: 'out' },
          to: { nodeId: 'neuron-1', portId: 'dendrite' },
          weight: 1,
        },
        {
          id: 'link-neuron-1-neuron-2',
          from: { nodeId: 'neuron-1', portId: 'axon' },
          to: { nodeId: 'neuron-2', portId: 'dendrite' },
          weight: 0.5,
        },
      ],
    },
  };

  const viewModel = buildGraphViewModel({
    document,
    navigationPath: ['core-neuron-group'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  assert.deepEqual(viewModel.nodes.map((node) => node.id), ['neuron-1', 'neuron-2']);
  assert.equal(viewModel.nodes.some((node) => node.proxy), false);
  assert.deepEqual(viewModel.links.map((link) => link.id), ['link-neuron-1-neuron-2']);
});

test('graph view child scope aggregates internal descendant links onto direct children without external proxies', () => {
  const document: GraphIRDocument = {
    version: 1,
    models: TEST_MODELS,
    root: {
      id: 'root',
      children: [
        {
          kind: 'adapter',
          id: 'input-adapter',
          label: 'Input',
          adapterType: 'input',
          children: [
            {
              kind: 'signal',
              id: 'vision-in',
              label: 'Vision',
              modelId: 'test-signal',
              direction: 'input',
              signal: { id: 'spike', valueType: 'number' },
            },
          ],
        },
        {
          kind: 'neuron-group',
          id: 'parent-group',
          label: 'Parent',
          children: [
            {
              kind: 'neuron-group',
              id: 'child-group-a',
              label: 'A',
              children: [
                {
                  kind: 'neuron',
                  id: 'neuron-a',
                  label: 'Neuron A',
                  modelId: 'test-neuron',
                },
              ],
            },
            {
              kind: 'neuron-group',
              id: 'child-group-b',
              label: 'B',
              children: [
                {
                  kind: 'neuron',
                  id: 'neuron-b',
                  label: 'Neuron B',
                  modelId: 'test-neuron',
                },
              ],
            },
          ],
        },
      ],
      links: [
        {
          id: 'link-external',
          from: { nodeId: 'vision-in', portId: 'out' },
          to: { nodeId: 'neuron-a', portId: 'dendrite' },
          weight: 0.5,
        },
        {
          id: 'link-internal',
          from: { nodeId: 'neuron-a', portId: 'axon' },
          to: { nodeId: 'neuron-b', portId: 'dendrite' },
          weight: 0.75,
        },
      ],
    },
  };

  const viewModel = buildGraphViewModel({
    document,
    navigationPath: ['parent-group'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  assert.deepEqual(viewModel.nodes.map((node) => node.id), ['child-group-a', 'child-group-b']);
  assert.equal(viewModel.nodes.some((node) => node.proxy), false);
  assert.deepEqual(viewModel.links, [
    {
      id: 'aggregate:child-group-a:child-group-b',
      fromNodeId: 'child-group-a',
      toNodeId: 'child-group-b',
      weight: 0.75,
      count: 1,
      aggregate: true,
      leafLinkIds: ['link-internal'],
      editable: false,
    },
  ]);
});
