import assert from 'node:assert/strict';
import type { SimulationSession } from '../../src/runtime/SimulationSession';
import type { Agent } from '../../src/types/simulation';

export function expectMainAgent(session: SimulationSession): Agent {
  const world = session.getWorldSnapshot();
  const mainAgent = world.agents.find((agent) => agent.id === world.mainAgentId);
  assert.ok(mainAgent);
  return mainAgent;
}

export function expectMainAgentProgramInstalled(session: SimulationSession): Agent {
  const mainAgent = expectMainAgent(session);
  assert.equal(session.getAgentRuntimeStatus().state, 'applied');
  assert.ok(session.getAgentRuntimeStatus().appliedSummary.inputSignalCount > 0);
  return mainAgent;
}

export function expectKeyboardModeControlsMainAgentOnly(session: SimulationSession): void {
  const mainAgent = expectMainAgent(session);
  const controlModeByAgentId = new Map<number, 'keyboard' | 'random' | 'snn'>();
  const sessionWithController = session as unknown as {
    agentController: {
      updateAgent: (
        agent: Agent,
        deltaTime: number,
        context: {
          controlMode: 'keyboard' | 'random' | 'snn';
          keyboardInputState: {
            turnLeft: boolean;
            moveForward: boolean;
            turnRight: boolean;
          };
        }
      ) => void;
    };
  };
  const controller = sessionWithController.agentController;
  const originalUpdateAgent = controller.updateAgent.bind(controller);
  controller.updateAgent = (agent, deltaTime, context) => {
    controlModeByAgentId.set(agent.id, context.controlMode);
    originalUpdateAgent(agent, deltaTime, context);
  };

  try {
    session.setKeyboardInputState({
      turnLeft: false,
      moveForward: true,
      turnRight: false,
    });
    session.step(0.01);
    session.setKeyboardInputState({
      turnLeft: false,
      moveForward: false,
      turnRight: false,
    });
  } finally {
    controller.updateAgent = originalUpdateAgent;
  }

  const world = session.getWorldSnapshot();
  const steppedMainAgent = world.agents.find((agent) => agent.id === mainAgent.id);
  assert.ok(steppedMainAgent);
  assert.equal(Math.abs(Math.hypot(steppedMainAgent.velocity.x, steppedMainAgent.velocity.y) - 60) < 1e-9, true);
  assert.equal(controlModeByAgentId.get(mainAgent.id), 'keyboard');

  for (const agent of world.agents) {
    if (agent.id === mainAgent.id) {
      continue;
    }

    assert.equal(controlModeByAgentId.get(agent.id), 'random');
  }
}
