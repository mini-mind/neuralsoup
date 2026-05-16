import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentController } from '../../src/engine/AgentController';
import { VisionSystem } from '../../src/engine/VisionSystem';
import { WorldManager } from '../../src/engine/WorldManager';
import { CollisionDetector } from '../../src/engine/CollisionDetector';
import { SimulationSession } from '../../src/runtime/SimulationSession';
import { createDefaultBrainGraph } from '../../src/domain/brain';
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

test('keyboard policy moves forward and cancels opposite turns', () => {
  const controller = new AgentController();

  const forwardAgent = createAgent();
  controller.updateAgent(forwardAgent, 1, {
    controlMode: 'keyboard',
    keyboardInputState: {
      turnLeft: false,
      moveForward: true,
      turnRight: false
    }
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
      turnRight: true
    }
  });

  assert.equal(cancelTurnAgent.angle, 0);
  assert.equal(cancelTurnAgent.velocity.x, 0);
  assert.equal(cancelTurnAgent.velocity.y, 0);
});

test('script policy exposes compile/runtime/shape errors and does not fallback to movement', () => {
  const controller = new AgentController();
  const compileErrorAgent = createAgent();

  controller.setScriptCode('return [');
  controller.updateAgent(compileErrorAgent, 1, {
    controlMode: 'script',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false
    }
  });

  assert.equal(controller.getScriptStatus().state, 'compile-error');
  assert.equal(compileErrorAgent.x, 0);
  assert.equal(compileErrorAgent.velocity.x, 0);

  const runtimeErrorAgent = createAgent();
  controller.setScriptCode('throw new Error("boom");');
  controller.updateAgent(runtimeErrorAgent, 1, {
    controlMode: 'script',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false
    }
  });

  assert.equal(controller.getScriptStatus().state, 'runtime-error');
  assert.equal(runtimeErrorAgent.x, 0);
  assert.equal(runtimeErrorAgent.velocity.x, 0);

  const invalidShapeAgent = createAgent();
  controller.setScriptCode('return [1, 0];');
  controller.updateAgent(invalidShapeAgent, 1, {
    controlMode: 'script',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false
    }
  });

  assert.equal(controller.getScriptStatus().state, 'invalid-output');
  assert.equal(invalidShapeAgent.x, 0);
  assert.equal(invalidShapeAgent.velocity.x, 0);
});

test('simulation session owns main-agent control mode and preserves it across reset', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector()
  });

  session.initialize();
  const initialMainAgent = session.getMainAgent();
  assert.ok(initialMainAgent);
  assert.equal(session.getMainAgentControlMode(), 'keyboard');
  assert.equal(session.getAgentControlMode(initialMainAgent.id), 'keyboard');
  assert.ok(
    session.getState().agents.every((agent) =>
      session.getAgentControlMode(agent.id) === (agent.id === initialMainAgent.id ? 'keyboard' : 'random')
    )
  );

  session.setControlMode('snn');
  const snnMainAgent = session.getMainAgent();
  assert.ok(snnMainAgent);
  assert.equal(session.getMainAgentControlMode(), 'snn');
  assert.equal(session.getAgentControlMode(snnMainAgent.id), 'snn');
  assert.ok(
    session.getState().agents.every((agent) =>
      session.getAgentControlMode(agent.id) === (agent.id === snnMainAgent.id ? 'snn' : 'random')
    )
  );

  session.reset();
  const resetMainAgent = session.getMainAgent();
  assert.ok(resetMainAgent);
  assert.equal(session.getControlMode(), 'snn');
  assert.equal(session.getMainAgentControlMode(), 'snn');
  assert.equal(session.getAgentControlMode(resetMainAgent.id), 'snn');
});

test('simulation session keeps main-agent brain program aligned across mode switches and vision-cell updates', () => {
  const agentController = new AgentController();
  const visionSystem = new VisionSystem();
  const session = new SimulationSession({
    visionSystem,
    agentController,
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector()
  });

  session.initialize();
  const mainAgent = session.getMainAgent();
  assert.ok(mainAgent);
  assert.equal(session.isMainAgentBrainProgramConfigured(), true);

  session.setControlMode('snn');
  assert.equal(session.isMainAgentBrainProgramConfigured(), true);
  assert.equal(session.getCurrentBrainGraph().inputs.length, mainAgent.visionCells.length * 3);

  session.setControlMode('keyboard');
  session.updateAgentParameters({ visionCells: 24 });
  assert.equal(mainAgent.visionCells.length, 24);
  assert.equal(session.getCurrentBrainGraph().inputs.length, 72);
  assert.equal(session.getCurrentBrainGraph().outputs.length, 3);

  session.setControlMode('snn');
  session.updateAgentParameters({ visionCells: 18 });
  assert.equal(mainAgent.visionCells.length, 18);
  assert.equal(session.getCurrentBrainGraph().inputs.length, 54);

  const agent = createAgent({
    id: mainAgent.id,
    visualInput: new Array(mainAgent.visionCells.length * 3).fill(0)
  });

  agentController.updateAgent(agent, 1, {
    controlMode: 'snn',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false
    }
  });

  assert.equal(Number.isFinite(agent.velocity.x), true);
  assert.equal(Number.isFinite(agent.velocity.y), true);
  assert.notEqual(agent.x, 0);
});

