import type { AgentIR, AgentMetadata, WorldRegistry } from '../domain/brain';
import {
  createBrainLibraryItemFromAgent,
  isValidBrainLibraryAgentPayload,
  normalizeCanonicalBrainLibraryRecord,
  type BrainLibraryRecord,
} from './brainLibraryRecord';

export interface BrainLibraryExchangeDocument {
  version: 1;
  kind: 'neuralsoup-agent';
  agent: AgentIR;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isBrainLibraryExchangeDocument = (_value: unknown): _value is BrainLibraryExchangeDocument => false;

export const isBrainLibraryExchangeDocumentWithRegistry = (
  value: unknown,
  worldRegistry: WorldRegistry
): value is BrainLibraryExchangeDocument =>
  isObject(value) &&
  value.version === 1 &&
  value.kind === 'neuralsoup-agent' &&
  isValidBrainLibraryAgentPayload((value as { agent?: unknown }).agent, worldRegistry);

export const encodeBrainLibraryRecordForExchange = (
  record: BrainLibraryRecord
): BrainLibraryExchangeDocument => {
  const normalized = normalizeCanonicalBrainLibraryRecord(record.agent, {
    ...record.agent.metadata,
  });

  return {
    version: 1,
    kind: 'neuralsoup-agent',
    agent: normalized.agent,
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

  return normalizeCanonicalBrainLibraryRecord(agent, nextMetadata);
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
