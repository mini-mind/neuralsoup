import {
  resolveBodyInputVisionCellIndex,
  withVisionCellCount,
  type AgentConnection,
  type AgentIR,
  type BodyInputRule,
} from './agent-ir';

const reconcileConnectionsForVisionCells = (
  connections: AgentConnection[],
  visionCells: number,
  inputRules: BodyInputRule[]
): AgentConnection[] =>
  connections.filter((connection) => {
    if (connection.from.scope === 'bodyInput') {
      const cellIndex = resolveBodyInputVisionCellIndex(connection.from.nodeId, inputRules);
      if (cellIndex != null && cellIndex >= visionCells) {
        return false;
      }
    }

    if (connection.to.scope === 'bodyInput') {
      const cellIndex = resolveBodyInputVisionCellIndex(connection.to.nodeId, inputRules);
      if (cellIndex != null && cellIndex >= visionCells) {
        return false;
      }
    }

    return true;
  });

export const reconcileAgentIRVisionCells = (
  agent: AgentIR,
  visionCells: number
): AgentIR =>
  withVisionCellCount(
    {
      ...agent,
      connections: reconcileConnectionsForVisionCells(agent.connections, visionCells, agent.body.inputRules),
    },
    visionCells
  );
