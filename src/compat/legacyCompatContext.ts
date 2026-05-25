import type { WorldRegistry } from '../domain/brain';

export interface LegacyCompatContext {
  worldRegistry: WorldRegistry;
}

export const createLegacyCompatContext = (
  worldRegistry: WorldRegistry
): LegacyCompatContext => ({
  worldRegistry,
});
