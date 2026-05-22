import type { AgentConnection, AgentIR, BodyInputRule, BodyOutputRule } from './agent-ir';

const INPUT_NODE_PATTERN = /^vision-[RGB]-\d+$/;

const parseVisionInputCellIndex = (nodeId: string): number | null => {
  const match = nodeId.match(/^vision-[RGB]-(\d+)$/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
};

const createVisionInputRule = (existingRule?: BodyInputRule): BodyInputRule => ({
  id: existingRule?.id ?? 'legacy-vision-inputs',
  nodeIdPattern: '^vision-([RGB])-(\\d+)$',
  sourceTemplate: existingRule?.sourceTemplate ?? 'vision.$1.$2',
  scale: existingRule?.scale ?? 1,
});

const createMotorOutputRule = (existingRule?: BodyOutputRule): BodyOutputRule => ({
  id: existingRule?.id ?? 'legacy-motor-outputs',
  nodeIdPattern: '^output-(turn-left|move-forward|turn-right)$',
  targetTemplate: existingRule?.targetTemplate ?? 'action.$1',
  decayPerSecond: existingRule?.decayPerSecond ?? 4,
});

const reconcileConnectionsForVisionCells = (
  connections: AgentConnection[],
  visionCells: number
): AgentConnection[] =>
  connections.filter((connection) => {
    if (connection.from.scope === 'bodyInput') {
      const cellIndex = parseVisionInputCellIndex(connection.from.nodeId);
      if (cellIndex != null && cellIndex >= visionCells) {
        return false;
      }
    }

    if (connection.to.scope === 'bodyInput') {
      const cellIndex = parseVisionInputCellIndex(connection.to.nodeId);
      if (cellIndex != null && cellIndex >= visionCells) {
        return false;
      }
    }

    return true;
  });

export const reconcileAgentIRVisionCells = (
  agent: AgentIR,
  visionCells: number
): AgentIR => {
  const nextInputRules = agent.connections.some(
    (connection) =>
      (connection.from.scope === 'bodyInput' && INPUT_NODE_PATTERN.test(connection.from.nodeId)) ||
      (connection.to.scope === 'bodyInput' && INPUT_NODE_PATTERN.test(connection.to.nodeId))
  )
    ? [createVisionInputRule(agent.body.inputRules[0])]
    : agent.body.inputRules;

  const nextOutputRules =
    agent.body.outputRules.length > 0
      ? [createMotorOutputRule(agent.body.outputRules[0]), ...agent.body.outputRules.slice(1)]
      : [];

  return {
    ...agent,
    body: {
      ...agent.body,
      visionCellCount: visionCells,
      inputRules: nextInputRules,
      outputRules: nextOutputRules,
    },
    connections: reconcileConnectionsForVisionCells(agent.connections, visionCells),
  };
};
