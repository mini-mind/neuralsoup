import type { Agent, Food, Obstacle, SimulationState, World } from '../../types/simulation';
import type { WorldState } from './state';
import { buildStatsSnapshot } from './state';

function cloneAgent(agent: Agent): Agent {
  const { visualInput: _visualInput, ...agentWithoutCompatVisualInput } = agent;
  return {
    ...agentWithoutCompatVisualInput,
    velocity: { ...agent.velocity },
    visionCells: agent.visionCells.map((cell) => ({
      ...cell,
      color: { ...cell.color }
    })),
  };
}

function cloneFood(food: Food): Food {
  return { ...food };
}

function cloneObstacle(obstacle: Obstacle): Obstacle {
  return { ...obstacle };
}

export function createWorldSnapshot(
  state: WorldState,
  vision: { range: number; angle: number }
): World {
  return {
    width: state.config.width,
    height: state.config.height,
    mainAgentId: state.config.mainAgentId,
    agents: state.agents.map(cloneAgent),
    foods: state.foods.map(cloneFood),
    obstacles: state.obstacles.map(cloneObstacle),
    visionRange: vision.range,
    visionAngle: vision.angle
  };
}

export function createSimulationStateSnapshot(state: WorldState, fps: number): SimulationState {
  return {
    agents: state.agents.map(cloneAgent),
    foods: state.foods.map(cloneFood),
    obstacles: state.obstacles.map(cloneObstacle),
    worldBounds: { ...state.worldBounds },
    stats: buildStatsSnapshot(state, fps)
  };
}
