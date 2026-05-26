import { resolveBodyInputVisionCellIndex, type AgentConnection, type AgentIR, type BodyIR } from './agent-ir';
import type { WorldRegistry } from './world-registry';

const LEGACY_VISION_LAYOUT_MARKER_PATTERN = /^__body-vision-cell-(\d+)$/;
const LEGACY_VISION_SIGNAL_PATTERN = /^vision-[RGB]-(\d+)$/;

const reconcileConnectionsForVisionCells = (
  connections: AgentConnection[],
  visionCells: number,
  body: BodyIR
): AgentConnection[] => {
  return connections.filter((connection) => {
    const fromCellIndex =
      connection.from.scope === 'bodyInput'
        ? resolveBodyInputVisionCellIndex(connection.from.nodeId, body)
        : null;
    if (fromCellIndex != null && fromCellIndex >= visionCells) {
      return false;
    }

    const toCellIndex =
      connection.to.scope === 'bodyInput'
        ? resolveBodyInputVisionCellIndex(connection.to.nodeId, body)
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
  _registry: WorldRegistry
): AgentIR =>
  ({
    ...agent,
    connections: reconcileConnectionsForVisionCells(agent.connections, visionCells, agent.body),
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
