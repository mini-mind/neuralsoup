import type { Agent, Food, NeuralState, Obstacle, SimulationState, SimulationStats } from '../../types/simulation';
import type { WorldConfig } from './config';

export interface WorldBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldState {
  config: WorldConfig;
  worldBounds: WorldBounds;
  agents: Agent[];
  foods: Food[];
  obstacles: Obstacle[];
  stats: SimulationStats;
}

const DEFAULT_NEURAL_STATE: NeuralState = {
  motivation: 0,
  stress: 0,
  homeostasis: 0.5
};

export function createInitialWorldStats(): SimulationStats {
  return {
    totalRewards: 0,
    totalCollisions: 0,
    averageNeuralState: { ...DEFAULT_NEURAL_STATE }
  };
}

export function createEmptyWorldState(config: WorldConfig, worldBounds: WorldBounds): WorldState {
  return {
    config,
    worldBounds: { ...worldBounds },
    agents: [],
    foods: [],
    obstacles: [],
    stats: createInitialWorldStats()
  };
}

export function aggregateAverageNeuralState(agents: Agent[]): NeuralState {
  if (agents.length === 0) {
    return { ...DEFAULT_NEURAL_STATE };
  }

  let totalMotivation = 0;
  let totalStress = 0;
  let totalHomeostasis = 0;

  for (const agent of agents) {
    totalMotivation += agent.motivation;
    totalStress += agent.stress;
    totalHomeostasis += agent.homeostasis;
  }

  return {
    motivation: totalMotivation / agents.length,
    stress: totalStress / agents.length,
    homeostasis: totalHomeostasis / agents.length
  };
}

export function buildStatsSnapshot(
  state: Pick<WorldState, 'agents' | 'stats'>,
  fps: number
): SimulationState['stats'] {
  return {
    fps,
    totalReward: state.stats.totalRewards,
    collisionCount: state.stats.totalCollisions,
    neuralState: aggregateAverageNeuralState(state.agents)
  };
}
