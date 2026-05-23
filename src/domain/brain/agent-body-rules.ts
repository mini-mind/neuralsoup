import type {
  AgentIR,
  BodyInputNodeRuntime,
  BodyInputRule,
  BodyOutputNodeRuntime,
  BodyOutputRule,
} from './agent-ir';
import type { BrainOutputChannel } from './shared';

export type AgentBodyRuleScope = 'input' | 'output';
export type AgentBodyRuleIssueKind = 'compile-error' | 'conflict' | 'unmatched';

export interface AgentBodyRulePreviewItem {
  nodeId: string;
  resolved: string;
}

export interface AgentBodyRulePreviewGroup {
  ruleId: string;
  nodeIdPattern: string;
  template: string;
  endpoints: AgentBodyRulePreviewItem[];
}

export interface AgentBodyRuleIssueSummaryItem {
  scope: AgentBodyRuleScope;
  kind: AgentBodyRuleIssueKind;
  message: string;
  ruleId?: string;
  nodeId?: string;
  relatedRuleIds?: string[];
  resolved?: string;
  target?: BrainOutputChannel;
}

export interface AgentBodyRuleScopePreview {
  endpointNodeIds: string[];
  rules: AgentBodyRulePreviewGroup[];
  previewsByRuleId: Record<string, AgentBodyRulePreviewItem[]>;
}

export interface AgentBodyRulePreviewModel {
  input: AgentBodyRuleScopePreview;
  output: AgentBodyRuleScopePreview;
  issues: AgentBodyRuleIssueSummaryItem[];
}

interface CompiledBodyRule<Rule> {
  rule: Rule;
  regex: RegExp;
}

interface BodyRuleResolution<RuntimeNode> {
  nodesById: Map<string, RuntimeNode>;
  issues: AgentBodyRuleIssueSummaryItem[];
  rules: AgentBodyRulePreviewGroup[];
}

const BODY_INPUT_SOURCE_PATTERN = /^vision\.([RGB])\.(\d+)$/;
const BODY_OUTPUT_TARGET_PATTERN = /^action\.(turn-left|move-forward|turn-right)$/;
const INPUT_CHANNEL_OFFSET = {
  R: 0,
  G: 1,
  B: 2,
} as const;
const INPUT_CHANNEL_VALUES = ['R', 'G', 'B'] as const;
const OUTPUT_CHANNEL_VALUES = ['turn-left', 'move-forward', 'turn-right'] as const;

type SupportedGroupKind = 'channel' | 'cell' | 'action';
type PatternSegment =
  | { type: 'literal'; value: string }
  | { type: 'group'; index: number; kind: SupportedGroupKind };

const applyRuleTemplate = (template: string, match: RegExpExecArray): string =>
  template.replace(/\$(\d+)/g, (_token, rawGroupIndex: string) => {
    const groupIndex = Number.parseInt(rawGroupIndex, 10);
    return match[groupIndex] ?? '';
  });

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

const executeRulePattern = (regex: RegExp, nodeId: string): RegExpExecArray | null => {
  regex.lastIndex = 0;
  return regex.exec(nodeId);
};

const compileRulePattern = (
  nodeIdPattern: string,
  ruleId: string,
  scope: AgentBodyRuleScope
): { regex: RegExp | null; issue: AgentBodyRuleIssueSummaryItem | null } => {
  try {
    return { regex: new RegExp(nodeIdPattern), issue: null };
  } catch (error) {
    return {
      regex: null,
      issue: {
        scope,
        kind: 'compile-error',
        ruleId,
        message: `body ${scope} rule "${ruleId}" has invalid nodeIdPattern "${nodeIdPattern}": ${
          error instanceof Error ? error.message : 'Unknown regular expression error.'
        }`,
      },
    };
  }
};

const parseBodyInputSource = (nodeId: string, source: string, scale: number): BodyInputNodeRuntime | null => {
  const match = source.match(BODY_INPUT_SOURCE_PATTERN);
  if (!match) {
    return null;
  }

  const channel = match[1] as keyof typeof INPUT_CHANNEL_OFFSET;
  const cellIndex = Number.parseInt(match[2], 10);
  return {
    id: nodeId,
    source: `vision.${channel}.${cellIndex}`,
    visualInputIndex: cellIndex * 3 + INPUT_CHANNEL_OFFSET[channel],
    scale,
  };
};

const parseBodyOutputTarget = (
  nodeId: string,
  target: string,
  decayPerSecond: number
): BodyOutputNodeRuntime | null => {
  const match = target.match(BODY_OUTPUT_TARGET_PATTERN);
  if (!match) {
    return null;
  }

  return {
    id: nodeId,
    target: match[1] as BrainOutputChannel,
    decayPerSecond,
  };
};

