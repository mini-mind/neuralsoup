import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentBodyEndpointPreviewModel,
  resolveCompiledAgentBodyEndpointIds,
  type AgentIR,
} from '../../src/domain/brain';
import { createVisionActionWorldRegistry } from '../../src/host';

const WORLD_REGISTRY = createVisionActionWorldRegistry();

const createEndpointDrivenAgent = (): AgentIR =>
  ({
    metadata: {
      id: 'agent-body-rules',
      name: 'Agent Body Endpoints',
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
        synapseModelId: 'static-default',
      },
      {
        id: 'output-connection',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-move-forward' },
        synapseModelId: 'static-default',
      },
    ],
    layout: {
      nodes: {},
    },
  });

test('buildAgentBodyEndpointPreviewModel projects referenced endpoints by explicit mappings', () => {
  const preview = buildAgentBodyEndpointPreviewModel(createEndpointDrivenAgent(), WORLD_REGISTRY, 3);

  assert.deepEqual(preview.input.previewsByEndpointId['vision-cells'], [
    { nodeId: 'sensor-G-2', resolved: 'vision.G.2' },
  ]);
  assert.deepEqual(preview.output.previewsByEndpointId['motor-turn-left'], [
    { nodeId: 'effector-turn-left', resolved: 'action.turn-left' },
  ]);
  assert.deepEqual(preview.output.previewsByEndpointId['motor-move-forward'], [
    { nodeId: 'effector-move-forward', resolved: 'action.move-forward' },
  ]);
  assert.deepEqual(preview.output.previewsByEndpointId['motor-turn-right'], [
    { nodeId: 'effector-turn-right', resolved: 'action.turn-right' },
  ]);
  assert.deepEqual(preview.issues, []);
});

test('buildAgentBodyEndpointPreviewModel endpoint node ids come from connections + explicit mappings only', () => {
  const preview = buildAgentBodyEndpointPreviewModel(createEndpointDrivenAgent(), WORLD_REGISTRY, 3);

  assert.deepEqual(preview.input.endpointNodeIds, ['sensor-G-2']);
  assert.deepEqual(
    new Set(preview.output.endpointNodeIds),
    new Set(['effector-turn-left', 'effector-move-forward', 'effector-turn-right'])
  );
});

test('buildAgentBodyEndpointPreviewModel summarizes missing endpoint references and unsupported source/target bindings', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    body: {
      inputEndpoints: [
        {
          id: 'unsupported-input-endpoint',
          source: 'audio.G.2',
          worldPort: 'audio',
          scale: 1,
        },
      ],
      outputEndpoints: [
        {
          id: 'unsupported-output-endpoint',
          target: 'thruster.move-forward',
          worldPort: 'thruster',
          decayPerSecond: 1,
        },
      ],
      mappings: [
        {
          id: 'missing-input-endpoint-map',
          kind: 'input',
          endpointId: 'missing-input-endpoint',
          nodeId: 'sensor-G-2',
        },
        {
          id: 'unsupported-input-map',
          kind: 'input',
          endpointId: 'unsupported-input-endpoint',
          nodeId: 'sensor-R-0',
        },
        {
          id: 'missing-output-endpoint-map',
          kind: 'output',
          endpointId: 'missing-output-endpoint',
          nodeId: 'effector-turn-left',
        },
        {
          id: 'unsupported-output-map',
          kind: 'output',
          endpointId: 'unsupported-output-endpoint',
          nodeId: 'effector-move-forward',
        },
      ],
    },
    connections: [
      {
        id: 'missing-input-reference',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        synapseModelId: 'static-default',
      },
      {
        id: 'unsupported-input-reference',
        from: { scope: 'bodyInput', nodeId: 'sensor-R-0' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        synapseModelId: 'static-default',
      },
      {
        id: 'missing-output-reference',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-turn-left' },
        synapseModelId: 'static-default',
      },
      {
        id: 'unsupported-output-reference',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-move-forward' },
        synapseModelId: 'static-default',
      },
    ],
  };

  const preview = buildAgentBodyEndpointPreviewModel(invalidAgent, WORLD_REGISTRY, 3);

  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'input' &&
        issue.kind === 'compile-error' &&
        issue.endpointId === 'missing-input-endpoint' &&
        issue.relatedMappingIds?.includes('missing-input-endpoint-map') &&
        issue.nodeId === 'sensor-G-2'
    ),
    true
  );
  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'input' &&
        issue.kind === 'compile-error' &&
        issue.endpointId === 'unsupported-input-endpoint' &&
        issue.nodeId === 'sensor-R-0' &&
        issue.resolved === 'audio.G.2'
    ),
    true
  );
  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'output' &&
        issue.kind === 'compile-error' &&
        issue.endpointId === 'missing-output-endpoint' &&
        issue.relatedMappingIds?.includes('missing-output-endpoint-map') &&
        issue.nodeId === 'effector-turn-left'
    ),
    true
  );
  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'output' &&
        issue.kind === 'compile-error' &&
        issue.endpointId === 'unsupported-output-endpoint' &&
        issue.nodeId === 'effector-move-forward' &&
        issue.resolved === 'thruster.move-forward'
    ),
    true
  );
});

