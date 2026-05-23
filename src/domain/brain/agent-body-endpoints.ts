import type { AgentIR, BodyInputRule, BodyOutputRule } from './agent-ir';
import { deriveAgentIRVisionCellCount } from './agent-ir';

const INPUT_SOURCE_TEMPLATE_PATTERN = /^vision\.\$(\d+)\.\$(\d+)$/;
const OUTPUT_TARGET_TEMPLATE_PATTERN = /^action\.\$(\d+)$/;
const OUTPUT_CHANNELS = ['turn-left', 'move-forward', 'turn-right'] as const;
const CHANNEL_VALUES = ['R', 'G', 'B'] as const;

type SupportedGroupKind = 'channel' | 'cell' | 'action';
type PatternSegment =
  | { type: 'literal'; value: string }
  | { type: 'group'; index: number; kind: SupportedGroupKind };

const appendLiteralSegment = (segments: PatternSegment[], literal: string) => {
  if (literal.length === 0) {
    return;
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment?.type === 'literal') {
    lastSegment.value += literal;
    return;
  }

  segments.push({ type: 'literal', value: literal });
};

const parseSupportedNodeIdPattern = (pattern: string): PatternSegment[] | null => {
  const anchoredPattern =
    pattern.startsWith('^') && pattern.endsWith('$') ? pattern.slice(1, -1) : pattern;
  const segments: PatternSegment[] = [];
  let cursor = 0;
  let groupIndex = 1;

  while (cursor < anchoredPattern.length) {
    const remaining = anchoredPattern.slice(cursor);

    if (remaining.startsWith('([RGB])')) {
      segments.push({ type: 'group', index: groupIndex, kind: 'channel' });
      groupIndex += 1;
      cursor += '([RGB])'.length;
      continue;
    }

    if (remaining.startsWith('(\\\\d+)') || remaining.startsWith('(\\d+)')) {
      segments.push({ type: 'group', index: groupIndex, kind: 'cell' });
      groupIndex += 1;
      cursor += remaining.startsWith('(\\\\d+)') ? '(\\\\d+)'.length : '(\\d+)'.length;
      continue;
    }

    if (remaining.startsWith('(turn-left|move-forward|turn-right)')) {
      segments.push({ type: 'group', index: groupIndex, kind: 'action' });
      groupIndex += 1;
      cursor += '(turn-left|move-forward|turn-right)'.length;
      continue;
    }

    const current = anchoredPattern[cursor];
    if (!current) {
      break;
    }

    if (current === '\\') {
      const escaped = anchoredPattern[cursor + 1];
      if (!escaped) {
        return null;
      }
      appendLiteralSegment(segments, escaped);
      cursor += 2;
      continue;
    }

    if ('[]{}+*?|()'.includes(current)) {
      return null;
    }

    appendLiteralSegment(segments, current);
    cursor += 1;
  }

  return segments;
};

const buildNodeIdFromSegments = (
  segments: PatternSegment[],
  valuesByGroupIndex: Map<number, string>
): string | null => {
  let nodeId = '';

  for (const segment of segments) {
    if (segment.type === 'literal') {
      nodeId += segment.value;
      continue;
    }

    const value = valuesByGroupIndex.get(segment.index);
    if (value == null) {
      return null;
    }
    nodeId += value;
  }

  return nodeId;
};

