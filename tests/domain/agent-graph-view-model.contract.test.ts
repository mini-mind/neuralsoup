import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentBodyEndpointPreviewModel, preflightBrainStructure, type AgentIR, type WorldRegistry } from '../../src/domain/brain';
import { resolveConnectionOverridePayload } from '../../src/components/ConnectionDetailEditor';
import { buildAgentGraphViewModel } from '../../src/components/editor/graph/agentGraphViewModel';
import { resolveGraphLinkInspectorParameters } from '../../src/components/hooks/useSNNTopologyState';
import { createVisionActionWorldRegistry } from '../../src/host';

const WORLD_REGISTRY = createVisionActionWorldRegistry();
const DEFAULT_NEURON_MODEL_ID = 'izhikevich-default';
const DEFAULT_SYNAPSE_MODEL_ID = 'static-default';
const CHANNELS = ['R', 'G', 'B'] as const;
const ACTIONS = ['turn-left', 'move-forward', 'turn-right'] as const;

interface CanonicalBodyFixtureOptions {
  inputEndpointId: string;
  outputEndpointId: string;
  inputNodePrefix: string;
  outputNodePrefix: string;
  visionCells: number;
  inputSourcePrefix?: string;
  outputTargetPrefix?: string;
  inputScale: number;
  outputDecayPerSecond: number;
}

const createEndpointAuthorityTestRegistry = (): WorldRegistry => ({
  version: 1,
  inputs: [{ id: 'vision', direction: 'input', kind: 'vision-array', enumerable: true }],
  outputs: [{ id: 'action', direction: 'output', kind: 'action-map', enumerable: true }],
  resolveInputBinding: (source) => {
    const match = source.match(/^(?:vision|unsupported)\.([RGB])\.(\d+)$/);
    if (!match) {
      return null;
    }

    const cellIndex = Number.parseInt(match[2] ?? '-1', 10);
    return {
      source: `vision.${match[1]}.${cellIndex}`,
      worldPort: 'vision',
      cellIndex,
    };
  },
  resolveOutputBinding: (target) => {
    const match = target.match(/^(?:action|unsupported)\.(turn-left|move-forward|turn-right)$/);
    if (!match) {
      return null;
    }

    return {
      target: `action.${match[1]}`,
      worldPort: 'action',
      commandKind: match[1],
    };
  },
});

const configureCanonicalBody = (
  agent: AgentIR,
  {
    inputEndpointId,
    outputEndpointId,
    inputNodePrefix,
    outputNodePrefix,
    visionCells,
    inputSourcePrefix = 'vision',
    outputTargetPrefix = 'action',
    inputScale,
    outputDecayPerSecond,
  }: CanonicalBodyFixtureOptions
): void => {
  agent.body = {
    inputEndpoints: Array.from({ length: visionCells }).flatMap((_, cellIndex) =>
      CHANNELS.map((channel) => ({
        id: `${inputEndpointId}-${channel}-${cellIndex}`,
        source: `${inputSourcePrefix}.${channel}.${cellIndex}`,
        scale: inputScale,
      }))
    ),
    outputEndpoints: ACTIONS.map((action) => ({
      id: `${outputEndpointId}-${action}`,
      target: `${outputTargetPrefix}.${action}`,
      decayPerSecond: outputDecayPerSecond,
    })),
    mappings: [
      ...Array.from({ length: visionCells }).flatMap((_, cellIndex) =>
        CHANNELS.map((channel) => ({
          id: `${inputEndpointId}-mapping-${channel}-${cellIndex}`,
          kind: 'input' as const,
          endpointId: `${inputEndpointId}-${channel}-${cellIndex}`,
          nodeId: `${inputNodePrefix}-${channel}-${cellIndex}`,
        }))
      ),
      ...ACTIONS.map((action) => ({
        id: `${outputEndpointId}-mapping-${action}`,
        kind: 'output' as const,
        endpointId: `${outputEndpointId}-${action}`,
        nodeId: `${outputNodePrefix}-${action}`,
      })),
    ],
  };
};

