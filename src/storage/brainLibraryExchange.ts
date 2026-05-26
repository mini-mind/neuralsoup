import type { AgentIR, AgentMetadata, WorldRegistry } from '../domain/brain';
import {
  createBrainLibraryItemFromAgent,
  isValidBrainLibraryAgentPayload,
  type BrainLibraryRecord,
} from './brainLibraryRecord';

export interface BrainLibraryExchangeDocument {
  version: 2;
  kind: 'neuralsoup-agent';
  agent: AgentIR;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowedKeys.includes(key));

export const isBrainLibraryExchangeDocument = (value: unknown): value is BrainLibraryExchangeDocument =>
  isObject(value) &&
  hasOnlyKeys(value, ['version', 'kind', 'agent']) &&
  value.version === 2 &&
  value.kind === 'neuralsoup-agent' &&
  isObject((value as { agent?: unknown }).agent);

export const isBrainLibraryExchangeDocumentWithRegistry = (
  value: unknown,
  worldRegistry: WorldRegistry
): value is BrainLibraryExchangeDocument =>
  isBrainLibraryExchangeDocument(value) &&
  isValidBrainLibraryAgentPayload((value as { agent?: unknown }).agent, worldRegistry);

export const encodeBrainLibraryRecordForExchange = (
  record: BrainLibraryRecord
): BrainLibraryExchangeDocument => {
  return {
    version: 2,
    kind: 'neuralsoup-agent',
    agent: record.agent,
  };
};

const createImportedRecord = (
  agent: AgentIR,
  worldRegistry: WorldRegistry,
  options?: {
    name?: string;
    existingIds?: Iterable<string>;
  }
): BrainLibraryRecord => {
  const trimmedName = options?.name?.trim();
  const existingIds = new Set(options?.existingIds ?? []);
  const nextId = existingIds.has(agent.metadata.id)
    ? createBrainLibraryItemFromAgent(trimmedName || agent.metadata.name, agent, worldRegistry).agent.metadata.id
    : agent.metadata.id;
  const nextMetadata: AgentMetadata = {
    ...agent.metadata,
    id: nextId,
    name: trimmedName || agent.metadata.name,
  };

  const created = createBrainLibraryItemFromAgent(nextMetadata.name, agent, worldRegistry);
  return {
    agent: {
      ...created.agent,
      metadata: nextMetadata,
    },
  };
};

export const normalizeImportedBrainExchange = (
  candidate: unknown,
  worldRegistry: WorldRegistry,
  options?: {
    name?: string;
    existingIds?: Iterable<string>;
  }
): BrainLibraryRecord | null => {
  if (!isBrainLibraryExchangeDocumentWithRegistry(candidate, worldRegistry)) {
    return null;
  }

  return createImportedRecord(candidate.agent, worldRegistry, options);
};
