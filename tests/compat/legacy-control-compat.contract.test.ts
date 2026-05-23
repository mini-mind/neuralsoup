import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentController } from '../../src/engine/AgentController';
import { VisionSystem } from '../../src/engine/VisionSystem';
import { WorldManager } from '../../src/engine/WorldManager';
import { CollisionDetector } from '../../src/engine/CollisionDetector';
import { SimulationSession } from '../../src/runtime/SimulationSession';
import {
  exportLegacyGraphIRDocument,
  inspectLegacyGraphIRExport,
  setLegacyGraphIRDocument,
} from '../../src/compat/legacySimulationSession';
import {
  deriveAgentIRVisionCellCount,
  withDerivedBodyVisionCellCount,
  withVisionCellLayoutMarkers,
  type AgentIR,
} from '../../src/domain/brain';
import { compileLegacyBrainDefinition } from '../../src/compat/legacyBrainCompiler';
import { createDefaultGraphIRDocument } from '../../src/compat/legacyGraphDefaults';
import { summarizeGraphIRDocument, type GraphIRDocument, type NeuronNode } from '../../src/domain/brain/ir';
import { createDefaultLegacyBodyDefinition, type LegacyBodyDefinition } from '../../src/compat/legacyBrainPackage';
import type { LegacyBrainProgram } from '../../src/compat/legacyBrainProgram';
import { createLegacyBrainProgramRuntimeState, stepLegacyBrainProgram } from '../../src/compat/legacyBrainStep';
import type { Agent } from '../../src/types/simulation';

function createAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: overrides.id ?? 0,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    angle: overrides.angle ?? 0,
    velocity: overrides.velocity ?? { x: 0, y: 0 },
    health: overrides.health ?? 100,
    energy: overrides.energy ?? 100,
    visionCells: overrides.visionCells ?? [],
    visualInput: overrides.visualInput ?? [0, 0, 0],
    motivation: overrides.motivation ?? 0,
    stress: overrides.stress ?? 0.5,
    homeostasis: overrides.homeostasis ?? 0.5,
    totalReward: overrides.totalReward ?? 0,
    collisionCount: overrides.collisionCount ?? 0,
  };
}

const getCoreNeuronGroup = (document: GraphIRDocument) => {
  const group = document.root.children.find((node) => node.id === 'core-neuron-group');
  assert.ok(group && group.kind === 'neuron-group');
  return group;
};

const getRootVisionCells = (document: GraphIRDocument) => {
  const inputAdapter = document.root.children.find((node) => node.id === 'input-adapter' && node.kind === 'adapter');
  return inputAdapter?.kind === 'adapter' ? inputAdapter.children.length / 3 : 1;
};

const compileDefaultBrain = (document: GraphIRDocument) =>
  compileLegacyBrainDefinition(document, createDefaultLegacyBodyDefinition(getRootVisionCells(document)));

