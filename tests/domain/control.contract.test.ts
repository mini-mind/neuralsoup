import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentController } from '../../src/engine/AgentController';
import { VisionSystem } from '../../src/engine/VisionSystem';
import { WorldManager } from '../../src/engine/WorldManager';
import { CollisionDetector } from '../../src/engine/CollisionDetector';
import { SimulationSession } from '../../src/runtime/SimulationSession';
import {
  compileBrainDefinition,
  createBrainProgramRuntimeState,
  createDefaultBodyDefinition,
  createDefaultGraphIRDocument,
  stepBrainProgram,
  summarizeGraphIRDocument,
  type GraphIRDocument,
} from '../../src/domain/brain/compat';
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
  compileBrainDefinition(document, createDefaultBodyDefinition(getRootVisionCells(document)));

test('keyboard policy moves forward and cancels opposite turns', () => {
  const controller = new AgentController();

  const forwardAgent = createAgent();
  controller.updateAgent(forwardAgent, 1, {
    controlMode: 'keyboard',
    keyboardInputState: {
      turnLeft: false,
      moveForward: true,
      turnRight: false,
    },
  });

  assert.equal(forwardAgent.velocity.x, 60);
  assert.equal(forwardAgent.velocity.y, 0);
  assert.equal(forwardAgent.x, 60);
  assert.equal(forwardAgent.angle, 0);

  const cancelTurnAgent = createAgent();
  controller.updateAgent(cancelTurnAgent, 1, {
    controlMode: 'keyboard',
    keyboardInputState: {
      turnLeft: true,
      moveForward: false,
      turnRight: true,
    },
  });

  assert.equal(cancelTurnAgent.angle, 0);
  assert.equal(cancelTurnAgent.velocity.x, 0);
  assert.equal(cancelTurnAgent.velocity.y, 0);
});

test('simulation session owns main-agent control mode and preserves it across reset', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
  });

  session.initialize();
  const initialMainAgent = session.getMainAgent();
  assert.ok(initialMainAgent);
  assert.equal(session.getMainAgentControlMode(), 'keyboard');
  assert.equal(session.getAgentControlMode(initialMainAgent.id), 'keyboard');
  assert.ok(
    session.getState().agents.every(
      (agent) =>
        session.getAgentControlMode(agent.id) ===
        (agent.id === initialMainAgent.id ? 'keyboard' : 'random')
    )
  );

  session.setControlMode('snn');
  const snnMainAgent = session.getMainAgent();
  assert.ok(snnMainAgent);
  assert.equal(session.getMainAgentControlMode(), 'snn');
  assert.equal(session.getAgentControlMode(snnMainAgent.id), 'snn');

  session.reset();
  const resetMainAgent = session.getMainAgent();
  assert.ok(resetMainAgent);
  assert.equal(session.getControlMode(), 'snn');
  assert.equal(session.getMainAgentControlMode(), 'snn');
  assert.equal(session.getAgentControlMode(resetMainAgent.id), 'snn');
});

test('simulation session keeps main-agent program aligned across mode switches and vision-cell updates', () => {
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
    summarizeGraphIRDocument(session.getCurrentGraphIRDocument()).inputSignalCount,
    mainAgent.visionCells.length * 3 + 3
  );

  session.setControlMode('keyboard');
  session.updateAgentParameters({ visionCells: 24 });
  assert.equal(mainAgent.visionCells.length, 24);
  assert.deepEqual(summarizeGraphIRDocument(session.getCurrentGraphIRDocument()), {
    inputSignalCount: 75,
    outputSignalCount: 6,
    neuronCount: 2,
    leafLinkCount: 82,
  });

  session.setControlMode('snn');
  session.updateAgentParameters({ visionCells: 18 });
  assert.equal(mainAgent.visionCells.length, 18);
  assert.equal(summarizeGraphIRDocument(session.getCurrentGraphIRDocument()).inputSignalCount, 57);

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

test('simulation session preserves custom GraphIR leaf links across reset and reconciles vision-cell changes', () => {
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
        nodeId: 'output-move-forward',
        portId: 'in',
      },
      weight: 2,
    },
  ];

  session.setGraphIRDocument(document);
  assert.equal(session.isMainAgentBrainProgramConfigured(), true);
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.weight, 2);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.scope, 'bodyInput');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.scope, 'bodyOutput');

  session.updateAgentParameters({ visionCells: 1 });
  assert.equal(summarizeGraphIRDocument(session.getCurrentGraphIRDocument()).inputSignalCount, 6);
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.weight, 2);

  session.reset();
  assert.equal(session.getMainAgentControlMode(), 'keyboard');
  assert.equal(summarizeGraphIRDocument(session.getCurrentGraphIRDocument()).inputSignalCount, 6);
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.weight, 2);
});

test('simulation session rejects invalid GraphIR drafts without dropping the last applied document', () => {
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

  const appliedStatus = session.setGraphIRDocument(validDocument);
  assert.equal(appliedStatus.state, 'applied');
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-R-0');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.nodeId, 'neuron-1');

  const invalidDocument = structuredClone(validDocument);
  invalidDocument.root.links[0]!.from.portId = 'in';

  const invalidStatus = session.setGraphIRDocument(invalidDocument);
  assert.equal(invalidStatus.state, 'invalid');
  assert.ok(invalidStatus.message.includes('not an output port'));
  assert.deepEqual(invalidStatus.appliedSummary.leafLinkCount, 1);
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-R-0');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.nodeId, 'neuron-1');
});

