import type { AgentConnection, AgentIR, BodyInputRule } from './agent-ir';

const BODY_INPUT_SOURCE_PATTERN = /^vision\.[RGB]\.(\d+)$/;

const parseVisionInputCellIndex = (nodeId: string): number | null => {
  const match = nodeId.match(/^vision-[RGB]-(\d+)$/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
};

const applyRuleTemplate = (template: string, match: RegExpExecArray): string =>
  template.replace(/\$(\d+)/g, (_token, rawGroupIndex: string) => {
    const groupIndex = Number.parseInt(rawGroupIndex, 10);
    return match[groupIndex] ?? '';
  });

const resolveBodyInputCellIndex = (nodeId: string, rules: BodyInputRule[]): number | null => {
  const legacyCellIndex = parseVisionInputCellIndex(nodeId);
  if (legacyCellIndex != null) {
    return legacyCellIndex;
  }

  const matches = rules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

  if (matches.length !== 1) {
    return null;
  }

  const source = applyRuleTemplate(matches[0].rule.sourceTemplate, matches[0].match);
  const sourceMatch = source.match(BODY_INPUT_SOURCE_PATTERN);
  return sourceMatch ? Number.parseInt(sourceMatch[1], 10) : null;
};

const reconcileConnectionsForVisionCells = (
  connections: AgentConnection[],
  visionCells: number,
  inputRules: BodyInputRule[]
): AgentConnection[] =>
  connections.filter((connection) => {
    if (connection.from.scope === 'bodyInput') {
      const cellIndex = resolveBodyInputCellIndex(connection.from.nodeId, inputRules);
      if (cellIndex != null && cellIndex >= visionCells) {
        return false;
      }
    }

    if (connection.to.scope === 'bodyInput') {
      const cellIndex = resolveBodyInputCellIndex(connection.to.nodeId, inputRules);
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
  return {
    ...agent,
    body: {
      ...agent.body,
      visionCellCount: visionCells,
    },
    connections: reconcileConnectionsForVisionCells(agent.connections, visionCells, agent.body.inputRules),
  };
};
