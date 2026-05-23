import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentController } from '../../src/engine/AgentController';
import { VisionSystem } from '../../src/engine/VisionSystem';
import { WorldManager } from '../../src/engine/WorldManager';
import { CollisionDetector } from '../../src/engine/CollisionDetector';
import { SimulationSession } from '../../src/runtime/SimulationSession';
import type { AgentRuntimeStatus } from '../../src/types/agentRuntime';
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

test('simulation session keeps main-agent runtime status aligned across mode switches and vision-cell updates', () => {
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
  let runtimeStatus: AgentRuntimeStatus = session.getAgentRuntimeStatus();
  assert.equal(runtimeStatus.state, 'applied');
  assert.equal(runtimeStatus.appliedSummary.inputSignalCount, mainAgent.visionCells.length * 3 + 3);

  session.setControlMode('keyboard');
  session.updateAgentParameters({ visionCells: 24 });
  assert.equal(mainAgent.visionCells.length, 24);
  runtimeStatus = session.getAgentRuntimeStatus();
  assert.equal(runtimeStatus.state, 'applied');
  assert.deepEqual(runtimeStatus.appliedSummary, {
    inputSignalCount: 75,
    outputSignalCount: 3,
    neuronCount: 2,
    leafLinkCount: 76,
  });

  session.setControlMode('snn');
  session.updateAgentParameters({ visionCells: 18 });
  assert.equal(mainAgent.visionCells.length, 18);
  runtimeStatus = session.getAgentRuntimeStatus();
  assert.equal(runtimeStatus.state, 'applied');
  assert.equal(runtimeStatus.appliedSummary.inputSignalCount, 57);

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