test('simulation session keeps the last applied document and program when GraphIR compile bindings fail', () => {
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
        nodeId: 'output-move-forward',
        portId: 'in',
      },
      weight: 2,
    },
  ];

  const appliedStatus = session.setGraphIRDocument(validDocument);
  assert.equal(appliedStatus.state, 'applied');
  const appliedSummary = appliedStatus.appliedSummary;

  const invalidBody = createDefaultBodyDefinition(2);
  invalidBody.brainBindings.outputs[1] = {
    brainSignalNodeId: 'missing-output-node',
    bodySignalId: 'motor-move-forward',
  };
  const invalidDocument = structuredClone(validDocument);
  invalidDocument.root.links.push({
    id: 'missing-output-to-forward',
    from: {
      nodeId: 'missing-output-node',
      portId: 'out',
    },
    to: {
      nodeId: 'output-move-forward',
      portId: 'in',
    },
    weight: 1,
  });

  const invalidStatus = session.setGraphIRDocument(invalidDocument, invalidBody);
  assert.equal(invalidStatus.state, 'invalid');
  assert.ok(
    invalidStatus.message.includes('missing-output-node') ||
      invalidStatus.message.includes('non-root or non-output brain signal')
  );
  assert.deepEqual(invalidStatus.appliedSummary.leafLinkCount, 1);
  assert.deepEqual(invalidStatus.appliedSummary, appliedSummary);
  const persistedConnections = session.getCurrentAgentIR().connections.map((connection) => ({
    from: connection.from.nodeId,
    to: connection.to.nodeId,
    weight: connection.weight,
  }));
  assert.deepEqual(persistedConnections, [{ from: 'vision-B-1', to: 'output-move-forward', weight: 2 }]);

  const runtimeStatus = session.getGraphIRRuntimeStatus();
  assert.equal(runtimeStatus.state, 'invalid');
  assert.deepEqual(runtimeStatus.appliedSummary, appliedSummary);

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

test('simulation session keeps applied GraphIR coherent when vision-cell reconciliation follows an invalid draft', () => {
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
  session.setGraphIRDocument(validDocument);

  const invalidDocument = structuredClone(validDocument);
  invalidDocument.root.links[0]!.from.portId = 'in';
  const invalidStatus = session.setGraphIRDocument(invalidDocument);
  assert.equal(invalidStatus.state, 'invalid');

  session.updateAgentParameters({ visionCells: 1 });

  assert.equal(summarizeGraphIRDocument(session.getCurrentGraphIRDocument()).inputSignalCount, 6);
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-R-0');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.nodeId, 'neuron-1');
});

test('brain-program backed snn control consumes GraphIR output signal channels', () => {
  const controller = new AgentController();
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

  controller.installBrainProgram(1, compileDefaultBrain(document));

  const agent = createAgent({
    id: 1,
    visualInput: [0, 1, 0],
  });

  controller.updateAgent(agent, 1, {
    controlMode: 'snn',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false,
    },
  });

  assert.ok(agent.velocity.x > 0);
  assert.equal(agent.velocity.y, 0);
});

test('simulation session exposes the main-agent active GraphIR leaf node ids', () => {
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

  const status = session.setGraphIRDocument(document);
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
    new Set(session.getGraphIRRuntimeActivitySnapshot().activeNodeIds),
    new Set([
      'vision-R-0',
      'vision-G-0',
      'neuron-1',
      'output-move-forward',
    ])
  );
});

test('GraphIR leaf link weights change runtime action outputs', () => {
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
  weakForwardLink.weight = 0.2;
  strongForwardLink.weight = 3;

  const weakProgram = compileDefaultBrain(weakDocument);
  const strongProgram = compileDefaultBrain(strongDocument);
  const weakResult = stepBrainProgram(weakProgram, [1, 1, 0], createBrainProgramRuntimeState(weakProgram), 1);
  const strongResult = stepBrainProgram(strongProgram, [1, 1, 0], createBrainProgramRuntimeState(strongProgram), 1);

  assert.equal(weakResult.outputs['move-forward'], 1);
  assert.equal(strongResult.outputs['move-forward'], 1);
});

test('GraphIR parameter overrides change runtime action outputs', () => {
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

  const lowResult = stepBrainProgram(lowProgram, [1, 1, 0], createBrainProgramRuntimeState(lowProgram), 1);
  const highResult = stepBrainProgram(highProgram, [1, 1, 0], createBrainProgramRuntimeState(highProgram), 1);

  assert.ok(lowResult.outputs['move-forward'] > highResult.outputs['move-forward']);
});

test('GraphIR runtime keeps outputs at zero when there is no sensory input or spike drive', () => {
  const document = createDefaultGraphIRDocument(1);
  const program = compileDefaultBrain(document);

  const result = stepBrainProgram(program, [0, 0, 0], createBrainProgramRuntimeState(program), 1);

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
  assert.equal(reconciledAgent.body.visionCellCount, 12);
  assert.equal(reconciledAgent.body.inputRules[0]?.scale, 3);
  assert.equal(reconciledAgent.body.outputRules[0]?.decayPerSecond, 9);
});

test('simulation session legacy GraphIR compat aliases stay behaviorally equivalent', () => {
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
        nodeId: 'output-move-forward',
        portId: 'in',
      },
      weight: 1.5,
    },
  ];

  const legacyNamedStatus = session.setLegacyGraphIRDocument(document);
  const legacyAliasStatus = session.setGraphIRDocument(document);

  assert.equal(legacyNamedStatus.state, 'applied');
  assert.equal(legacyAliasStatus.state, 'applied');
  assert.equal(session.getCurrentAgentIR().connections.length, 1);
  assert.equal(session.getCurrentAgentIR().connections[0]?.weight, 1.5);
  assert.equal(session.getCurrentAgentIR().connections[0]?.from.nodeId, 'vision-G-0');
  assert.equal(session.getCurrentAgentIR().connections[0]?.to.nodeId, 'output-move-forward');
});
