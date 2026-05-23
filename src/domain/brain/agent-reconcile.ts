import { withVisionCellCount, type AgentConnection, type AgentIR, type BodyInputRule } from './agent-ir';
import { resolveAgentBodyInputRuleBindings } from './agent-body-rules';
import type { WorldRegistry } from './world-registry';

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

  const inputBindings = resolveAgentBodyInputRuleBindings(registry, inputRules, referencedInputNodeIds).nodesById;

  return connections.filter((connection) => {
    const fromBinding = connection.from.scope === 'bodyInput' ? inputBindings.get(connection.from.nodeId) : null;
    if (fromBinding && Math.floor(fromBinding.visualInputIndex / 3) >= visionCells) {
      return false;
    }

    const toBinding = connection.to.scope === 'bodyInput' ? inputBindings.get(connection.to.nodeId) : null;
    if (toBinding && Math.floor(toBinding.visualInputIndex / 3) >= visionCells) {
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
  withVisionCellCount(
    {
      ...agent,
      connections: reconcileConnectionsForVisionCells(agent.connections, visionCells, agent.body.inputRules, registry),
    },
    visionCells
  );