const createTestAgent = (): AgentIR => ({
  metadata: {
    id: 'agent-test',
    name: 'Agent Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  body: {
    inputEndpoints: [],
    outputEndpoints: [],
    mappings: [],
  },
  brain: {
    neuronModels: [
      {
        id: DEFAULT_NEURON_MODEL_ID,
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
        id: DEFAULT_SYNAPSE_MODEL_ID,
        kind: 'static-current',
        label: 'Static Default',
        defaults: {
          weight: 0.5,
          delayMs: 0,
        },
      },
    ],
    rootContainerId: 'root-group',
    neurons: [
      {
        id: 'neuron-1',
        label: 'Neuron 1',
        neuronModelId: DEFAULT_NEURON_MODEL_ID,
        initialState: {
          v: -65,
        },
      },
      {
        id: 'neuron-2',
        label: 'Neuron 2',
        neuronModelId: DEFAULT_NEURON_MODEL_ID,
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
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
  ],
  layout: {
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
    worldRegistry: WORLD_REGISTRY,
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
    worldRegistry: WORLD_REGISTRY,
  });

  assert.equal(viewModel.activeViewNodeIds.has('expanded-group::neuron-1'), true);
  assert.equal(viewModel.activeViewNodeIds.has('neuron-1'), false);
});

test('agent graph expanded group size derives from persisted child bounds with padding and minimum size', () => {
  const agent = createTestAgent();
  agent.layout = {
    nodes: {
      ...agent.layout?.nodes,
      'neuron-1': { position: { x: 0, y: 0 } },
      'neuron-2': { position: { x: 420, y: 260 } },
    },
  };

  const viewModel = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {
      'neuron-1': { x: 1400, y: 1300 },
      'neuron-2': { x: 1800, y: 1600 },
    },
    runtimeActiveNodeIds: [],
    worldRegistry: WORLD_REGISTRY,
  });

  const expandedGroup = viewModel.nodes.find((node) => node.id === 'expanded-group');
  assert.ok(expandedGroup);
  assert.equal(expandedGroup.width, 494);
  assert.equal(expandedGroup.height, 334);
});

test('agent graph expanded child local projection uses persisted canvas position and ignores transient draft positions', () => {
  const agent = createTestAgent();
  agent.layout = {
    nodes: {
      ...agent.layout?.nodes,
      'expanded-group': {
        position: { x: 100, y: 120 },
        collapsed: false,
      },
      'neuron-1': { position: { x: 0, y: 0 } },
      'neuron-2': { position: { x: 420, y: 260 } },
    },
  };

  const viewModel = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {
      'neuron-1': { x: 1000, y: 1000 },
      'neuron-2': { x: 2000, y: 2000 },
    },
    runtimeActiveNodeIds: [],
    worldRegistry: WORLD_REGISTRY,
  });

  const child1 = viewModel.nodes.find((node) => node.viewId === 'expanded-group::neuron-1');
  const child2 = viewModel.nodes.find((node) => node.viewId === 'expanded-group::neuron-2');
  assert.ok(child1);
  assert.ok(child2);
  assert.equal(child1.x, 390);
  assert.equal(child1.y, 190);
  assert.equal(child2.x, 810);
  assert.equal(child2.y, 450);
});

test('agent graph root brain child scope does not inject orphan adapter proxy nodes', () => {
  const agent = createTestAgent();
  const viewModel = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    worldRegistry: WORLD_REGISTRY,
  });

  assert.equal(viewModel.nodes.some((node) => node.proxy), false);
});

