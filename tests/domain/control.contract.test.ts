import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentController } from '../../src/engine/AgentController';
import { VisionSystem } from '../../src/engine/VisionSystem';
import { WorldManager } from '../../src/engine/WorldManager';
import { CollisionDetector } from '../../src/engine/CollisionDetector';
import { SimulationSession } from '../../src/runtime/SimulationSession';
import {
  type WorldControlCommand,
} from '../../src/domain/world';
import { compileAgentIR, createAgentProgramRuntimeState, stepAgentProgram } from '../../src/domain/brain';
import {
  VISION_ACTION_HOST_PROFILE,
  createVisionActionSeedAgentIR,
  createVisionActionCommandApplier,
  createVisionActionInputSignalProvider,
  createVisionActionOutputAdapter,
  createVisionActionWorldRegistry,
  VISION_ACTION_MOVEMENT_BINDINGS,
} from '../../src/host';
import type { AgentRuntimeStatus } from '../../src/types/agentRuntime';
import type { Agent, VisionCell } from '../../src/types/simulation';

const WORLD_REGISTRY = createVisionActionWorldRegistry();

const createSimulationSession = (
  agentController: AgentController = new AgentController(
    createVisionActionOutputAdapter(),
    createVisionActionInputSignalProvider(),
    createVisionActionCommandApplier(),
    VISION_ACTION_MOVEMENT_BINDINGS
  )
) =>
  new SimulationSession({
    visionSystem: new VisionSystem(),
    agentController,
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
    worldRegistry: WORLD_REGISTRY,
    createInitialAgentIR: (visionCells) => createVisionActionSeedAgentIR(visionCells, '默认 Agent'),
    reconcileAgentIRToWorld: VISION_ACTION_HOST_PROFILE.reconcileAgentIR,
  });

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
    visualInput: overrides.visualInput,
    motivation: overrides.motivation ?? 0,
    stress: overrides.stress ?? 0.5,
    homeostasis: overrides.homeostasis ?? 0.5,
    totalReward: overrides.totalReward ?? 0,
    collisionCount: overrides.collisionCount ?? 0,
  };
}

function createVisionCells(
  count: number,
  color: { r: number; g: number; b: number } = { r: 0, g: 0, b: 0 }
): VisionCell[] {
  return Array.from({ length: count }, () => ({
    angle: 0,
    x: 0,
    y: 0,
    color: { ...color },
    closestDistance: Infinity,
  }));
}

