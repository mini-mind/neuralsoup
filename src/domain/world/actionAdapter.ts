export type WorldActionVector = [number, number, number];
export interface WorldOutputSignal {
  id: string;
  target: string;
  normalizedTarget: string;
  worldPort: string;
  value: number;
}

export interface WorldActionOutputAdapter {
  resolve(outputSignals: WorldOutputSignal[]): WorldActionVector;
}

const ACTION_TARGET_TO_INDEX = {
  'action.turn-left': 0,
  'action.move-forward': 1,
  'action.turn-right': 2,
} as const satisfies Record<string, 0 | 1 | 2>;

type SupportedActionTarget = keyof typeof ACTION_TARGET_TO_INDEX;

const isSupportedActionTarget = (target: string): target is SupportedActionTarget =>
  target in ACTION_TARGET_TO_INDEX;

export const createDefaultWorldActionOutputAdapter = (): WorldActionOutputAdapter => ({
  resolve(outputSignals) {
    const actionVector: WorldActionVector = [0, 0, 0];

    for (const signal of outputSignals) {
      if (signal.worldPort !== 'action') {
        continue;
      }

      const target = signal.normalizedTarget;
      if (!isSupportedActionTarget(target)) {
        continue;
      }

      const actionIndex = ACTION_TARGET_TO_INDEX[target];
      actionVector[actionIndex] = signal.value;
    }

    return actionVector;
  },
});
