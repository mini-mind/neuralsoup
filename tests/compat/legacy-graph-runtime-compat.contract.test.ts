import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultGraphIRDocument } from '../../src/compat/legacyGraphDefaults';
import type { GraphIRDocument } from '../../src/compat/legacyGraphIR';
import { compileLegacyBrainDefinition } from '../../src/compat/legacyBrainCompiler';
import { createDefaultLegacyBodyDefinition, type LegacyBodyDefinition } from '../../src/compat/legacyBrainPackage';
import { createLegacyBrainProgramRuntimeState, stepLegacyBrainProgram } from '../../src/compat/legacyBrainStep';
import type { LegacyBrainProgram } from '../../src/compat/legacyBrainProgram';
import { createLegacyCompatContext } from '../../src/compat/legacyCompatContext';
import { createVisionActionWorldRegistry } from '../../src/host';

const LEGACY_COMPAT_CONTEXT = createLegacyCompatContext(createVisionActionWorldRegistry());

const getRootVisionCells = (document: GraphIRDocument) => {
  const inputAdapter = document.root.children.find((node) => node.id === 'input-adapter' && node.kind === 'adapter');
  return inputAdapter?.kind === 'adapter' ? inputAdapter.children.length / 3 : 1;
};

const compileDefaultBrain = (document: GraphIRDocument) =>
  compileLegacyBrainDefinition(
    document,
    createDefaultLegacyBodyDefinition(getRootVisionCells(document)),
    LEGACY_COMPAT_CONTEXT
  );

const createValidGraphIRDocument = (): GraphIRDocument => ({
  version: 1,
  models: [
    {
      id: 'spike-neuron',
      kind: 'neuron',
      doc: 'Simple placeholder neuron model.',
      state: [{ id: 'voltage', valueType: 'number', defaultValue: 0 }],
      parameters: [{ id: 'threshold', valueType: 'number', defaultValue: 1 }],
      internals: [{ id: 'drive', valueType: 'number', defaultValue: 0 }],
      inputs: [{ id: 'dendrite', signal: { id: 'spike', valueType: 'number' } }],
      outputs: [{ id: 'axon', signal: { id: 'spike', valueType: 'number' } }],
      equations: [],
      onReceive: [],
      update: [],
    },
    {
      id: 'world-signal',
      kind: 'signal',
      doc: 'Signal bridge model.',
      state: [],
      parameters: [],
      internals: [],
      inputs: [{ id: 'in', signal: { id: 'spike', valueType: 'number' } }],
      outputs: [{ id: 'out', signal: { id: 'spike', valueType: 'number' } }],
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
            signal: { id: 'spike', valueType: 'number' },
          },
          {
            kind: 'signal',
            id: 'motor-out',
            label: 'Motor Out',
            modelId: 'world-signal',
            direction: 'output',
            signal: { id: 'spike', valueType: 'number' },
          },
        ],
      },
      {
        kind: 'neuron-group',
        id: 'core',
        label: 'Core',
        children: [
          { kind: 'neuron', id: 'neuron-a', label: 'Neuron A', modelId: 'spike-neuron' },
          { kind: 'neuron', id: 'neuron-b', label: 'Neuron B', modelId: 'spike-neuron' },
        ],
      },
    ],
    links: [
      {
        id: 'link-vision-core',
        from: { nodeId: 'vision-in', portId: 'out' },
        to: { nodeId: 'neuron-a', portId: 'dendrite' },
        weight: 1,
      },
      {
        id: 'link-core-motor',
        from: { nodeId: 'neuron-a', portId: 'axon' },
        to: { nodeId: 'motor-out', portId: 'in' },
        weight: 1,
      },
    ],
  },
});

test('compileLegacyBrainDefinition excludes non-leaf topology nodes from runtime executable nodes', () => {
  const document = createDefaultGraphIRDocument(1);
  const program: LegacyBrainProgram = compileDefaultBrain(document);

  assert.equal(program.neuronNodes.some((node) => node.id === 'core-neuron-group'), false);
  assert.equal(program.signalNodes.some((node) => node.id === 'input-adapter'), false);
  assert.equal(program.signalNodes.some((node) => node.id === 'output-adapter'), false);
  assert.equal(
    program.links.some((link) => link.from.nodeId === 'core-neuron-group' || link.to.nodeId === 'core-neuron-group'),
    false
  );
});

test('compileLegacyBrainDefinition binds output SignalNodes to runtime action channels', () => {
  const document = createDefaultGraphIRDocument(1);
  const program: LegacyBrainProgram = compileDefaultBrain(document);

  assert.deepEqual(program.outputBindings.map((binding) => binding.channel), ['turn-left', 'move-forward', 'turn-right']);
  assert.deepEqual(program.outputBindings.map((binding) => binding.nodeId), [
    'output-turn-left',
    'output-move-forward',
    'output-turn-right',
  ]);
  assert.deepEqual(program.outputBindings.map((binding) => binding.portId), ['in', 'in', 'in']);
});