const createValidCompatBoundaryDocument = (): GraphIRDocument => ({
  version: 1,
  models: [
    {
      id: 'spike-neuron',
      kind: 'neuron',
      state: [],
      parameters: [],
      internals: [],
      inputs: [
        {
          id: 'dendrite',
          signal: { id: 'spike', valueType: 'number' },
        },
      ],
      outputs: [
        {
          id: 'axon',
          signal: { id: 'spike', valueType: 'number' },
        },
      ],
      equations: [],
      onReceive: [],
      update: [],
    },
    {
      id: 'world-signal',
      kind: 'signal',
      state: [],
      parameters: [],
      internals: [],
      inputs: [
        {
          id: 'in',
          signal: { id: 'spike', valueType: 'number' },
        },
      ],
      outputs: [
        {
          id: 'out',
          signal: { id: 'spike', valueType: 'number' },
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
        id: 'input-adapter',
        label: 'Input Adapter',
        adapterType: 'input',
        children: [
          {
            kind: 'signal',
            id: 'vision-in',
            label: 'Vision In',
            modelId: 'world-signal',
            direction: 'input',
            signal: { id: 'spike', valueType: 'number' },
          },
        ],
      },
      {
        kind: 'neuron-group',
        id: 'core-neuron-group',
        label: 'Core',
        children: [
          {
            kind: 'neuron',
            id: 'neuron-1',
            label: 'Neuron 1',
            modelId: 'spike-neuron',
          },
        ],
      },
      {
        kind: 'adapter',
        id: 'output-adapter',
        label: 'Output Adapter',
        adapterType: 'output',
        children: [
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
    ],
    links: [
      {
        id: 'vision-to-neuron',
        from: { nodeId: 'vision-in', portId: 'out' },
        to: { nodeId: 'neuron-1', portId: 'dendrite' },
        weight: 1,
      },
      {
        id: 'neuron-to-motor',
        from: { nodeId: 'neuron-1', portId: 'axon' },
        to: { nodeId: 'motor-out', portId: 'in' },
        weight: 1,
      },
    ],
  },
});

const createRuleDrivenSessionAgent = (): AgentIR =>
  withDerivedBodyVisionCellCount(
    withVisionCellLayoutMarkers(
      {
        version: 1,
        metadata: {
          id: 'agent-session-rule-driven',
          name: 'Session Rule Driven Agent',
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
      },
      3
    )
  );

test('legacy GraphIR compilation remains a compat wrapper over compiled Agent runtime', () => {
  const document = createDefaultGraphIRDocument(1);
  const program: LegacyBrainProgram = compileDefaultBrain(document);

  assert.equal(program.inputBindings.length, 3);
  assert.equal(program.outputBindings.length, 3);
  assert.equal('legacyGraphIR' in (program as LegacyBrainProgram & Record<string, unknown>), false);
  assert.equal('compiledAgentProgram' in (program as LegacyBrainProgram & Record<string, unknown>), false);
});

test('simulation session legacy GraphIR compat setter rejects invalid drafts without dropping the last applied AgentIR', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const validDocument = createDefaultGraphIRDocument(2);
  validDocument.root.links = [
    {
      id: 'vision-to-neuron',
      from: {
        nodeId: 'vision-R-0',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-1',
        portId: 'dendrite',
      },
      weight: 0.5,
    },
  ];

  const appliedStatus = setLegacyGraphIRDocument(session, validDocument);
  assert.equal(appliedStatus.state, 'applied');
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-R-0');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.nodeId, 'neuron-1');

  const invalidDocument = structuredClone(validDocument);
  invalidDocument.root.links[0]!.from.portId = 'in';

  const invalidStatus = setLegacyGraphIRDocument(session, invalidDocument);
  assert.equal(invalidStatus.state, 'invalid');
  assert.ok(invalidStatus.message.includes('not an output port'));
  assert.deepEqual(invalidStatus.appliedSummary.leafLinkCount, 1);
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-R-0');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.nodeId, 'neuron-1');
});

test('simulation session legacy GraphIR compat setter keeps the last applied AgentIR and runtime when compat compile bindings fail', () => {
  const agentController = new AgentController();
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController,
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const validDocument = createDefaultGraphIRDocument(2);
  validDocument.root.links = [
    {
      id: 'vision-b1-to-forward',
      from: {
        nodeId: 'vision-B-1',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-1',
        portId: 'dendrite',
      },
      weight: 2,
    },
    {
      id: 'neuron-1-to-forward',
      from: {
        nodeId: 'neuron-1',
        portId: 'axon',
      },
      to: {
        nodeId: 'output-move-forward',
        portId: 'in',
      },
      weight: 2,
    },
  ];

  const appliedStatus = setLegacyGraphIRDocument(session, validDocument);
  assert.equal(appliedStatus.state, 'applied');
  const appliedSummary = appliedStatus.appliedSummary;

  const invalidBody = createDefaultLegacyBodyDefinition(2);
  invalidBody.brainBindings.outputs[1] = {
    brainSignalNodeId: 'missing-output-node',
    bodySignalId: 'motor-move-forward',
  };
  const invalidDocument = structuredClone(validDocument);

  const invalidStatus = setLegacyGraphIRDocument(session, invalidDocument, invalidBody);
  assert.equal(invalidStatus.state, 'invalid');
  assert.ok(
    invalidStatus.message.includes('missing-output-node') ||
      invalidStatus.message.includes('non-root or non-output brain signal') ||
      invalidStatus.message.includes('missing-brain-node')
  );
  assert.deepEqual(invalidStatus.appliedSummary, appliedSummary);
  const persistedConnections = session.getCurrentAgentIR().connections.map((connection) => ({
    from: connection.from.nodeId,
    to: connection.to.nodeId,
    weight: connection.weight,
  }));
  assert.deepEqual(persistedConnections, [
    { from: 'vision-B-1', to: 'neuron-1', weight: 2 },
    { from: 'neuron-1', to: 'output-move-forward', weight: 2 },
  ]);

  const runtimeStatus = session.getAgentRuntimeStatus();
  assert.equal(runtimeStatus.state, 'applied');
  assert.deepEqual(runtimeStatus.appliedSummary, appliedSummary);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-B-1');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.nodeId, 'neuron-1');

  const mainAgent = session.getMainAgent();
  assert.ok(mainAgent);
  const agent = createAgent({
    id: mainAgent.id,
    visualInput: [0, 0, 0, 0, 0, 1],
  });

  assert.doesNotThrow(() => {
    agentController.updateAgent(agent, 1, {
      controlMode: 'snn',
      keyboardInputState: {
        turnLeft: false,
        moveForward: false,
        turnRight: false,
      },
    });
  });
  assert.ok(agent.velocity.x > 0);
  assert.equal(agent.velocity.y, 0);
});

test('simulation session keeps applied legacy GraphIR compat state coherent when vision-cell reconciliation follows an invalid compat draft', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const validDocument = createDefaultGraphIRDocument(3);
  validDocument.root.links = [
    {
      id: 'keep-link',
      from: {
        nodeId: 'vision-R-0',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-1',
        portId: 'dendrite',
      },
      weight: 0.7,
    },
  ];
  setLegacyGraphIRDocument(session, validDocument);

  const invalidDocument = structuredClone(validDocument);
  invalidDocument.root.links[0]!.from.portId = 'in';
  const invalidStatus = setLegacyGraphIRDocument(session, invalidDocument);
  assert.equal(invalidStatus.state, 'invalid');

  session.updateAgentParameters({ visionCells: 1 });

  assert.equal(summarizeGraphIRDocument(exportLegacyGraphIRDocument(session)).inputSignalCount, 6);
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-R-0');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.nodeId, 'neuron-1');
});

test('simulation session keeps legacy GraphIR compat state aligned across mode switches and vision-cell updates', () => {
  const agentController = new AgentController();
  const visionSystem = new VisionSystem();
  const session = new SimulationSession({
    visionSystem,
    agentController,
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();
  const mainAgent = session.getMainAgent();
  assert.ok(mainAgent);
  assert.equal(session.isMainAgentBrainProgramConfigured(), true);

  session.setControlMode('snn');
  assert.equal(session.isMainAgentBrainProgramConfigured(), true);
  assert.equal(
    summarizeGraphIRDocument(exportLegacyGraphIRDocument(session)).inputSignalCount,
    mainAgent.visionCells.length * 3 + 3
  );

  session.setControlMode('keyboard');
  session.updateAgentParameters({ visionCells: 24 });
  assert.equal(mainAgent.visionCells.length, 24);
  assert.deepEqual(summarizeGraphIRDocument(exportLegacyGraphIRDocument(session)), {
    inputSignalCount: 75,
    outputSignalCount: 6,
    neuronCount: 2,
    leafLinkCount: 82,
  });

  session.setControlMode('snn');
  session.updateAgentParameters({ visionCells: 18 });
  assert.equal(mainAgent.visionCells.length, 18);
  assert.equal(summarizeGraphIRDocument(exportLegacyGraphIRDocument(session)).inputSignalCount, 57);

  const agent = createAgent({
    id: mainAgent.id,
    visualInput: new Array(mainAgent.visionCells.length * 3).fill(0),
  });

  agentController.updateAgent(agent, 1, {
    controlMode: 'snn',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false,
    },
  });

  assert.equal(Number.isFinite(agent.velocity.x), true);
  assert.equal(Number.isFinite(agent.velocity.y), true);
  assert.equal(agent.x, 0);
  assert.equal(agent.y, 0);
});

test('simulation session preserves custom legacy GraphIR compat leaf links across reset and reconciles vision-cell changes', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const document = createDefaultGraphIRDocument(36);
  document.root.links = [
    {
      id: 'forward-on-green',
      from: {
        nodeId: 'vision-G-0',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-1',
        portId: 'dendrite',
      },
      weight: 2,
    },
    {
      id: 'neuron-1-to-forward',
      from: {
        nodeId: 'neuron-1',
        portId: 'axon',
      },
      to: {
        nodeId: 'output-move-forward',
        portId: 'in',
      },
      weight: 2,
    },
  ];

  setLegacyGraphIRDocument(session, document);
  assert.equal(session.isMainAgentBrainProgramConfigured(), true);
  assert.equal(session.getCurrentAgentIR().connections.length, 2);
  assert.equal(session.getCurrentAgentIR().connections[0]?.weight, 2);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.scope, 'bodyInput');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.scope, 'brain');
  assert.equal(session.getCurrentAgentIR().connections[1]?.from.scope, 'brain');
  assert.equal(session.getCurrentAgentIR().connections[1]?.to.scope, 'bodyOutput');

  session.updateAgentParameters({ visionCells: 1 });
  assert.equal(summarizeGraphIRDocument(exportLegacyGraphIRDocument(session)).inputSignalCount, 6);
  assert.equal(session.getCurrentAgentIR().connections.length, 2);
  assert.equal(session.getCurrentAgentIR().connections[0]?.weight, 2);

  session.reset();
  assert.equal(session.getMainAgentControlMode(), 'keyboard');
  assert.equal(summarizeGraphIRDocument(exportLegacyGraphIRDocument(session)).inputSignalCount, 6);
  assert.equal(session.getCurrentAgentIR().connections.length, 2);
  assert.equal(session.getCurrentAgentIR().connections[0]?.weight, 2);
});

