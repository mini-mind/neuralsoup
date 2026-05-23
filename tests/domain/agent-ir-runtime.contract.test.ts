import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileAgentIR,
  createAgentProgramRuntimeState,
  deriveAgentIRVisionCellCount,
  stepAgentProgram,
  validateAgentIR,
  withDerivedBodyVisionCellCount,
  withVisionCellLayoutMarkers,
  type AgentIR,
} from '../../src/domain/brain';
import { createLegacyGraphBridgeFromAgent } from '../../src/domain/brain/legacy-graph-bridge';

const createRuleDrivenAgent = (): AgentIR =>
  withDerivedBodyVisionCellCount(
    withVisionCellLayoutMarkers({
      version: 1,
      metadata: {
        id: 'agent-rule-driven',
        name: 'Rule Driven Agent',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      body: {
        version: 1,
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
    }, 3)
  );

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
  const sparseAgent: AgentIR = withDerivedBodyVisionCellCount(withVisionCellLayoutMarkers({
    ...createRuleDrivenAgent(),
    connections: [
      {
        id: 'sparse-input',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        weight: 1,
      },
    ],
  }, 36));

  const bridge = createLegacyGraphBridgeFromAgent(sparseAgent);

  const inputAdapter = bridge.document.root.children.find((node) => node.id === 'input-adapter');
  assert.ok(inputAdapter && inputAdapter.kind === 'adapter');
  assert.equal(inputAdapter.children.length, 36 * 3);
  assert.equal(deriveAgentIRVisionCellCount(sparseAgent), 36);
});

test('legacy graph bridge projects rule-driven body node ids onto legacy GraphIR signal nodes without dropping links', () => {
  const bridge = createLegacyGraphBridgeFromAgent(createRuleDrivenAgent());

  assert.ok(
    bridge.document.root.links.some(
      (link) =>
        link.from.nodeId === 'vision-G-2' &&
        link.to.nodeId === 'core-input-G'
    )
  );
  assert.ok(
    bridge.document.root.links.some(
      (link) =>
        link.from.nodeId === 'core-input-G' &&
        link.to.nodeId === 'neuron-1'
    )
  );
  assert.ok(
    bridge.document.root.links.some(
      (link) =>
        link.from.nodeId === 'neuron-1' &&
        link.to.nodeId === 'core-output-move-forward'
    )
  );
  assert.ok(
    bridge.document.root.links.some(
      (link) =>
        link.from.nodeId === 'core-output-move-forward' &&
        link.to.nodeId === 'output-move-forward'
    )
  );
});

