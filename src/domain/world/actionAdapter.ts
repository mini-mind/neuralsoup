import type { MovementWorldControlBindings } from './runtimeAdapter';

export interface WorldOutputSignal {
  id: string;
  target: string;
  normalizedTarget: string;
  worldPort: string;
  commandKind: string;
  value: number;
}

export interface WorldControlCommand {
  kind: string;
  value: number;
}

export interface WorldActionOutputAdapter {
  resolve(outputSignals: WorldOutputSignal[]): WorldControlCommand[];
}

const createSupportedActionKinds = (bindings: MovementWorldControlBindings): Set<string> =>
  new Set(Object.values(bindings));

export const createDefaultWorldActionOutputAdapter = (
  bindings: MovementWorldControlBindings
): WorldActionOutputAdapter => {
  const supportedActionKinds = createSupportedActionKinds(bindings);

  return {
    resolve(outputSignals) {
      const commandsByKind = new Map<string, number>();

      for (const signal of outputSignals) {
        if (signal.worldPort !== 'action') {
          continue;
        }

        if (!supportedActionKinds.has(signal.commandKind)) {
          continue;
        }

        commandsByKind.set(signal.commandKind, signal.value);
      }

      return [...commandsByKind.entries()].map(([kind, value]) => ({ kind, value }));
    },
  };
};