test('legacy brain-program compat compiler rejects legacy GraphIR drafts that lower to direct body bridges', () => {
  const document = createDefaultGraphIRDocument(1);
  document.root.links = [
    {
      id: 'vision-to-output-forward',
      from: {
        nodeId: 'vision-G-0',
        portId: 'out',
      },
      to: {
        nodeId: 'output-move-forward',
        portId: 'in',
      },
      weight: 2,
    },
  ];

  assert.throws(() => compileDefaultBrain(document), /bodyInput directly to bodyOutput/);
});

test('simulation session exposes the main-agent active legacy GraphIR leaf node ids through compat runtime state', () => {
  const agentController = new AgentController();
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController,
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();
  session.setControlMode('snn');

  const document = createDefaultGraphIRDocument(1);
  const neuronGroup = getCoreNeuronGroup(document);
  const neuron = neuronGroup.children.find((node) => node.id === 'neuron-1');
  assert.ok(neuron && neuron.kind === 'neuron');
  neuron.parameterOverrides = {
    ...(neuron.parameterOverrides ?? {}),
    threshold: -70,
  };

  const status = setLegacyGraphIRDocument(session, document);
  assert.equal(status.state, 'applied');

  const mainAgent = session.getMainAgent();
  assert.ok(mainAgent);
  mainAgent.visualInput = [1, 1, 0];
  agentController.updateAgent(mainAgent, 1 / 60, {
    controlMode: 'snn',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false,
    },
  });

  assert.deepEqual(
    new Set(session.getAgentRuntimeActivitySnapshot().activeNodeIds),
    new Set([
      'vision-R-0',
      'vision-G-0',
      'neuron-1',
      'output-move-forward',
    ])
  );
});