test('agent graph root brain child scope projects boundary adapters without proxy nodes', () => {
  const agent = createTestAgent();
  configureCanonicalBody(agent, {
    inputEndpointId: 'vision-inputs',
    outputEndpointId: 'motor-outputs',
    inputNodePrefix: 'vision',
    outputNodePrefix: 'output',
    visionCells: 1,
    inputScale: 1,
    outputDecayPerSecond: 4,
  });
  agent.connections = [
    ...agent.connections,
    {
      id: 'body-input-to-neuron',
      from: { scope: 'bodyInput', nodeId: 'vision-G-0' },
      to: { scope: 'brain', nodeId: 'neuron-1' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
    {
      id: 'neuron-to-body-output',
      from: { scope: 'brain', nodeId: 'neuron-2' },
      to: { scope: 'bodyOutput', nodeId: 'output-move-forward' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
  ];
  agent.layout = {
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
    projectedVisionCellCount: 1,
    worldRegistry: WORLD_REGISTRY,
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
  configureCanonicalBody(agent, {
    inputEndpointId: 'vision-inputs',
    outputEndpointId: 'motor-outputs',
    inputNodePrefix: 'vision',
    outputNodePrefix: 'output',
    visionCells: 1,
    inputScale: 1,
    outputDecayPerSecond: 4,
  });
  agent.layout = {
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
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
  ];

  const rootView = buildAgentGraphViewModel({
    agent,
    navigationPath: [],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount: 1,
    worldRegistry: WORLD_REGISTRY,
  });
  const inputAdapter = rootView.nodes.find((node) => node.id === 'input-adapter');
  const outputAdapter = rootView.nodes.find((node) => node.id === 'output-adapter');
  assert.ok(inputAdapter);
  assert.ok(outputAdapter);
  assert.equal(inputAdapter.runtimeInstalledLeafCount, 0);
  assert.equal(outputAdapter.runtimeInstalledLeafCount, 0);
  assert.equal(inputAdapter.detail, '3 canonical / 0 installed');
  assert.equal(outputAdapter.detail, '3 canonical / 0 installed');
  assert.equal(rootView.links.some((link) => link.aggregate), false);

  const inputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['input-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount: 1,
    worldRegistry: WORLD_REGISTRY,
  });
  const outputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['output-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount: 1,
    worldRegistry: WORLD_REGISTRY,
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

test('agent graph root adapters can expand in place and expose their signal children', () => {
  const agent = createTestAgent();
  configureCanonicalBody(agent, {
    inputEndpointId: 'vision-inputs',
    outputEndpointId: 'motor-outputs',
    inputNodePrefix: 'vision',
    outputNodePrefix: 'output',
    visionCells: 1,
    inputScale: 1,
    outputDecayPerSecond: 4,
  });
  agent.layout = {
    nodes: {
      ...agent.layout?.nodes,
      'input-adapter': {
        position: { x: 24, y: 180 },
        collapsed: false,
      },
      'output-adapter': {
        position: { x: 644, y: 200 },
        collapsed: false,
      },
      'vision-R-0': { position: { x: 0, y: 0 } },
      'vision-G-0': { position: { x: 0, y: 24 } },
      'vision-B-0': { position: { x: 0, y: 48 } },
      'output-turn-left': { position: { x: 320, y: 0 } },
      'output-move-forward': { position: { x: 320, y: 24 } },
      'output-turn-right': { position: { x: 320, y: 48 } },
    },
  };

  const rootView = buildAgentGraphViewModel({
    agent,
    navigationPath: [],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount: 1,
    worldRegistry: WORLD_REGISTRY,
  });

  assert.equal(rootView.nodes.find((node) => node.id === 'input-adapter')?.expanded, true);
  assert.equal(rootView.nodes.find((node) => node.id === 'output-adapter')?.expanded, true);
  assert.equal(rootView.nodes.some((node) => node.viewId === 'input-adapter::vision-R-0'), true);
  assert.equal(rootView.nodes.some((node) => node.viewId === 'output-adapter::output-move-forward'), true);
});

test('agent graph root adapters report installed counts from compiled runtime truth', () => {
  const agent = createTestAgent();
  configureCanonicalBody(agent, {
    inputEndpointId: 'vision-inputs',
    outputEndpointId: 'motor-outputs',
    inputNodePrefix: 'vision',
    outputNodePrefix: 'output',
    visionCells: 1,
    inputScale: 1,
    outputDecayPerSecond: 4,
  });
  agent.connections = [
    ...agent.connections,
    {
      id: 'body-input-to-neuron',
      from: { scope: 'bodyInput', nodeId: 'vision-G-0' },
      to: { scope: 'brain', nodeId: 'neuron-1' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
    {
      id: 'neuron-to-body-output',
      from: { scope: 'brain', nodeId: 'neuron-2' },
      to: { scope: 'bodyOutput', nodeId: 'output-move-forward' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
  ];

  const rootView = buildAgentGraphViewModel({
    agent,
    navigationPath: [],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount: 1,
    worldRegistry: WORLD_REGISTRY,
  });

  const inputAdapter = rootView.nodes.find((node) => node.id === 'input-adapter');
  const outputAdapter = rootView.nodes.find((node) => node.id === 'output-adapter');
  assert.ok(inputAdapter);
  assert.ok(outputAdapter);
  assert.equal(inputAdapter.runtimeInstalledLeafCount, 1);
  assert.equal(outputAdapter.runtimeInstalledLeafCount, 1);
  assert.equal(inputAdapter.detail, '3 canonical / 1 installed');
  assert.equal(outputAdapter.detail, '3 canonical / 1 installed');
});

test('expanded core boundary adapters project links to concrete signal children instead of the adapter group', () => {
  const agent = createTestAgent();
  configureCanonicalBody(agent, {
    inputEndpointId: 'vision-inputs',
    outputEndpointId: 'motor-outputs',
    inputNodePrefix: 'vision',
    outputNodePrefix: 'output',
    visionCells: 1,
    inputScale: 1,
    outputDecayPerSecond: 4,
  });
  agent.connections = [
    ...agent.connections,
    {
      id: 'body-input-to-neuron',
      from: { scope: 'bodyInput', nodeId: 'vision-G-0' },
      to: { scope: 'brain', nodeId: 'neuron-1' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
    {
      id: 'neuron-to-body-output',
      from: { scope: 'brain', nodeId: 'neuron-2' },
      to: { scope: 'bodyOutput', nodeId: 'output-move-forward' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
  ];
  agent.layout = {
    nodes: {
      ...agent.layout?.nodes,
      'core-input-adapter': {
        position: { x: 40, y: 180 },
        collapsed: false,
      },
      'core-output-adapter': {
        position: { x: 520, y: 180 },
        collapsed: false,
      },
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
    projectedVisionCellCount: 1,
    worldRegistry: WORLD_REGISTRY,
  });

  assert.equal(viewModel.nodes.some((node) => node.viewId === 'core-input-adapter::vision-G-0'), true);
  assert.equal(viewModel.nodes.some((node) => node.viewId === 'core-output-adapter::output-move-forward'), true);
  assert.equal(viewModel.links.some((link) => link.fromNodeId === 'core-input-adapter'), false);
  assert.equal(viewModel.links.some((link) => link.toNodeId === 'core-output-adapter'), false);
  assert.equal(
    viewModel.links.some(
      (link) =>
        link.fromNodeId === 'core-input-adapter::vision-G-0' && link.toNodeId === 'expanded-group::neuron-1'
    ),
    true
  );
  assert.equal(
    viewModel.links.some(
      (link) =>
        link.fromNodeId === 'expanded-group::neuron-2' && link.toNodeId === 'core-output-adapter::output-move-forward'
    ),
    true
  );
  const directInputLeafLink = viewModel.links.find((link) => link.id === 'body-input-to-neuron');
  const directOutputLeafLink = viewModel.links.find((link) => link.id === 'neuron-to-body-output');
  assert.ok(directInputLeafLink);
  assert.ok(directOutputLeafLink);
  assert.equal(directInputLeafLink.aggregate, false);
  assert.equal(directOutputLeafLink.aggregate, false);
  assert.deepEqual(directInputLeafLink.leafLinkIds, ['body-input-to-neuron']);
  assert.deepEqual(directOutputLeafLink.leafLinkIds, ['neuron-to-body-output']);
  assert.equal(directInputLeafLink.inspectable, true);
  assert.equal(directOutputLeafLink.inspectable, true);
  assert.equal(directInputLeafLink.editable, true);
  assert.equal(directOutputLeafLink.editable, true);
});

test('agent graph aggregate links sum resolved synapse weights instead of non-canonical top-level connection.weight', () => {
  const agent = createTestAgent();
  configureCanonicalBody(agent, {
    inputEndpointId: 'vision-inputs',
    outputEndpointId: 'motor-outputs',
    inputNodePrefix: 'vision',
    outputNodePrefix: 'output',
    visionCells: 1,
    inputScale: 1,
    outputDecayPerSecond: 4,
  });
  agent.brain.synapseModels = [
    ...(agent.brain.synapseModels ?? []),
    {
      id: 'static-drive',
      kind: 'static-current',
      label: 'Static Drive',
      defaults: {
        weight: 3,
        delayMs: 0,
      },
    },
  ];
  agent.layout = {
    nodes: {
      ...agent.layout?.nodes,
      'expanded-group': {
        position: { x: 100, y: 120 },
        collapsed: true,
      },
    },
  };
  agent.connections = [
    ...agent.connections,
    {
      id: 'body-input-a',
      from: { scope: 'bodyInput', nodeId: 'vision-R-0' },
      to: { scope: 'brain', nodeId: 'neuron-1' },
      synapseModelId: 'static-drive',
      parameterOverrides: { weight: 4 },
    },
    {
      id: 'body-input-b',
      from: { scope: 'bodyInput', nodeId: 'vision-G-0' },
      to: { scope: 'brain', nodeId: 'neuron-1' },
      synapseModelId: 'static-drive',
    },
  ];

  const viewModel = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount: 1,
    worldRegistry: WORLD_REGISTRY,
  });

  const aggregateInputLink = viewModel.links.find(
    (link) => link.aggregate && link.fromNodeId === 'core-input-adapter' && link.toNodeId === 'expanded-group'
  );
  assert.ok(aggregateInputLink);
  assert.equal(aggregateInputLink.count, 2);
  assert.equal(aggregateInputLink.weight, 7);
  assert.notEqual(aggregateInputLink.weight, 300);
  assert.deepEqual(new Set(aggregateInputLink.leafLinkIds), new Set(['body-input-a', 'body-input-b']));
  assert.equal(aggregateInputLink.inspectable, true);
  assert.equal(aggregateInputLink.editable, false);
});

test('agent graph neuron record keeps stable model reference when per-neuron overrides drift from model defaults', () => {
  const agent = createTestAgent();
  agent.brain.neuronModels = [
    ...(agent.brain.neuronModels ?? []),
    {
      id: 'izhikevich-burst',
      family: 'izhikevich',
      label: 'Burst Profile',
      params: {
        a: 0.03,
        b: 0.25,
        c: -60,
        d: 4,
        threshold: -52,
      },
    },
  ];
  agent.brain.neurons[0] = {
    ...agent.brain.neurons[0]!,
    neuronModelId: 'izhikevich-burst',
    parameterOverrides: { threshold: 30 },
  };

  const viewModel = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    worldRegistry: WORLD_REGISTRY,
  });

  const neuronRecord = viewModel.indexes.nodeById.get('neuron-1');
  assert.ok(neuronRecord?.neuron);
  assert.equal(neuronRecord.neuron.neuronModelId, 'izhikevich-burst');
  assert.equal(neuronRecord.neuron.parameterOverrides?.threshold, 30);
});

test('agent graph root scope uses the canonical rootContainerId as the top-level brain node id', () => {
  const agent = createTestAgent();
  agent.brain.containers = [
    agent.brain.containers[1]!,
    agent.brain.containers[0]!,
  ];
  const rootView = buildAgentGraphViewModel({
    agent,
    navigationPath: [],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    worldRegistry: WORLD_REGISTRY,
  });

  const rootBrainNode = rootView.nodes.find((node) => node.refNodeId === agent.brain.rootContainerId);
  assert.ok(rootBrainNode);
  assert.equal(rootBrainNode.id, agent.brain.rootContainerId);
  assert.equal(rootBrainNode.rootContainer, true);
});

test('agent graph projects the canonical root even when root is not the first container entry', () => {
  const agent = createTestAgent();
  agent.brain.containers = [
    agent.brain.containers[1]!,
    agent.brain.containers[0]!,
  ];

  const rootView = buildAgentGraphViewModel({
    agent,
    navigationPath: [],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    worldRegistry: WORLD_REGISTRY,
  });

  assert.deepEqual(
    rootView.nodes
      .filter((node) => node.kind === 'neuron-group')
      .map((node) => node.refNodeId),
    [agent.brain.rootContainerId]
  );

  const rootScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    worldRegistry: WORLD_REGISTRY,
  });

  assert.deepEqual(
    rootScopeView.nodes
      .filter((node) => node.parentId === agent.brain.rootContainerId)
      .map((node) => node.refNodeId),
    ['expanded-group']
  );
});

test('agent graph detects container cycles without recursive blow-up', () => {
  const agent = createTestAgent();
  agent.brain.containers = [
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
        { scope: 'container', nodeId: 'root-group' },
      ],
    },
  ];

  const preflight = preflightBrainStructure(agent.brain);
  assert.equal(preflight.issues.some((issue) => issue.code === 'container-cycle'), true);

  const rootView = buildAgentGraphViewModel({
    agent,
    navigationPath: [],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    worldRegistry: WORLD_REGISTRY,
  });
  assert.deepEqual(
    rootView.nodes
      .filter((node) => node.kind === 'neuron-group')
      .map((node) => node.refNodeId),
    [agent.brain.rootContainerId]
  );

  const rootScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: [agent.brain.rootContainerId],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    worldRegistry: WORLD_REGISTRY,
  });

  assert.equal(rootScopeView.nodes.length < 10, true);
  assert.equal(new Set(rootScopeView.nodes.map((node) => node.viewId)).size, rootScopeView.nodes.length);
  assert.equal(rootScopeView.nodes.some((node) => node.refNodeId === 'expanded-group'), true);
});

test('agent graph view and body preview share the same canonical endpoint expansion', () => {
  const agent = createTestAgent();
  configureCanonicalBody(agent, {
    inputEndpointId: 'sensor-inputs',
    outputEndpointId: 'effector-outputs',
    inputNodePrefix: 'sensor',
    outputNodePrefix: 'effector',
    visionCells: 2,
    inputScale: 1,
    outputDecayPerSecond: 2,
  });
  const projectedVisionCellCount = 2;

  const preview = buildAgentBodyEndpointPreviewModel(agent, WORLD_REGISTRY, projectedVisionCellCount);
  const inputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['input-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount,
    worldRegistry: WORLD_REGISTRY,
  });
  const outputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['output-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount,
    worldRegistry: WORLD_REGISTRY,
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
  configureCanonicalBody(agent, {
    inputEndpointId: 'sensor-inputs',
    outputEndpointId: 'effector-outputs',
    inputNodePrefix: 'sensor',
    outputNodePrefix: 'effector',
    visionCells: 1,
    inputScale: 1,
    outputDecayPerSecond: 2,
  });
  const projectedVisionCellCount = 1;
  agent.connections = [
    {
      id: 'sensor-link',
      from: { scope: 'bodyInput', nodeId: 'sensor-G-0' },
      to: { scope: 'brain', nodeId: 'neuron-1' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
  ];

  const inputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['input-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount,
    worldRegistry: WORLD_REGISTRY,
  });

  const installedInput = inputScopeView.nodes.find((node) => node.refNodeId === 'sensor-G-0');
  const canonicalOnlyInput = inputScopeView.nodes.find((node) => node.refNodeId === 'sensor-R-0');
  assert.ok(installedInput);
  assert.ok(canonicalOnlyInput);
  assert.equal(installedInput.runtimeInstalled, true);
  assert.equal(canonicalOnlyInput.runtimeInstalled, false);
  assert.equal(canonicalOnlyInput.detail.includes('canonical-only'), true);
});

test('agent graph view, preview, and runtime counts share registry endpoint-binding authority', () => {
  const agent = createTestAgent();
  const authorityRegistry = createEndpointAuthorityTestRegistry();
  configureCanonicalBody(agent, {
    inputEndpointId: 'sensor-inputs',
    outputEndpointId: 'effector-outputs',
    inputNodePrefix: 'sensor',
    outputNodePrefix: 'effector',
    visionCells: 2,
    inputSourcePrefix: 'unsupported',
    outputTargetPrefix: 'unsupported',
    inputScale: 1,
    outputDecayPerSecond: 2,
  });
  agent.connections = [
    ...agent.connections,
    {
      id: 'sensor-link',
      from: { scope: 'bodyInput', nodeId: 'sensor-G-1' },
      to: { scope: 'brain', nodeId: 'neuron-1' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
    {
      id: 'effector-link',
      from: { scope: 'brain', nodeId: 'neuron-2' },
      to: { scope: 'bodyOutput', nodeId: 'effector-move-forward' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
  ];

  const preview = buildAgentBodyEndpointPreviewModel(agent, authorityRegistry, 2);
  const rootView = buildAgentGraphViewModel({
    agent,
    navigationPath: [],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount: 2,
    worldRegistry: authorityRegistry,
  });
  const inputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['input-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount: 2,
    worldRegistry: authorityRegistry,
  });
  const outputScopeView = buildAgentGraphViewModel({
    agent,
    navigationPath: ['output-adapter'],
    draftNodePositions: {},
    runtimeActiveNodeIds: [],
    projectedVisionCellCount: 2,
    worldRegistry: authorityRegistry,
  });

  assert.deepEqual(preview.issues, []);
  const inputPreviewItems = preview.input.previewsByEndpointId['sensor-inputs-R-1'] ?? [];
  assert.equal(inputPreviewItems[inputPreviewItems.length - 1]?.resolved, 'unsupported.R.1');
  assert.equal(preview.output.previewsByEndpointId['effector-outputs-turn-left']?.[0]?.resolved, 'unsupported.turn-left');
  assert.deepEqual(
    inputScopeView.nodes.map((node) => node.refNodeId).sort(),
    [...preview.input.endpointNodeIds].sort()
  );
  assert.deepEqual(
    outputScopeView.nodes.map((node) => node.refNodeId).sort(),
    [...preview.output.endpointNodeIds].sort()
  );

  const inputAdapter = rootView.nodes.find((node) => node.id === 'input-adapter');
  const outputAdapter = rootView.nodes.find((node) => node.id === 'output-adapter');
  assert.ok(inputAdapter);
  assert.ok(outputAdapter);
  assert.equal(inputAdapter.runtimeInstalledLeafCount, 1);
  assert.equal(outputAdapter.runtimeInstalledLeafCount, 1);
  assert.equal(inputAdapter.detail, '6 canonical / 1 installed');
  assert.equal(outputAdapter.detail, '3 canonical / 1 installed');
});

test('graph link inspector parameters keep resolved display values separate from real overrides', () => {
  const resolved = resolveGraphLinkInspectorParameters({
    defaults: {
      weight: 1,
      delayMs: 0,
    },
    parameterOverrides: {},
    effectiveWeight: 1,
    effectiveDelayMs: 0,
  });

  assert.deepEqual(resolved.parameterOverrides, {});
  assert.deepEqual(resolved.resolvedParameters, { weight: 1, delayMs: 0 });
  assert.deepEqual(resolved.defaultParameters, { weight: 1, delayMs: 0 });
});

test('connection detail update payload omits overrides when values equal model defaults', () => {
  const strippedOverrides = resolveConnectionOverridePayload({
    defaultParameters: {
      weight: 1,
      delayMs: 0,
    },
    nextWeightValue: 1,
    nextDelayMsValue: 0,
  });
  assert.deepEqual(strippedOverrides.parameterOverrides, {});

  const keptOverrides = resolveConnectionOverridePayload({
    defaultParameters: {
      weight: 1,
      delayMs: 0,
    },
    nextWeightValue: 1.25,
    nextDelayMsValue: 7,
  });
  assert.deepEqual(keptOverrides.parameterOverrides, { weight: 1.25, delayMs: 7 });
});
