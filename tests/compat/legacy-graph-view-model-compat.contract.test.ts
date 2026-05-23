import test from 'node:test';
import assert from 'node:assert/strict';
import type { GraphIRDocument, ModelDefinition } from '../../src/domain/brain/ir';
import { buildLegacyGraphViewModel } from '../../src/compat/legacyGraphViewModel';

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

test('legacy graph view child scope keeps only direct children and local direct leaf links visible', () => {
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

  const viewModel = buildLegacyGraphViewModel({
    document,
    navigationPath: ['core-neuron-group'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  assert.deepEqual(viewModel.nodes.map((node) => node.id), ['neuron-1', 'neuron-2']);
  assert.equal(viewModel.nodes.some((node) => node.proxy), false);
  assert.deepEqual(viewModel.links.map((link) => link.id), ['link-neuron-1-neuron-2']);
});

test('legacy graph view child scope aggregates internal descendant links onto direct children without external proxies', () => {
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

  const viewModel = buildLegacyGraphViewModel({
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
      fromRefNodeId: 'child-group-a',
      toRefNodeId: 'child-group-b',
      weight: 0.75,
      count: 1,
      aggregate: true,
      leafLinkIds: ['link-internal'],
      inspectable: false,
      editable: false,
    },
  ]);
});

test('legacy graph view expanded group projects child leaf links as editable direct links', () => {
  const document: GraphIRDocument = {
    version: 1,
    models: TEST_MODELS,
    root: {
      id: 'root',
      children: [
        {
          kind: 'neuron-group',
          id: 'parent-group',
          label: 'Parent',
          children: [
            {
              kind: 'neuron-group',
              id: 'expanded-group',
              label: 'Expanded',
              collapsed: false,
              position: { x: 100, y: 120 },
              children: [
                { kind: 'neuron', id: 'neuron-1', label: 'Neuron 1', modelId: 'test-neuron', position: { x: 0, y: 0 } },
                { kind: 'neuron', id: 'neuron-2', label: 'Neuron 2', modelId: 'test-neuron', position: { x: 80, y: 0 } },
              ],
            },
          ],
        },
      ],
      links: [
        {
          id: 'link-neuron-1-neuron-2',
          from: { nodeId: 'neuron-1', portId: 'axon' },
          to: { nodeId: 'neuron-2', portId: 'dendrite' },
          weight: 0.5,
        },
      ],
    },
  };

  const viewModel = buildLegacyGraphViewModel({
    document,
    navigationPath: ['parent-group'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  assert.deepEqual(viewModel.nodes.map((node) => node.id), ['expanded-group', 'neuron-1', 'neuron-2']);
  assert.equal(viewModel.visibleNodeByRefId.get('neuron-1')?.x, 390);
  assert.equal(viewModel.visibleNodeByRefId.get('neuron-1')?.expansionOffsetX, 30);
  assert.deepEqual(viewModel.links, [
    {
      id: 'link-neuron-1-neuron-2',
      fromNodeId: 'neuron-1',
      toNodeId: 'neuron-2',
      fromRefNodeId: 'neuron-1',
      toRefNodeId: 'neuron-2',
      weight: 0.5,
      count: 1,
      aggregate: false,
      leafLinkIds: ['link-neuron-1-neuron-2'],
      inspectable: true,
      editable: true,
    },
  ]);
});

test('legacy graph view expanded group draft move carries children without mutating relative child offsets', () => {
  const document: GraphIRDocument = {
    version: 1,
    models: TEST_MODELS,
    root: {
      id: 'root',
      children: [
        {
          kind: 'neuron-group',
          id: 'parent-group',
          label: 'Parent',
          children: [
            {
              kind: 'neuron-group',
              id: 'expanded-group',
              label: 'Expanded',
              collapsed: false,
              position: { x: 100, y: 120 },
              children: [
                { kind: 'neuron', id: 'neuron-1', label: 'Neuron 1', modelId: 'test-neuron', position: { x: 0, y: 0 } },
              ],
            },
          ],
        },
      ],
      links: [],
    },
  };

  const before = buildLegacyGraphViewModel({
    document,
    navigationPath: ['parent-group'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });
  const after = buildLegacyGraphViewModel({
    document,
    navigationPath: ['parent-group'],
    draftNodePositions: {
      'expanded-group': { x: 172, y: 158 },
    },
    runtimeActiveNodeIds: [],
  });

  assert.equal(after.visibleNodeByRefId.get('expanded-group')!.x - before.visibleNodeByRefId.get('expanded-group')!.x, 72);
  assert.equal(after.visibleNodeByRefId.get('expanded-group')!.y - before.visibleNodeByRefId.get('expanded-group')!.y, 38);
  assert.equal(after.visibleNodeByRefId.get('neuron-1')!.x - before.visibleNodeByRefId.get('neuron-1')!.x, 72);
  assert.equal(after.visibleNodeByRefId.get('neuron-1')!.y - before.visibleNodeByRefId.get('neuron-1')!.y, 38);
  assert.equal(after.visibleNodeByRefId.get('neuron-1')!.expansionOffsetX, 30);
  assert.equal(after.visibleNodeByRefId.get('neuron-1')!.expansionOffsetY, 30);
});