test('legacy GraphIR leaf link weights change compat runtime action outputs', () => {
  const baseDocument = createDefaultGraphIRDocument(1);
  const weakDocument = structuredClone(baseDocument);
  const strongDocument = structuredClone(baseDocument);
  const weakGroup = getCoreNeuronGroup(weakDocument);
  const strongGroup = getCoreNeuronGroup(strongDocument);

  const weakNeuron = weakGroup.children.find((node) => node.id === 'neuron-1');
  const strongNeuron = strongGroup.children.find((node) => node.id === 'neuron-1');
  assert.ok(weakNeuron && weakNeuron.kind === 'neuron');
  assert.ok(strongNeuron && strongNeuron.kind === 'neuron');
  weakNeuron.parameterOverrides = { ...(weakNeuron.parameterOverrides ?? {}), threshold: -70 };
  strongNeuron.parameterOverrides = { ...(strongNeuron.parameterOverrides ?? {}), threshold: -70 };

  const weakForwardLink = weakDocument.root.links.find((link) => link.id === 'link-neuron-1-output-move-forward');
  const strongForwardLink = strongDocument.root.links.find((link) => link.id === 'link-neuron-1-output-move-forward');
  assert.ok(weakForwardLink);
  assert.ok(strongForwardLink);
  weakForwardLink.weight = 0;
  strongForwardLink.weight = 3;

  const weakProgram = compileDefaultBrain(weakDocument);
  const strongProgram = compileDefaultBrain(strongDocument);
  const weakResult = stepLegacyBrainProgram(weakProgram, [1, 1, 0], createLegacyBrainProgramRuntimeState(weakProgram), 1);
  const strongResult = stepLegacyBrainProgram(strongProgram, [1, 1, 0], createLegacyBrainProgramRuntimeState(strongProgram), 1);

  assert.equal(weakResult.outputs['move-forward'], 0);
  assert.equal(strongResult.outputs['move-forward'], 1);
});

