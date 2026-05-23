import type { AgentIR, AgentMetadata } from '../domain/brain';
import type { AgentPackage as AgentLibraryItem } from './legacyBrainPackage';
import {
  createBrainLibraryItemFromAgent,
  isAgentMetadata,
  isValidBrainLibraryAgentPayload,
  normalizeCanonicalBrainLibraryRecord,
  type BrainLibraryRecord,
} from '../storage/brainLibraryRecord';

export interface LegacyBrainLibraryStorageEnvelope {
  storageVersion: 1;
  savedAt: string;
  brains: AgentLibraryItem[];
}

type LegacyAgentPackageLike = {
  packageVersion?: unknown;
  metadata?: unknown;
  agent?: unknown;
};

type LegacyAgentPackageWithLegacyBody = AgentLibraryItem & {
  agent: AgentIR & {
    body: AgentIR['body'] & {
      visionCellCount?: unknown;
    };
  };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasValidOptionalTopLevelMetadata = (value: unknown): boolean => value === undefined || isAgentMetadata(value);

const getLegacyVisionCellCount = (agent: AgentIR): number | null => {
  const value = (agent as LegacyAgentPackageWithLegacyBody['agent']).body.visionCellCount;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
};

const normalizeImportedBrainLibraryRecord = (
  agent: AgentIR,
  metadataOverride?: AgentMetadata,
  options?: {
    legacyVisionCellCount?: number | null;
  }
): BrainLibraryRecord => {
  const explicitVisionCellCount =
    typeof (agent.body as AgentIR['body'] & { visionCellCount?: unknown }).visionCellCount === 'number'
      ? Math.max(0, Math.floor((agent.body as AgentIR['body'] & { visionCellCount?: number }).visionCellCount ?? 0))
      : 0;
  const structuredVisionCellCount = Math.max(
    0,
    ...agent.connections.flatMap((connection) => {
      const fromNodeId = connection.from.scope === 'bodyInput' ? connection.from.nodeId : null;
      const toNodeId = connection.to.scope === 'bodyInput' ? connection.to.nodeId : null;
      return [fromNodeId, toNodeId]
        .filter((nodeId): nodeId is string => nodeId != null)
        .map((nodeId) => {
          const match = nodeId.match(/^vision-[RGB]-(\d+)$/);
          return match ? Number.parseInt(match[1] ?? '-1', 10) + 1 : 0;
        });
    })
  );
  const effectiveVisionCellCount = Math.max(
    explicitVisionCellCount,
    structuredVisionCellCount,
    options?.legacyVisionCellCount != null ? Math.max(0, Math.floor(options.legacyVisionCellCount)) : 0
  );
  const nextAgent = {
    ...agent,
    body: {
      ...agent.body,
      visionCellCount: effectiveVisionCellCount,
    },
  };

  return normalizeCanonicalBrainLibraryRecord(nextAgent, metadataOverride);
};

const isValidLegacyAgentPayload = (agent: unknown): agent is AgentIR => {
  if (!isObject(agent)) {
    return false;
  }

  const candidateBody = (agent as { body?: unknown }).body;
  if (!isObject(candidateBody)) {
    return false;
  }

  const candidateVisionCellCount = candidateBody.visionCellCount;
  if (candidateVisionCellCount === undefined) {
    return isValidBrainLibraryAgentPayload({
      ...(agent as Record<string, unknown>),
      body: {
        ...candidateBody,
        visionCellCount: 0,
      },
    });
  }

  return isValidBrainLibraryAgentPayload(agent);
};

export const isLegacyAgentPackage = (value: unknown): value is AgentLibraryItem =>
  isObject(value) &&
  value.packageVersion === 1 &&
  hasValidOptionalTopLevelMetadata((value as LegacyAgentPackageLike).metadata) &&
  isValidLegacyAgentPayload((value as LegacyAgentPackageLike).agent);

export const encodeBrainLibraryRecordAsLegacyAgentPackage = (
  record: BrainLibraryRecord
): AgentLibraryItem => {
  const normalized = normalizeCanonicalBrainLibraryRecord(record.agent, {
    ...record.agent.metadata,
  });

  return {
    packageVersion: 1,
    metadata: { ...normalized.agent.metadata },
    agent: normalized.agent,
  };
};

const normalizeLegacyAgentPackageMetadata = (candidate: AgentLibraryItem): AgentLibraryItem =>
  encodeBrainLibraryRecordAsLegacyAgentPackage(
    normalizeCanonicalBrainLibraryRecord(candidate.agent, {
      ...candidate.agent.metadata,
    })
  );

export const normalizeImportedLegacyBrainExchange = (
  candidate: unknown,
  options?: {
    name?: string;
    existingIds?: Iterable<string>;
  }
): BrainLibraryRecord | null => {
  if (!isLegacyAgentPackage(candidate)) {
    return null;
  }

  const normalizedRecord = normalizeImportedBrainLibraryRecord(candidate.agent, undefined, {
    legacyVisionCellCount: getLegacyVisionCellCount(candidate.agent),
  });
  const canonicalAgent = normalizeLegacyAgentPackageMetadata({
    ...candidate,
    metadata: normalizedRecord.agent.metadata,
    agent: normalizedRecord.agent,
  }).agent;
  const trimmedName = options?.name?.trim();
  const existingIds = new Set(options?.existingIds ?? []);
  const nextId = existingIds.has(canonicalAgent.metadata.id)
    ? createBrainLibraryItemFromAgent(trimmedName || canonicalAgent.metadata.name, canonicalAgent).agent.metadata.id
    : canonicalAgent.metadata.id;
  const nextMetadata: AgentMetadata = {
    ...canonicalAgent.metadata,
    id: nextId,
    name: trimmedName || canonicalAgent.metadata.name,
  };

  return normalizeCanonicalBrainLibraryRecord(canonicalAgent, nextMetadata);
};

export const isLegacyBrainLibraryStorageEnvelope = (
  value: unknown
): value is LegacyBrainLibraryStorageEnvelope =>
  isObject(value) &&
  value.storageVersion === 1 &&
  typeof value.savedAt === 'string' &&
  Array.isArray(value.brains) &&
  value.brains.every(isLegacyAgentPackage);

export const loadLegacyBrainLibraryStorageEnvelope = (value: unknown): BrainLibraryRecord[] | null => {
  if (!isLegacyBrainLibraryStorageEnvelope(value)) {
    return null;
  }

  return value.brains
    .map((brain) => normalizeImportedLegacyBrainExchange(brain))
    .filter((brain): brain is BrainLibraryRecord => brain !== null);
};
