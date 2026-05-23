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

  const world = session.getWorldSnapshot();
  const steppedMainAgent = world.agents.find((agent) => agent.id === mainAgent.id);
  assert.ok(steppedMainAgent);
  assert.equal(Math.abs(Math.hypot(steppedMainAgent.velocity.x, steppedMainAgent.velocity.y) - 60) < 1e-9, true);

  for (const agent of world.agents) {
    if (agent.id === mainAgent.id) {
      continue;
    }

    const speed = Math.hypot(agent.velocity.x, agent.velocity.y);
    assert.equal(Math.abs(speed - 40) < 1e-9, true);
  }
}