test('legacy GraphIR parameter overrides change compat runtime action outputs', () => {
  const lowThresholdDocument = createDefaultGraphIRDocument(1);
  const highThresholdDocument = createDefaultGraphIRDocument(1);
  const lowThresholdGroup = getCoreNeuronGroup(lowThresholdDocument);
  const highThresholdGroup = getCoreNeuronGroup(highThresholdDocument);

  const lowThresholdNeuron = lowThresholdGroup.children.find((node) => node.id === 'neuron-1');
  const highThresholdNeuron = highThresholdGroup.children.find((node) => node.id === 'neuron-1');
  assert.ok(lowThresholdNeuron && lowThresholdNeuron.kind === 'neuron');
  assert.ok(highThresholdNeuron && highThresholdNeuron.kind === 'neuron');

  lowThresholdNeuron.parameterOverrides = { ...(lowThresholdNeuron.parameterOverrides ?? {}), threshold: -70 };
  highThresholdNeuron.parameterOverrides = { ...(highThresholdNeuron.parameterOverrides ?? {}), threshold: 1000 };

  const lowProgram = compileDefaultBrain(lowThresholdDocument);
  const highProgram = compileDefaultBrain(highThresholdDocument);

  const lowResult = stepLegacyBrainProgram(lowProgram, [1, 1, 0], createLegacyBrainProgramRuntimeState(lowProgram), 1);
  const highResult = stepLegacyBrainProgram(highProgram, [1, 1, 0], createLegacyBrainProgramRuntimeState(highProgram), 1);

  assert.ok(lowResult.outputs['move-forward'] > highResult.outputs['move-forward']);
});

test('legacy GraphIR compat runtime keeps outputs at zero when there is no sensory input or spike drive', () => {
  const document = createDefaultGraphIRDocument(1);
  const program = compileDefaultBrain(document);

  const result = stepLegacyBrainProgram(program, [0, 0, 0], createLegacyBrainProgramRuntimeState(program), 1);

  assert.deepEqual(result.outputs, {
    'turn-left': 0,
    'move-forward': 0,
    'turn-right': 0,
  });
});

test('simulation session preserves custom output signal metadata when vision-cell reconciliation runs', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();
  const currentAgent = session.getCurrentAgentIR();
  const status = session.setAgentIR({
    ...currentAgent,
    layout: {
      version: 1,
      ...(currentAgent.layout ?? {}),
      nodes: {
        ...(currentAgent.layout?.nodes ?? {}),
        'output-move-forward': {
          ...(currentAgent.layout?.nodes['output-move-forward'] ?? {}),
          position: { x: 999, y: 111 },
        },
      },
    },
  });
  assert.equal(status.state, 'applied');

  session.updateAgentParameters({ visionCells: 24 });

  const reconciledAgent = session.getCurrentAgentIR();
  assert.deepEqual(reconciledAgent.layout?.nodes['output-move-forward']?.position, { x: 999, y: 111 });
});

test('simulation session vision-cell reconcile preserves AgentIR-only body rule semantics', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const currentAgent = session.getCurrentAgentIR();
  const customAgent = {
    ...currentAgent,
        body: {
          ...currentAgent.body,
          visionCellCount: currentAgent.body.visionCellCount,
          inputRules: [
        {
          id: 'custom-vision-rule',
          nodeIdPattern: '^vision-([RGB])-(\\d+)$',
          sourceTemplate: 'vision.$1.$2',
          scale: 3,
        },
      ],
      outputRules: [
        {
          id: 'custom-output-rule',
          nodeIdPattern: '^output-(turn-left|move-forward|turn-right)$',
          targetTemplate: 'action.$1',
          decayPerSecond: 9,
        },
      ],
    },
  };

  const status = session.setAgentIR(customAgent);
  assert.equal(status.state, 'applied');

  session.updateAgentParameters({ visionCells: 12 });

  const reconciledAgent = session.getCurrentAgentIR();
  assert.equal(deriveAgentIRVisionCellCount(reconciledAgent), 12);
  assert.equal(reconciledAgent.body.inputRules[0]?.scale, 3);
  assert.equal(reconciledAgent.body.outputRules[0]?.decayPerSecond, 9);
  assert.equal(reconciledAgent.body.inputRules[0]?.nodeIdPattern, '^vision-([RGB])-(\\d+)$');
  assert.equal(reconciledAgent.body.outputRules[0]?.nodeIdPattern, '^output-(turn-left|move-forward|turn-right)$');
});

