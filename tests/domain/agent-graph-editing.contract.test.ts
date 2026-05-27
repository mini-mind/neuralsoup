import test from 'node:test';
import assert from 'node:assert/strict';
import type { AgentIR } from '../../src/domain/brain';
import {
  aggregateAgentNodesIntoGroup,
  createNeuronAndConnectInContainer,
  reparentAgentNode,
  tryAggregateAgentNodesIntoGroup,
  tryCreateNeuronAndConnectInContainer,
  tryReparentAgentNode,
  tryUngroupAgentContainer,
  ungroupAgentContainer,
} from '../../src/components/editor/graph/agentGraphEditing';

const createEditingAgent = (): AgentIR => ({
  metadata: {
    id: 'agent-editing-test',
    name: 'Agent Editing Test',
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
        id: 'izhikevich-default',
        family: 'izhikevich',
        label: 'Default Izhikevich',
        params: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
      },
    ],
    synapseModels: [
      {
        id: 'static_current',
        kind: 'static-current',
        label: 'Static Current',
        defaults: { weight: 1, delayMs: 1 },
      },
    ],
    rootContainerId: 'root-group',
    neurons: [
      {
        id: 'neuron-1',
        label: 'Neuron 1',
        neuronModelId: 'izhikevich-default',
        parameterOverrides: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
        initialState: { v: -65 },
      },
      {
        id: 'neuron-2',
        label: 'Neuron 2',
        neuronModelId: 'izhikevich-default',
        parameterOverrides: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
        initialState: { v: -65 },
      },
      {
        id: 'neuron-3',
        label: 'Neuron 3',
        neuronModelId: 'izhikevich-default',
        parameterOverrides: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
        initialState: { v: -65 },
      },
    ],
    containers: [
      {
        id: 'root-group',
        label: 'Root',
        children: [
          { scope: 'brain', nodeId: 'neuron-1' },
          { scope: 'brain', nodeId: 'neuron-2' },
          { scope: 'brain', nodeId: 'neuron-3' },
        ],
      },
    ],
  },
  connections: [],
  layout: {
    nodes: {
      'neuron-1': { position: { x: 120, y: 80 } },
      'neuron-2': { position: { x: 200, y: 140 } },
      'neuron-3': { position: { x: 320, y: 260 } },
    },
  },
});

const createAggregateInput = () => ({
  parentContainerId: 'root-group',
  selectedNodeIds: ['neuron-1', 'neuron-2'],
  nextGroupId: 'group-1',
  nextGroupLabel: '神经元组1',
  nextGroupPosition: { x: 120, y: 80 },
  childPositionsById: {
    'neuron-1': { x: 0, y: 0 },
    'neuron-2': { x: 80, y: 60 },
  },
});

test('tryAggregateAgentNodesIntoGroup returns an updated agent on the happy path', () => {
  const result = tryAggregateAgentNodesIntoGroup(createEditingAgent(), createAggregateInput());

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const root = result.agent.brain.containers.find((container) => container.id === 'root-group');
  const group = result.agent.brain.containers.find((container) => container.id === 'group-1');

  assert.ok(root);
  assert.ok(group);
  assert.deepEqual(root.children, [
    { scope: 'container', nodeId: 'group-1' },
    { scope: 'brain', nodeId: 'neuron-3' },
  ]);
  assert.deepEqual(group.children, [
    { scope: 'brain', nodeId: 'neuron-1' },
    { scope: 'brain', nodeId: 'neuron-2' },
  ]);
  assert.deepEqual(result.agent.layout?.nodes['group-1']?.position, { x: 120, y: 80 });
  assert.deepEqual(result.agent.layout?.nodes['neuron-1']?.position, { x: 0, y: 0 });
  assert.deepEqual(result.agent.layout?.nodes['neuron-2']?.position, { x: 80, y: 60 });
});