test('compileLegacyBrainDefinition binds input SignalNodes using model output ports', () => {
  const document = createDefaultGraphIRDocument(1);
  const program: LegacyBrainProgram = compileDefaultBrain(document);

  assert.deepEqual(program.inputBindings.map((binding) => binding.portId), ['out', 'out', 'out']);
});

test('compileLegacyBrainDefinition excludes nested adapter signals from world input and output bindings', () => {
  const document = createDefaultGraphIRDocument(1);
  const coreGroup = document.root.children.find((node) => node.id === 'core-neuron-group');
  assert.ok(coreGroup && coreGroup.kind === 'neuron-group');
  coreGroup.children.push({
    kind: 'adapter',
    id: 'nested-adapter',
    label: 'Nested Adapter',
    adapterType: 'io',
    children: [
      {
        kind: 'signal',
        id: 'nested-in',
        label: 'Nested In',
        modelId: 'world-signal-bridge',
        direction: 'input',
        signal: { id: 'vision-r', valueType: 'number' },
      },
      {
        kind: 'signal',
        id: 'nested-out',
        label: 'Nested Out',
        modelId: 'world-signal-bridge',
        direction: 'output',
        signal: { id: 'turn-left', valueType: 'number' },
      },
    ],
  });

  const program: LegacyBrainProgram = compileDefaultBrain(document);

  assert.equal(program.signalNodes.some((node) => node.id === 'nested-in'), true);
  assert.equal(program.signalNodes.some((node) => node.id === 'nested-out'), true);
  assert.equal(program.inputBindings.some((binding) => binding.nodeId === 'nested-in'), false);
  assert.equal(program.outputBindings.some((binding) => binding.nodeId === 'nested-out'), false);
});

test('compileLegacyBrainDefinition maps vision input bindings to visualInput channel order instead of leaf order', () => {
  const document = createDefaultGraphIRDocument(2);
  const program: LegacyBrainProgram = compileDefaultBrain(document);
  const inputBindingIndices = new Map(program.inputBindings.map((binding) => [binding.nodeId, binding.index]));

  assert.equal(inputBindingIndices.get('vision-R-0'), 0);
  assert.equal(inputBindingIndices.get('vision-G-0'), 1);
  assert.equal(inputBindingIndices.get('vision-B-0'), 2);
  assert.equal(inputBindingIndices.get('vision-R-1'), 3);
  assert.equal(inputBindingIndices.get('vision-G-1'), 4);
  assert.equal(inputBindingIndices.get('vision-B-1'), 5);
});

test('compileLegacyBrainDefinition exposes legacy-named compat wrapper fields', () => {
  const document = createDefaultGraphIRDocument(1);
  const program = compileDefaultBrain(document);

  assert.equal(program.inputBindings.length, 3);
  assert.equal(program.outputBindings.length, 3);
  assert.equal('compiledAgentProgram' in (program as LegacyBrainProgram & Record<string, unknown>), false);
  assert.equal('legacyGraphIR' in (program as LegacyBrainProgram & Record<string, unknown>), false);
});

