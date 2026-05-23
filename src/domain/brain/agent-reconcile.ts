import { resolveBodyInputVisionCellIndex, type AgentConnection, type AgentIR, type BodyInputRule } from './agent-ir';
import type { WorldRegistry } from './world-registry';

const LEGACY_VISION_LAYOUT_MARKER_PATTERN = /^__body-vision-cell-(\d+)$/;
const LEGACY_VISION_SIGNAL_PATTERN = /^vision-[RGB]-(\d+)$/;

const reconcileConnectionsForVisionCells = (
  connections: AgentConnection[],
  visionCells: number,
  inputRules: BodyInputRule[],
  registry: WorldRegistry
): AgentConnection[] => {
  const referencedInputNodeIds = new Set<string>();
  for (const connection of connections) {
    if (connection.from.scope === 'bodyInput') {
      referencedInputNodeIds.add(connection.from.nodeId);
    }
    if (connection.to.scope === 'bodyInput') {
      referencedInputNodeIds.add(connection.to.nodeId);
    }
  }

  return connections.filter((connection) => {
    const fromCellIndex =
      connection.from.scope === 'bodyInput'
        ? resolveBodyInputVisionCellIndex(connection.from.nodeId, inputRules, registry)
        : null;
    if (fromCellIndex != null && fromCellIndex >= visionCells) {
      return false;
    }

    const toCellIndex =
      connection.to.scope === 'bodyInput'
        ? resolveBodyInputVisionCellIndex(connection.to.nodeId, inputRules, registry)
        : null;
    if (toCellIndex != null && toCellIndex >= visionCells) {
      return false;
    }

    return true;
  });
};

export const reconcileAgentIRVisionCells = (
  agent: AgentIR,
  visionCells: number,
  registry: WorldRegistry
): AgentIR =>
  ({
    ...agent,
    connections: reconcileConnectionsForVisionCells(agent.connections, visionCells, agent.body.inputRules, registry),
    layout: agent.layout
      ? {
          ...agent.layout,
          nodes: Object.fromEntries(
            Object.entries(agent.layout.nodes).filter(([nodeId]) => {
              const markerMatch = nodeId.match(LEGACY_VISION_LAYOUT_MARKER_PATTERN);
              if (markerMatch) {
                return Number.parseInt(markerMatch[1] ?? '-1', 10) < visionCells;
              }

              const signalMatch = nodeId.match(LEGACY_VISION_SIGNAL_PATTERN);
              if (signalMatch) {
                return Number.parseInt(signalMatch[1] ?? '-1', 10) < visionCells;
              }

              return true;
            })
          ),
        }
      : agent.layout,
  });
