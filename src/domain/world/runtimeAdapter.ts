import type { Agent } from '../../types/simulation';
import type { AgentWorldInputSignalMap } from '../brain';
import type { WorldControlCommand } from './actionAdapter';

export interface WorldInputSignalProvider {
  resolve(agent: Agent): AgentWorldInputSignalMap;
}

export interface WorldControlCommandApplier {
  apply(agent: Agent, commands: WorldControlCommand[], deltaTime: number): void;
}

export interface MovementWorldControlBindings {
  turnLeft: string;
  moveForward: string;
  turnRight: string;
}

export const createVisionCellWorldInputSignalProvider = (): WorldInputSignalProvider => ({
  resolve(agent) {
    const sensoryInputs: AgentWorldInputSignalMap = {};

    for (const [cellIndex, cell] of agent.visionCells.entries()) {
      sensoryInputs[`vision-R-${cellIndex}`] = cell.color.r;
      sensoryInputs[`vision-G-${cellIndex}`] = cell.color.g;
      sensoryInputs[`vision-B-${cellIndex}`] = cell.color.b;
    }

    return sensoryInputs;
  },
});

export const createMovementWorldControlCommandApplier = (
  bindings: MovementWorldControlBindings
): WorldControlCommandApplier => ({
  apply(agent, commands, deltaTime) {
    const commandsByKind = new Map<string, number>();
    for (const command of commands) {
      commandsByKind.set(command.kind, command.value);
    }

    const turnLeft = commandsByKind.get(bindings.turnLeft) ?? 0;
    const moveForward = commandsByKind.get(bindings.moveForward) ?? 0;
    const turnRight = commandsByKind.get(bindings.turnRight) ?? 0;

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
  },
});
