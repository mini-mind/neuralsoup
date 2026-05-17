import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidGraphIRDocument,
  compileGraphIRDocument,
  createBrainProgramRuntimeState,
  createDefaultGraphIRDocument,
  GraphIRValidationError,
  stepBrainProgram,
  type GraphIRDocument,
  validateGraphIRDocument,
} from '../../src/domain/brain';

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

test('validation rejects adapter outside root', () => {
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

  assert.equal(issues.some((issue) => issue.code === 'adapter-not-root-child'), true);
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

test('default Graph IR document is valid', () => {
  const document = createDefaultGraphIRDocument(4);

  assert.deepEqual(validateGraphIRDocument(document), []);
  assert.doesNotThrow(() => assertValidGraphIRDocument(document));
});

test('default Graph IR document scales vision input signals with visionCells', () => {
  const smallDocument = createDefaultGraphIRDocument(2);
  const largeDocument = createDefaultGraphIRDocument(5);
  const smallInputAdapter = smallDocument.root.children.find((node) => node.id === 'input-adapter');
  const largeInputAdapter = largeDocument.root.children.find((node) => node.id === 'input-adapter');

  assert.ok(smallInputAdapter && smallInputAdapter.kind === 'adapter');
  assert.ok(largeInputAdapter && largeInputAdapter.kind === 'adapter');
  assert.equal(smallInputAdapter.children.length, 6);
  assert.equal(largeInputAdapter.children.length, 15);
});

test('default Graph IR document contains top-level input and output adapters', () => {
  const document = createDefaultGraphIRDocument(3);
  const inputAdapter = document.root.children.find((node) => node.id === 'input-adapter');
  const outputAdapter = document.root.children.find((node) => node.id === 'output-adapter');

  assert.ok(inputAdapter && inputAdapter.kind === 'adapter');
  assert.ok(outputAdapter && outputAdapter.kind === 'adapter');
  assert.equal(inputAdapter.adapterType, 'input');
  assert.equal(outputAdapter.adapterType, 'output');
  assert.equal(inputAdapter.children.every((node) => node.kind === 'signal' && node.direction === 'input'), true);
  assert.equal(outputAdapter.children.every((node) => node.kind === 'signal' && node.direction === 'output'), true);
  assert.deepEqual(
    outputAdapter.children.map((node) => node.id),
    ['output-turn-left', 'output-move-forward', 'output-turn-right']
  );
});

test('default Graph IR document uses explicit world-facing signal metadata for vision inputs and motor outputs', () => {
  const document = createDefaultGraphIRDocument(2);
  const inputAdapter = document.root.children.find((node) => node.id === 'input-adapter');
  const outputAdapter = document.root.children.find((node) => node.id === 'output-adapter');

  assert.ok(inputAdapter && inputAdapter.kind === 'adapter');
  assert.ok(outputAdapter && outputAdapter.kind === 'adapter');
  assert.equal(inputAdapter.children.every((node) => node.kind === 'signal'), true);
  assert.equal(outputAdapter.children.every((node) => node.kind === 'signal'), true);
  const inputSignals = inputAdapter.children.filter((node) => node.kind === 'signal');
  const outputSignals = outputAdapter.children.filter((node) => node.kind === 'signal');
  assert.deepEqual(
    inputSignals.map((node) => node.signal.id),
    ['vision-r', 'vision-r', 'vision-g', 'vision-g', 'vision-b', 'vision-b']
  );
  assert.deepEqual(
    [...new Set(outputSignals.map((node) => node.signal.id))],
    ['turn-left', 'move-forward', 'turn-right']
  );
  assert.equal(inputSignals.every((node) => node.signal.doc?.includes('World observation channel metadata') === true), true);
  assert.equal(outputSignals.every((node) => node.signal.doc?.includes('World action channel metadata') === true), true);
});

test('default Graph IR document only links leaf nodes', () => {
  const document = createDefaultGraphIRDocument(2);
  const leafNodeIds = new Set<string>();

  const visit = (nodes: GraphIRDocument['root']['children']): void => {
    for (const node of nodes) {
      if (node.kind === 'neuron' || node.kind === 'signal') {
        leafNodeIds.add(node.id);
        continue;
      }

      visit(node.children);
    }
  };

  visit(document.root.children);

  for (const link of document.root.links) {
    assert.equal(leafNodeIds.has(link.from.nodeId), true, `source ${link.from.nodeId} should be leaf`);
    assert.equal(leafNodeIds.has(link.to.nodeId), true, `target ${link.to.nodeId} should be leaf`);
  }
});

test('default Graph IR document keeps default neuron-group semantics', () => {
  const document = createDefaultGraphIRDocument(1);
  const neuronGroup = document.root.children.find((node) => node.id === 'core-neuron-group');
  const neuronModel = document.models.find((model) => model.id === 'izhikevich-neuron');

  assert.ok(neuronGroup && neuronGroup.kind === 'neuron-group');
  assert.equal(neuronGroup.children.length, 2);
  assert.deepEqual(
    neuronGroup.children.map((node) => node.id),
    ['neuron-1', 'neuron-2']
  );
  assert.ok(neuronModel);
  assert.deepEqual(
    neuronModel.parameters.map((parameter) => parameter.id),
    ['a', 'b', 'c', 'd', 'threshold']
  );
  assert.deepEqual(
    neuronModel.equations.map((equation) => equation.id),
    ['dv', 'du']
  );
  const emitSpikeStep = neuronModel.update.find((step) => step.id === 'emit-spike');
  assert.ok(emitSpikeStep);
  const spikeResetAssignments = JSON.stringify(emitSpikeStep.body);
  assert.equal(spikeResetAssignments.includes('"target":"v"'), true);
  assert.equal(spikeResetAssignments.includes('"target":"u"'), true);
  assert.equal(spikeResetAssignments.includes('"target":"drive"'), true);
});

test('default Graph IR document keeps default seed connectivity explicit', () => {
  const document = createDefaultGraphIRDocument(1);

  assert.deepEqual(
    document.root.links.map((link) => ({
      id: link.id,
      from: link.from.nodeId,
      to: link.to.nodeId,
      weight: link.weight,
    })),
    [
      {
        id: 'link-vision-R-0-neuron-1',
        from: 'vision-R-0',
        to: 'neuron-1',
        weight: 1,
      },
      {
        id: 'link-vision-G-0-neuron-1',
        from: 'vision-G-0',
        to: 'neuron-1',
        weight: 0.75,
      },
      {
        id: 'link-vision-B-0-neuron-2',
        from: 'vision-B-0',
        to: 'neuron-2',
        weight: 0.75,
      },
      {
        id: 'link-neuron-1-neuron-2',
        from: 'neuron-1',
        to: 'neuron-2',
        weight: 0.5,
      },
      {
        id: 'link-neuron-1-output-move-forward',
        from: 'neuron-1',
        to: 'output-move-forward',
        weight: 1,
      },
      {
        id: 'link-neuron-2-output-turn-left',
        from: 'neuron-2',
        to: 'output-turn-left',
        weight: 1,
      },
      {
        id: 'link-neuron-2-output-turn-right',
        from: 'neuron-2',
        to: 'output-turn-right',
        weight: 1,
      },
    ]
  );
});

test('compileGraphIRDocument excludes non-leaf topology nodes from runtime executable nodes', () => {
  const document = createDefaultGraphIRDocument(1);
  const program = compileGraphIRDocument(document);

  assert.equal(program.neuronNodes.some((node) => node.id === 'core-neuron-group'), false);
  assert.equal(program.signalNodes.some((node) => node.id === 'input-adapter'), false);
  assert.equal(program.signalNodes.some((node) => node.id === 'output-adapter'), false);
  assert.equal(program.links.some((link) => link.from.nodeId === 'core-neuron-group' || link.to.nodeId === 'core-neuron-group'), false);
});

test('compileGraphIRDocument binds output SignalNodes to runtime action channels', () => {
  const document = createDefaultGraphIRDocument(1);
  const program = compileGraphIRDocument(document);

  assert.deepEqual(
    program.outputBindings.map((binding) => binding.channel),
    ['turn-left', 'move-forward', 'turn-right']
  );
  assert.deepEqual(
    program.outputBindings.map((binding) => binding.nodeId),
    ['output-turn-left', 'output-move-forward', 'output-turn-right']
  );
  assert.deepEqual(
    program.outputBindings.map((binding) => binding.portId),
    ['in', 'in', 'in']
  );
});

test('compileGraphIRDocument binds input SignalNodes using model output ports', () => {
  const document = createDefaultGraphIRDocument(1);
  const program = compileGraphIRDocument(document);

  assert.deepEqual(
    program.inputBindings.map((binding) => binding.portId),
    ['out', 'out', 'out']
  );
});

test('compileGraphIRDocument maps vision input bindings to visualInput channel order instead of leaf order', () => {
  const document = createDefaultGraphIRDocument(2);
  const program = compileGraphIRDocument(document);
  const inputBindingIndices = new Map(
    program.inputBindings.map((binding) => [binding.nodeId, binding.index])
  );

  assert.equal(inputBindingIndices.get('vision-R-0'), 0);
  assert.equal(inputBindingIndices.get('vision-G-0'), 1);
  assert.equal(inputBindingIndices.get('vision-B-0'), 2);
  assert.equal(inputBindingIndices.get('vision-R-1'), 3);
  assert.equal(inputBindingIndices.get('vision-G-1'), 4);
  assert.equal(inputBindingIndices.get('vision-B-1'), 5);
});

test('GraphIR runtime step reads visualInput values using channel-interleaved vision layout', () => {
  const document = createDefaultGraphIRDocument(2);
  document.root.links = [
    {
      id: 'vision-g0-to-left',
      from: {
        nodeId: 'vision-G-0',
        portId: 'out',
      },
      to: {
        nodeId: 'output-turn-left',
        portId: 'in',
      },
      weight: 1,
    },
    {
      id: 'vision-r1-to-forward',
      from: {
        nodeId: 'vision-R-1',
        portId: 'out',
      },
      to: {
        nodeId: 'output-move-forward',
        portId: 'in',
      },
      weight: 1,
    },
    {
      id: 'vision-b1-to-right',
      from: {
        nodeId: 'vision-B-1',
        portId: 'out',
      },
      to: {
        nodeId: 'output-turn-right',
        portId: 'in',
      },
      weight: 1,
    },
  ];

  const program = compileGraphIRDocument(document);
  const result = stepBrainProgram(
    program,
    [0, 0.4, 0, 0.7, 0, 1],
    createBrainProgramRuntimeState(program),
    1
  );

  assert.ok(result.outputs['turn-left'] > 0);
  assert.ok(result.outputs['move-forward'] > result.outputs['turn-left']);
  assert.ok(result.outputs['turn-right'] > result.outputs['move-forward']);
});

test('output SignalNodes produce action outputs at runtime', () => {
  const document = createDefaultGraphIRDocument(1);
  const neuronGroup = document.root.children.find((node) => node.id === 'core-neuron-group');
  assert.ok(neuronGroup && neuronGroup.kind === 'neuron-group');
  const neuron = neuronGroup.children.find((node) => node.id === 'neuron-1');
  assert.ok(neuron && neuron.kind === 'neuron');
  neuron.parameterOverrides = {
    ...(neuron.parameterOverrides ?? {}),
    threshold: -70,
  };

  const program = compileGraphIRDocument(document);
  const result = stepBrainProgram(program, [1, 1, 0], createBrainProgramRuntimeState(program), 1);

  assert.ok(result.outputs['move-forward'] > 0);
});

test('GraphIR runtime step exposes active leaf node ids for input, neuron, and output leaves', () => {
  const document = createDefaultGraphIRDocument(1);
  const neuronGroup = document.root.children.find((node) => node.id === 'core-neuron-group');
  assert.ok(neuronGroup && neuronGroup.kind === 'neuron-group');
  const neuron = neuronGroup.children.find((node) => node.id === 'neuron-1');
  assert.ok(neuron && neuron.kind === 'neuron');
  neuron.parameterOverrides = {
    ...(neuron.parameterOverrides ?? {}),
    threshold: -70,
  };

  const program = compileGraphIRDocument(document);
  const result = stepBrainProgram(program, [1, 1, 0], createBrainProgramRuntimeState(program), 1);

  assert.deepEqual(
    new Set(result.runtimeState.activeLeafNodeIds),
    new Set(['vision-R-0', 'vision-G-0', 'neuron-1', 'output-move-forward'])
  );
});

test('compileGraphIRDocument rejects unsupported world action signal bindings', () => {
  const document = createDefaultGraphIRDocument(1);
  const outputAdapter = document.root.children.find((node) => node.id === 'output-adapter');
  assert.ok(outputAdapter && outputAdapter.kind === 'adapter');
  const moveForward = outputAdapter.children.find((node) => node.id === 'output-move-forward');
  assert.ok(moveForward && moveForward.kind === 'signal');
  moveForward.signal.id = 'custom-action';

  assert.throws(
    () => compileGraphIRDocument(document),
    /unsupported world action signal/
  );
});
