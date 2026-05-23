import { Agent } from '../types/simulation';
import type { KeyboardInputState } from './AgentController';
import {
  createBrainProgramRuntimeState,
  stepBrainProgram,
  type BrainProgramRuntimeState,
} from '../domain/brain/step';
import type { BrainProgram } from '../domain/brain/program';

const applyLegacyAction = (agent: Agent, output: number[], deltaTime: number): void => {
  const [turnLeft, moveForward, turnRight] = output;

  const turnSpeed = 3.0;
  const turnThreshold = 0.3;
  if (turnLeft > turnThreshold) {
    agent.angle -= turnSpeed * turnLeft * deltaTime;
  }
  if (turnRight > turnThreshold) {
    agent.angle += turnSpeed * turnRight * deltaTime;
  }

  const maxSpeed = 60;
  const moveThreshold = 0.2;
  if (moveForward > moveThreshold) {
    const speed = maxSpeed * moveForward;
    agent.velocity.x = Math.cos(agent.angle) * speed;
    agent.velocity.y = Math.sin(agent.angle) * speed;
    return;
  }

  agent.velocity.x = 0;
  agent.velocity.y = 0;
};

const getKeyboardInputs = (inputState: KeyboardInputState): [number, number, number] => {
  let turnLeft = inputState.turnLeft ? 1.0 : 0;
  let moveForward = inputState.moveForward ? 1.0 : 0;
  let turnRight = inputState.turnRight ? 1.0 : 0;

  if (turnLeft > 0 && turnRight > 0) {
    turnLeft = 0;
    turnRight = 0;
  }

  return [turnLeft, moveForward, turnRight];
};

export interface LegacyBrainController {
  program: BrainProgram;
  runtimeState: BrainProgramRuntimeState;
}

export const createLegacyBrainController = (program: BrainProgram): LegacyBrainController => ({
  program,
  runtimeState: createBrainProgramRuntimeState(program),
});

export const updateLegacyBrainAgent = (
  controller: LegacyBrainController,
  agent: Agent,
  deltaTime: number,
  keyboardInputState: KeyboardInputState
): void => {
  const keyboardInputs = getKeyboardInputs(keyboardInputState);
  const hasKeyboardInput = keyboardInputs[0] > 0 || keyboardInputs[1] > 0 || keyboardInputs[2] > 0;

  if (hasKeyboardInput) {
    applyLegacyAction(agent, keyboardInputs, deltaTime);
    return;
  }

  const result = stepBrainProgram(
    controller.program,
    agent.visualInput,
    controller.runtimeState,
    deltaTime,
    Date.now()
  );
  controller.runtimeState = result.runtimeState;
  applyLegacyAction(
    agent,
    [
      result.outputs['turn-left'],
      result.outputs['move-forward'],
      result.outputs['turn-right'],
    ],
    deltaTime
  );
};