test('buildAgentBodyEndpointPreviewModel summarizes duplicate mappings, duplicate output targets, and unmatched endpoints', () => {
  const invalidAgent: AgentIR = {
    ...createEndpointDrivenAgent(),
    body: {
      ...createEndpointDrivenAgent().body,
      inputEndpoints: [
        {
          id: 'vision-primary',
          source: 'vision.G.2',
          worldPort: 'vision',
          scale: 1,
        },
        {
          id: 'vision-duplicate',
          source: 'vision.G.2',
          worldPort: 'vision',
          scale: 1,
        },
      ],
      outputEndpoints: [
        {
          id: 'left-actions',
          target: 'action.turn-left',
          worldPort: 'action',
          decayPerSecond: 1,
        },
        {
          id: 'left-actions-duplicate-target',
          target: 'action.turn-left',
          worldPort: 'action',
          decayPerSecond: 1,
        },
        {
          id: 'move-forward-actions',
          target: 'action.move-forward',
          worldPort: 'action',
          decayPerSecond: 1,
        },
      ],
      mappings: [
        {
          id: 'input-primary-map',
          kind: 'input',
          endpointId: 'vision-primary',
          nodeId: 'sensor-G-2',
        },
        {
          id: 'input-duplicate-map',
          kind: 'input',
          endpointId: 'vision-duplicate',
          nodeId: 'sensor-G-2',
        },
        {
          id: 'output-left-map',
          kind: 'output',
          endpointId: 'left-actions-duplicate-target',
          nodeId: 'effector-turn-left',
        },
        {
          id: 'output-left-alt-map',
          kind: 'output',
          endpointId: 'left-actions',
          nodeId: 'alt-effector-turn-left',
        },
        {
          id: 'output-move-forward-map',
          kind: 'output',
          endpointId: 'move-forward-actions',
          nodeId: 'effector-move-forward',
        },
        {
          id: 'output-move-forward-duplicate-map',
          kind: 'output',
          endpointId: 'move-forward-actions',
          nodeId: 'effector-move-forward',
        },
      ],
    },
    connections: [
      {
        id: 'conflicting-input',
        from: { scope: 'bodyInput', nodeId: 'sensor-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        synapseModelId: 'static-default',
      },
      {
        id: 'unmatched-input',
        from: { scope: 'bodyInput', nodeId: 'vision-G-2' },
        to: { scope: 'brain', nodeId: 'neuron-1' },
        synapseModelId: 'static-default',
      },
      {
        id: 'left-output',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-turn-left' },
        synapseModelId: 'static-default',
      },
      {
        id: 'left-output-duplicate',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'alt-effector-turn-left' },
        synapseModelId: 'static-default',
      },
      {
        id: 'unmatched-output',
        from: { scope: 'brain', nodeId: 'neuron-1' },
        to: { scope: 'bodyOutput', nodeId: 'effector-turn-right' },
        synapseModelId: 'static-default',
      },
    ],
  };

  const preview = buildAgentBodyEndpointPreviewModel(invalidAgent, WORLD_REGISTRY);

  assert.equal(
    preview.issues.some(
      (issue) =>
        issue.scope === 'input' &&
        issue.kind === 'conflict' &&
        issue.nodeId === 'sensor-G-2' &&
        issue.relatedMappingIds?.includes('input-primary-map') &&
        issue.relatedMappingIds?.includes('input-duplicate-map')
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
        issue.nodeId === 'effector-move-forward' &&
        issue.relatedMappingIds?.includes('output-move-forward-map') &&
        issue.relatedMappingIds?.includes('output-move-forward-duplicate-map')
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
  const agent = createEndpointDrivenAgent();
  const preview = buildAgentBodyEndpointPreviewModel(agent, WORLD_REGISTRY, 3);
  const compiledEndpointIds = resolveCompiledAgentBodyEndpointIds(agent, WORLD_REGISTRY);

  assert.deepEqual(
    compiledEndpointIds.bodyInputNodeIds,
    ['sensor-G-2']
  );
  assert.deepEqual(
    compiledEndpointIds.bodyOutputNodeIds,
    ['effector-move-forward']
  );
  assert.equal(preview.input.endpointNodeIds.length, compiledEndpointIds.bodyInputNodeIds.length);
  assert.equal(preview.output.endpointNodeIds.length > compiledEndpointIds.bodyOutputNodeIds.length, true);
});

test('body endpoint preview and compiled endpoint projection stay stable when persisted endpoints/mappings are reordered', () => {
  const agent = createEndpointDrivenAgent();
  const baselinePreview = buildAgentBodyEndpointPreviewModel(agent, WORLD_REGISTRY, 3);
  const baselineCompiledEndpointIds = resolveCompiledAgentBodyEndpointIds(agent, WORLD_REGISTRY);

  const reorderedAgent: AgentIR = {
    ...agent,
    body: {
      inputEndpoints: [...agent.body.inputEndpoints].reverse(),
      outputEndpoints: [...agent.body.outputEndpoints].reverse(),
      mappings: [...agent.body.mappings].reverse(),
    },
    connections: [...agent.connections].reverse(),
  };

  const reorderedPreview = buildAgentBodyEndpointPreviewModel(reorderedAgent, WORLD_REGISTRY, 3);
  const reorderedCompiledEndpointIds = resolveCompiledAgentBodyEndpointIds(reorderedAgent, WORLD_REGISTRY);

  assert.deepEqual(reorderedPreview.input.endpointNodeIds, baselinePreview.input.endpointNodeIds);
  assert.deepEqual(reorderedPreview.output.endpointNodeIds, baselinePreview.output.endpointNodeIds);
  assert.deepEqual(reorderedCompiledEndpointIds, baselineCompiledEndpointIds);
  assert.deepEqual(reorderedPreview.input.previewsByEndpointId['vision-cells'], [
    { nodeId: 'sensor-G-2', resolved: 'vision.G.2' },
  ]);
  assert.deepEqual(reorderedPreview.output.previewsByEndpointId['motor-turn-left'], [
    { nodeId: 'effector-turn-left', resolved: 'action.turn-left' },
  ]);
  assert.deepEqual(reorderedPreview.output.previewsByEndpointId['motor-move-forward'], [
    { nodeId: 'effector-move-forward', resolved: 'action.move-forward' },
  ]);
  assert.deepEqual(reorderedPreview.output.previewsByEndpointId['motor-turn-right'], [
    { nodeId: 'effector-turn-right', resolved: 'action.turn-right' },
  ]);
});
