import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentValidationError,
  compileAgentIR,
  createAgentProgramRuntimeState,
  stepAgentProgram,
  validateAgentIR,
  validateAgentIRModelCatalog,
  type AgentIR,
} from '../../src/domain/brain';
import { createVisionActionWorldRegistry } from '../../src/host';

const WORLD_REGISTRY = createVisionActionWorldRegistry();
type AgentSynapseModel = NonNullable<AgentIR['brain']['synapseModels']>[number];

const createEndpointDrivenAgent = (): AgentIR =>
  ({
    metadata: {
      id: 'agent-endpoint-driven',
      name: 'Endpoint Driven Agent',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    body: {
      inputEndpoints: [
        {
          id: 'vision-cells',
          source: 'vision.G.2',
          worldPort: 'vision',
          scale: 2,
        },
      ],
      outputEndpoints: [
        {
          id: 'motor-turn-left',
          target: 'action.turn-left',
          worldPort: 'action',
          decayPerSecond: 3,
        },
        {
          id: 'motor-move-forward',
          target: 'action.move-forward',
          worldPort: 'action',
          decayPerSecond: 3,
        },
        {
          id: 'motor-turn-right',
          target: 'action.turn-right',
          worldPort: 'action',
          decayPerSecond: 3,
        },
      ],
      mappings: [
        {
          id: 'input-vision-g-2',
          kind: 'input',
          endpointId: 'vision-cells',
          nodeId: 'sensor-G-2',
        },
        {
          id: 'output-turn-left',
          kind: 'output',
          endpointId: 'motor-turn-left',
          nodeId: 'effector-turn-left',
        },
        {
          id: 'output-move-forward',
          kind: 'output',
          endpointId: 'motor-move-forward',
          nodeId: 'effector-move-forward',
        },
        {
          id: 'output-turn-right',
          kind: 'output',
          endpointId: 'motor-turn-right',
          nodeId: 'effector-turn-right',
        },
      ],
    },
    brain: {
      neuronModels: [
        {
          id: 'izhikevich-default',
          family: 'izhikevich',
          label: 'Default Izhikevich',
          params: {
            a: 0.02,
            b: 0.2,
            c: -65,
            d: 8,
            threshold: -70,
          },
        },
      ],
      synapseModels: [
        {
          id: 'static-default',
          kind: 'static-current',
          label: 'Static Current',
          defaults: {
            weight: 1,
            delayMs: 0,
          },
        },
      ],
      rootContainerId: 'root',
      neurons: [
        {
          id: 'neuron-1',
          label: 'Neuron 1',
          neuronModelId: 'izhikevich-default',
          initialState: {
            v: -65,
          },
        },
      ],
      containers: [
        {
          id: 'root',
          label: 'Root',
          children: [{ scope: 'brain', nodeId: 'neuron-1' }],
        },
      ],
    },
    connections: [
      {
        id: 'input-connection',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        synapseModelId: 'static-default'
      },
      {
        id: 'output-connection',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-move-forward' },
        synapseModelId: 'static-default'
      },
    ],
    layout: {
      nodes: {},
    },
  });

const createAgentWithInputSynapseModel = (
  synapseModel: AgentSynapseModel,
  inputParameterOverrides?: AgentIR['connections'][number]['parameterOverrides']
): AgentIR => {
  const baseAgent = createEndpointDrivenAgent();
  return {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      synapseModels: [...(baseAgent.brain.synapseModels ?? []), synapseModel],
    },
    connections: [
      {
        ...baseAgent.connections[0],
        synapseModelId: synapseModel.id,
        parameterOverrides: inputParameterOverrides,
      },
      baseAgent.connections[1],
    ],
  };
};

const collectMoveForwardTrajectory = (
  agent: AgentIR,
  steps: number,
  sensoryInputs: Record<string, number> = { 'vision.G.2': 0.5 }
): { outputs: number[]; membraneVoltages: number[] } => {
  const program = compileAgentIR(agent, WORLD_REGISTRY);
  let runtimeState = createAgentProgramRuntimeState(program);
  const outputs: number[] = [];
  const membraneVoltages: number[] = [];

  for (let index = 0; index < steps; index += 1) {
    const result = stepAgentProgram(program, sensoryInputs, runtimeState, 1, index + 1);
    outputs.push(result.outputsByTarget['action.move-forward'] ?? 0);
    membraneVoltages.push(result.runtimeState.neurons.get('neuron-1')?.v ?? Number.NaN);
    runtimeState = result.runtimeState;
  }

  return { outputs, membraneVoltages };
};

