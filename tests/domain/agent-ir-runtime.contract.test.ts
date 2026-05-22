import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileAgentIR,
  createLegacyGraphBridgeFromAgent,
  createAgentProgramRuntimeState,
  stepAgentProgram,
  validateAgentIR,
  type AgentIR,
} from '../../src/domain/brain';

const createRuleDrivenAgent = (): AgentIR => ({
  version: 1,
  metadata: {
    id: 'agent-rule-driven',
    name: 'Rule Driven Agent',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  body: {
    version: 1,
    visionCellCount: 3,
    inputRules: [
      {
        id: 'vision-cells',
        nodeIdPattern: '^sensor-([RGB])-(\\d+)$',
        sourceTemplate: 'vision.$1.$2',
        scale: 2,
      },
    ],
    outputRules: [
      {
        id: 'motor-actions',
        nodeIdPattern: '^effector-(turn-left|move-forward|turn-right)$',
        targetTemplate: 'action.$1',
        decayPerSecond: 3,
      },
    ],
  },
  brain: {
    version: 1,
    rootContainerId: 'root',
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
          threshold: -70,
        },
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
      weight: 1,
    },
    {
      id: 'output-connection',
      from: { scope: 'brain', nodeId: 'neuron-1' },
      to: { scope: 'bodyOutput', nodeId: 'effector-move-forward' },
      weight: 1,
    },
  ],
  layout: {
    version: 1,
    nodes: {},
  },
});

test('compileAgentIR resolves BodyIR regex rules into runtime ports instead of relying on legacy node ids', () => {
  const program = compileAgentIR(createRuleDrivenAgent());

  assert.deepEqual(program.inputPorts, [
    {
      id: 'sensor-G-2',
      source: 'vision.G.2',
      index: 7,
      scale: 2,
    },
  ]);
  assert.deepEqual(
    program.outputPorts.find((port) => port.target === 'move-forward'),
    {
      id: 'effector-move-forward',
      target: 'move-forward',
      decayPerSecond: 3,
    }
  );
});

test('stepAgentProgram consumes rule-resolved input ports and activates rule-resolved output ports', () => {
  const program = compileAgentIR(createRuleDrivenAgent());
  const runtimeState = createAgentProgramRuntimeState(program);
  const sensoryInputs = new Array(9).fill(0);
  sensoryInputs[7] = 0.5;

  const result = stepAgentProgram(program, sensoryInputs, runtimeState, 1, 1);

  assert.equal(result.outputs['move-forward'], 1);
  assert.deepEqual(
    new Set(result.runtimeState.activeLeafNodeIds),
    new Set(['sensor-G-2', 'neuron-1', 'effector-move-forward'])
  );
});

test('validateAgentIR rejects body endpoints that do not match any BodyIR rule', () => {
  const invalidAgent: AgentIR = {
    ...createRuleDrivenAgent(),
    connections: [
      {
        id: 'bad-input',
        from: { scope: 'bodyInput', nodeId: 'vision-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        weight: 1,
      },
    ],
  };

  const issues = validateAgentIR(invalidAgent);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'runtime-binding-error' &&
        issue.message.includes('vision-G-2') &&
        issue.message.includes('does not match any BodyIR input rule')
    )
  );
});

test('legacy graph bridge preserves explicit BodyIR visionCellCount even when only a sparse subset is connected', () => {
  const sparseAgent: AgentIR = {
    ...createRuleDrivenAgent(),
    body: {
      ...createRuleDrivenAgent().body,
      visionCellCount: 36,
    },
    connections: [
      {
        id: 'sparse-input',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        weight: 1,
      },
    ],
  };

  const bridge = createLegacyGraphBridgeFromAgent(sparseAgent);

  const inputAdapter = bridge.document.root.children.find((node) => node.id === 'input-adapter');
  assert.ok(inputAdapter && inputAdapter.kind === 'adapter');
  assert.equal(inputAdapter.children.length, 36 * 3);
});
