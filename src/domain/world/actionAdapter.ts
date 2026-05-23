export interface WorldOutputSignal {
  id: string;
  target: string;
  normalizedTarget: string;
  worldPort: string;
  value: number;
}

export interface WorldControlCommand {
  kind: string;
  value: number;
}

export interface WorldActionOutputAdapter {
  resolve(outputSignals: WorldOutputSignal[]): WorldControlCommand[];
}

const ACTION_TARGET_TO_COMMAND_KIND: Record<string, string> = {
  'action.turn-left': 'turn-left',
  'action.move-forward': 'move-forward',
  'action.turn-right': 'turn-right',
};

export const createDefaultWorldActionOutputAdapter = (): WorldActionOutputAdapter => ({
  resolve(outputSignals) {
    const commandsByKind = new Map<string, number>();

    for (const signal of outputSignals) {
      if (signal.worldPort !== 'action') {
        continue;
      }

      const commandKind = ACTION_TARGET_TO_COMMAND_KIND[signal.normalizedTarget];
      if (!commandKind) {
        continue;
      }

      commandsByKind.set(commandKind, signal.value);
    }

    return [...commandsByKind.entries()].map(([kind, value]) => ({ kind, value }));
  },
});
