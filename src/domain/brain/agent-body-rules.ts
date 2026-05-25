import type {
  AgentIR,
  BodyInputNodeRuntime,
  BodyInputRule,
  BodyOutputNodeRuntime,
  BodyOutputRule,
} from './agent-ir';
import type { WorldInputBinding, WorldOutputBinding, WorldRegistry } from './world-registry';

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
  target?: string;
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

const parseBodyInputSource = (nodeId: string, binding: WorldInputBinding | null, scale: number): BodyInputNodeRuntime | null => {
  if (!binding) {
    return null;
  }
  return {
    id: nodeId,
    source: binding.source,
    worldPort: binding.worldPort,
    scale,
  };
};

const parseBodyOutputTarget = (
  nodeId: string,
  binding: WorldOutputBinding | null,
  decayPerSecond: number
): BodyOutputNodeRuntime | null => {
  if (!binding) {
    return null;
  }

  return {
    id: nodeId,
    target: binding.target,
    normalizedTarget: binding.target,
    worldPort: binding.worldPort,
    commandKind: binding.commandKind,
    decayPerSecond,
  };
};

const enumerateInputRuleNodeIds = (
  registry: Pick<WorldRegistry, 'enumerateInputNodeIds'>,
  rule: BodyInputRule,
  visionCellCount: number
): string[] => {
  return registry.enumerateInputNodeIds(rule, visionCellCount);
};

const resolveProjectedVisionCellCount = (projectedVisionCellCount?: number): number =>
  projectedVisionCellCount == null ? 0 : Math.max(0, Math.floor(projectedVisionCellCount));

