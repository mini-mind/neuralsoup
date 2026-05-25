import type { WorldInputSignalProvider } from '../domain/world';
import type { AgentWorldInputSignalMap } from '../domain/brain';
import type { Agent } from '../types/simulation';

type LegacyVisualInputAgent = Agent & {
  visualInput?: number[];
};

export const createLegacyVisualInputSignalProvider = (): WorldInputSignalProvider => ({
  resolve(agent) {
    const sensoryInputs: AgentWorldInputSignalMap = {};
    const visualInput = (agent as LegacyVisualInputAgent).visualInput ?? [];
    const visualCellCount = Math.floor(visualInput.length / 3);

    for (let cellIndex = 0; cellIndex < visualCellCount; cellIndex += 1) {
      const baseIndex = cellIndex * 3;
      sensoryInputs[`vision-R-${cellIndex}`] = visualInput[baseIndex] ?? 0;
      sensoryInputs[`vision-G-${cellIndex}`] = visualInput[baseIndex + 1] ?? 0;
      sensoryInputs[`vision-B-${cellIndex}`] = visualInput[baseIndex + 2] ?? 0;
    }

    return sensoryInputs;
  },
});
