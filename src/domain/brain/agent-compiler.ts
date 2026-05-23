import type {
  AgentIR,
  BodyInputNodeRuntime,
  BodyInputRule,
  BodyOutputNodeRuntime,
  BodyOutputRule,
  BrainNeuronNode,
} from './agent-ir';
import { GraphIRValidationError, type GraphIRValidationIssue } from './ir';
import type { AgentProgram, AgentProgramConnection, AgentProgramNeuronNode } from './agent-program';
import type { BrainOutputChannel } from './shared';

export type AgentValidationIssue = GraphIRValidationIssue;
export class AgentValidationError extends GraphIRValidationError {}

const BODY_INPUT_SOURCE_PATTERN = /^vision\.([RGB])\.(\d+)$/;
const BODY_OUTPUT_TARGET_PATTERN = /^action\.(turn-left|move-forward|turn-right)$/;
const INPUT_CHANNEL_OFFSET = {
  R: 0,
  G: 1,
  B: 2,
} as const;

const ACTION_CHANNELS: BrainOutputChannel[] = ['turn-left', 'move-forward', 'turn-right'];

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
  scope: 'body input' | 'body output'
): { regex: RegExp | null; issue: AgentValidationIssue | null } => {
  try {
    return { regex: new RegExp(nodeIdPattern), issue: null };
  } catch (error) {
    return {
      regex: null,
      issue: {
        code: 'runtime-binding-error',
        message: `${scope} rule "${ruleId}" has invalid nodeIdPattern "${nodeIdPattern}": ${
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

interface ResolvedRule<Rule> {
  rule: Rule;
  regex: RegExp;
}

interface ResolvedBodyEndpoints<RuntimeNode> {
  nodesById: Map<string, RuntimeNode>;
  issues: AgentValidationIssue[];
}

const buildResolvedInputRules = (rules: BodyInputRule[]): {
  rules: ResolvedRule<BodyInputRule>[];
  issues: AgentValidationIssue[];
} => {
  const resolvedRules: ResolvedRule<BodyInputRule>[] = [];
  const issues: AgentValidationIssue[] = [];

  for (const rule of rules) {
    const { regex, issue } = compileRulePattern(rule.nodeIdPattern, rule.id, 'body input');
    if (issue) {
      issues.push(issue);
      continue;
    }

    if (regex) {
      resolvedRules.push({ rule, regex });
    }
  }

  return { rules: resolvedRules, issues };
};

const buildResolvedOutputRules = (rules: BodyOutputRule[]): {
  rules: ResolvedRule<BodyOutputRule>[];
  issues: AgentValidationIssue[];
} => {
  const resolvedRules: ResolvedRule<BodyOutputRule>[] = [];
  const issues: AgentValidationIssue[] = [];

  for (const rule of rules) {
    const { regex, issue } = compileRulePattern(rule.nodeIdPattern, rule.id, 'body output');
    if (issue) {
      issues.push(issue);
      continue;
    }

    if (regex) {
      resolvedRules.push({ rule, regex });
    }
  }

  return { rules: resolvedRules, issues };
};

const resolveBodyInputs = (agent: AgentIR): ResolvedBodyEndpoints<BodyInputNodeRuntime> => {
  const nodes = new Map<string, BodyInputNodeRuntime>();
  const { rules, issues } = buildResolvedInputRules(agent.body.inputRules);
  const nodeIds = new Set(
    agent.connections
      .filter((connection) => connection.from.scope === 'bodyInput')
      .map((connection) => connection.from.nodeId)
  );

  for (const nodeId of nodeIds) {
    const matches = rules
      .map((entry) => ({ entry, match: executeRulePattern(entry.regex, nodeId) }))
      .filter((candidate): candidate is { entry: ResolvedRule<BodyInputRule>; match: RegExpExecArray } => Boolean(candidate.match));

    if (matches.length === 0) {
      issues.push({
        code: 'runtime-binding-error',
        message: `Body input node "${nodeId}" does not match any BodyIR input rule.`,
      });
      continue;
    }

    if (matches.length > 1) {
      issues.push({
        code: 'runtime-binding-error',
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
        code: 'runtime-binding-error',
        message: `Body input rule "${entry.rule.id}" resolved node "${nodeId}" to unsupported source "${source}".`,
      });
      continue;
    }

    nodes.set(parsed.id, parsed);
  }

  return { nodesById: nodes, issues };
};

const resolveBodyOutputs = (agent: AgentIR): ResolvedBodyEndpoints<BodyOutputNodeRuntime> => {
  const nodes = new Map<string, BodyOutputNodeRuntime>();
  const { rules, issues } = buildResolvedOutputRules(agent.body.outputRules);
  const targetToNodeId = new Map<BrainOutputChannel, string>();
  const nodeIds = new Set(
    agent.connections
      .filter((connection) => connection.to.scope === 'bodyOutput')
      .map((connection) => connection.to.nodeId)
  );

  for (const nodeId of nodeIds) {
    const matches = rules
      .map((entry) => ({ entry, match: executeRulePattern(entry.regex, nodeId) }))
      .filter((candidate): candidate is { entry: ResolvedRule<BodyOutputRule>; match: RegExpExecArray } => Boolean(candidate.match));

    if (matches.length === 0) {
      issues.push({
        code: 'runtime-binding-error',
        message: `Body output node "${nodeId}" does not match any BodyIR output rule.`,
      });
      continue;
    }

    if (matches.length > 1) {
      issues.push({
        code: 'runtime-binding-error',
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
        code: 'runtime-binding-error',
        message: `Body output rule "${entry.rule.id}" resolved node "${nodeId}" to unsupported target "${target}".`,
      });
      continue;
    }

    const existingNodeId = targetToNodeId.get(parsed.target);
    if (existingNodeId && existingNodeId !== nodeId) {
      issues.push({
        code: 'runtime-binding-error',
        message: `Body output nodes "${existingNodeId}" and "${nodeId}" both resolve to action target "${parsed.target}".`,
      });
      continue;
    }

    targetToNodeId.set(parsed.target, nodeId);
    nodes.set(parsed.id, parsed);
  }

  return { nodesById: nodes, issues };
};

const createNeuronProgramNode = (neuron: BrainNeuronNode): AgentProgramNeuronNode => ({
  id: neuron.id,
  label: neuron.label,
  params: { ...neuron.params },
  initialState: {
    v: neuron.initialState.v,
    u: neuron.initialState.u ?? neuron.params.b * neuron.initialState.v,
  },
  inputConnections: [],
  outputConnections: [],
});

interface AgentCompilationContext {
  issues: AgentValidationIssue[];
  bodyInputsById: Map<string, BodyInputNodeRuntime>;
  bodyOutputsById: Map<string, BodyOutputNodeRuntime>;
}

const buildAgentCompilationContext = (agent: AgentIR): AgentCompilationContext => {
  const issues: AgentValidationIssue[] = [];
  const bodyInputResolution = resolveBodyInputs(agent);
  const bodyOutputResolution = resolveBodyOutputs(agent);
  const neuronIds = new Set(agent.brain.neurons.map((neuron) => neuron.id));
  const containerIds = new Set(agent.brain.containers.map((container) => container.id));

  issues.push(...bodyInputResolution.issues, ...bodyOutputResolution.issues);

  if (!containerIds.has(agent.brain.rootContainerId)) {
    issues.push({
      code: 'runtime-binding-error',
      message: `Brain root container "${agent.brain.rootContainerId}" is missing.`,
    });
  }

  for (const connection of agent.connections) {
    if (connection.from.scope === 'brain' && !neuronIds.has(connection.from.nodeId)) {
      issues.push({
        code: 'missing-link-node',
        message: `Agent connection "${connection.id}" references missing brain source "${connection.from.nodeId}".`,
      });
    }
    if (connection.to.scope === 'brain' && !neuronIds.has(connection.to.nodeId)) {
      issues.push({
        code: 'missing-link-node',
        message: `Agent connection "${connection.id}" references missing brain target "${connection.to.nodeId}".`,
      });
    }
    if (connection.from.scope === 'bodyInput' && !bodyInputResolution.nodesById.has(connection.from.nodeId)) {
      issues.push({
        code: 'runtime-binding-error',
        message: `Agent connection "${connection.id}" references unresolved body input "${connection.from.nodeId}".`,
      });
    }
    if (connection.to.scope === 'bodyOutput' && !bodyOutputResolution.nodesById.has(connection.to.nodeId)) {
      issues.push({
        code: 'runtime-binding-error',
        message: `Agent connection "${connection.id}" references unresolved body output "${connection.to.nodeId}".`,
      });
    }
    if (connection.from.scope === 'bodyOutput') {
      issues.push({
        code: 'invalid-link-direction',
        message: `Agent connection "${connection.id}" cannot start from bodyOutput.`,
      });
    }
    if (connection.to.scope === 'bodyInput') {
      issues.push({
        code: 'invalid-link-direction',
        message: `Agent connection "${connection.id}" cannot target bodyInput.`,
      });
    }
  }

  return {
    issues,
    bodyInputsById: bodyInputResolution.nodesById,
    bodyOutputsById: bodyOutputResolution.nodesById,
  };
};

export const validateAgentIR = (agent: AgentIR): AgentValidationIssue[] => {
  return buildAgentCompilationContext(agent).issues;
};

export const compileAgentIR = (agent: AgentIR): AgentProgram => {
  const { issues, bodyInputsById, bodyOutputsById } = buildAgentCompilationContext(agent);
  if (issues.length > 0) {
    throw new AgentValidationError(issues);
  }

  const neuronNodes = agent.brain.neurons.map(createNeuronProgramNode);
  const neuronNodeIndex = new Map(neuronNodes.map((node) => [node.id, node]));

  const connections: AgentProgramConnection[] = agent.connections.map((connection) => ({
    id: connection.id,
    sourceNodeId: connection.from.nodeId,
    targetNodeId: connection.to.nodeId,
    weight: connection.weight,
    delayMs: connection.delayMs ?? 0,
  }));

  for (const connection of connections) {
    const sourceNode = neuronNodeIndex.get(connection.sourceNodeId);
    const targetNode = neuronNodeIndex.get(connection.targetNodeId);

    if (sourceNode) {
      sourceNode.outputConnections.push(connection);
    }
    if (targetNode) {
      targetNode.inputConnections.push(connection);
    }
  }

  return {
    agent,
    inputPorts: [...bodyInputsById.values()]
      .sort((left, right) => left.visualInputIndex - right.visualInputIndex || left.id.localeCompare(right.id))
      .map((node) => ({
        id: node.id,
        source: node.source,
        index: node.visualInputIndex,
        scale: node.scale,
      })),
    outputPorts: ACTION_CHANNELS.map((channel) => {
      const outputNode = [...bodyOutputsById.values()].find((node) => node.target === channel);
      return {
        id: outputNode?.id ?? `output-${channel}`,
        target: channel,
        decayPerSecond: outputNode?.decayPerSecond ?? 0,
      };
    }),
    neuronNodes,
    connections,
    bodyInputsById,
    bodyOutputsById,
    neuronNodeIndex,
  };
};
