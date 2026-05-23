import type {
  AgentIR,
  BodyInputNodeRuntime,
  BodyOutputNodeRuntime,
  BrainNeuronNode,
} from './agent-ir';
import {
  resolveAgentBodyInputRuleBindings,
  resolveAgentBodyOutputRuleBindings,
} from './agent-body-rules';
import type { AgentProgram, AgentProgramConnection, AgentProgramNeuronNode } from './agent-program';
import type { BrainOutputChannel } from './shared';

export type AgentValidationIssueCode =
  | 'missing-brain-root-container'
  | 'missing-brain-node'
  | 'duplicate-brain-node-id'
  | 'invalid-brain-structure'
  | 'invalid-connection-direction'
  | 'runtime-binding-error';

export interface AgentValidationIssue {
  code: AgentValidationIssueCode;
  message: string;
}

export class AgentValidationError extends Error {
  public readonly issues: AgentValidationIssue[];

  constructor(issues: AgentValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(' | '));
    this.name = 'AgentValidationError';
    this.issues = issues;
  }
}

const ACTION_CHANNELS: BrainOutputChannel[] = ['turn-left', 'move-forward', 'turn-right'];

interface ResolvedBodyEndpoints<RuntimeNode> {
  nodesById: Map<string, RuntimeNode>;
  issues: AgentValidationIssue[];
}

const resolveBodyInputs = (agent: AgentIR): ResolvedBodyEndpoints<BodyInputNodeRuntime> => {
  const nodeIds = new Set(
    agent.connections
      .filter((connection) => connection.from.scope === 'bodyInput')
      .map((connection) => connection.from.nodeId)
  );
  const resolution = resolveAgentBodyInputRuleBindings(agent.body.inputRules, nodeIds);
  return {
    nodesById: resolution.nodesById,
    issues: resolution.issues.map((issue) => ({
      code: 'runtime-binding-error',
      message: issue.message,
    })),
  };
};