test('simulation session preserves custom BrainGraph across reset and reconciles it to vision-cell changes', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector()
  });

  session.initialize();

  const graph = createDefaultBrainGraph(36);
  graph.synapses.push({
    id: 'forward-on-green',
    from: 'vision-G-0',
    to: 'output-move-forward',
    weight: 2
  });

  session.setBrainGraph(graph);
  assert.equal(session.isMainAgentBrainProgramConfigured(), true);
  assert.deepEqual(
    session.getCurrentBrainGraph().synapses.map((synapse) => synapse.id),
    ['forward-on-green']
  );

  session.updateAgentParameters({ visionCells: 1 });
  assert.equal(session.getCurrentBrainGraph().inputs.length, 3);
  assert.deepEqual(
    session.getCurrentBrainGraph().synapses.map((synapse) => synapse.id),
    ['forward-on-green']
  );

  session.reset();
  assert.equal(session.getMainAgentControlMode(), 'keyboard');
  assert.equal(session.getCurrentBrainGraph().inputs.length, 3);
  assert.deepEqual(
    session.getCurrentBrainGraph().synapses.map((synapse) => synapse.id),
    ['forward-on-green']
  );
});

test('simulation session rejects invalid BrainGraph updates without dropping the last applied graph', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector()
  });

  session.initialize();

  const validGraph = createDefaultBrainGraph(2);
  validGraph.synapses.push({
    id: 'vision-to-neuron',
    from: 'vision-R-0',
    to: 'neuron-1',
    weight: 0.5
  });

  const appliedStatus = session.setBrainGraph(validGraph);
  assert.equal(appliedStatus.state, 'applied');
  assert.deepEqual(
    session.getCurrentBrainGraph().synapses.map((synapse) => synapse.id),
    ['vision-to-neuron']
  );

  const invalidGraph = {
    ...validGraph,
    synapses: [
      ...validGraph.synapses,
      {
        id: 'invalid-output-to-output',
        from: 'output-turn-left',
        to: 'output-turn-right',
        weight: 1
      }
    ]
  };

  const invalidStatus = session.setBrainGraph(invalidGraph);
  assert.equal(invalidStatus.state, 'invalid');
  assert.ok(invalidStatus.message.includes('invalid direction output -> output'));
  assert.deepEqual(
    invalidStatus.appliedGraph.synapses.map((synapse) => synapse.id),
    ['vision-to-neuron']
  );
  assert.deepEqual(
    session.getCurrentBrainGraph().synapses.map((synapse) => synapse.id),
    ['vision-to-neuron']
  );
});

test('simulation session keeps applied BrainGraph coherent when vision-cell reconciliation happens after an invalid draft', () => {
  const session = new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController: new AgentController(),
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector()
  });

  session.initialize();

  const validGraph = createDefaultBrainGraph(3);
  validGraph.synapses.push({
    id: 'keep-synapse',
    from: 'vision-R-0',
    to: 'neuron-1',
    weight: 0.7
  });
  session.setBrainGraph(validGraph);

  const invalidGraph = {
    ...validGraph,
    synapses: [
      ...validGraph.synapses,
      {
        id: 'invalid-output-loop',
        from: 'output-move-forward',
        to: 'output-turn-right',
        weight: 1
      }
    ]
  };
  const invalidStatus = session.setBrainGraph(invalidGraph);
  assert.equal(invalidStatus.state, 'invalid');

  session.updateAgentParameters({ visionCells: 1 });

  assert.equal(session.getCurrentBrainGraph().inputs.length, 3);
  assert.deepEqual(
    session.getCurrentBrainGraph().synapses.map((synapse) => synapse.id),
    ['keep-synapse']
  );
});

test('brain-program backed snn control consumes BrainGraph output channels', () => {
  const controller = new AgentController();
  const graph = createDefaultBrainGraph(1);

  graph.synapses.push({
    id: 'vision-to-output-forward',
    from: 'vision-G-0',
    to: 'output-move-forward',
    weight: 2
  });

  controller.setBrainGraph(1, graph);

  const agent = createAgent({
    id: 1,
    visualInput: [0, 1, 0]
  });

  controller.updateAgent(agent, 1, {
    controlMode: 'snn',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false
    }
  });

  assert.ok(agent.velocity.x > 0);
  assert.equal(agent.velocity.y, 0);
});