test('validateAgentIR rejects invalid container ownership and missing child references', () => {
  const invalidAgent: AgentIR = {
    ...createRuleDrivenAgent(),
    brain: {
      ...createRuleDrivenAgent().brain,
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

  const issues = validateAgentIR(invalidAgent);

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

test('validateAgentIR rejects duplicate neuron and container ids', () => {
  const baseAgent = createRuleDrivenAgent();
  const invalidAgent: AgentIR = {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      neurons: [...baseAgent.brain.neurons, { ...baseAgent.brain.neurons[0] }],
      containers: [...baseAgent.brain.containers, { ...baseAgent.brain.containers[0] }],
    },
  };

  const issues = validateAgentIR(invalidAgent);

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

test('legacy graph bridge reports dropped compat links when multiple AgentIR edges collapse onto one legacy bridge edge', () => {
  const bridge = createLegacyGraphBridgeFromAgent({
    ...createRuleDrivenAgent(),
    connections: [
      {
        id: 'input-connection-a',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        weight: 1,
      },
      {
        id: 'input-connection-b',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        weight: 0.5,
      },
    ],
  });

  assert.deepEqual(bridge.droppedConnectionIds, ['input-connection-b']);
});

test('legacy graph bridge does not treat lossless shared compat edges as dropped connections', () => {
  const bridge = createLegacyGraphBridgeFromAgent({
    ...createRuleDrivenAgent(),
    brain: {
      ...createRuleDrivenAgent().brain,
      neurons: [
        ...createRuleDrivenAgent().brain.neurons,
        {
          id: 'neuron-2',
          label: 'Neuron 2',
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
          children: [
            { scope: 'brain', nodeId: 'neuron-1' },
            { scope: 'brain', nodeId: 'neuron-2' },
          ],
        },
      ],
    },
    connections: [
      {
        id: 'input-connection-a',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        weight: 1,
      },
      {
        id: 'input-connection-b',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-2' },
        weight: 1,
      },
      {
        id: 'output-connection-a',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-move-forward' },
        weight: 1,
      },
      {
        id: 'output-connection-b',
        from: { scope: 'brain', nodeId: 'neuron-2' },
        to: { scope: 'bodyOutput', nodeId: 'effector-move-forward' },
        weight: 1,
      },
    ],
  });

  assert.deepEqual(bridge.droppedConnectionIds, []);
});

test('validateAgentIR rejects neuron and container id collisions', () => {
  const baseAgent = createRuleDrivenAgent();
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

  const issues = validateAgentIR(invalidAgent);

  assert.ok(
    issues.some(
      (issue) =>
        issue.code === 'duplicate-brain-node-id' &&
        issue.message.includes('collides with neuron id')
    )
  );
});

test('legacy graph bridge marks unbridgeable body endpoints as dropped connections', () => {
  const bridge = createLegacyGraphBridgeFromAgent({
    ...createRuleDrivenAgent(),
    body: {
      ...createRuleDrivenAgent().body,
      inputRules: [
        {
          id: 'non-legacy-input',
          nodeIdPattern: '^sensor-([RGB])-(\\d+)$',
          sourceTemplate: 'audio.$1.$2',
          scale: 2,
        },
      ],
    },
  });

  assert.deepEqual(bridge.droppedConnectionIds, ['input-connection']);
});

test('legacy graph bridge reports document-only losses when BodyIR rules cannot round-trip through compat body', () => {
  const bridge = createLegacyGraphBridgeFromAgent({
    ...createRuleDrivenAgent(),
    body: {
      ...createRuleDrivenAgent().body,
      inputRules: [
        {
          id: 'custom-input-a',
          nodeIdPattern: '^sensor-a$',
          sourceTemplate: 'vision.G.2',
          scale: 2,
        },
        {
          id: 'custom-input-b',
          nodeIdPattern: '^sensor-b$',
          sourceTemplate: 'vision.G.2',
          scale: 2,
        },
      ],
      outputRules: [
        {
          id: 'custom-output-a',
          nodeIdPattern: '^effector-a$',
          targetTemplate: 'action.move-forward',
          decayPerSecond: 3,
        },
        {
          id: 'custom-output-b',
          nodeIdPattern: '^effector-b$',
          targetTemplate: 'action.move-forward',
          decayPerSecond: 3,
        },
      ],
    },
    connections: [
      {
        id: 'input-connection-a',
        from: { scope: 'bodyInput', nodeId: 'sensor-a' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        weight: 1,
      },
      {
        id: 'output-connection-a',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-a' },
        weight: 1,
      },
    ],
  });

  assert.deepEqual(bridge.droppedConnectionIds, []);
  assert.ok(
    bridge.documentOnlyLosses.some((message) =>
      message.includes('cannot preserve full BodyIR input rule semantics')
    )
  );
  assert.ok(
    bridge.documentOnlyLosses.some((message) =>
      message.includes('cannot preserve full BodyIR output rule semantics')
    )
  );
});

test('legacy graph bridge reports document-only losses for unconnected BodyIR alias rules that compat getter would otherwise drop', () => {
  const agent = createRuleDrivenAgent();
  const bridge = createLegacyGraphBridgeFromAgent({
    ...agent,
    body: {
      ...agent.body,
      inputRules: [
        {
          id: 'unconnected-input-regex-alias',
          nodeIdPattern: '^sensor-(left|right)$',
          sourceTemplate: 'vision.G.1',
          scale: 5,
        },
      ],
      outputRules: [
        {
          id: 'unconnected-output-regex-alias',
          nodeIdPattern: '^effector-(dash|glide)$',
          targetTemplate: 'action.turn-right',
          decayPerSecond: 9,
        },
      ],
    },
    connections: [],
  });

  assert.deepEqual(bridge.droppedConnectionIds, []);
  assert.ok(
    bridge.documentOnlyLosses.some((message) =>
      message.includes('cannot preserve full BodyIR input rule semantics')
    )
  );
  assert.ok(
    bridge.documentOnlyLosses.some((message) =>
      message.includes('cannot preserve full BodyIR output rule semantics')
    )
  );
  assert.ok(
    bridge.documentOnlyLosses.some((message) => message.includes('sensor-left'))
  );
  assert.ok(
    bridge.documentOnlyLosses.some((message) => message.includes('effector-dash'))
  );
});
