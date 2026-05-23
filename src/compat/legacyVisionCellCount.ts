import { createVisionActionWorldRegistry } from '../host';
import type { AgentIR } from '../domain/brain/agent-ir';
import { resolveBodyInputVisionCellIndex } from '../domain/brain/agent-ir';

const VISION_LAYOUT_MARKER_PATTERN = /^__body-vision-cell-(\d+)$/;
const VISION_LAYOUT_NODE_PATTERN = /^vision-[RGB]-(\d+)$/;
const DEFAULT_WORLD_REGISTRY = createVisionActionWorldRegistry();

type LegacyBodyIR = AgentIR['body'] & {
  visionCellCount?: unknown;
};

const normalizeVisionCellCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.max(0, Math.floor(value))
    : null;

const deriveLegacyAgentIRVisionCellCount = (agent: AgentIR): number => {
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
    if (match) {
      maxCellIndex = Math.max(maxCellIndex, Number.parseInt(match[1], 10));
      continue;
    }

    const signalMatch = nodeId.match(VISION_LAYOUT_NODE_PATTERN);
    if (signalMatch) {
      maxCellIndex = Math.max(maxCellIndex, Number.parseInt(signalMatch[1], 10));
    }
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
  Math.max(
    deriveLegacyAgentIRVisionCellCount(agent),
    normalizeVisionCellCount((agent.body as LegacyBodyIR).visionCellCount) ?? 0
  );

export const withDerivedBodyVisionCellCount = (agent: AgentIR): AgentIR => {
  const derivedVisionCellCount = deriveLegacyAgentIRVisionCellCount(agent);
  return {
    ...agent,
    body: {
      ...agent.body,
      ...(derivedVisionCellCount > 0 ? { visionCellCount: derivedVisionCellCount } : {}),
    } as AgentIR['body'],
  };
};

export const withVisionCellLayoutMarkers = (agent: AgentIR, visionCellCount: number): AgentIR => {
  const normalizedVisionCellCount = Math.max(0, Math.floor(visionCellCount));
  const nextNodes = { ...(agent.layout?.nodes ?? {}) };

  for (let cellIndex = 0; cellIndex < normalizedVisionCellCount; cellIndex += 1) {
    const markerId = createVisionCellLayoutMarkerId(cellIndex);
    if (!nextNodes[markerId]) {
      nextNodes[markerId] = {};
    }
  }

  return {
    ...agent,
    layout: {
      version: 1,
      nodes: nextNodes,
    },
  };
};
