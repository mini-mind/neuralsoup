import type { AgentIR, AgentMetadata } from '../domain/brain';
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

export const isBrainLibraryExchangeDocument = (value: unknown): value is BrainLibraryExchangeDocument =>
  isObject(value) &&
  value.version === 1 &&
  value.kind === 'neuralsoup-agent' &&
  isValidBrainLibraryAgentPayload((value as { agent?: unknown }).agent);

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
  options?: {
    name?: string;
    existingIds?: Iterable<string>;
  }
): BrainLibraryRecord => {
  const trimmedName = options?.name?.trim();
  const existingIds = new Set(options?.existingIds ?? []);
  const nextId = existingIds.has(agent.metadata.id)
    ? createBrainLibraryItemFromAgent(trimmedName || agent.metadata.name, agent).agent.metadata.id
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
  options?: {
    name?: string;
    existingIds?: Iterable<string>;
  }
): BrainLibraryRecord | null => {
  if (!isBrainLibraryExchangeDocument(candidate)) {
    return null;
  }

  return createImportedRecord(candidate.agent, options);
};