type PlasticSynapseModel = Extract<
  AgentSynapseModel,
  { kind: 'static-current' | 'dual-exp-conductance' | 'dual-exp-stdp' }
>;

interface PairingStimulus {
  pre: number;
  post: number;
}

const createSpikePairingAgent = (
  plasticSynapseModel: PlasticSynapseModel,
  plasticParameterOverrides?: AgentIR['connections'][number]['parameterOverrides']
): AgentIR => ({
  metadata: {
    id: `agent-${plasticSynapseModel.kind}`,
    name: `Agent ${plasticSynapseModel.kind}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  body: {
    inputEndpoints: [
      {
        id: 'pre-input',
        source: 'vision.G.0',
        worldPort: 'vision',
        scale: 1,
      },
      {
        id: 'post-input',
        source: 'vision.R.0',
        worldPort: 'vision',
        scale: 1,
      },
    ],
    outputEndpoints: [
      {
        id: 'post-output',
        target: 'action.move-forward',
        worldPort: 'action',
        decayPerSecond: 3,
      },
    ],
    mappings: [
      {
        id: 'pre-input-map',
        kind: 'input',
        endpointId: 'pre-input',
        nodeId: 'sensor-G-0',
      },
      {
        id: 'post-input-map',
        kind: 'input',
        endpointId: 'post-input',
        nodeId: 'sensor-R-0',
      },
      {
        id: 'post-output-map',
        kind: 'output',
        endpointId: 'post-output',
        nodeId: 'effector-move-forward',
      },
    ],
  },
  brain: {
    neuronModels: [
      {
        id: 'izhikevich-spike-model',
        family: 'izhikevich',
        params: {
          a: 0.02,
          b: 0.2,
          c: -65,
          d: 8,
          threshold: 30,
        },
      },
    ],
    synapseModels: [
      {
        id: 'static-drive',
        kind: 'static-current',
        defaults: {
          weight: 1,
          delayMs: 0,
        },
      },
      plasticSynapseModel,
    ],
    rootContainerId: 'root',
    neurons: [
      {
        id: 'pre-neuron',
        label: 'Pre Neuron',
        neuronModelId: 'izhikevich-spike-model',
        initialState: {
          v: -65,
        },
      },
      {
        id: 'post-neuron',
        label: 'Post Neuron',
        neuronModelId: 'izhikevich-spike-model',
        initialState: {
          v: -65,
        },
      },
    ],
    containers: [
      {
        id: 'root',
        label: 'Root',
        children: [
          { scope: 'brain', nodeId: 'pre-neuron' },
          { scope: 'brain', nodeId: 'post-neuron' },
        ],
      },
    ],
  },
  connections: [
    {
      id: 'pre-drive',
      from: { scope: 'bodyInput', nodeId: 'sensor-G-0' },
      to: { scope: 'brain', nodeId: 'pre-neuron' },
      synapseModelId: 'static-drive',
      parameterOverrides: {
        weight: 50,
      }
    },
    {
      id: 'post-drive',
      from: { scope: 'bodyInput', nodeId: 'sensor-R-0' },
      to: { scope: 'brain', nodeId: 'post-neuron' },
      synapseModelId: 'static-drive',
      parameterOverrides: {
        weight: 50,
      }
    },
    {
      id: 'plastic-connection',
      from: { scope: 'brain', nodeId: 'pre-neuron' },
      to: { scope: 'brain', nodeId: 'post-neuron' },
      synapseModelId: plasticSynapseModel.id,
      ...(plasticParameterOverrides ? { parameterOverrides: plasticParameterOverrides } : {})
    },
    {
      id: 'post-output',
      from: { scope: 'brain', nodeId: 'post-neuron' },
      to: { scope: 'bodyOutput', nodeId: 'effector-move-forward' },
      synapseModelId: 'static-drive'
    },
  ],
  layout: {
    nodes: {},
  },
});

const runPairingStimulus = (
  program: ReturnType<typeof compileAgentIR>,
  stimuli: PairingStimulus[],
  deltaTime = 0.05
): ReturnType<typeof createAgentProgramRuntimeState> => {
  let runtimeState = createAgentProgramRuntimeState(program);
  for (let index = 0; index < stimuli.length; index += 1) {
    const stimulus = stimuli[index];
    const result = stepAgentProgram(
      program,
      {
        'vision.G.0': stimulus.pre,
        'vision.R.0': stimulus.post,
      },
      runtimeState,
      deltaTime,
      index + 1
    );
    runtimeState = result.runtimeState;
  }
  return runtimeState;
};

const createPairingSequence = (
  pairCount: number,
  first: PairingStimulus,
  second: PairingStimulus
): PairingStimulus[] => {
  const sequence: PairingStimulus[] = [];
  for (let index = 0; index < pairCount; index += 1) {
    sequence.push(first, second);
  }
  return sequence;
};

const getConnectionWeight = (program: ReturnType<typeof compileAgentIR>, connectionId: string): number => {
  const connection = program.connections.find((item) => item.id === connectionId);
  assert.ok(connection, `Expected connection "${connectionId}" to exist.`);
  return connection.weight;
};

test('compileAgentIR resolves explicit BodyIR endpoint mappings into runtime ports and does not require body node ids to mirror historical naming', () => {
  const program = compileAgentIR(createEndpointDrivenAgent(), WORLD_REGISTRY);

  assert.equal(program.inputPorts.length, 1);
  assert.deepEqual(
    program.inputPorts.find((port) => port.id === 'sensor-G-2'),
    {
      id: 'sensor-G-2',
      source: 'vision.G.2',
      worldPort: 'vision',
      scale: 2,
    }
  );
  assert.equal(program.outputPorts.length, 3);
  assert.deepEqual(
    program.outputPorts.find((port) => port.id === 'effector-move-forward'),
    {
      id: 'effector-move-forward',
      target: 'action.move-forward',
      normalizedTarget: 'action.move-forward',
      worldPort: 'action',
      commandKind: 'move-forward',
      decayPerSecond: 3,
    }
  );
  assert.deepEqual(program.summary, {
    inputSignalCount: 1,
    outputSignalCount: 3,
    neuronCount: 1,
    connectionCount: 2,
    leafLinkCount: 2,
  });
});

test('compileAgentIR lowers static-current parameters from model defaults and per-connection overrides, ignoring non-canonical top-level fields', () => {
  const baseAgent = createEndpointDrivenAgent();
  const agent: AgentIR = {
    ...baseAgent,
    connections: [
      {
        ...baseAgent.connections[0],
      },
      {
        ...baseAgent.connections[1],
        parameterOverrides: {
          weight: 2.5,
          delayMs: 4,
        },
      },
    ],
  };

  const program = compileAgentIR(agent, WORLD_REGISTRY);
  const connectionsById = new Map(program.connections.map((connection) => [connection.id, connection]));

  assert.equal(connectionsById.get('input-connection')?.weight, 1);
  assert.equal(connectionsById.get('input-connection')?.delayMs, 0);
  assert.equal(connectionsById.get('output-connection')?.weight, 2.5);
  assert.equal(connectionsById.get('output-connection')?.delayMs, 4);
});

test('stepAgentProgram consumes mapping-resolved input ports and activates mapping-resolved output ports', () => {
  const program = compileAgentIR(createEndpointDrivenAgent(), WORLD_REGISTRY);
  const runtimeState = createAgentProgramRuntimeState(program);
  const sensoryInputs: Record<string, number> = {
    'vision.G.2': 0.5,
  };

  const result = stepAgentProgram(program, sensoryInputs, runtimeState, 1, 1);

  assert.equal(result.outputsByTarget['action.move-forward'], 1);
  assert.deepEqual(
    result.outputSignals.find((signal) => signal.id === 'effector-move-forward'),
    {
      id: 'effector-move-forward',
      target: 'action.move-forward',
      normalizedTarget: 'action.move-forward',
      worldPort: 'action',
      commandKind: 'move-forward',
      value: 1,
    }
  );
  assert.deepEqual(
    new Set(result.runtimeState.activeLeafNodeIds),
    new Set(['sensor-G-2', 'neuron-1', 'effector-move-forward'])
  );
});

test('stepAgentProgram ignores non-canonical body node-id input keys and only reads normalized source keys', () => {
  const program = compileAgentIR(createEndpointDrivenAgent(), WORLD_REGISTRY);
  const runtimeState = createAgentProgramRuntimeState(program);

  const normalizedOnly = stepAgentProgram(
    program,
    {
      'vision.G.2': 1,
    },
    runtimeState,
    1,
    1
  );

  const nonCanonicalOnly = stepAgentProgram(
    program,
    {
      'sensor-G-2': 1,
    },
    runtimeState,
    1,
    1
  );

  assert.equal(normalizedOnly.runtimeState.activeLeafNodeIds.includes('sensor-G-2'), true);
  assert.equal(nonCanonicalOnly.runtimeState.activeLeafNodeIds.includes('sensor-G-2'), false);
});

test('stepAgentProgram applies connection delayMs to runtime propagation timing', () => {
  const createStaticPlasticAgent = (delayMs: number): AgentIR =>
    createSpikePairingAgent({
      id: `static-delay-${delayMs}`,
      kind: 'static-current',
      defaults: {
        weight: 50,
        delayMs,
      },
    });

  const collectMoveForwardOutputs = (agent: AgentIR): number[] => {
    const program = compileAgentIR(agent, WORLD_REGISTRY);
    let runtimeState = createAgentProgramRuntimeState(program);
    const outputs: number[] = [];
    const stimuli: PairingStimulus[] = [
      { pre: 1, post: 0 },
      { pre: 0, post: 0 },
      { pre: 0, post: 0 },
      { pre: 0, post: 0 },
      { pre: 0, post: 0 },
    ];

    for (let index = 0; index < stimuli.length; index += 1) {
      const result = stepAgentProgram(
        program,
        {
          'vision.G.0': stimuli[index].pre,
          'vision.R.0': stimuli[index].post,
        },
        runtimeState,
        0.05,
        index + 1
      );
      outputs.push(result.outputsByTarget['action.move-forward'] ?? 0);
      runtimeState = result.runtimeState;
    }

    return outputs;
  };

  const noDelayOutputs = collectMoveForwardOutputs(createStaticPlasticAgent(0));
  const delayedOutputs = collectMoveForwardOutputs(createStaticPlasticAgent(100));
  const firstNoDelayActivation = noDelayOutputs.findIndex((value) => value > 0.5);
  const firstDelayedActivation = delayedOutputs.findIndex((value) => value > 0.5);

  assert.notEqual(firstNoDelayActivation, -1);
  assert.notEqual(firstDelayedActivation, -1);
  assert.equal(firstDelayedActivation - firstNoDelayActivation, 2);
});

test('validateAgentIR rejects body endpoints that do not match any BodyIR mapping', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    connections: [
      {
        id: 'bad-input',
        from: { scope: 'bodyInput', nodeId: 'vision-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        synapseModelId: 'static-default'
      },
    ],
  };

  const issues = validateAgentIR(invalidAgent, WORLD_REGISTRY);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'runtime-binding-error' &&
        issue.message.includes('vision-G-2') &&
        issue.message.includes('does not match any BodyIR input mapping')
    )
  );
});

test('validateAgentIR rejects body output endpoints that resolve to unsupported action targets', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    body: {
      ...createEndpointDrivenAgent().body,
      outputEndpoints: [
        {
          id: 'motor-strafe-left',
          target: 'action.strafe-left',
          worldPort: 'action',
          decayPerSecond: 3,
        },
      ],
      mappings: [
        {
          id: 'output-strafe-left',
          kind: 'output',
          endpointId: 'motor-strafe-left',
          nodeId: 'effector-strafe-left',
        },
      ],
    },
    connections: [
      {
        id: 'unsupported-output-connection',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-strafe-left' },
        synapseModelId: 'static-default'
      },
    ],
  };

  const issues = validateAgentIR(invalidAgent, WORLD_REGISTRY);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'runtime-binding-error' &&
        issue.message.includes('effector-strafe-left') &&
        issue.message.includes('unsupported target "action.strafe-left"')
    )
  );
});

test('validateAgentIR rejects direct bodyInput -> bodyOutput connections', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    connections: [
      {
        id: 'invalid-direct-body-bridge',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'bodyOutput', nodeId: 'effector-move-forward' },
        synapseModelId: 'static-default'
      },
    ],
  };

  const issues = validateAgentIR(invalidAgent, WORLD_REGISTRY);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'invalid-connection-direction' &&
        issue.message.includes('invalid-direct-body-bridge') &&
        issue.message.includes('bodyInput directly to bodyOutput')
    )
  );
});

test('validateAgentIR rejects invalid container ownership and missing child references', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    brain: {
      ...createEndpointDrivenAgent().brain,
      containers: [
        {
          id: 'root',
          label: 'Root',
          children: [
            { scope: 'brain', nodeId: 'neuron-1' },
            { scope: 'brain', nodeId: 'missing-neuron' },
            { scope: 'container', nodeId: 'group-1' },
          ],
        },
        {
          id: 'group-1',
          label: 'Group 1',
          children: [{ scope: 'brain', nodeId: 'neuron-1' }],
        },
        {
          id: 'orphan-group',
          label: 'Orphan',
          children: [],
        },
      ],
    },
  };

  const issues = validateAgentIR(invalidAgent, WORLD_REGISTRY);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'missing-brain-node' &&
        issue.message.includes('missing-neuron')
    )
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'invalid-brain-structure' &&
        issue.message.includes('neuron-1') &&
        issue.message.includes('multiple containers')
    )
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'invalid-brain-structure' &&
        issue.message.includes('orphan-group')
    )
  );
});

test('compileAgentIR + stepAgentProgram accept single-exp-conductance with deterministic runtime behavior', () => {
  const singleExpAgent = createAgentWithInputSynapseModel({
    id: 'single-exp-default',
    kind: 'single-exp-conductance',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 1.2,
      reversalPotential: -120,
      tauDecayMs: 8,
    },
  });

  const firstRun = collectMoveForwardTrajectory(singleExpAgent, 4);
  const secondRun = collectMoveForwardTrajectory(singleExpAgent, 4);

  assert.equal(firstRun.outputs.length, 4);
  assert.deepEqual(firstRun, secondRun);
});

test('compileAgentIR + stepAgentProgram accept dual-exp-conductance with deterministic runtime behavior', () => {
  const dualExpAgent = createAgentWithInputSynapseModel({
    id: 'dual-exp-default',
    kind: 'dual-exp-conductance',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 1.2,
      reversalPotential: -120,
      tauRiseMs: 2,
      tauDecayMs: 12,
    },
  });

  const firstRun = collectMoveForwardTrajectory(dualExpAgent, 4);
  const secondRun = collectMoveForwardTrajectory(dualExpAgent, 4);

  assert.equal(firstRun.outputs.length, 4);
  assert.deepEqual(firstRun, secondRun);
});

test('single-exp and dual-exp conductance produce deterministic output differences vs static-current under identical input', () => {
  const staticTrajectory = collectMoveForwardTrajectory(createEndpointDrivenAgent(), 5);

  const singleExpAgent = createAgentWithInputSynapseModel({
    id: 'single-exp-inhibitory',
    kind: 'single-exp-conductance',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 1.4,
      reversalPotential: -120,
      tauDecayMs: 10,
    },
  });
  const singleExpTrajectory = collectMoveForwardTrajectory(singleExpAgent, 5);
  const singleExpTrajectoryRepeat = collectMoveForwardTrajectory(singleExpAgent, 5);

  const dualExpAgent = createAgentWithInputSynapseModel({
    id: 'dual-exp-inhibitory',
    kind: 'dual-exp-conductance',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 1.4,
      reversalPotential: -120,
      tauRiseMs: 2000,
      tauDecayMs: 10000,
    },
  });
  const dualExpTrajectory = collectMoveForwardTrajectory(dualExpAgent, 5);
  const dualExpTrajectoryRepeat = collectMoveForwardTrajectory(dualExpAgent, 5);

  assert.deepEqual(staticTrajectory.outputs, [1, 1, 1, 1, 1]);
  assert.deepEqual(singleExpTrajectory.outputs, [0, 0, 0, 0, 0]);
  assert.deepEqual(dualExpTrajectory.outputs, [1, 1, 0, 0, 0]);
  assert.deepEqual(singleExpTrajectory, singleExpTrajectoryRepeat);
  assert.deepEqual(dualExpTrajectory, dualExpTrajectoryRepeat);
});

test('validateAgentIR rejects invalid conductance parameters (tau<=0 and non-finite gMax/reversalPotential)', () => {
  const invalidSingleExp = createAgentWithInputSynapseModel(
    {
      id: 'single-exp-invalid-tau',
      kind: 'single-exp-conductance',
      defaults: {
        weight: 1,
        delayMs: 0,
        gMax: 1,
        reversalPotential: 0,
        tauDecayMs: 0,
      },
    },
    {
      tauDecayMs: -1,
    }
  );
  const invalidDualExp = createAgentWithInputSynapseModel({
    id: 'dual-exp-invalid-finite',
    kind: 'dual-exp-conductance',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: Number.POSITIVE_INFINITY,
      reversalPotential: Number.NaN,
      tauRiseMs: 1,
      tauDecayMs: 5,
    },
  });

  const singleExpIssues = validateAgentIR(invalidSingleExp, WORLD_REGISTRY);
  const dualExpIssues = validateAgentIR(invalidDualExp, WORLD_REGISTRY);

  assert.ok(
    singleExpIssues.some(
      (issue) =>
        issue.code === 'invalid-synapse-parameter-resolution' &&
        issue.message.includes('single-exp-invalid-tau') &&
        issue.message.includes('tauDecayMs')
    )
  );
  assert.ok(
    dualExpIssues.some(
      (issue) =>
        issue.code === 'invalid-synapse-parameter-resolution' &&
        issue.message.includes('dual-exp-invalid-finite') &&
        (issue.message.includes('gMax') || issue.message.includes('reversalPotential'))
    )
  );
  assert.throws(() => compileAgentIR(invalidSingleExp, WORLD_REGISTRY), AgentValidationError);
  assert.throws(() => compileAgentIR(invalidDualExp, WORLD_REGISTRY), AgentValidationError);
});

test('compileAgentIR lowers dual-exp-stdp into runtime connection config', () => {
  const stdpAgent = createAgentWithInputSynapseModel({
    id: 'dual-exp-stdp-default',
    kind: 'dual-exp-stdp',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 1,
      reversalPotential: 0,
      tauRiseMs: 1,
      tauDecayMs: 8,
      aPlus: 0.01,
      aMinus: 0.012,
      tauPlusMs: 20,
      tauMinusMs: 20,
      wMin: 0,
      wMax: 3,
    },
  });

  const program = compileAgentIR(stdpAgent, WORLD_REGISTRY);
  const stdpConnection = program.connections.find((connection) => connection.id === 'input-connection');

  assert.deepEqual(stdpConnection, {
    id: 'input-connection',
    sourceNodeId: 'sensor-G-2',
    targetNodeId: 'neuron-1',
    synapseModelId: 'dual-exp-stdp-default',
    synapseKind: 'dual-exp-stdp',
    weight: 1,
    delayMs: 0,
    gMax: 1,
    reversalPotential: 0,
    tauRiseMs: 1,
    tauDecayMs: 8,
    aPlus: 0.01,
    aMinus: 0.012,
    tauPlusMs: 20,
    tauMinusMs: 20,
    wMin: 0,
    wMax: 3,
  });
});

test('compileAgentIR keeps dual-exp-stp fail-closed with connection id and kind in error message', () => {
  const stpAgent = createAgentWithInputSynapseModel({
    id: 'dual-exp-stp-default',
    kind: 'dual-exp-stp',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 1,
      reversalPotential: 0,
      tauRiseMs: 1,
      tauDecayMs: 8,
      utilization: 0.3,
      tauFacilitationMs: 100,
      tauRecoveryMs: 200,
    },
  });

  assert.throws(
    () => compileAgentIR(stpAgent, WORLD_REGISTRY),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('input-connection') &&
      error.message.includes('dual-exp-stp')
  );
});

test('stepAgentProgram STDP potentiation increases weight for pre-before-post pairing', () => {
  const agent = createSpikePairingAgent({
    id: 'stdp-potentiation',
    kind: 'dual-exp-stdp',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 0,
      reversalPotential: 0,
      tauRiseMs: 2,
      tauDecayMs: 12,
      aPlus: 0.4,
      aMinus: 0.1,
      tauPlusMs: 20,
      tauMinusMs: 20,
      wMin: 0.5,
      wMax: 2,
    },
  });
  const program = compileAgentIR(agent, WORLD_REGISTRY);
  const initialWeight = getConnectionWeight(program, 'plastic-connection');

  const runtimeState = runPairingStimulus(
    program,
    createPairingSequence(4, { pre: 1, post: 0 }, { pre: 0, post: 1 })
  );
  const finalWeight = runtimeState.stdp.effectiveWeightByConnectionId.get('plastic-connection');
  assert.ok(typeof finalWeight === 'number');
  assert.ok(finalWeight > initialWeight);
});

test('stepAgentProgram STDP depression decreases weight for post-before-pre pairing', () => {
  const agent = createSpikePairingAgent({
    id: 'stdp-depression',
    kind: 'dual-exp-stdp',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 0,
      reversalPotential: 0,
      tauRiseMs: 2,
      tauDecayMs: 12,
      aPlus: 0.1,
      aMinus: 0.4,
      tauPlusMs: 20,
      tauMinusMs: 20,
      wMin: 0.5,
      wMax: 2,
    },
  });
  const program = compileAgentIR(agent, WORLD_REGISTRY);
  const initialWeight = getConnectionWeight(program, 'plastic-connection');

  const runtimeState = runPairingStimulus(
    program,
    createPairingSequence(4, { pre: 0, post: 1 }, { pre: 1, post: 0 })
  );
  const finalWeight = runtimeState.stdp.effectiveWeightByConnectionId.get('plastic-connection');
  assert.ok(typeof finalWeight === 'number');
  assert.ok(finalWeight < initialWeight);
});

test('stepAgentProgram STDP clamps updated weight into [wMin, wMax]', () => {
  const agent = createSpikePairingAgent({
    id: 'stdp-clamp',
    kind: 'dual-exp-stdp',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 0,
      reversalPotential: 0,
      tauRiseMs: 2,
      tauDecayMs: 12,
      aPlus: 2,
      aMinus: 2,
      tauPlusMs: 20,
      tauMinusMs: 20,
      wMin: 0.8,
      wMax: 1.2,
    },
  });
  const program = compileAgentIR(agent, WORLD_REGISTRY);

  const potentiatedRuntimeState = runPairingStimulus(
    program,
    createPairingSequence(12, { pre: 1, post: 0 }, { pre: 0, post: 1 })
  );

  const potentiatedWeight =
    potentiatedRuntimeState.stdp.effectiveWeightByConnectionId.get('plastic-connection');
  assert.ok(typeof potentiatedWeight === 'number');
  assert.ok(potentiatedWeight <= 1.2);
  assert.ok(potentiatedWeight >= 0.8);

  const depressedRuntimeState = runPairingStimulus(
    program,
    createPairingSequence(12, { pre: 0, post: 1 }, { pre: 1, post: 0 })
  );

  const depressedWeight = depressedRuntimeState.stdp.effectiveWeightByConnectionId.get('plastic-connection');
  assert.ok(typeof depressedWeight === 'number');
  assert.ok(depressedWeight <= 1.2);
  assert.ok(depressedWeight >= 0.8);
});

test('stepAgentProgram keeps static-current and dual-exp-conductance weights unchanged under repeated steps', () => {
  const staticAgent = createSpikePairingAgent({
    id: 'static-no-learning',
    kind: 'static-current',
    defaults: {
      weight: 1.7,
      delayMs: 0,
    },
  });
  const staticProgram = compileAgentIR(staticAgent, WORLD_REGISTRY);
  const staticInitialWeight = getConnectionWeight(staticProgram, 'plastic-connection');

  runPairingStimulus(staticProgram, createPairingSequence(6, { pre: 1, post: 0 }, { pre: 0, post: 1 }));

  const staticFinalWeight = getConnectionWeight(staticProgram, 'plastic-connection');
  assert.equal(staticFinalWeight, staticInitialWeight);

  const dualExpAgent = createSpikePairingAgent({
    id: 'dual-exp-no-learning',
    kind: 'dual-exp-conductance',
    defaults: {
      weight: 1.6,
      delayMs: 0,
      gMax: 0.2,
      reversalPotential: 0,
      tauRiseMs: 2,
      tauDecayMs: 12,
    },
  });
  const dualExpProgram = compileAgentIR(dualExpAgent, WORLD_REGISTRY);
  const dualExpInitialWeight = getConnectionWeight(dualExpProgram, 'plastic-connection');

  runPairingStimulus(dualExpProgram, createPairingSequence(6, { pre: 1, post: 0 }, { pre: 0, post: 1 }));

  const dualExpFinalWeight = getConnectionWeight(dualExpProgram, 'plastic-connection');
  assert.equal(dualExpFinalWeight, dualExpInitialWeight);
});

test('stepAgentProgram repeated runtime steps do not mutate source AgentIR', () => {
  const agent = createSpikePairingAgent({
    id: 'stdp-source-immutability',
    kind: 'dual-exp-stdp',
    defaults: {
      weight: 1,
      delayMs: 0,
      gMax: 0,
      reversalPotential: 0,
      tauRiseMs: 2,
      tauDecayMs: 12,
      aPlus: 0.4,
      aMinus: 0.4,
      tauPlusMs: 20,
      tauMinusMs: 20,
      wMin: 0.5,
      wMax: 2,
    },
  });
  const expectedSnapshot = JSON.parse(JSON.stringify(agent));
  const program = compileAgentIR(agent, WORLD_REGISTRY);

  runPairingStimulus(program, createPairingSequence(8, { pre: 1, post: 0 }, { pre: 0, post: 1 }));

  assert.deepEqual(agent, expectedSnapshot);
});

test('validateAgentIR rejects static-current connection when model defaults and overrides cannot resolve weight/delayMs', () => {
  const baseAgent = createEndpointDrivenAgent();
  const invalidAgent: AgentIR = {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      synapseModels: [
        {
          id: 'static-broken',
          kind: 'static-current',
          defaults: {
            weight: Number.NaN,
            delayMs: Number.NaN,
          },
        },
      ],
    },
    connections: [
      {
        ...baseAgent.connections[0],
        id: 'missing-static-current-params',
        synapseModelId: 'static-broken',
        parameterOverrides: undefined,
      },
      {
        ...baseAgent.connections[1],
        synapseModelId: 'static-broken',
      },
    ],
  };

  const issues = validateAgentIR(invalidAgent, WORLD_REGISTRY);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'invalid-synapse-parameter-resolution' &&
        issue.message.includes('missing-static-current-params') &&
        issue.message.includes('weight') &&
        issue.message.includes('delayMs')
    )
  );
  assert.throws(() => compileAgentIR(invalidAgent, WORLD_REGISTRY), AgentValidationError);
});

test('validateAgentIR rejects duplicate neuron and container ids', () => {
  const baseAgent = createEndpointDrivenAgent();
  const invalidAgent: AgentIR = {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      neurons: [...baseAgent.brain.neurons, { ...baseAgent.brain.neurons[0] }],
      containers: [...baseAgent.brain.containers, { ...baseAgent.brain.containers[0] }],
    },
  };

  const issues = validateAgentIR(invalidAgent, WORLD_REGISTRY);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'duplicate-brain-node-id' &&
        issue.message.includes('neuron-1')
    )
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'duplicate-brain-node-id' &&
        issue.message.includes('root')
    )
  );
});

test('validateAgentIR rejects neuron and container id collisions', () => {
  const baseAgent = createEndpointDrivenAgent();
  const invalidAgent: AgentIR = {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      containers: [
        ...baseAgent.brain.containers,
        {
          id: 'neuron-1',
          label: 'Colliding Container',
          children: [],
        },
      ],
    },
  };

  const issues = validateAgentIR(invalidAgent, WORLD_REGISTRY);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'duplicate-brain-node-id' &&
        issue.message.includes('collides with neuron id')
    )
  );
});

test('validateAgentIRModelCatalog rejects missing neuron model references', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    brain: {
      ...createEndpointDrivenAgent().brain,
      neurons: [
        {
          ...createEndpointDrivenAgent().brain.neurons[0],
          neuronModelId: 'missing-neuron-model',
        },
      ],
      neuronModels: [],
    },
  };

  const issues = validateAgentIRModelCatalog(invalidAgent);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'missing-neuron-model' &&
        issue.message.includes('missing-neuron-model')
    )
  );
});

test('validateAgentIRModelCatalog rejects missing synapse model references', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    brain: {
      ...createEndpointDrivenAgent().brain,
      synapseModels: [],
    },
    connections: [
      {
        ...createEndpointDrivenAgent().connections[0],
        synapseModelId: 'missing-synapse-model',
      },
    ],
  };

  const issues = validateAgentIRModelCatalog(invalidAgent);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'missing-synapse-model' &&
        issue.message.includes('missing-synapse-model')
    )
  );
});

test('validateAgentIRModelCatalog rejects duplicate neuron and synapse model ids', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    brain: {
      ...createEndpointDrivenAgent().brain,
      neuronModels: [
        {
          id: 'shared-neuron-model',
          family: 'izhikevich',
          params: {
            a: 0.02,
            b: 0.2,
            c: -65,
            d: 8,
            threshold: -70,
          },
        },
        {
          id: 'shared-neuron-model',
          family: 'izhikevich',
          params: {
            a: 0.02,
            b: 0.2,
            c: -65,
            d: 8,
            threshold: -70,
          },
        },
      ],
      synapseModels: [
        {
          id: 'shared-synapse-model',
          kind: 'static-current',
          defaults: {
            weight: 1,
            delayMs: 0,
          },
        },
        {
          id: 'shared-synapse-model',
          kind: 'static-current',
          defaults: {
            weight: 2,
            delayMs: 0,
          },
        },
      ],
    },
  };

  const issues = validateAgentIRModelCatalog(invalidAgent);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'duplicate-neuron-model-id' &&
        issue.message.includes('shared-neuron-model')
    )
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'duplicate-synapse-model-id' &&
        issue.message.includes('shared-synapse-model')
    )
  );
});

test('validateAgentIRModelCatalog rejects invalid override shapes', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    brain: {
      ...createEndpointDrivenAgent().brain,
      neurons: [
        {
          ...createEndpointDrivenAgent().brain.neurons[0],
          parameterOverrides: {
            a: '0.02' as unknown as number,
          } as unknown as AgentIR['brain']['neurons'][number]['parameterOverrides'],
        },
      ],
    },
    connections: [
      {
        ...createEndpointDrivenAgent().connections[0],
        parameterOverrides: {
          gain: 1 as unknown as number,
        } as unknown as AgentIR['connections'][number]['parameterOverrides'],
      },
    ],
  };

  const issues = validateAgentIRModelCatalog(invalidAgent);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'invalid-neuron-parameter-override' &&
        issue.message.includes('parameterOverrides')
    )
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'invalid-synapse-parameter-override' &&
        issue.message.includes('"gain"')
    )
  );
});
