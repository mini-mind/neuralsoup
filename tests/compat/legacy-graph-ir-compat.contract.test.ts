import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidGraphIRDocument,
  GraphIRValidationError,
  validateGraphIRDocument,
} from '../../src/compat/legacyGraphIR';
import type { GraphIRDocument } from '../../src/compat/legacyGraphIR';

const createValidGraphIRDocument = (): GraphIRDocument => ({
  version: 1,
  models: [
    {
      id: 'spike-neuron',
      kind: 'neuron',
      doc: 'Simple placeholder neuron model.',
      state: [
        {
          id: 'voltage',
          valueType: 'number',
          defaultValue: 0,
        },
      ],
      parameters: [
        {
          id: 'threshold',
          valueType: 'number',
          defaultValue: 1,
        },
      ],
      internals: [
        {
          id: 'drive',
          valueType: 'number',
          defaultValue: 0,
        },
      ],
      inputs: [
        {
          id: 'dendrite',
          signal: {
            id: 'spike',
            valueType: 'number',
          },
        },
      ],
      outputs: [
        {
          id: 'axon',
          signal: {
            id: 'spike',
            valueType: 'number',
          },
        },
      ],
      equations: [
        {
          id: 'dv',
          target: 'voltage',
          expression: {
            kind: 'binary',
            operator: '+',
            left: {
              kind: 'reference',
              target: 'voltage',
            },
            right: {
              kind: 'reference',
              target: 'drive',
            },
          },
        },
      ],
      onReceive: [
        {
          portId: 'dendrite',
          body: [
            {
              kind: 'assign',
              target: 'drive',
              expression: {
                kind: 'reference',
                target: 'dendrite',
              },
            },
          ],
        },
      ],
      update: [
        {
          id: 'step',
          body: [
            {
              kind: 'if',
              condition: {
                kind: 'binary',
                operator: '>=',
                left: {
                  kind: 'reference',
                  target: 'voltage',
                },
                right: {
                  kind: 'reference',
                  target: 'threshold',
                },
              },
              then: [
                {
                  kind: 'emit',
                  portId: 'axon',
                  expression: {
                    kind: 'literal',
                    value: 1,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'world-signal',
      kind: 'signal',
      doc: 'Signal bridge model.',
      state: [],
      parameters: [],
      internals: [],
      inputs: [
        {
          id: 'in',
          signal: {
            id: 'spike',
            valueType: 'number',
          },
        },
      ],
      outputs: [
        {
          id: 'out',
          signal: {
            id: 'spike',
            valueType: 'number',
          },
        },
      ],
      equations: [],
      onReceive: [],
      update: [],
    },
  ],
  root: {
    id: 'root',
    children: [
      {
        kind: 'adapter',
        id: 'boundary',
        label: 'Boundary',
        adapterType: 'io',
        children: [
          {
            kind: 'signal',
            id: 'vision-in',
            label: 'Vision In',
            modelId: 'world-signal',
            direction: 'input',
            signal: {
              id: 'spike',
              valueType: 'number',
            },
          },
          {
            kind: 'signal',
            id: 'motor-out',
            label: 'Motor Out',
            modelId: 'world-signal',
            direction: 'output',
            signal: {
              id: 'spike',
              valueType: 'number',
            },
          },
        ],
      },
      {
        kind: 'neuron-group',
        id: 'core',
        label: 'Core',
        children: [
          {
            kind: 'neuron',
            id: 'neuron-a',
            label: 'Neuron A',
            modelId: 'spike-neuron',
          },
          {
            kind: 'neuron',
            id: 'neuron-b',
            label: 'Neuron B',
            modelId: 'spike-neuron',
          },
        ],
      },
    ],
    links: [
      {
        id: 'link-vision-core',
        from: {
          nodeId: 'vision-in',
          portId: 'out',
        },
        to: {
          nodeId: 'neuron-a',
          portId: 'dendrite',
        },
        weight: 1,
      },
      {
        id: 'link-core-core',
        from: {
          nodeId: 'neuron-a',
          portId: 'axon',
        },
        to: {
          nodeId: 'neuron-b',
          portId: 'dendrite',
        },
        weight: 0.5,
      },
      {
        id: 'link-core-motor',
        from: {
          nodeId: 'neuron-b',
          portId: 'axon',
        },
        to: {
          nodeId: 'motor-out',
          portId: 'in',
        },
        weight: 1,
      },
    ],
  },
});

test('valid Graph IR document passes validation', () => {
  const document = createValidGraphIRDocument();

  assert.deepEqual(validateGraphIRDocument(document), []);
  assert.doesNotThrow(() => assertValidGraphIRDocument(document));
});

test('validation rejects duplicate model ids', () => {
  const document = createValidGraphIRDocument();
  document.models.push(structuredClone(document.models[0]!));

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'duplicate-model-id'), true);
});

test('validation rejects duplicate model ports', () => {
  const document = createValidGraphIRDocument();
  document.models[0]!.outputs.push({
    id: 'axon',
    signal: {
      id: 'spike',
      valueType: 'number',
    },
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'duplicate-model-port-id'), true);
});

test('validation rejects duplicate model variables', () => {
  const document = createValidGraphIRDocument();
  document.models[0]!.internals.push({
    id: 'threshold',
    valueType: 'number',
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'duplicate-model-variable-id'), true);
});

test('validation rejects duplicate topology node ids', () => {
  const document = createValidGraphIRDocument();
  const group = document.root.children[1];
  assert.ok(group && group.kind === 'neuron-group');
  group.children.push({
    kind: 'neuron',
    id: 'neuron-a',
    label: 'Duplicate neuron',
    modelId: 'spike-neuron',
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'duplicate-topology-node-id'), true);
});

test('validation allows adapter nested inside neuron-group for local boundary routing', () => {
  const document = createValidGraphIRDocument();
  const group = document.root.children[1];
  assert.ok(group && group.kind === 'neuron-group');
  group.children.push({
    kind: 'adapter',
    id: 'nested-adapter',
    label: 'Nested',
    adapterType: 'input',
    children: [],
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'adapter-child-not-signal'), false);
  assert.deepEqual(issues, []);
});

test('validation rejects non-signal adapter children', () => {
  const document = createValidGraphIRDocument();
  const adapter = document.root.children[0];
  assert.ok(adapter && adapter.kind === 'adapter');
  adapter.children.push({
    kind: 'neuron',
    id: 'invalid-child',
    label: 'Invalid Child',
    modelId: 'spike-neuron',
  } as never);

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'adapter-child-not-signal'), true);
});

test('validation rejects duplicate leaf link ids', () => {
  const document = createValidGraphIRDocument();
  document.root.links.push(structuredClone(document.root.links[0]!));

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'duplicate-leaf-link-id'), true);
});

test('validation rejects duplicate leaf link endpoints even when ids differ', () => {
  const document = createValidGraphIRDocument();
  document.root.links.push({
    ...structuredClone(document.root.links[0]!),
    id: 'duplicate-endpoints-link',
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'duplicate-leaf-link-endpoints'), true);
});

test('validation rejects missing node model references', () => {
  const document = createValidGraphIRDocument();
  const group = document.root.children[1];
  assert.ok(group && group.kind === 'neuron-group');
  group.children.push({
    kind: 'neuron',
    id: 'orphan-neuron',
    label: 'Orphan Neuron',
    modelId: 'missing-model',
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'missing-node-model'), true);
});

test('validation rejects node model kind mismatches', () => {
  const document = createValidGraphIRDocument();
  const group = document.root.children[1];
  assert.ok(group && group.kind === 'neuron-group');
  group.children.push({
    kind: 'neuron',
    id: 'wrong-model-neuron',
    label: 'Wrong Model Neuron',
    modelId: 'world-signal',
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'invalid-node-model-kind'), true);
});

test('validation rejects missing link node references', () => {
  const document = createValidGraphIRDocument();
  document.root.links.push({
    id: 'missing-node-link',
    from: {
      nodeId: 'missing-node',
      portId: 'out',
    },
    to: {
      nodeId: 'neuron-a',
      portId: 'dendrite',
    },
    weight: 1,
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'missing-link-node'), true);
});

test('validation rejects missing link port references', () => {
  const document = createValidGraphIRDocument();
  document.root.links.push({
    id: 'missing-port-link',
    from: {
      nodeId: 'neuron-a',
      portId: 'missing-port',
    },
    to: {
      nodeId: 'neuron-b',
      portId: 'dendrite',
    },
    weight: 1,
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'missing-link-port'), true);
});

test('validation rejects non-leaf link endpoints', () => {
  const document = createValidGraphIRDocument();
  document.root.links.push({
    id: 'group-link',
    from: {
      nodeId: 'core',
      portId: 'axon',
    },
    to: {
      nodeId: 'neuron-a',
      portId: 'dendrite',
    },
    weight: 1,
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'non-leaf-link-endpoint'), true);
});

test('validation rejects wrong port directions', () => {
  const document = createValidGraphIRDocument();
  document.root.links.push({
    id: 'wrong-direction-link',
    from: {
      nodeId: 'neuron-a',
      portId: 'dendrite',
    },
    to: {
      nodeId: 'neuron-b',
      portId: 'dendrite',
    },
    weight: 1,
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'invalid-link-direction'), true);
});

test('validation rejects mismatched signal types', () => {
  const document = createValidGraphIRDocument();
  document.models.push({
    id: 'boolean-signal',
    kind: 'signal',
    state: [],
    parameters: [],
    internals: [],
    inputs: [
      {
        id: 'in',
        signal: {
          id: 'flag',
          valueType: 'boolean',
        },
      },
    ],
    outputs: [
      {
        id: 'out',
        signal: {
          id: 'flag',
          valueType: 'boolean',
        },
      },
    ],
    equations: [],
    onReceive: [],
    update: [],
  });
  const adapter = document.root.children[0];
  assert.ok(adapter && adapter.kind === 'adapter');
  adapter.children.push({
    kind: 'signal',
    id: 'flag-out',
    label: 'Flag Out',
    modelId: 'boolean-signal',
    direction: 'output',
    signal: {
      id: 'flag',
      valueType: 'boolean',
    },
  });
  document.root.links.push({
    id: 'mismatch-link',
    from: {
      nodeId: 'neuron-a',
      portId: 'axon',
    },
    to: {
      nodeId: 'flag-out',
      portId: 'in',
    },
    weight: 1,
  });

  const issues = validateGraphIRDocument(document);

  assert.equal(issues.some((issue) => issue.code === 'mismatched-link-signal'), true);
});

test('assertValidGraphIRDocument throws rich validation errors', () => {
  const document = createValidGraphIRDocument();
  document.root.links.push({
    id: 'bad-link',
    from: {
      nodeId: 'neuron-a',
      portId: 'dendrite',
    },
    to: {
      nodeId: 'neuron-b',
      portId: 'dendrite',
    },
    weight: 1,
  });

  assert.throws(
    () => assertValidGraphIRDocument(document),
    (error: unknown) =>
      error instanceof GraphIRValidationError &&
      error.issues.some((issue) => issue.code === 'invalid-link-direction')
  );
});
