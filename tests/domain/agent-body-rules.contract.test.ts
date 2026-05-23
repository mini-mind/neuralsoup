import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentBodyRulePreviewModel,
  resolveCompiledAgentBodyEndpointIds,
  type AgentIR,
} from '../../src/domain/brain';
import { createVisionActionWorldRegistry } from '../../src/host';

const WORLD_REGISTRY = createVisionActionWorldRegistry();

const createRuleDrivenAgent = (): AgentIR =>
  ({
    version: 1,
    metadata: {
      id: 'agent-body-rules',
      name: 'Agent Body Rules',
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
  });

test('buildAgentBodyRulePreviewModel projects input and output endpoint previews by rule', () => {
  const preview = buildAgentBodyRulePreviewModel(createRuleDrivenAgent(), WORLD_REGISTRY, 3);

  assert.deepEqual(preview.input.previewsByRuleId['vision-cells'], [
    { nodeId: 'sensor-B-0', resolved: 'vision.B.0' },
    { nodeId: 'sensor-B-1', resolved: 'vision.B.1' },
    { nodeId: 'sensor-B-2', resolved: 'vision.B.2' },
    { nodeId: 'sensor-G-0', resolved: 'vision.G.0' },
    { nodeId: 'sensor-G-1', resolved: 'vision.G.1' },
    { nodeId: 'sensor-G-2', resolved: 'vision.G.2' },
    { nodeId: 'sensor-R-0', resolved: 'vision.R.0' },
    { nodeId: 'sensor-R-1', resolved: 'vision.R.1' },
    { nodeId: 'sensor-R-2', resolved: 'vision.R.2' },
  ]);
  assert.deepEqual(preview.output.previewsByRuleId['motor-actions'], [
    { nodeId: 'effector-move-forward', resolved: 'action.move-forward' },
    { nodeId: 'effector-turn-left', resolved: 'action.turn-left' },
    { nodeId: 'effector-turn-right', resolved: 'action.turn-right' },
  ]);
  assert.deepEqual(preview.issues, []);
});

test('buildAgentBodyRulePreviewModel enumerates canonical vision coverage without layout markers', () => {
  const preview = buildAgentBodyRulePreviewModel(createRuleDrivenAgent(), WORLD_REGISTRY, 3);

  assert.equal(preview.input.endpointNodeIds.includes('sensor-R-0'), true);
  assert.equal(preview.input.endpointNodeIds.includes('sensor-G-1'), true);
  assert.equal(preview.input.endpointNodeIds.includes('sensor-B-2'), true);
});

test('buildAgentBodyRulePreviewModel summarizes compile errors from invalid regex and unsupported templates', () => {
  const invalidAgent: AgentIR = {
    ...createRuleDrivenAgent(),
    body: {
      version: 1,
      inputRules: [
        {
          id: 'broken-input-regex',
          nodeIdPattern: '^sensor-([RGB]-(\\d+)$',
          sourceTemplate: 'vision.$1.$2',
          scale: 1,
        },
        {
          id: 'broken-input-template',
          nodeIdPattern: '^sensor-([RGB])-(\\d+)$',
          sourceTemplate: 'audio.$1.$2',
          scale: 1,
        },
      ],
      outputRules: [
        {
          id: 'broken-output-template',
          nodeIdPattern: '^effector-(turn-left|move-forward|turn-right)$',
          targetTemplate: 'thruster.$1',
          decayPerSecond: 1,
        },
      ],
    },
  };

  const preview = buildAgentBodyRulePreviewModel(invalidAgent, WORLD_REGISTRY, 3);

  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'input' &&
        issue.kind === 'compile-error' &&
        issue.ruleId === 'broken-input-regex' &&
        issue.message.includes('invalid nodeIdPattern')
    ),
    true
  );
  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'input' &&
        issue.kind === 'compile-error' &&
        issue.ruleId === 'broken-input-template' &&
        issue.nodeId === 'sensor-G-2' &&
        issue.resolved === 'audio.G.2'
    ),
    true
  );
  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'output' &&
        issue.kind === 'compile-error' &&
        issue.ruleId === 'broken-output-template' &&
        issue.nodeId === 'effector-move-forward' &&
        issue.resolved === 'thruster.move-forward'
    ),
    true
  );
});

test('buildAgentBodyRulePreviewModel summarizes conflicts and unmatched endpoints', () => {
  const invalidAgent: AgentIR = {
    ...createRuleDrivenAgent(),
    body: {
      ...createRuleDrivenAgent().body,
      inputRules: [
        {
          id: 'vision-primary',
          nodeIdPattern: '^sensor-([RGB])-(\\d+)$',
          sourceTemplate: 'vision.$1.$2',
          scale: 1,
        },
        {
          id: 'vision-duplicate',
          nodeIdPattern: '^sensor-(G)-(\\d+)$',
          sourceTemplate: 'vision.$1.$2',
          scale: 1,
        },
      ],
      outputRules: [
        {
          id: 'left-actions',
          nodeIdPattern: '^(effector|alt-effector)-(turn-left)$',
          targetTemplate: 'action.$2',
          decayPerSecond: 1,
        },
        {
          id: 'move-forward-actions',
          nodeIdPattern: '^effector-(move-forward)$',
          targetTemplate: 'action.$1',
          decayPerSecond: 1,
        },
      ],
    },
    connections: [
      {
        id: 'conflicting-input',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        weight: 1,
      },
      {
        id: 'unmatched-input',
        from: { scope: 'bodyInput', nodeId: 'vision-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        weight: 1,
      },
      {
        id: 'left-output',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-turn-left' },
        weight: 1,
      },
      {
        id: 'left-output-duplicate',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'alt-effector-turn-left' },
        weight: 1,
      },
      {
        id: 'unmatched-output',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-turn-right' },
        weight: 1,
      },
    ],
  };

  const preview = buildAgentBodyRulePreviewModel(invalidAgent, WORLD_REGISTRY);

  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'input' &&
        issue.kind === 'conflict' &&
        issue.nodeId === 'sensor-G-2' &&
        issue.relatedRuleIds?.includes('vision-primary') &&
        issue.relatedRuleIds?.includes('vision-duplicate')
    ),
    true
  );
  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'input' &&
        issue.kind === 'unmatched' &&
        issue.nodeId === 'vision-G-2'
    ),
    true
  );
  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'output' &&
        issue.kind === 'conflict' &&
        issue.nodeId === 'effector-turn-left' &&
        issue.target === 'action.turn-left'
    ),
    true
  );
  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'output' &&
        issue.kind === 'unmatched' &&
        issue.nodeId === 'effector-turn-right'
    ),
    true
  );
});

test('compiled body endpoint projection only includes referenced endpoints while canonical preview keeps full coverage', () => {
  const agent = createRuleDrivenAgent();
  const preview = buildAgentBodyRulePreviewModel(agent, WORLD_REGISTRY, 3);
  const compiledEndpointIds = resolveCompiledAgentBodyEndpointIds(agent, WORLD_REGISTRY);

  assert.deepEqual(
    compiledEndpointIds.bodyInputNodeIds,
    ['sensor-G-2']
  );
  assert.deepEqual(
    compiledEndpointIds.bodyOutputNodeIds,
    ['effector-move-forward']
  );
  assert.equal(preview.input.endpointNodeIds.length > compiledEndpointIds.bodyInputNodeIds.length, true);
  assert.equal(preview.output.endpointNodeIds.length > compiledEndpointIds.bodyOutputNodeIds.length, true);
});