test('legacy GraphIR compat runtime step reads visualInput values using channel-interleaved vision layout', () => {
  const document = createDefaultGraphIRDocument(2);
  const neuronGroup = document.root.children.find((node) => node.id === 'core-neuron-group');
  assert.ok(neuronGroup && neuronGroup.kind === 'neuron-group');
  for (const child of neuronGroup.children) {
    if (child.kind !== 'neuron') {
      continue;
    }
    child.parameterOverrides = {
      ...(child.parameterOverrides ?? {}),
      threshold: -70,
    };
  }
  neuronGroup.children.push(
    {
      kind: 'neuron',
      id: 'neuron-3',
      label: 'Neuron 3',
      modelId: 'izhikevich-neuron',
      parameterOverrides: { threshold: -70 },
    },
    {
      kind: 'neuron',
      id: 'neuron-4',
      label: 'Neuron 4',
      modelId: 'izhikevich-neuron',
      parameterOverrides: { threshold: -70 },
    }
  );
  document.root.links = [
    { id: 'vision-g0-to-left-neuron', from: { nodeId: 'vision-G-0', portId: 'out' }, to: { nodeId: 'neuron-1', portId: 'dendrite' }, weight: 1 },
    { id: 'vision-r1-to-forward-neuron', from: { nodeId: 'vision-R-1', portId: 'out' }, to: { nodeId: 'neuron-3', portId: 'dendrite' }, weight: 1 },
    { id: 'vision-b1-to-right-neuron', from: { nodeId: 'vision-B-1', portId: 'out' }, to: { nodeId: 'neuron-4', portId: 'dendrite' }, weight: 1 },
    { id: 'left-neuron-to-output', from: { nodeId: 'neuron-1', portId: 'axon' }, to: { nodeId: 'output-turn-left', portId: 'in' }, weight: 1 },
    { id: 'forward-neuron-to-output', from: { nodeId: 'neuron-3', portId: 'axon' }, to: { nodeId: 'output-move-forward', portId: 'in' }, weight: 1 },
    { id: 'right-neuron-to-output', from: { nodeId: 'neuron-4', portId: 'axon' }, to: { nodeId: 'output-turn-right', portId: 'in' }, weight: 1 },
  ];

  const program = compileDefaultBrain(document);
  const result = stepLegacyBrainProgram(program, [0, 0.4, 0, 0.7, 0, 1], createLegacyBrainProgramRuntimeState(program), 1);

  assert.equal(result.outputs['turn-left'], 1);
  assert.equal(result.outputs['move-forward'], 1);
  assert.equal(result.outputs['turn-right'], 1);
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

  const program = compileDefaultBrain(document);
  const result = stepLegacyBrainProgram(program, [1, 1, 0], createLegacyBrainProgramRuntimeState(program), 1);

  assert.ok(result.outputs['move-forward'] > 0);
});

test('legacy GraphIR compat runtime step exposes active leaf node ids for input, neuron, and output leaves', () => {
  const document = createDefaultGraphIRDocument(1);
  const neuronGroup = document.root.children.find((node) => node.id === 'core-neuron-group');
  assert.ok(neuronGroup && neuronGroup.kind === 'neuron-group');
  const neuron = neuronGroup.children.find((node) => node.id === 'neuron-1');
  assert.ok(neuron && neuron.kind === 'neuron');
  neuron.parameterOverrides = {
    ...(neuron.parameterOverrides ?? {}),
    threshold: -70,
  };

  const program = compileDefaultBrain(document);
  const result = stepLegacyBrainProgram(program, [1, 1, 0], createLegacyBrainProgramRuntimeState(program), 1);

  assert.deepEqual(new Set(result.runtimeState.activeLeafNodeIds), new Set(['vision-R-0', 'vision-G-0', 'neuron-1', 'output-move-forward']));
});

test('compileLegacyBrainDefinition rejects invalid legacy compat body output bindings', () => {
  const document = createDefaultGraphIRDocument(1);
  const body = createDefaultLegacyBodyDefinition(1);
  body.brainBindings.outputs[0] = {
    brainSignalNodeId: 'missing-output-node',
    bodySignalId: 'motor-turn-left',
  };

  assert.throws(
    () => compileLegacyBrainDefinition(document, body, LEGACY_COMPAT_CONTEXT),
    /non-root or non-output brain signal/
  );
});

test('compileLegacyBrainDefinition honors legacy compat body bindings that use AgentIR-native signal node ids', () => {
  const document = createValidGraphIRDocument();
  const body: LegacyBodyDefinition = {
    version: 1,
    inputSignals: [
      {
        id: 'vision-g-0',
        source: {
          kind: 'vision-cell',
          channel: 'G',
          cellIndex: 0,
        },
        scale: 2,
      },
    ],
    outputSignals: [
      {
        id: 'motor-move-forward',
        target: {
          kind: 'action-channel',
          channel: 'move-forward',
        },
        decayPerSecond: 7,
      },
    ],
    brainBindings: {
      inputs: [
        {
          bodySignalId: 'vision-g-0',
          brainSignalNodeId: 'vision-in',
        },
      ],
      outputs: [
        {
          bodySignalId: 'motor-move-forward',
          brainSignalNodeId: 'motor-out',
        },
      ],
    },
  };

  const program = compileLegacyBrainDefinition(document, body, LEGACY_COMPAT_CONTEXT);
  const result = stepLegacyBrainProgram(program, [0, 0.5, 0], createLegacyBrainProgramRuntimeState(program), 1);

  assert.equal(program.inputBindings[0]?.nodeId, 'vision-in');
  assert.equal(program.inputBindings[0]?.index, 1);
  assert.equal(program.outputBindings[0]?.nodeId, 'motor-out');
  assert.equal(program.outputBindings[0]?.channel, 'move-forward');
  assert.equal(result.runtimeState.signals.get('vision-in'), 0.5);
  assert.equal(result.runtimeState.activeLeafNodeIds.includes('vision-in'), true);
});