const enumerateInputRuleNodeIds = (rule: BodyInputRule, visionCellCount: number): string[] => {
  const templateMatch = rule.sourceTemplate.match(INPUT_SOURCE_TEMPLATE_PATTERN);
  const segments = parseSupportedNodeIdPattern(rule.nodeIdPattern);
  if (!templateMatch || !segments) {
    return [];
  }

  const channelGroupIndex = Number.parseInt(templateMatch[1], 10);
  const cellGroupIndex = Number.parseInt(templateMatch[2], 10);
  const channelGroup = segments.find(
    (segment): segment is Extract<PatternSegment, { type: 'group' }> =>
      segment.type === 'group' && segment.index === channelGroupIndex
  );
  const cellGroup = segments.find(
    (segment): segment is Extract<PatternSegment, { type: 'group' }> =>
      segment.type === 'group' && segment.index === cellGroupIndex
  );

  if (channelGroup?.kind !== 'channel' || cellGroup?.kind !== 'cell') {
    return [];
  }

  const nodeIds = new Set<string>();
  for (let cellIndex = 0; cellIndex < visionCellCount; cellIndex += 1) {
    for (const channel of CHANNEL_VALUES) {
      const nodeId = buildNodeIdFromSegments(
        segments,
        new Map([
          [channelGroupIndex, channel],
          [cellGroupIndex, String(cellIndex)],
        ])
      );
      if (nodeId) {
        nodeIds.add(nodeId);
      }
    }
  }

  return [...nodeIds];
};

const enumerateOutputRuleNodeIds = (rule: BodyOutputRule): string[] => {
  const templateMatch = rule.targetTemplate.match(OUTPUT_TARGET_TEMPLATE_PATTERN);
  const segments = parseSupportedNodeIdPattern(rule.nodeIdPattern);
  if (!templateMatch || !segments) {
    return [];
  }

  const actionGroupIndex = Number.parseInt(templateMatch[1], 10);
  const actionGroup = segments.find(
    (segment): segment is Extract<PatternSegment, { type: 'group' }> =>
      segment.type === 'group' && segment.index === actionGroupIndex
  );
  if (actionGroup?.kind !== 'action') {
    return [];
  }

  const nodeIds = new Set<string>();
  for (const channel of OUTPUT_CHANNELS) {
    const nodeId = buildNodeIdFromSegments(segments, new Map([[actionGroupIndex, channel]]));
    if (nodeId) {
      nodeIds.add(nodeId);
    }
  }

  return [...nodeIds];
};

const collectEndpointIdsFromConnections = (agent: AgentIR, scope: 'bodyInput' | 'bodyOutput'): Set<string> => {
  const endpointIds = new Set<string>();
  for (const connection of agent.connections) {
    if (connection.from.scope === scope) {
      endpointIds.add(connection.from.nodeId);
    }
    if (connection.to.scope === scope) {
      endpointIds.add(connection.to.nodeId);
    }
  }
  return endpointIds;
};

const collectEndpointIdsFromLayout = (agent: AgentIR, rules: Array<BodyInputRule | BodyOutputRule>): Set<string> => {
  const endpointIds = new Set<string>();
  const layoutNodeIds = Object.keys(agent.layout?.nodes ?? {});

  for (const rule of rules) {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.nodeIdPattern);
    } catch {
      continue;
    }

    for (const nodeId of layoutNodeIds) {
      regex.lastIndex = 0;
      if (regex.test(nodeId)) {
        endpointIds.add(nodeId);
      }
    }
  }

  return endpointIds;
};

export interface AgentBodyEndpointIds {
  bodyInputNodeIds: string[];
  bodyOutputNodeIds: string[];
}

export const resolveAgentBodyEndpointIds = (agent: AgentIR): AgentBodyEndpointIds => {
  const visionCellCount = deriveAgentIRVisionCellCount(agent);
  const bodyInputNodeIds = new Set<string>([
    ...collectEndpointIdsFromConnections(agent, 'bodyInput'),
    ...collectEndpointIdsFromLayout(agent, agent.body.inputRules),
    ...agent.body.inputRules.flatMap((rule) => enumerateInputRuleNodeIds(rule, visionCellCount)),
  ]);
  const bodyOutputNodeIds = new Set<string>([
    ...collectEndpointIdsFromConnections(agent, 'bodyOutput'),
    ...collectEndpointIdsFromLayout(agent, agent.body.outputRules),
    ...agent.body.outputRules.flatMap((rule) => enumerateOutputRuleNodeIds(rule)),
  ]);

  return {
    bodyInputNodeIds: [...bodyInputNodeIds].sort(),
    bodyOutputNodeIds: [...bodyOutputNodeIds].sort(),
  };
};
