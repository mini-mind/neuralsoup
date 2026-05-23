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

const ACTION_TARGET_PATTERN = /^action\.([a-z0-9-]+)$/;

export const createDefaultWorldActionOutputAdapter = (): WorldActionOutputAdapter => ({
  resolve(outputSignals) {
    const commandsByKind = new Map<string, number>();

    for (const signal of outputSignals) {
      if (signal.worldPort !== 'action') {
        continue;
      }

      const commandMatch = signal.normalizedTarget.match(ACTION_TARGET_PATTERN);
      if (!commandMatch) {
        continue;
      }

      commandsByKind.set(commandMatch[1], signal.value);
    }

    return [...commandsByKind.entries()].map(([kind, value]) => ({ kind, value }));
  },
});