test('simulation session vision-cell reconcile does not rewrite AgentIR-native body rule node ids', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const agent = createRuleDrivenSessionAgent();
  const status = session.setAgentIR(agent);
  assert.equal(status.state, 'applied');

  session.updateAgentParameters({ visionCells: 12 });

  const reconciledAgent = session.getCurrentAgentIR();
  assert.equal(reconciledAgent.body.inputRules[0]?.nodeIdPattern, '^sensor-([RGB])-(\\d+)$');
  assert.equal(reconciledAgent.body.outputRules[0]?.nodeIdPattern, '^effector-(turn-left|move-forward|turn-right)$');
});

test('simulation session legacy GraphIR compat getter preserves the applied bridgeable connection semantics', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const document = createDefaultGraphIRDocument(2);
  document.root.links = [
    {
      id: 'compat-forward-link',
      from: {
        nodeId: 'vision-G-0',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-1',
        portId: 'dendrite',
      },
      weight: 1.5,
    },
  ];

  const legacyNamedStatus = setLegacyGraphIRDocument(session, document);
  const legacyNamedDocument = exportLegacyGraphIRDocument(session);

  assert.equal(legacyNamedStatus.state, 'applied');
  assert.ok(
    legacyNamedDocument.root.links.some(
      (link) =>
        link.from.nodeId === 'vision-G-0' &&
        link.to.nodeId === 'core-input-G' &&
        link.weight === 1
    )
  );
  assert.ok(
    legacyNamedDocument.root.links.some(
      (link) =>
        link.from.nodeId === 'core-input-G' &&
        link.to.nodeId === 'neuron-1' &&
        link.weight === 1.5
    )
  );
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.weight, 1.5);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-G-0');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.nodeId, 'neuron-1');
});

test('simulation session setAgentIR accepts AgentIR-native body rules without requiring legacy GraphIR node ids', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const agent = createRuleDrivenSessionAgent();
  const status = session.setAgentIR(agent);

  assert.equal(status.state, 'applied');
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'sensor-G-2');
  assert.equal(session.getCurrentAgentIR().connections[1]?.to.nodeId, 'effector-move-forward');
});

test('simulation session legacy GraphIR compat setter rejects draft links that cannot be preserved', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const document = createDefaultGraphIRDocument(1);
  document.root.links.push({
    id: 'invalid-output-source-link',
    from: {
      nodeId: 'output-turn-left',
      portId: 'out',
    },
    to: {
      nodeId: 'neuron-1',
      portId: 'dendrite',
    },
    weight: 1,
  });

  const status = setLegacyGraphIRDocument(session, document);
  assert.equal(status.state, 'invalid');
  assert.ok(status.message?.includes('invalid-output-source-link'));
});

test('simulation session legacy GraphIR compat setter rejects drafts that would require silent vision-cell reconcile', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();
  session.updateAgentParameters({ visionCells: 2 });

  const validDocument = createDefaultGraphIRDocument(2);
  validDocument.root.links = [
    {
      id: 'keep-link',
      from: {
        nodeId: 'vision-R-0',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-1',
        portId: 'dendrite',
      },
      weight: 1,
    },
  ];

  const appliedStatus = setLegacyGraphIRDocument(session, validDocument);
  assert.equal(appliedStatus.state, 'applied');
  assert.equal(session.getCurrentAgentIR().connections.length, 1);

  const oversizedDraft = createDefaultGraphIRDocument(3);
  oversizedDraft.root.links = [
    {
      id: 'out-of-range-link',
      from: {
        nodeId: 'vision-G-2',
        portId: 'out',
      },
      to: {
        nodeId: 'neuron-1',
        portId: 'dendrite',
      },
      weight: 1,
    },
  ];

  const invalidStatus = setLegacyGraphIRDocument(session, oversizedDraft);
  assert.equal(invalidStatus.state, 'invalid');
  assert.ok(invalidStatus.message?.includes('vision-G-2'));
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-R-0');
});