test('keyboard policy moves forward and cancels opposite turns', () => {
  const controller = new AgentController(
    createVisionActionOutputAdapter(),
    createVisionActionInputSignalProvider(),
    createVisionActionCommandApplier(),
    VISION_ACTION_MOVEMENT_BINDINGS
  );

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
  const session = createSimulationSession();

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
  const agentController = new AgentController(
    createVisionActionOutputAdapter(),
    createVisionActionInputSignalProvider(),
    createVisionActionCommandApplier(),
    VISION_ACTION_MOVEMENT_BINDINGS
  );
  const visionSystem = new VisionSystem();
  const session = new SimulationSession({
    visionSystem,
    agentController,
    worldManager: new WorldManager(1600, 1200),
    collisionDetector: new CollisionDetector(),
    worldRegistry: WORLD_REGISTRY,
    createInitialAgentIR: (visionCells) => createVisionActionSeedAgentIR(visionCells, '默认 Agent'),
    reconcileAgentIRToWorld: VISION_ACTION_HOST_PROFILE.reconcileAgentIR,
  });

  session.initialize();
  const mainAgent = session.getMainAgent();
  assert.ok(mainAgent);
  assert.equal(session.isMainAgentBrainProgramConfigured(), true);

  session.setControlMode('snn');
  assert.equal(session.isMainAgentBrainProgramConfigured(), true);
  let runtimeStatus: AgentRuntimeStatus = session.getAgentRuntimeStatus();
  assert.equal(runtimeStatus.state, 'applied');
  assert.equal(runtimeStatus.appliedSummary.inputSignalCount, mainAgent.visionCells.length * 3);

  session.setControlMode('keyboard');
  session.updateAgentParameters({ visionCells: 24 });
  assert.equal(mainAgent.visionCells.length, 24);
  runtimeStatus = session.getAgentRuntimeStatus();
  assert.equal(runtimeStatus.state, 'applied');
  assert.deepEqual(runtimeStatus.appliedSummary, {
    inputSignalCount: 72,
    outputSignalCount: 3,
    neuronCount: 2,
    leafLinkCount: 76,
  });

  session.setControlMode('snn');
  session.updateAgentParameters({ visionCells: 18 });
  assert.equal(mainAgent.visionCells.length, 18);
  runtimeStatus = session.getAgentRuntimeStatus();
  assert.equal(runtimeStatus.state, 'applied');
  assert.equal(runtimeStatus.appliedSummary.inputSignalCount, 54);

  const agent = createAgent({
    id: mainAgent.id,
    visionCells: createVisionCells(mainAgent.visionCells.length),
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

test('default world action adapter consumes normalized action.* runtime targets', () => {
  const controller = new AgentController(
    createVisionActionOutputAdapter(),
    createVisionActionInputSignalProvider(),
    createVisionActionCommandApplier(),
    VISION_ACTION_MOVEMENT_BINDINGS
  );
  const session = createSimulationSession(controller);

  session.initialize();
  session.setControlMode('snn');
  const mainAgent = session.getMainAgent();
  assert.ok(mainAgent);

  const program = compileAgentIR(session.getCurrentAgentIR(), WORLD_REGISTRY);
  const result = stepAgentProgram(
    program,
    Object.fromEntries(mainAgent.visionCells.flatMap((_cell, cellIndex) => [
      [`vision-R-${cellIndex}`, 1],
      [`vision-G-${cellIndex}`, 1],
      [`vision-B-${cellIndex}`, 1],
    ])) as Record<string, number>,
    createAgentProgramRuntimeState(program),
    1,
    1
  );

  assert.equal(typeof result.outputsByTarget['action.move-forward'], 'number');

  const controlledAgent = createAgent({
    id: mainAgent.id,
    visionCells: createVisionCells(mainAgent.visionCells.length, { r: 1, g: 1, b: 1 }),
  });
  controller.updateAgent(controlledAgent, 1, {
    controlMode: 'snn',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false,
    },
  });

  assert.equal(Number.isFinite(controlledAgent.velocity.x), true);
  assert.equal(Number.isFinite(controlledAgent.velocity.y), true);
});

test('agent controller consumes runtime outputs through the injected world action adapter', () => {
  const adapterCalls: Array<Array<{
    id: string;
    target: string;
    normalizedTarget: string;
    worldPort: string;
    value: number;
  }>> = [];
  const controller = new AgentController({
    resolve(outputSignals) {
      adapterCalls.push(outputSignals.map((signal) => ({ ...signal })));
      return [{ kind: 'move-forward', value: 1 }] as WorldControlCommand[];
    },
  }, createVisionActionInputSignalProvider(), createVisionActionCommandApplier(), VISION_ACTION_MOVEMENT_BINDINGS);
  const session = createSimulationSession(controller);

  session.initialize();
  session.setControlMode('snn');
  const mainAgent = session.getMainAgent();
  assert.ok(mainAgent);

  const controlledAgent = createAgent({
    id: mainAgent.id,
    visionCells: createVisionCells(mainAgent.visionCells.length, { r: 1, g: 1, b: 1 }),
  });

  controller.updateAgent(controlledAgent, 1, {
    controlMode: 'snn',
    keyboardInputState: {
      turnLeft: false,
      moveForward: false,
      turnRight: false,
    },
  });

  assert.equal(adapterCalls.length, 1);
  assert.equal(
    adapterCalls[0].some(
      (signal) =>
        signal.normalizedTarget === 'action.move-forward' &&
        signal.worldPort === 'action' &&
        typeof signal.value === 'number'
    ),
    true
  );
  assert.equal(controlledAgent.velocity.x > 0, true);
});

test('default world action adapter projects any action.* target into commands by slug', () => {
  const adapter = createVisionActionOutputAdapter();

  assert.deepEqual(
    adapter.resolve([
      {
        id: 'turn-left',
        target: 'action.turn-left',
        normalizedTarget: 'action.turn-left',
        worldPort: 'action',
        value: 0.25,
      },
      {
        id: 'move-forward',
        target: 'action.move-forward',
        normalizedTarget: 'action.move-forward',
        worldPort: 'action',
        value: 0.75,
      },
      {
        id: 'turn-right',
        target: 'action.turn-right',
        normalizedTarget: 'action.turn-right',
        worldPort: 'action',
        value: 0.5,
      },
      {
        id: 'strafe-left',
        target: 'action.strafe-left',
        normalizedTarget: 'action.strafe-left',
        worldPort: 'action',
        value: 1,
      },
      {
        id: 'other-port',
        target: 'thruster.forward',
        normalizedTarget: 'thruster.forward',
        worldPort: 'thruster',
        value: 1,
      },
    ]),
    [
      { kind: 'turn-left', value: 0.25 },
      { kind: 'move-forward', value: 0.75 },
      { kind: 'turn-right', value: 0.5 },
      { kind: 'strafe-left', value: 1 },
    ] satisfies WorldControlCommand[]
  );
});

test('vision-cell world input provider ignores legacy visualInput and only uses visionCells as source of truth', () => {
  const provider = createVisionActionInputSignalProvider();
  const agent = createAgent({
    visionCells: createVisionCells(2, { r: 0.1, g: 0.2, b: 0.3 }),
    visualInput: [1, 1, 1, 1, 1, 1],
  });

  assert.deepEqual(provider.resolve(agent), {
    'vision-R-0': 0.1,
    'vision-G-0': 0.2,
    'vision-B-0': 0.3,
    'vision-R-1': 0.1,
    'vision-G-1': 0.2,
    'vision-B-1': 0.3,
  });
});

test('invalid install keeps the last successfully applied runtime summary', () => {
  const session = createSimulationSession();

  session.initialize();
  const appliedSummary = session.getAgentRuntimeStatus().appliedSummary;
  const invalidAgent = {
    ...session.getCurrentAgentIR(),
    body: {
      ...session.getCurrentAgentIR().body,
      outputRules: session.getCurrentAgentIR().body.outputRules.map((rule) => ({
        ...rule,
        targetTemplate: 'thruster.$1',
      })),
    },
  };

  const runtimeStatus = session.setAgentIR(invalidAgent);

  assert.equal(runtimeStatus.state, 'invalid');
  assert.deepEqual(runtimeStatus.appliedSummary, appliedSummary);
});
