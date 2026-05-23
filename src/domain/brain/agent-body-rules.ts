import type {
  AgentIR,
  BodyInputNodeRuntime,
  BodyInputRule,
  BodyOutputNodeRuntime,
  BodyOutputRule,
} from './agent-ir';
import { resolveAgentBodyEndpointIds } from './agent-body-endpoints';
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

const applyRuleTemplate = (template: string, match: RegExpExecArray): string =>
  template.replace(/\$(\d+)/g, (_token, rawGroupIndex: string) => {
    const groupIndex = Number.parseInt(rawGroupIndex, 10);
    return match[groupIndex] ?? '';
  });

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