const resolveBodyOutputs = (agent: AgentIR): ResolvedBodyEndpoints<BodyOutputNodeRuntime> => {
  const nodeIds = new Set(
    agent.connections
      .filter((connection) => connection.to.scope === 'bodyOutput')
      .map((connection) => connection.to.nodeId)
  );
  const resolution = resolveAgentBodyOutputRuleBindings(agent.body.outputRules, nodeIds);
  return {
    nodesById: resolution.nodesById,
    issues: resolution.issues.map((issue) => ({
      code: 'runtime-binding-error',
      message: issue.message,
    })),
  };
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

const buildBrainStructureIssues = (agent: AgentIR): AgentValidationIssue[] => {
  const issues: AgentValidationIssue[] = [];
  const neuronIds = new Set<string>();
  const containerIds = new Set<string>();
  const neuronOwners = new Map<string, string[]>();
  const containerOwners = new Map<string, string[]>();

  for (const neuron of agent.brain.neurons) {
    if (neuronIds.has(neuron.id)) {
      issues.push({
        code: 'duplicate-brain-node-id',
        message: `Brain neuron id "${neuron.id}" is duplicated.`,
      });
      continue;
    }
    neuronIds.add(neuron.id);
  }

  for (const container of agent.brain.containers) {
    if (neuronIds.has(container.id)) {
      issues.push({
        code: 'duplicate-brain-node-id',
        message: `Brain container id "${container.id}" collides with neuron id "${container.id}".`,
      });
      continue;
    }
    if (containerIds.has(container.id)) {
      issues.push({
        code: 'duplicate-brain-node-id',
        message: `Brain container id "${container.id}" is duplicated.`,
      });
      continue;
    }
    containerIds.add(container.id);
  }

  for (const container of agent.brain.containers) {
    for (const child of container.children) {
      if (child.scope === 'brain') {
        if (!neuronIds.has(child.nodeId)) {
          issues.push({
            code: 'missing-brain-node',
            message: `Brain container "${container.id}" references missing neuron "${child.nodeId}".`,
          });
          continue;
        }

        const owners = neuronOwners.get(child.nodeId) ?? [];
        owners.push(container.id);
        neuronOwners.set(child.nodeId, owners);
        continue;
      }

      if (!containerIds.has(child.nodeId)) {
        issues.push({
          code: 'missing-brain-node',
          message: `Brain container "${container.id}" references missing child container "${child.nodeId}".`,
        });
        continue;
      }

      const owners = containerOwners.get(child.nodeId) ?? [];
      owners.push(container.id);
      containerOwners.set(child.nodeId, owners);
    }
  }

  for (const neuronId of neuronIds) {
    const owners = neuronOwners.get(neuronId) ?? [];
    if (owners.length === 0) {
      issues.push({
        code: 'invalid-brain-structure',
        message: `Brain neuron "${neuronId}" is not attached to any container.`,
      });
      continue;
    }

    if (owners.length > 1) {
      issues.push({
        code: 'invalid-brain-structure',
        message: `Brain neuron "${neuronId}" is attached to multiple containers: ${owners.join(', ')}.`,
      });
    }
  }

  for (const containerId of containerIds) {
    const owners = containerOwners.get(containerId) ?? [];
    if (containerId === agent.brain.rootContainerId) {
      if (owners.length > 0) {
        issues.push({
          code: 'invalid-brain-structure',
          message: `Brain root container "${containerId}" cannot be nested under another container.`,
        });
      }
      continue;
    }

    if (owners.length === 0) {
      issues.push({
        code: 'invalid-brain-structure',
        message: `Brain container "${containerId}" is not attached to any parent container.`,
      });
      continue;
    }

    if (owners.length > 1) {
      issues.push({
        code: 'invalid-brain-structure',
        message: `Brain container "${containerId}" is attached to multiple parent containers: ${owners.join(', ')}.`,
      });
    }
  }

  const containersById = new Map(agent.brain.containers.map((container) => [container.id, container]));
  const visitState = new Map<string, 'visiting' | 'visited'>();

  const visitContainer = (containerId: string, path: string[]): void => {
    const state = visitState.get(containerId);
    if (state === 'visiting') {
      issues.push({
        code: 'invalid-brain-structure',
        message: `Brain container cycle detected: ${[...path, containerId].join(' -> ')}.`,
      });
      return;
    }
    if (state === 'visited') {
      return;
    }

    const container = containersById.get(containerId);
    if (!container) {
      return;
    }

    visitState.set(containerId, 'visiting');
    for (const child of container.children) {
      if (child.scope === 'container') {
        visitContainer(child.nodeId, [...path, containerId]);
      }
    }
    visitState.set(containerId, 'visited');
  };

  if (containerIds.has(agent.brain.rootContainerId)) {
    visitContainer(agent.brain.rootContainerId, []);
  }

  for (const containerId of containerIds) {
    if (!visitState.has(containerId)) {
      issues.push({
        code: 'invalid-brain-structure',
        message: `Brain container "${containerId}" is unreachable from root container "${agent.brain.rootContainerId}".`,
      });
    }
  }

  return issues;
};

const buildAgentCompilationContext = (agent: AgentIR): AgentCompilationContext => {
  const issues: AgentValidationIssue[] = [];
  const bodyInputResolution = resolveBodyInputs(agent);
  const bodyOutputResolution = resolveBodyOutputs(agent);
  const neuronIds = new Set(agent.brain.neurons.map((neuron) => neuron.id));
  const containerIds = new Set(agent.brain.containers.map((container) => container.id));

  issues.push(...bodyInputResolution.issues, ...bodyOutputResolution.issues);
  issues.push(...buildBrainStructureIssues(agent));

  if (!containerIds.has(agent.brain.rootContainerId)) {
    issues.push({
      code: 'missing-brain-root-container',
      message: `Brain root container "${agent.brain.rootContainerId}" is missing.`,
    });
  }

  for (const connection of agent.connections) {
    if (connection.from.scope === 'brain' && !neuronIds.has(connection.from.nodeId)) {
      issues.push({
        code: 'missing-brain-node',
        message: `Agent connection "${connection.id}" references missing brain source "${connection.from.nodeId}".`,
      });
    }
    if (connection.to.scope === 'brain' && !neuronIds.has(connection.to.nodeId)) {
      issues.push({
        code: 'missing-brain-node',
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
        code: 'invalid-connection-direction',
        message: `Agent connection "${connection.id}" cannot start from bodyOutput.`,
      });
    }
    if (connection.from.scope === 'bodyInput' && connection.to.scope === 'bodyOutput') {
      issues.push({
        code: 'invalid-connection-direction',
        message: `Agent connection "${connection.id}" cannot connect bodyInput directly to bodyOutput.`,
      });
    }
    if (connection.to.scope === 'bodyInput') {
      issues.push({
        code: 'invalid-connection-direction',
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
        worldPort: node.worldPort,
        index: node.visualInputIndex,
        scale: node.scale,
      })),
    outputPorts: ACTION_CHANNELS.map((channel) => {
      const outputNode = [...bodyOutputsById.values()].find((node) => node.target === channel);
      return {
        id: outputNode?.id ?? `output-${channel}`,
        target: channel,
        normalizedTarget: outputNode?.normalizedTarget ?? `action.${channel}`,
        worldPort: outputNode?.worldPort ?? 'action',
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