test('simulation session legacy GraphIR compat setter accepts custom body bindings even when compat export cannot round-trip them', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const document = createValidCompatBoundaryDocument();
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

  const status = setLegacyGraphIRDocument(session, document, body);
  assert.equal(status.state, 'applied');
  const exportAudit = inspectLegacyGraphIRExport(session);
  assert.ok(
    exportAudit.issues.some((issue) => issue.message.includes('cannot preserve full BodyIR input rule semantics')) ||
      exportAudit.issues.some((issue) => issue.message.includes('cannot preserve full BodyIR output rule semantics'))
  );
  assert.throws(
    () => exportLegacyGraphIRDocument(session),
    (error: unknown) =>
      error instanceof Error &&
      (error.message.includes('cannot preserve full BodyIR input rule semantics') ||
        error.message.includes('cannot preserve full BodyIR output rule semantics'))
  );
});

test('simulation session legacy GraphIR compat getter rejects applied AgentIR bodies with compat-only semantic loss', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const currentAgent = session.getCurrentAgentIR();
  const status = session.setAgentIR({
    ...currentAgent,
    body: {
      ...currentAgent.body,
      visionCellCount: currentAgent.body.visionCellCount,
      inputRules: [
        {
          id: 'custom-input-a',
          nodeIdPattern: '^sensor-a$',
          sourceTemplate: 'vision.G.0',
          scale: 1,
        },
        {
          id: 'custom-input-b',
          nodeIdPattern: '^sensor-b$',
          sourceTemplate: 'vision.G.0',
          scale: 1,
        },
      ],
      outputRules: [
        {
          id: 'custom-output-a',
          nodeIdPattern: '^effector-a$',
          targetTemplate: 'action.move-forward',
          decayPerSecond: 4,
        },
        {
          id: 'custom-output-b',
          nodeIdPattern: '^effector-b$',
          targetTemplate: 'action.move-forward',
          decayPerSecond: 4,
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

  assert.equal(status.state, 'applied');
  assert.throws(
    () => exportLegacyGraphIRDocument(session),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('cannot preserve full BodyIR input rule semantics')
  );
});

test('simulation session legacy GraphIR compat getter preserves explicit neuron initialState.u round-trip', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const currentAgent = session.getCurrentAgentIR();
  const appliedStatus = session.setAgentIR({
    ...currentAgent,
    brain: {
      ...currentAgent.brain,
      neurons: currentAgent.brain.neurons.map((neuron) =>
        neuron.id === 'neuron-1'
          ? {
              ...neuron,
              initialState: {
                v: -62,
                u: -11,
              },
            }
          : neuron
      ),
    },
  });

  assert.equal(appliedStatus.state, 'applied');

  const document = exportLegacyGraphIRDocument(session);
  const compatNeuron = getCoreNeuronGroup(document).children.find(
    (node): node is NeuronNode => node.kind === 'neuron' && node.id === 'neuron-1'
  );

  assert.ok(compatNeuron);
  assert.equal(compatNeuron.parameterOverrides?.__agent_initialState_v, -62);
  assert.equal(compatNeuron.parameterOverrides?.__agent_initialState_u, -11);
});

test('simulation session legacy GraphIR compat setter reads explicit neuron initialState.u back into AgentIR', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();

  const document = createDefaultGraphIRDocument(1);
  const coreNeuron = getCoreNeuronGroup(document).children.find(
    (node): node is NeuronNode => node.kind === 'neuron' && node.id === 'neuron-1'
  );
  assert.ok(coreNeuron);
  coreNeuron.parameterOverrides = {
    ...(coreNeuron.parameterOverrides ?? {}),
    __agent_initialState_v: -61,
    __agent_initialState_u: -13,
  };

  const status = setLegacyGraphIRDocument(session, document);
  assert.equal(status.state, 'applied');

  const appliedNeuron = session.getCurrentAgentIR().brain.neurons.find((neuron) => neuron.id === 'neuron-1');
  assert.ok(appliedNeuron);
  assert.equal(appliedNeuron.initialState.v, -61);
  assert.equal(appliedNeuron.initialState.u, -13);
});