const enumerateOutputRuleNodeIds = (
  registry: Pick<WorldRegistry, 'enumerateOutputNodeIds'>,
  rule: BodyOutputRule
): string[] => {
  return registry.enumerateOutputNodeIds(rule);
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

export interface AgentCompiledBodyEndpointIds {
  bodyInputNodeIds: string[];
  bodyOutputNodeIds: string[];
}

export interface AgentBodyEndpointResolution {
  inputNodesById: Map<string, BodyInputNodeRuntime>;
  outputNodesById: Map<string, BodyOutputNodeRuntime>;
  issues: AgentBodyRuleIssueSummaryItem[];
  endpointIds: AgentBodyEndpointIds;
}

export const resolveAgentBodyEndpointIds = (
  agent: AgentIR,
  registry: WorldRegistry,
  projectedVisionCellCount?: number
): AgentBodyEndpointIds => {
  const visionCellCount = resolveProjectedVisionCellCount(projectedVisionCellCount);
  const bodyInputNodeIds = new Set<string>([
    ...collectEndpointIdsFromConnections(agent, 'bodyInput'),
    ...agent.body.inputRules.flatMap((rule) => enumerateInputRuleNodeIds(registry, rule, visionCellCount)),
  ]);
  const bodyOutputNodeIds = new Set<string>([
    ...collectEndpointIdsFromConnections(agent, 'bodyOutput'),
    ...agent.body.outputRules.flatMap((rule) => enumerateOutputRuleNodeIds(registry, rule)),
  ]);

  return {
    bodyInputNodeIds: [...bodyInputNodeIds].sort(),
    bodyOutputNodeIds: [...bodyOutputNodeIds].sort(),
  };
};

export const resolveCompiledAgentBodyEndpointIds = (agent: AgentIR, registry: WorldRegistry): AgentCompiledBodyEndpointIds => {
  const referencedBodyInputNodeIds = collectEndpointIdsFromConnections(agent, 'bodyInput');
  const referencedBodyOutputNodeIds = collectEndpointIdsFromConnections(agent, 'bodyOutput');
  const input = resolveBodyInputRules(registry, agent.body.inputRules, referencedBodyInputNodeIds);
  const output = resolveBodyOutputRules(registry, agent.body.outputRules, referencedBodyOutputNodeIds);

  return {
    bodyInputNodeIds: [...input.nodesById.keys()].sort(),
    bodyOutputNodeIds: [...output.nodesById.keys()].sort(),
  };
};

export const resolveAgentBodyEndpointResolution = (agent: AgentIR, registry: WorldRegistry): AgentBodyEndpointResolution => {
  const endpointIds = resolveAgentBodyEndpointIds(agent, registry);
  const input = resolveBodyInputRules(registry, agent.body.inputRules, endpointIds.bodyInputNodeIds);
  const output = resolveBodyOutputRules(registry, agent.body.outputRules, endpointIds.bodyOutputNodeIds);

  return {
    inputNodesById: input.nodesById,
    outputNodesById: output.nodesById,
    issues: [...input.issues, ...output.issues],
    endpointIds,
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
  registry: WorldRegistry,
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
      const resolution = registry.resolveInputRuleBinding(entry.rule, match);
      previewByRuleId.get(entry.rule.id)?.endpoints.push({ nodeId, resolved: resolution.source });
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
    const resolution = registry.resolveInputRuleBinding(entry.rule, match);
    const parsed = parseBodyInputSource(nodeId, resolution.binding, entry.rule.scale);
    if (!parsed) {
      issues.push({
        scope: 'input',
        kind: 'compile-error',
        ruleId: entry.rule.id,
        nodeId,
        resolved: resolution.source,
        message: `Body input rule "${entry.rule.id}" resolved node "${nodeId}" to unsupported source "${resolution.source}".`,
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
  registry: WorldRegistry,
  rules: BodyOutputRule[],
  nodeIds: Iterable<string>
): BodyRuleResolution<BodyOutputNodeRuntime> => {
  const nodesById = new Map<string, BodyOutputNodeRuntime>();
  const { compiledRules, issues, previews } = buildOutputPreviewGroups(rules);
  const previewByRuleId = new Map(previews.map((preview) => [preview.ruleId, preview]));
  const targetToNodeId = new Map<string, string>();
  const nodeIdList = [...nodeIds];

  for (const nodeId of nodeIdList) {
    const matches = compiledRules
      .map((entry) => ({ entry, match: executeRulePattern(entry.regex, nodeId) }))
      .filter((candidate): candidate is { entry: CompiledBodyRule<BodyOutputRule>; match: RegExpExecArray } => Boolean(candidate.match));

    for (const { entry, match } of matches) {
      const resolution = registry.resolveOutputRuleBinding(entry.rule, match);
      previewByRuleId.get(entry.rule.id)?.endpoints.push({ nodeId, resolved: resolution.target });
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
    const resolution = registry.resolveOutputRuleBinding(entry.rule, match);
    const parsed = parseBodyOutputTarget(nodeId, resolution.binding, entry.rule.decayPerSecond);
    if (!parsed) {
      issues.push({
        scope: 'output',
        kind: 'compile-error',
        ruleId: entry.rule.id,
        nodeId,
        resolved: resolution.target,
        message: `Body output rule "${entry.rule.id}" resolved node "${nodeId}" to unsupported target "${resolution.target}".`,
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
  registry: WorldRegistry,
  rules: BodyInputRule[],
  nodeIds: Iterable<string>
): BodyRuleResolution<BodyInputNodeRuntime> => resolveBodyInputRules(registry, rules, nodeIds);

export const resolveAgentBodyOutputRuleBindings = (
  registry: WorldRegistry,
  rules: BodyOutputRule[],
  nodeIds: Iterable<string>
): BodyRuleResolution<BodyOutputNodeRuntime> => resolveBodyOutputRules(registry, rules, nodeIds);

export const buildAgentBodyRulePreviewModel = (
  agent: AgentIR,
  registry: WorldRegistry,
  projectedVisionCellCount?: number
): AgentBodyRulePreviewModel => {
  const endpointIds = resolveAgentBodyEndpointIds(agent, registry, projectedVisionCellCount);
  const input = resolveBodyInputRules(registry, agent.body.inputRules, endpointIds.bodyInputNodeIds);
  const output = resolveBodyOutputRules(registry, agent.body.outputRules, endpointIds.bodyOutputNodeIds);

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
