import type { AgentIR, BodyInputNodeRuntime, BodyOutputNodeRuntime, BrainNeuronNode } from './agent-ir';
import { GraphIRValidationError, type GraphIRValidationIssue } from './ir';
import type { AgentProgram, AgentProgramConnection, AgentProgramNeuronNode } from './agent-program';
import type { BrainOutputChannel } from './shared';

const BODY_INPUT_NODE_PATTERN = /^vision-([RGB])-(\d+)$/;
const BODY_OUTPUT_NODE_PATTERN = /^output-(turn-left|move-forward|turn-right)$/;
const INPUT_CHANNEL_OFFSET = {
  R: 0,
  G: 1,
  B: 2,
} as const;

const ACTION_CHANNELS: BrainOutputChannel[] = ['turn-left', 'move-forward', 'turn-right'];

const parseBodyInputNode = (nodeId: string, scale: number): BodyInputNodeRuntime | null => {
  const match = nodeId.match(BODY_INPUT_NODE_PATTERN);
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

const parseBodyOutputNode = (nodeId: string, decayPerSecond: number): BodyOutputNodeRuntime | null => {
  const match = nodeId.match(BODY_OUTPUT_NODE_PATTERN);
  if (!match) {
    return null;
  }

  return {
    id: nodeId,
    target: match[1] as BrainOutputChannel,
    decayPerSecond,
  };
};

const buildInputRuleMap = (agent: AgentIR): Map<string, BodyInputNodeRuntime> => {
  const nodes = new Map<string, BodyInputNodeRuntime>();
  for (const rule of agent.body.inputRules) {
    for (const connection of agent.connections) {
      if (connection.from.scope !== 'bodyInput') {
        continue;
      }
      const parsed = parseBodyInputNode(connection.from.nodeId, rule.scale);
      if (parsed) {
        nodes.set(parsed.id, parsed);
      }
    }
  }
  return nodes;
};

const buildOutputRuleMap = (agent: AgentIR): Map<string, BodyOutputNodeRuntime> => {
  const nodes = new Map<string, BodyOutputNodeRuntime>();
  for (const rule of agent.body.outputRules) {
    for (const connection of agent.connections) {
      if (connection.to.scope !== 'bodyOutput') {
        continue;
      }
      const parsed = parseBodyOutputNode(connection.to.nodeId, rule.decayPerSecond);
      if (parsed) {
        nodes.set(parsed.id, parsed);
      }
    }
  }
  return nodes;
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

export const validateAgentIR = (agent: AgentIR): GraphIRValidationIssue[] => {
  const issues: GraphIRValidationIssue[] = [];
  const neuronIds = new Set(agent.brain.neurons.map((neuron) => neuron.id));
  const containerIds = new Set(agent.brain.containers.map((container) => container.id));

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

  return issues;
};

export const compileAgentIR = (agent: AgentIR): AgentProgram => {
  const issues = validateAgentIR(agent);
  if (issues.length > 0) {
    throw new GraphIRValidationError(issues);
  }

  const bodyInputsById = buildInputRuleMap(agent);
  const bodyOutputsById = buildOutputRuleMap(agent);
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
