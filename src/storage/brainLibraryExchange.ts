import type { AgentLibraryItem } from '../domain/brain';
import type { AgentIR, AgentMetadata } from '../domain/brain';
import {
  createBrainLibraryItemFromAgent,
  isAgentMetadata,
  isValidBrainLibraryAgentPayload,
  normalizeCanonicalBrainLibraryRecord,
  normalizeImportedBrainLibraryRecord,
  type BrainLibraryRecord,
} from './brainLibraryRecord';

export interface BrainLibraryExchangeDocument {
  version: 1;
  kind: 'neuralsoup-agent';
  agent: AgentIR;
}

type LegacyAgentPackage = AgentLibraryItem;

type LegacyAgentPackageLike = {
  packageVersion?: unknown;
  metadata?: unknown;
  agent?: unknown;
};

type LegacyAgentPackageWithLegacyBody = LegacyAgentPackage & {
  agent: AgentIR & {
    body: AgentIR['body'] & {
      visionCellCount?: unknown;
    };
  };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasValidOptionalTopLevelMetadata = (value: unknown): boolean => value === undefined || isAgentMetadata(value);

export const isBrainLibraryExchangeDocument = (value: unknown): value is BrainLibraryExchangeDocument =>
  isObject(value) &&
  value.version === 1 &&
  value.kind === 'neuralsoup-agent' &&
  isValidBrainLibraryAgentPayload((value as { agent?: unknown }).agent);

export const isLegacyAgentPackage = (value: unknown): value is LegacyAgentPackage =>
  isObject(value) &&
  value.packageVersion === 1 &&
  hasValidOptionalTopLevelMetadata((value as LegacyAgentPackageLike).metadata) &&
  isValidBrainLibraryAgentPayload((value as LegacyAgentPackageLike).agent, { allowLegacyVisionCellCount: true });

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

export const encodeBrainLibraryRecordAsLegacyAgentPackage = (
  record: BrainLibraryRecord
): LegacyAgentPackage => {
  const normalized = normalizeCanonicalBrainLibraryRecord(record.agent, {
    ...record.agent.metadata,
  });

  return {
    packageVersion: 1,
    metadata: { ...normalized.agent.metadata },
    agent: normalized.agent,
  };
};

const normalizeLegacyAgentPackageMetadata = (candidate: LegacyAgentPackage): LegacyAgentPackage => {
  return encodeBrainLibraryRecordAsLegacyAgentPackage(
    normalizeCanonicalBrainLibraryRecord(candidate.agent, {
      ...candidate.agent.metadata,
    })
  );
};

const normalizeLegacyAgentPackage = (candidate: unknown): LegacyAgentPackage | null => {
  if (!isLegacyAgentPackage(candidate)) {
    return null;
  }

  const legacyVisionCellCount = (() => {
    const value = (candidate as LegacyAgentPackageWithLegacyBody).agent.body.visionCellCount;
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
  })();

  const normalizedRecord = normalizeImportedBrainLibraryRecord(candidate.agent, undefined, {
    legacyVisionCellCount,
  });

  return normalizeLegacyAgentPackageMetadata({
    ...candidate,
    metadata: normalizedRecord.agent.metadata,
    agent: normalizedRecord.agent,
  });
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
  if (isBrainLibraryExchangeDocument(candidate)) {
    return createImportedRecord(candidate.agent, options);
  }

  const normalizedLegacyPackage = normalizeLegacyAgentPackage(candidate);
  if (!normalizedLegacyPackage) {
    return null;
  }

  return createImportedRecord(normalizedLegacyPackage.agent, options);
};
