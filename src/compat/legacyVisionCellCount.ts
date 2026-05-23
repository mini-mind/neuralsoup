import { createDefaultWorldRegistry } from '../domain/brain';
import type { AgentIR } from '../domain/brain/agent-ir';
import { resolveBodyInputVisionCellIndex, withVisionCellCount } from '../domain/brain/agent-ir';

const VISION_LAYOUT_MARKER_PATTERN = /^__body-vision-cell-(\d+)$/;
const DEFAULT_WORLD_REGISTRY = createDefaultWorldRegistry();

type LegacyBodyIR = AgentIR['body'] & {
  visionCellCount?: unknown;
};

const normalizeVisionCellCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.max(0, Math.floor(value))
    : null;

const deriveLegacyAgentIRVisionCellCount = (agent: AgentIR): number => {
  const canonicalVisionCellCount = normalizeVisionCellCount((agent.body as LegacyBodyIR).visionCellCount);
  if (canonicalVisionCellCount != null) {
    return canonicalVisionCellCount;
  }

  let maxCellIndex = -1;

  for (const connection of agent.connections) {
    if (connection.from.scope === 'bodyInput') {
      const cellIndex = resolveBodyInputVisionCellIndex(
        connection.from.nodeId,
        agent.body.inputRules,
        DEFAULT_WORLD_REGISTRY
      );
      if (cellIndex != null) {
        maxCellIndex = Math.max(maxCellIndex, cellIndex);
      }
    }

    if (connection.to.scope === 'bodyInput') {
      const cellIndex = resolveBodyInputVisionCellIndex(
        connection.to.nodeId,
        agent.body.inputRules,
        DEFAULT_WORLD_REGISTRY
      );
      if (cellIndex != null) {
        maxCellIndex = Math.max(maxCellIndex, cellIndex);
      }
    }
  }

  for (const nodeId of Object.keys(agent.layout?.nodes ?? {})) {
    const match = nodeId.match(VISION_LAYOUT_MARKER_PATTERN);
    if (!match) {
      continue;
    }
    maxCellIndex = Math.max(maxCellIndex, Number.parseInt(match[1], 10));
  }

  return maxCellIndex + 1;
};

export const createVisionCellLayoutMarkerId = (cellIndex: number): string => `__body-vision-cell-${cellIndex}`;

export const parseVisionCellLayoutMarkerIndex = (nodeId: string): number | null => {
  const match = nodeId.match(VISION_LAYOUT_MARKER_PATTERN);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
};

export const deriveAgentIRVisionCellCount = (agent: AgentIR): number =>
  normalizeVisionCellCount((agent.body as LegacyBodyIR).visionCellCount) ?? deriveLegacyAgentIRVisionCellCount(agent);

export const withDerivedBodyVisionCellCount = (agent: AgentIR): AgentIR => {
  return {
    ...agent,
    body: {
      ...agent.body,
      visionCellCount: deriveLegacyAgentIRVisionCellCount(agent),
    },
  };
};

export const withVisionCellLayoutMarkers = (agent: AgentIR, visionCellCount: number): AgentIR =>
  withVisionCellCount(agent, visionCellCount);
