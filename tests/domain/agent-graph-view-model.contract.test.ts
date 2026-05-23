import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentBodyRulePreviewModel, type AgentIR } from '../../src/domain/brain';
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
    visionCellCount: 0,
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

test('agent graph view expanded children expose separate viewId and refId indexes', () => {
  const agent = createTestAgent();
  const viewModel = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  const expandedChild = viewModel.nodes.find((node) => node.viewId === 'expanded-group::neuron-1');
  assert.ok(expandedChild);
  assert.equal(viewModel.viewNodeByViewId.get('expanded-group::neuron-1'), expandedChild);
  assert.equal(viewModel.visibleNodeByRefId.get('neuron-1'), expandedChild);
});

test('agent graph view expanded children use viewId for active highlights', () => {
  const agent = createTestAgent();
  const viewModel = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {},
    runtimeActiveNodeIds: ['neuron-1'],
  });

  assert.equal(viewModel.activeViewNodeIds.has('expanded-group::neuron-1'), true);
  assert.equal(viewModel.activeViewNodeIds.has('neuron-1'), false);
});

test('agent graph root brain child scope does not inject orphan adapter proxy nodes', () => {
  const agent = createTestAgent();
  const viewModel = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  assert.equal(viewModel.nodes.some((node) => node.proxy), false);
});

test('agent graph root brain child scope projects boundary adapters without proxy nodes', () => {
  const agent = createTestAgent();
  agent.body.inputRules = [
    {
      id: 'vision-inputs',
      nodeIdPattern: '^vision-([RGB])-(\\d+)$',
      sourceTemplate: 'vision.$1.$2',
      scale: 1,
    },
  ];
  agent.body.outputRules = [
    {
      id: 'motor-outputs',
      nodeIdPattern: '^output-(turn-left|move-forward|turn-right)$',
      targetTemplate: 'action.$1',
      decayPerSecond: 4,
    },
  ];
  agent.body.visionCellCount = 1;
  agent.connections = [
    ...agent.connections,
    {
      id: 'body-input-to-neuron',
      from: { scope: 'bodyInput', nodeId: 'vision-G-0' },
      to: { scope: 'brain', nodeId: 'neuron-1' },
      weight: 1,
    },
    {
      id: 'neuron-to-body-output',
      from: { scope: 'brain', nodeId: 'neuron-2' },
      to: { scope: 'bodyOutput', nodeId: 'output-move-forward' },
      weight: 1,
    },
  ];
  agent.layout = {
    version: 1,
    nodes: {
      ...agent.layout?.nodes,
      'vision-R-0': { position: { x: 0, y: 0 } },
      'vision-G-0': { position: { x: 0, y: 24 } },
      'vision-B-0': { position: { x: 0, y: 48 } },
      'output-turn-left': { position: { x: 320, y: 0 } },
      'output-move-forward': { position: { x: 320, y: 24 } },
      'output-turn-right': { position: { x: 320, y: 48 } },
    },
  };

  const viewModel = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  assert.equal(viewModel.nodes.some((node) => node.id === 'core-input-adapter'), true);
  assert.equal(viewModel.nodes.some((node) => node.id === 'core-output-adapter'), true);
  assert.equal(viewModel.nodes.some((node) => node.proxy), false);
  const boundaryLinks = viewModel.links.filter((link) => link.aggregate);
  assert.equal(boundaryLinks.length > 0, true);
  assert.equal(boundaryLinks.every((link) => link.inspectable), true);
  assert.equal(boundaryLinks.every((link) => link.editable === false), true);
});