const enumerateInputRuleNodeIds = (rule: BodyInputRule, visionCellCount: number): string[] => {
  const templateMatch = rule.sourceTemplate.match(/^vision\.\$(\d+)\.\$(\d+)$/);
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
    for (const channel of INPUT_CHANNEL_VALUES) {
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
  const templateMatch = rule.targetTemplate.match(/^action\.\$(\d+)$/);
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
  for (const action of OUTPUT_CHANNEL_VALUES) {
    const nodeId = buildNodeIdFromSegments(segments, new Map([[actionGroupIndex, action]]));
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

export interface AgentBodyEndpointIds {
  bodyInputNodeIds: string[];
  bodyOutputNodeIds: string[];
}

export const resolveAgentBodyEndpointIds = (agent: AgentIR): AgentBodyEndpointIds => {
  const bodyInputNodeIds = new Set<string>([
    ...collectEndpointIdsFromConnections(agent, 'bodyInput'),
    ...agent.body.inputRules.flatMap((rule) => enumerateInputRuleNodeIds(rule, agent.body.visionCellCount)),
  ]);
  const bodyOutputNodeIds = new Set<string>([
    ...collectEndpointIdsFromConnections(agent, 'bodyOutput'),
    ...agent.body.outputRules.flatMap((rule) => enumerateOutputRuleNodeIds(rule)),
  ]);

  return {
    bodyInputNodeIds: [...bodyInputNodeIds].sort(),
    bodyOutputNodeIds: [...bodyOutputNodeIds].sort(),
  };
};

const buildPreviewRecord = (rules: AgentBodyRulePreviewGroup[]): Record<string, AgentBodyRulePreviewItem[]> =>
  Object.fromEntries(rules.map((rule) => [rule.ruleId, [...rule.endpoints]]));

const sortPreviewItems = (items: AgentBodyRulePreviewItem[]): AgentBodyRulePreviewItem[] =>
  items.sort((left, right) => left.nodeId.localeCompare(right.nodeId) || left.resolved.localeCompare(right.resolved));

const buildInputPreviewGroups = (
  rules: BodyInputRule[]
): {
  compiledRules: CompiledBodyRule<BodyInputRule>[];
  issues: AgentBodyRuleIssueSummaryItem[];
  previews: AgentBodyRulePreviewGroup[];
} => {
  const compiledRules: CompiledBodyRule<BodyInputRule>[] = [];
  const issues: AgentBodyRuleIssueSummaryItem[] = [];
  const previews = rules.map((rule) => ({
    ruleId: rule.id,
    nodeIdPattern: rule.nodeIdPattern,
    template: rule.sourceTemplate,
    endpoints: [],
  }));
  const previewByRuleId = new Map(previews.map((preview) => [preview.ruleId, preview]));

  for (const rule of rules) {
    const { regex, issue } = compileRulePattern(rule.nodeIdPattern, rule.id, 'input');
    if (issue) {
      issues.push(issue);
      continue;
    }

    if (regex) {
      compiledRules.push({ rule, regex });
    }
  }

  return { compiledRules, issues, previews: [...previewByRuleId.values()] };
};

const resolveBodyInputRules = (
  rules: BodyInputRule[],
  nodeIds: Iterable<string>
): BodyRuleResolution<BodyInputNodeRuntime> => {
  const nodesById = new Map<string, BodyInputNodeRuntime>();
  const { compiledRules, issues, previews } = buildInputPreviewGroups(rules);
  const previewByRuleId = new Map(previews.map((preview) => [preview.ruleId, preview]));
  const nodeIdList = [...nodeIds];

  for (const nodeId of nodeIdList) {
    const matches = compiledRules
      .map((entry) => ({ entry, match: executeRulePattern(entry.regex, nodeId) }))
      .filter((candidate): candidate is { entry: CompiledBodyRule<BodyInputRule>; match: RegExpExecArray } => Boolean(candidate.match));

    for (const { entry, match } of matches) {
      const resolved = applyRuleTemplate(entry.rule.sourceTemplate, match);
      previewByRuleId.get(entry.rule.id)?.endpoints.push({ nodeId, resolved });
    }

    if (matches.length === 0) {
      issues.push({
        scope: 'input',
        kind: 'unmatched',
        nodeId,
        message: `Body input node "${nodeId}" does not match any BodyIR input rule.`,
      });
      continue;
    }

    if (matches.length > 1) {
      issues.push({
        scope: 'input',
        kind: 'conflict',
        nodeId,
        relatedRuleIds: matches.map((candidate) => candidate.entry.rule.id),
        message: `Body input node "${nodeId}" matches multiple BodyIR input rules: ${matches
          .map((candidate) => candidate.entry.rule.id)
          .join(', ')}.`,
      });
      continue;
    }

    const [{ entry, match }] = matches;
    const source = applyRuleTemplate(entry.rule.sourceTemplate, match);
    const parsed = parseBodyInputSource(nodeId, source, entry.rule.scale);
    if (!parsed) {
      issues.push({
        scope: 'input',
        kind: 'compile-error',
        ruleId: entry.rule.id,
        nodeId,
        resolved: source,
        message: `Body input rule "${entry.rule.id}" resolved node "${nodeId}" to unsupported source "${source}".`,
      });
      continue;
    }

    nodesById.set(parsed.id, parsed);
  }

  for (const preview of previews) {
    sortPreviewItems(preview.endpoints);
  }

  return { nodesById, issues, rules: previews };
};

const buildOutputPreviewGroups = (
  rules: BodyOutputRule[]
): {
  compiledRules: CompiledBodyRule<BodyOutputRule>[];
  issues: AgentBodyRuleIssueSummaryItem[];
  previews: AgentBodyRulePreviewGroup[];
} => {
  const compiledRules: CompiledBodyRule<BodyOutputRule>[] = [];
  const issues: AgentBodyRuleIssueSummaryItem[] = [];
  const previews = rules.map((rule) => ({
    ruleId: rule.id,
    nodeIdPattern: rule.nodeIdPattern,
    template: rule.targetTemplate,
    endpoints: [],
  }));

  for (const rule of rules) {
    const { regex, issue } = compileRulePattern(rule.nodeIdPattern, rule.id, 'output');
    if (issue) {
      issues.push(issue);
      continue;
    }

    if (regex) {
      compiledRules.push({ rule, regex });
    }
  }

  return { compiledRules, issues, previews };
};

const resolveBodyOutputRules = (
  rules: BodyOutputRule[],
  nodeIds: Iterable<string>
): BodyRuleResolution<BodyOutputNodeRuntime> => {
  const nodesById = new Map<string, BodyOutputNodeRuntime>();
  const { compiledRules, issues, previews } = buildOutputPreviewGroups(rules);
  const previewByRuleId = new Map(previews.map((preview) => [preview.ruleId, preview]));
  const targetToNodeId = new Map<BrainOutputChannel, string>();
  const nodeIdList = [...nodeIds];

  for (const nodeId of nodeIdList) {
    const matches = compiledRules
      .map((entry) => ({ entry, match: executeRulePattern(entry.regex, nodeId) }))
      .filter((candidate): candidate is { entry: CompiledBodyRule<BodyOutputRule>; match: RegExpExecArray } => Boolean(candidate.match));

    for (const { entry, match } of matches) {
      const resolved = applyRuleTemplate(entry.rule.targetTemplate, match);
      previewByRuleId.get(entry.rule.id)?.endpoints.push({ nodeId, resolved });
    }

    if (matches.length === 0) {
      issues.push({
        scope: 'output',
        kind: 'unmatched',
        nodeId,
        message: `Body output node "${nodeId}" does not match any BodyIR output rule.`,
      });
      continue;
    }

    if (matches.length > 1) {
      issues.push({
        scope: 'output',
        kind: 'conflict',
        nodeId,
        relatedRuleIds: matches.map((candidate) => candidate.entry.rule.id),
        message: `Body output node "${nodeId}" matches multiple BodyIR output rules: ${matches
          .map((candidate) => candidate.entry.rule.id)
          .join(', ')}.`,
      });
      continue;
    }

    const [{ entry, match }] = matches;
    const target = applyRuleTemplate(entry.rule.targetTemplate, match);
    const parsed = parseBodyOutputTarget(nodeId, target, entry.rule.decayPerSecond);
    if (!parsed) {
      issues.push({
        scope: 'output',
        kind: 'compile-error',
        ruleId: entry.rule.id,
        nodeId,
        resolved: target,
        message: `Body output rule "${entry.rule.id}" resolved node "${nodeId}" to unsupported target "${target}".`,
      });
      continue;
    }

    const existingNodeId = targetToNodeId.get(parsed.target);
    if (existingNodeId && existingNodeId !== nodeId) {
      issues.push({
        scope: 'output',
        kind: 'conflict',
        nodeId,
        target: parsed.target,
        message: `Body output nodes "${existingNodeId}" and "${nodeId}" both resolve to action target "${parsed.target}".`,
      });
      continue;
    }

    targetToNodeId.set(parsed.target, nodeId);
    nodesById.set(parsed.id, parsed);
  }

  for (const preview of previews) {
    sortPreviewItems(preview.endpoints);
  }

  return { nodesById, issues, rules: previews };
};

export const resolveAgentBodyInputRuleBindings = (
  rules: BodyInputRule[],
  nodeIds: Iterable<string>
): BodyRuleResolution<BodyInputNodeRuntime> => resolveBodyInputRules(rules, nodeIds);

export const resolveAgentBodyOutputRuleBindings = (
  rules: BodyOutputRule[],
  nodeIds: Iterable<string>
): BodyRuleResolution<BodyOutputNodeRuntime> => resolveBodyOutputRules(rules, nodeIds);

export const buildAgentBodyRulePreviewModel = (agent: AgentIR): AgentBodyRulePreviewModel => {
  const endpointIds = resolveAgentBodyEndpointIds(agent);
  const input = resolveBodyInputRules(agent.body.inputRules, endpointIds.bodyInputNodeIds);
  const output = resolveBodyOutputRules(agent.body.outputRules, endpointIds.bodyOutputNodeIds);

  return {
    input: {
      endpointNodeIds: [...endpointIds.bodyInputNodeIds],
      rules: input.rules,
      previewsByRuleId: buildPreviewRecord(input.rules),
    },
    output: {
      endpointNodeIds: [...endpointIds.bodyOutputNodeIds],
      rules: output.rules,
      previewsByRuleId: buildPreviewRecord(output.rules),
    },
    issues: [...input.issues, ...output.issues],
  };
};
