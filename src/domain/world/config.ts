export type SimulationControlMode = 'snn' | 'random' | 'keyboard';

export interface WorldConfig {
  width: number;
  height: number;
  mainAgentId: number;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  width: 1600,
  height: 1200,
  mainAgentId: 0
};

export function createWorldConfig(config: Partial<WorldConfig> = {}): WorldConfig {
  return {
    width: config.width ?? DEFAULT_WORLD_CONFIG.width,
    height: config.height ?? DEFAULT_WORLD_CONFIG.height,
    mainAgentId: config.mainAgentId ?? DEFAULT_WORLD_CONFIG.mainAgentId
  };
}