test('ungroupAgentContainer restores grouped children into parent scope and reprojects absolute positions', () => {
  const aggregated = aggregateAgentNodesIntoGroup(createEditingAgent(), createAggregateInput());
  const next = ungroupAgentContainer(aggregated, 'root-group', 'group-1');

  const root = next.brain.containers.find((container) => container.id === 'root-group');
  const group = next.brain.containers.find((container) => container.id === 'group-1');

  assert.ok(root);
  assert.equal(group, undefined);
  assert.deepEqual(root.children, [
    { scope: 'brain', nodeId: 'neuron-1' },
    { scope: 'brain', nodeId: 'neuron-2' },
    { scope: 'brain', nodeId: 'neuron-3' },
  ]);
  assert.equal(next.layout?.nodes['group-1'], undefined);
  assert.deepEqual(next.layout?.nodes['neuron-1']?.position, { x: 120, y: 80 });
  assert.deepEqual(next.layout?.nodes['neuron-2']?.position, { x: 200, y: 140 });
});

test('tryCreateNeuronAndConnectInContainer appends the neuron, parent child ref, connections, and layout', () => {
  const result = tryCreateNeuronAndConnectInContainer(createEditingAgent(), {
    parentContainerId: 'root-group',
    nextNeuronId: 'neuron-4',
    nextNeuronLabel: 'Neuron 4',
    nextNeuronPosition: { x: 400, y: 320 },
    connections: [
      {
        id: 'link-1',
        from: { scope: 'brain', nodeId: 'neuron-1', portId: 'output' },
        to: { scope: 'brain', nodeId: 'neuron-4', portId: 'input' },
        synapseModelId: 'static_current',
        parameterOverrides: {
          weight: 0.8,
        },
      },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.agent.brain.neurons.some((neuron) => neuron.id === 'neuron-4'), true);
  assert.deepEqual(result.agent.brain.containers[0]?.children.at(-1), { scope: 'brain', nodeId: 'neuron-4' });
  const createdConnection = result.agent.connections.at(-1);
  assert.ok(createdConnection);
  assert.equal(createdConnection.id, 'link-1');
  assert.deepEqual(createdConnection.from, { scope: 'brain', nodeId: 'neuron-1', portId: 'output' });
  assert.deepEqual(createdConnection.to, { scope: 'brain', nodeId: 'neuron-4', portId: 'input' });
  assert.equal(createdConnection.synapseModelId, 'static_current');
  assert.deepEqual(createdConnection.parameterOverrides, {
    weight: 0.8,
    delayMs: 0,
  });
  assert.deepEqual(result.agent.layout?.nodes['neuron-4']?.position, { x: 400, y: 320 });
});

test('tryAggregateAgentNodesIntoGroup rejects insufficient selection and keeps safe wrapper as no-op', () => {
  const agent = createEditingAgent();
  const result = tryAggregateAgentNodesIntoGroup(agent, {
    ...createAggregateInput(),
    selectedNodeIds: ['neuron-1'],
  });

  assert.deepEqual(result, {
    ok: false,
    reason: 'insufficient-selection',
    issues: [
      {
        code: 'insufficient-selection',
        message: 'Cannot aggregate fewer than two selected child nodes.',
      },
    ],
  });
  assert.equal(
    aggregateAgentNodesIntoGroup(agent, {
      ...createAggregateInput(),
      selectedNodeIds: ['neuron-1'],
    }),
    agent
  );
});

test('tryAggregateAgentNodesIntoGroup rejects when a selected child is not owned by the parent', () => {
  const result = tryAggregateAgentNodesIntoGroup(createEditingAgent(), {
    ...createAggregateInput(),
    selectedNodeIds: ['neuron-1', 'group-foreign'],
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.reason, 'child-not-owned-by-parent');
  assert.match(result.issues[0]?.message ?? '', /group-foreign/);
});

test('tryAggregateAgentNodesIntoGroup rejects id collisions before rewriting containers', () => {
  const agent = createEditingAgent();
  const result = tryAggregateAgentNodesIntoGroup(agent, {
    ...createAggregateInput(),
    nextGroupId: 'neuron-3',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.reason, 'duplicate-node-id');
  assert.equal(aggregateAgentNodesIntoGroup(agent, { ...createAggregateInput(), nextGroupId: 'neuron-3' }), agent);
});

test('tryCreateNeuronAndConnectInContainer rejects duplicate node ids and keeps safe wrapper as no-op', () => {
  const agent = createEditingAgent();
  const result = tryCreateNeuronAndConnectInContainer(agent, {
    parentContainerId: 'root-group',
    nextNeuronId: 'neuron-2',
    nextNeuronLabel: 'Neuron 2 clone',
    nextNeuronPosition: { x: 0, y: 0 },
    connections: [],
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.reason, 'duplicate-node-id');
  assert.equal(
    createNeuronAndConnectInContainer(agent, {
      parentContainerId: 'root-group',
      nextNeuronId: 'neuron-2',
      nextNeuronLabel: 'Neuron 2 clone',
      nextNeuronPosition: { x: 0, y: 0 },
      connections: [],
    }),
    agent
  );
});

test('tryUngroupAgentContainer rejects missing parent ownership and keeps safe wrapper as no-op', () => {
  const aggregated = aggregateAgentNodesIntoGroup(createEditingAgent(), createAggregateInput());
  const result = tryUngroupAgentContainer(aggregated, 'root-group', 'group-missing');

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.reason, 'missing-target-container');
  assert.equal(ungroupAgentContainer(aggregated, 'root-group', 'group-missing'), aggregated);
});

test('tryReparentAgentNode moves a neuron into an existing group and updates its layout position', () => {
  const aggregated = aggregateAgentNodesIntoGroup(createEditingAgent(), createAggregateInput());
  const result = tryReparentAgentNode(aggregated, {
    nodeId: 'neuron-3',
    fromContainerId: 'root-group',
    toContainerId: 'group-1',
    nextPosition: { x: 40, y: 50 },
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const root = result.agent.brain.containers.find((container) => container.id === 'root-group');
  const group = result.agent.brain.containers.find((container) => container.id === 'group-1');
  assert.ok(root);
  assert.ok(group);
  assert.deepEqual(root.children, [{ scope: 'container', nodeId: 'group-1' }]);
  assert.deepEqual(group.children.at(-1), { scope: 'brain', nodeId: 'neuron-3' });
  assert.deepEqual(result.agent.layout?.nodes['neuron-3']?.position, { x: 40, y: 50 });
});

test('tryReparentAgentNode moves a nested group back to parent scope', () => {
  const baseAgent = createEditingAgent();
  const nested: AgentIR = {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      containers: [
        {
          id: 'root-group',
          label: 'Root',
          children: [
            { scope: 'container', nodeId: 'group-1' },
            { scope: 'brain', nodeId: 'neuron-3' },
          ],
        },
        {
          id: 'group-1',
          label: '神经元组1',
          children: [{ scope: 'container', nodeId: 'group-2' }],
        },
        {
          id: 'group-2',
          label: '子组',
          children: [
            { scope: 'brain', nodeId: 'neuron-1' },
            { scope: 'brain', nodeId: 'neuron-2' },
          ],
        },
      ],
    },
    layout: {
      nodes: {
        ...baseAgent.layout?.nodes,
        'group-1': { position: { x: 120, y: 80 } },
        'group-2': { position: { x: 40, y: 50 } },
      },
    },
  };

  const result = tryReparentAgentNode(nested, {
    nodeId: 'group-2',
    fromContainerId: 'group-1',
    toContainerId: 'root-group',
    nextPosition: { x: 360, y: 240 },
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const root = result.agent.brain.containers.find((container) => container.id === 'root-group');
  const parentGroup = result.agent.brain.containers.find((container) => container.id === 'group-1');
  assert.ok(root);
  assert.ok(parentGroup);
  assert.deepEqual(root.children, [
    { scope: 'container', nodeId: 'group-1' },
    { scope: 'brain', nodeId: 'neuron-3' },
    { scope: 'container', nodeId: 'group-2' },
  ]);
  assert.deepEqual(parentGroup.children, []);
  assert.deepEqual(result.agent.layout?.nodes['group-2']?.position, { x: 360, y: 240 });
});

test('tryReparentAgentNode can preserve an expanded-child absolute position when moving back to parent scope', () => {
  const baseAgent = createEditingAgent();
  const nested: AgentIR = {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      containers: [
        {
          id: 'root-group',
          label: 'Root',
          children: [
            { scope: 'container', nodeId: 'group-1' },
            { scope: 'brain', nodeId: 'neuron-3' },
          ],
        },
        {
          id: 'group-1',
          label: '神经元组1',
          children: [
            { scope: 'brain', nodeId: 'neuron-1' },
            { scope: 'brain', nodeId: 'neuron-2' },
          ],
        },
      ],
    },
    layout: {
      nodes: {
        ...baseAgent.layout?.nodes,
        'group-1': { position: { x: 120, y: 80 } },
        'neuron-1': { position: { x: 30, y: 30 } },
      },
    },
  };

  const result = tryReparentAgentNode(nested, {
    nodeId: 'neuron-1',
    fromContainerId: 'group-1',
    toContainerId: 'root-group',
    nextPosition: { x: 150, y: 110 },
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.agent.layout?.nodes['neuron-1']?.position, { x: 150, y: 110 });
});

test('tryReparentAgentNode rejects moving a container into its own descendant and safe wrapper stays no-op', () => {
  const baseAgent = createEditingAgent();
  const nested: AgentIR = {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      containers: [
        {
          id: 'root-group',
          label: 'Root',
          children: [
            { scope: 'container', nodeId: 'group-1' },
            { scope: 'brain', nodeId: 'neuron-3' },
          ],
        },
        {
          id: 'group-1',
          label: '神经元组1',
          children: [{ scope: 'container', nodeId: 'group-2' }],
        },
        {
          id: 'group-2',
          label: '子组',
          children: [
            { scope: 'brain', nodeId: 'neuron-1' },
            { scope: 'brain', nodeId: 'neuron-2' },
          ],
        },
      ],
    },
  };

  const result = tryReparentAgentNode(nested, {
    nodeId: 'group-1',
    fromContainerId: 'root-group',
    toContainerId: 'group-2',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.reason, 'cycle-detected');
  assert.equal(
    reparentAgentNode(nested, {
      nodeId: 'group-1',
      fromContainerId: 'root-group',
      toContainerId: 'group-2',
    }),
    nested
  );
});

test('tryAggregateAgentNodesIntoGroup rejects malformed source graphs with missing root containers', () => {
  const invalidAgent: AgentIR = {
    ...createEditingAgent(),
    brain: {
      ...createEditingAgent().brain,
      rootContainerId: 'root-missing',
    },
  };

  const result = tryAggregateAgentNodesIntoGroup(invalidAgent, createAggregateInput());

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.reason, 'missing-root-container');
  assert.equal(aggregateAgentNodesIntoGroup(invalidAgent, createAggregateInput()), invalidAgent);
});

test('tryAggregateAgentNodesIntoGroup rejects malformed source graphs with multiple owners', () => {
  const baseAgent = createEditingAgent();
  const invalidAgent: AgentIR = {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      containers: [
        ...baseAgent.brain.containers,
        {
          id: 'group-foreign',
          label: 'Foreign',
          children: [{ scope: 'brain', nodeId: 'neuron-1' }],
        },
      ],
    },
  };

  const result = tryAggregateAgentNodesIntoGroup(invalidAgent, createAggregateInput());

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.reason, 'multiple-owners');
  assert.match(result.issues[0]?.message ?? '', /multiple containers|not attached/);
});

test('tryAggregateAgentNodesIntoGroup rejects malformed source graphs with container cycles', () => {
  const baseAgent = createEditingAgent();
  const invalidAgent: AgentIR = {
    ...baseAgent,
    brain: {
      ...baseAgent.brain,
      containers: [
        {
          id: 'root-group',
          label: 'Root',
          children: [
            { scope: 'brain', nodeId: 'neuron-1' },
            { scope: 'brain', nodeId: 'neuron-3' },
            { scope: 'container', nodeId: 'group-1' },
          ],
        },
        {
          id: 'group-1',
          label: 'Group 1',
          children: [
            { scope: 'brain', nodeId: 'neuron-2' },
            { scope: 'container', nodeId: 'root-group' },
          ],
        },
      ],
    },
  };

  const result = tryAggregateAgentNodesIntoGroup(invalidAgent, {
    ...createAggregateInput(),
    selectedNodeIds: ['neuron-1', 'neuron-3'],
    nextGroupId: 'group-2',
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.equal(result.reason, 'root-has-parent');
  assert.equal(result.issues.some((issue) => issue.code === 'cycle-detected'), true);
});