test('agent graph root scope exposes canonical body endpoints even before any connection references them', () => {
  const agent = createTestAgent();
  agent.body.inputRules = [
    {
      id: 'vision-inputs',
      nodeIdPattern: '^vision-([RGB])-(\\d+)$',
      sourceTemplate: 'vision.$1.$2',
      scale: 1,
    },
  ];
  agent.body.outputRules = [
    {
      id: 'motor-outputs',
      nodeIdPattern: '^output-(turn-left|move-forward|turn-right)$',
      targetTemplate: 'action.$1',
      decayPerSecond: 4,
    },
  ];
  agent.body.visionCellCount = 1;
  agent.layout = {
    version: 1,
    nodes: {
      ...agent.layout?.nodes,
      'vision-R-0': { position: { x: 0, y: 0 } },
      'vision-G-0': { position: { x: 0, y: 24 } },
      'vision-B-0': { position: { x: 0, y: 48 } },
      'output-turn-left': { position: { x: 320, y: 0 } },
      'output-move-forward': { position: { x: 320, y: 24 } },
      'output-turn-right': { position: { x: 320, y: 48 } },
    },
  };
  agent.connections = [
    {
      id: 'connection-1',
      from: { scope: 'brain', nodeId: 'neuron-1' },
      to: { scope: 'brain', nodeId: 'neuron-2' },
      weight: 0.5,
    },
  ];

  const rootView = buildAgentGraphViewModel({
    agent,
    navigationPath: [],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });
  const inputAdapter = rootView.nodes.find((node) => node.id === 'input-adapter');
  const outputAdapter = rootView.nodes.find((node) => node.id === 'output-adapter');
  assert.ok(inputAdapter);
  assert.ok(outputAdapter);
  assert.equal(rootView.links.some((link) => link.aggregate), false);

  const inputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['input-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });
  const outputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['output-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  assert.deepEqual(
    new Set(inputScopeView.nodes.map((node) => node.id)),
    new Set(['vision-R-0', 'vision-G-0', 'vision-B-0'])
  );
  assert.deepEqual(
    new Set(outputScopeView.nodes.map((node) => node.id)),
    new Set(['output-turn-left', 'output-move-forward', 'output-turn-right'])
  );
});

test('agent graph root scope uses the canonical rootContainerId as the top-level brain node id', () => {
  const agent = createTestAgent();
  const rootView = buildAgentGraphViewModel({
    agent,
    navigationPath: [],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  const rootBrainNode = rootView.nodes.find((node) => node.refNodeId === agent.brain.rootContainerId);
  assert.ok(rootBrainNode);
  assert.equal(rootBrainNode.id, agent.brain.rootContainerId);
  assert.equal(rootBrainNode.rootContainer, true);
});

test('agent graph view and body preview share the same canonical endpoint expansion', () => {
  const agent = createTestAgent();
  agent.body.inputRules = [
    {
      id: 'sensor-inputs',
      nodeIdPattern: '^sensor-([RGB])-(\\d+)$',
      sourceTemplate: 'vision.$1.$2',
      scale: 1,
    },
  ];
  agent.body.outputRules = [
    {
      id: 'effector-outputs',
      nodeIdPattern: '^effector-(turn-left|move-forward|turn-right)$',
      targetTemplate: 'action.$1',
      decayPerSecond: 2,
    },
  ];
  agent.body.visionCellCount = 2;

  const preview = buildAgentBodyRulePreviewModel(agent);
  const inputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['input-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });
  const outputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['output-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  assert.deepEqual(
    inputScopeView.nodes.map((node) => node.refNodeId).sort(),
    [...preview.input.endpointNodeIds].sort()
  );
  assert.deepEqual(
    outputScopeView.nodes.map((node) => node.refNodeId).sort(),
    [...preview.output.endpointNodeIds].sort()
  );
});

test('agent graph view marks canonical-only body endpoints that are not installed in compiled runtime', () => {
  const agent = createTestAgent();
  agent.body.inputRules = [
    {
      id: 'sensor-inputs',
      nodeIdPattern: '^sensor-([RGB])-(\\d+)$',
      sourceTemplate: 'vision.$1.$2',
      scale: 1,
    },
  ];
  agent.body.outputRules = [
    {
      id: 'effector-outputs',
      nodeIdPattern: '^effector-(turn-left|move-forward|turn-right)$',
      targetTemplate: 'action.$1',
      decayPerSecond: 2,
    },
  ];
  agent.body.visionCellCount = 1;
  agent.connections = [
    {
      id: 'sensor-link',
      from: { scope: 'bodyInput', nodeId: 'sensor-G-0' },
      to: { scope: 'brain', nodeId: 'neuron-1' },
      weight: 1,
    },
  ];

  const inputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['input-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
  });

  const installedInput = inputScopeView.nodes.find((node) => node.refNodeId === 'sensor-G-0');
  const canonicalOnlyInput = inputScopeView.nodes.find((node) => node.refNodeId === 'sensor-R-0');
  assert.ok(installedInput);
  assert.ok(canonicalOnlyInput);
  assert.equal(installedInput.runtimeInstalled, true);
  assert.equal(canonicalOnlyInput.runtimeInstalled, false);
  assert.equal(canonicalOnlyInput.detail.includes('canonical-only'), true);
});
