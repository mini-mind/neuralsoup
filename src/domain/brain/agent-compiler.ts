import type {
  AgentIR,
  AgentIRSummary,
  BodyInputNodeRuntime,
  BodyOutputNodeRuntime,
  BrainNeuronNode,
  DualExpConductanceSynapseModelIR,
  DualExpConductanceSynapseParameterOverrides,
  DualExpStdpSynapseModelIR,
  DualExpStdpSynapseParameterOverrides,
  NeuronModelIR,
  SingleExpConductanceSynapseModelIR,
  SingleExpConductanceSynapseParameterOverrides,
  StaticCurrentSynapseParameterOverrides,
  StaticCurrentSynapseModelIR,
  SynapseModelIR,
} from './agent-ir';
import { validateAgentIRModelCatalog } from './agent-ir';
import { resolveAgentBodyEndpointResolution } from './agent-body-rules';
import type { AgentProgram, AgentProgramConnection, AgentProgramNeuronNode } from './agent-program';
import type { IzhikevichNeuronParameters } from './shared';
import type { WorldRegistry } from './world-registry';

export type AgentValidationIssueCode =
  | 'missing-brain-root-container'
  | 'missing-brain-node'
  | 'duplicate-brain-node-id'
  | 'invalid-brain-structure'
  | 'invalid-connection-direction'
  | 'missing-neuron-model-id'
  | 'missing-synapse-model-id'
  | 'duplicate-neuron-model-id'
  | 'duplicate-synapse-model-id'
  | 'unsupported-synapse-kind'
  | 'invalid-synapse-parameter-resolution'
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

interface ResolvedBodyEndpoints<RuntimeNode> {
  nodesById: Map<string, RuntimeNode>;
  issues: AgentValidationIssue[];
}

interface AgentCompilationContext {
  issues: AgentValidationIssue[];
  bodyInputsById: Map<string, BodyInputNodeRuntime>;
  bodyOutputsById: Map<string, BodyOutputNodeRuntime>;
  summary: AgentIRSummary;
  neuronNodes: AgentProgramNeuronNode[];
  connections: AgentProgramConnection[];
}

const resolveBodyInputs = (agent: AgentIR, registry: WorldRegistry): ResolvedBodyEndpoints<BodyInputNodeRuntime> => {
  const resolution = resolveAgentBodyEndpointResolution(agent, registry);
  return {
    nodesById: resolution.inputNodesById,
    issues: resolution.issues
      .filter((issue) => issue.scope === 'input')
      .map((issue) => ({
        code: 'runtime-binding-error',
        message: issue.message,
      })),
  };
};

const resolveBodyOutputs = (agent: AgentIR, registry: WorldRegistry): ResolvedBodyEndpoints<BodyOutputNodeRuntime> => {
  const resolution = resolveAgentBodyEndpointResolution(agent, registry);
  return {
    nodesById: resolution.outputNodesById,
    issues: resolution.issues
      .filter((issue) => issue.scope === 'output')
      .map((issue) => ({
        code: 'runtime-binding-error',
        message: issue.message,
      })),
  };
};

const createCompiledAgentSummary = (
  agent: AgentIR,
  bodyInputsById: Map<string, BodyInputNodeRuntime>,
  bodyOutputsById: Map<string, BodyOutputNodeRuntime>
): AgentIRSummary => ({
  inputSignalCount: bodyInputsById.size,
  outputSignalCount: bodyOutputsById.size,
  neuronCount: agent.brain.neurons.length,
  connectionCount: agent.connections.length,
  leafLinkCount: agent.connections.length,
});

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

const createNeuronModelIndex = (agent: AgentIR): Map<string, NeuronModelIR> =>
  new Map(agent.brain.neuronModels.map((model) => [model.id, model]));

const createSynapseModelIndex = (agent: AgentIR): Map<string, SynapseModelIR> =>
  new Map(agent.brain.synapseModels.map((model) => [model.id, model]));

const resolveNeuronParameters = (
  neuron: BrainNeuronNode,
  model: NeuronModelIR
): IzhikevichNeuronParameters => ({
  ...model.params,
  ...(neuron.parameterOverrides ?? {}),
});

const createNeuronProgramNode = (
  neuron: BrainNeuronNode,
  neuronModelsById: Map<string, NeuronModelIR>
): AgentProgramNeuronNode => {
  const neuronModelId = neuron.neuronModelId?.trim() ?? '';
  if (!neuronModelId) {
    throw new Error(`Neuron "${neuron.id}" is missing required neuronModelId.`);
  }

  const neuronModel = neuronModelsById.get(neuronModelId);
  if (!neuronModel) {
    throw new Error(`Neuron "${neuron.id}" references missing neuron model "${neuronModelId}" during lowering.`);
  }

  const params = resolveNeuronParameters(neuron, neuronModel);
  return {
    id: neuron.id,
    label: neuron.label ?? neuron.id,
    neuronModelId,
    params,
    initialState: {
      v: neuron.initialState.v,
      u: neuron.initialState.u ?? params.b * neuron.initialState.v,
    },
    inputConnections: [],
    outputConnections: [],
  };
};

const createProgramConnection = (
  connection: AgentIR['connections'][number],
  synapseModel:
    | StaticCurrentSynapseModelIR
    | SingleExpConductanceSynapseModelIR
    | DualExpConductanceSynapseModelIR
    | DualExpStdpSynapseModelIR
): AgentProgramConnection => {
  if (synapseModel.kind === 'static-current') {
    const staticOverrides = (connection.parameterOverrides ?? {}) as Partial<StaticCurrentSynapseParameterOverrides>;
    const resolvedWeight =
      typeof staticOverrides.weight === 'number' && Number.isFinite(staticOverrides.weight)
        ? staticOverrides.weight
        : synapseModel.defaults.weight;
    const resolvedDelayMs =
      typeof staticOverrides.delayMs === 'number' && Number.isFinite(staticOverrides.delayMs)
        ? staticOverrides.delayMs
        : synapseModel.defaults.delayMs;

    return {
      id: connection.id,
      sourceNodeId: connection.from.nodeId,
      targetNodeId: connection.to.nodeId,
      synapseModelId: synapseModel.id,
      synapseKind: 'static-current',
      weight: resolvedWeight,
      delayMs: resolvedDelayMs,
    };
  }

  if (synapseModel.kind === 'single-exp-conductance') {
    const overrides = (connection.parameterOverrides ?? {}) as Partial<SingleExpConductanceSynapseParameterOverrides>;
    const resolvedWeight =
      typeof overrides.weight === 'number' && Number.isFinite(overrides.weight) ? overrides.weight : synapseModel.defaults.weight;
    const resolvedDelayMs =
      typeof overrides.delayMs === 'number' && Number.isFinite(overrides.delayMs) ? overrides.delayMs : synapseModel.defaults.delayMs;
    const resolvedGMax =
      typeof overrides.gMax === 'number' && Number.isFinite(overrides.gMax) ? overrides.gMax : synapseModel.defaults.gMax;
    const resolvedReversalPotential =
      typeof overrides.reversalPotential === 'number' && Number.isFinite(overrides.reversalPotential)
        ? overrides.reversalPotential
        : synapseModel.defaults.reversalPotential;
    const resolvedTauDecayMs =
      typeof overrides.tauDecayMs === 'number' && Number.isFinite(overrides.tauDecayMs)
        ? overrides.tauDecayMs
        : synapseModel.defaults.tauDecayMs;

    return {
      id: connection.id,
      sourceNodeId: connection.from.nodeId,
      targetNodeId: connection.to.nodeId,
      synapseModelId: synapseModel.id,
      synapseKind: 'single-exp-conductance',
      weight: resolvedWeight,
      delayMs: resolvedDelayMs,
      gMax: resolvedGMax,
      reversalPotential: resolvedReversalPotential,
      tauDecayMs: resolvedTauDecayMs,
    };
  }

  if (synapseModel.kind === 'dual-exp-conductance') {
    const overrides = (connection.parameterOverrides ?? {}) as Partial<DualExpConductanceSynapseParameterOverrides>;
    const resolvedWeight =
      typeof overrides.weight === 'number' && Number.isFinite(overrides.weight) ? overrides.weight : synapseModel.defaults.weight;
    const resolvedDelayMs =
      typeof overrides.delayMs === 'number' && Number.isFinite(overrides.delayMs) ? overrides.delayMs : synapseModel.defaults.delayMs;
    const resolvedGMax =
      typeof overrides.gMax === 'number' && Number.isFinite(overrides.gMax) ? overrides.gMax : synapseModel.defaults.gMax;
    const resolvedReversalPotential =
      typeof overrides.reversalPotential === 'number' && Number.isFinite(overrides.reversalPotential)
        ? overrides.reversalPotential
        : synapseModel.defaults.reversalPotential;
    const resolvedTauRiseMs =
      typeof overrides.tauRiseMs === 'number' && Number.isFinite(overrides.tauRiseMs)
        ? overrides.tauRiseMs
        : synapseModel.defaults.tauRiseMs;
    const resolvedTauDecayMs =
      typeof overrides.tauDecayMs === 'number' && Number.isFinite(overrides.tauDecayMs)
        ? overrides.tauDecayMs
        : synapseModel.defaults.tauDecayMs;

    return {
      id: connection.id,
      sourceNodeId: connection.from.nodeId,
      targetNodeId: connection.to.nodeId,
      synapseModelId: synapseModel.id,
      synapseKind: 'dual-exp-conductance',
      weight: resolvedWeight,
      delayMs: resolvedDelayMs,
      gMax: resolvedGMax,
      reversalPotential: resolvedReversalPotential,
      tauRiseMs: resolvedTauRiseMs,
      tauDecayMs: resolvedTauDecayMs,
    };
  }

  const overrides = (connection.parameterOverrides ?? {}) as Partial<DualExpStdpSynapseParameterOverrides>;
  const resolvedWeight =
    typeof overrides.weight === 'number' && Number.isFinite(overrides.weight) ? overrides.weight : synapseModel.defaults.weight;
  const resolvedDelayMs =
    typeof overrides.delayMs === 'number' && Number.isFinite(overrides.delayMs) ? overrides.delayMs : synapseModel.defaults.delayMs;
  const resolvedGMax =
    typeof overrides.gMax === 'number' && Number.isFinite(overrides.gMax) ? overrides.gMax : synapseModel.defaults.gMax;
  const resolvedReversalPotential =
    typeof overrides.reversalPotential === 'number' && Number.isFinite(overrides.reversalPotential)
      ? overrides.reversalPotential
      : synapseModel.defaults.reversalPotential;
  const resolvedTauRiseMs =
    typeof overrides.tauRiseMs === 'number' && Number.isFinite(overrides.tauRiseMs)
      ? overrides.tauRiseMs
      : synapseModel.defaults.tauRiseMs;
  const resolvedTauDecayMs =
    typeof overrides.tauDecayMs === 'number' && Number.isFinite(overrides.tauDecayMs)
      ? overrides.tauDecayMs
      : synapseModel.defaults.tauDecayMs;
  const resolvedAPlus =
    typeof overrides.aPlus === 'number' && Number.isFinite(overrides.aPlus) ? overrides.aPlus : synapseModel.defaults.aPlus;
  const resolvedAMinus =
    typeof overrides.aMinus === 'number' && Number.isFinite(overrides.aMinus) ? overrides.aMinus : synapseModel.defaults.aMinus;
  const resolvedTauPlusMs =
    typeof overrides.tauPlusMs === 'number' && Number.isFinite(overrides.tauPlusMs)
      ? overrides.tauPlusMs
      : synapseModel.defaults.tauPlusMs;
  const resolvedTauMinusMs =
    typeof overrides.tauMinusMs === 'number' && Number.isFinite(overrides.tauMinusMs)
      ? overrides.tauMinusMs
      : synapseModel.defaults.tauMinusMs;
  const resolvedWMin =
    typeof overrides.wMin === 'number' && Number.isFinite(overrides.wMin) ? overrides.wMin : synapseModel.defaults.wMin;
  const resolvedWMax =
    typeof overrides.wMax === 'number' && Number.isFinite(overrides.wMax) ? overrides.wMax : synapseModel.defaults.wMax;

  return {
    id: connection.id,
    sourceNodeId: connection.from.nodeId,
    targetNodeId: connection.to.nodeId,
    synapseModelId: synapseModel.id,
    synapseKind: 'dual-exp-stdp',
    weight: resolvedWeight,
    delayMs: resolvedDelayMs,
    gMax: resolvedGMax,
    reversalPotential: resolvedReversalPotential,
    tauRiseMs: resolvedTauRiseMs,
    tauDecayMs: resolvedTauDecayMs,
    aPlus: resolvedAPlus,
    aMinus: resolvedAMinus,
    tauPlusMs: resolvedTauPlusMs,
    tauMinusMs: resolvedTauMinusMs,
    wMin: resolvedWMin,
    wMax: resolvedWMax,
  };
};

const buildAgentCompilationContext = (agent: AgentIR, registry: WorldRegistry): AgentCompilationContext => {
  const issues: AgentValidationIssue[] = [];
  const bodyInputResolution = resolveBodyInputs(agent, registry);
  const bodyOutputResolution = resolveBodyOutputs(agent, registry);
  const neuronIds = new Set(agent.brain.neurons.map((neuron) => neuron.id));
  const containerIds = new Set(agent.brain.containers.map((container) => container.id));
  const neuronModelsById = createNeuronModelIndex(agent);
  const synapseModelsById = createSynapseModelIndex(agent);

  issues.push(...bodyInputResolution.issues, ...bodyOutputResolution.issues);
  issues.push(...buildBrainStructureIssues(agent));
  issues.push(...validateAgentIRModelCatalog(agent).map((issue) => {
    if (issue.code === 'missing-neuron-model') {
      return {
        code: 'missing-neuron-model-id' as const,
        message: issue.message,
      };
    }
    if (issue.code === 'missing-synapse-model') {
      return {
        code: 'missing-synapse-model-id' as const,
        message: issue.message,
      };
    }
    if (issue.code === 'duplicate-neuron-model-id') {
      return {
        code: 'duplicate-neuron-model-id' as const,
        message: issue.message,
      };
    }
    if (issue.code === 'duplicate-synapse-model-id') {
      return {
        code: 'duplicate-synapse-model-id' as const,
        message: issue.message,
      };
    }
    return {
      code: 'runtime-binding-error' as const,
      message: issue.message,
    };
  }));

  if (!containerIds.has(agent.brain.rootContainerId)) {
    issues.push({
      code: 'missing-brain-root-container',
      message: `Brain root container "${agent.brain.rootContainerId}" is missing.`,
    });
  }

  for (const connection of agent.connections) {
    const sourceScope = connection.from.scope;
    const targetScope = connection.to.scope;
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

    if (sourceScope === 'bodyOutput') {
      issues.push({
        code: 'invalid-connection-direction',
        message: `Agent connection "${connection.id}" cannot start from bodyOutput.`,
      });
    }
    if (sourceScope === 'bodyInput' && targetScope === 'bodyOutput') {
      issues.push({
        code: 'invalid-connection-direction',
        message: `Agent connection "${connection.id}" cannot connect bodyInput directly to bodyOutput.`,
      });
    }
    if (targetScope === 'bodyInput') {
      issues.push({
        code: 'invalid-connection-direction',
        message: `Agent connection "${connection.id}" cannot target bodyInput.`,
      });
    }

    const synapseModelId = connection.synapseModelId?.trim() ?? '';
    if (!synapseModelId) {
      issues.push({
        code: 'missing-synapse-model-id',
        message: `Agent connection "${connection.id}" is missing required synapseModelId.`,
      });
      continue;
    }

    const synapseModel = synapseModelsById.get(synapseModelId);
    if (!synapseModel) {
      continue;
    }

    if (synapseModel.kind === 'dual-exp-stp') {
      issues.push({
        code: 'unsupported-synapse-kind',
        message: `Agent connection "${connection.id}" uses unsupported synapse kind "${synapseModel.kind}" from model "${synapseModel.id}".`,
      });
      continue;
    }

    if (synapseModel.kind === 'static-current') {
      const staticOverrides = (connection.parameterOverrides ?? {}) as Partial<StaticCurrentSynapseParameterOverrides>;
      const resolvedWeight =
        typeof staticOverrides.weight === 'number' && Number.isFinite(staticOverrides.weight)
          ? staticOverrides.weight
          : synapseModel.defaults.weight;
      const resolvedDelayMs =
        typeof staticOverrides.delayMs === 'number' && Number.isFinite(staticOverrides.delayMs)
          ? staticOverrides.delayMs
          : synapseModel.defaults.delayMs;
      if (!Number.isFinite(resolvedWeight) || !Number.isFinite(resolvedDelayMs)) {
        issues.push({
          code: 'invalid-synapse-parameter-resolution',
          message: `Agent connection "${connection.id}" could not resolve static-current weight/delayMs from synapse model "${synapseModel.id}".`,
        });
      }
      continue;
    }

    if (synapseModel.kind === 'single-exp-conductance') {
      const overrides = (connection.parameterOverrides ?? {}) as Partial<SingleExpConductanceSynapseParameterOverrides>;
      const resolvedWeight =
        typeof overrides.weight === 'number' && Number.isFinite(overrides.weight) ? overrides.weight : synapseModel.defaults.weight;
      const resolvedDelayMs =
        typeof overrides.delayMs === 'number' && Number.isFinite(overrides.delayMs) ? overrides.delayMs : synapseModel.defaults.delayMs;
      const resolvedGMax =
        typeof overrides.gMax === 'number' && Number.isFinite(overrides.gMax) ? overrides.gMax : synapseModel.defaults.gMax;
      const resolvedReversalPotential =
        typeof overrides.reversalPotential === 'number' && Number.isFinite(overrides.reversalPotential)
          ? overrides.reversalPotential
          : synapseModel.defaults.reversalPotential;
      const resolvedTauDecayMs =
        typeof overrides.tauDecayMs === 'number' && Number.isFinite(overrides.tauDecayMs)
          ? overrides.tauDecayMs
          : synapseModel.defaults.tauDecayMs;

      if (
        !Number.isFinite(resolvedWeight) ||
        !Number.isFinite(resolvedDelayMs) ||
        !Number.isFinite(resolvedGMax) ||
        !Number.isFinite(resolvedReversalPotential) ||
        !Number.isFinite(resolvedTauDecayMs) ||
        resolvedTauDecayMs <= 0
      ) {
        issues.push({
          code: 'invalid-synapse-parameter-resolution',
          message: `Agent connection "${connection.id}" could not resolve single-exp-conductance parameters (weight, delayMs, gMax, reversalPotential, tauDecayMs>0) from synapse model "${synapseModel.id}".`,
        });
      }
      continue;
    }

    if (synapseModel.kind === 'dual-exp-conductance') {
      const overrides = (connection.parameterOverrides ?? {}) as Partial<DualExpConductanceSynapseParameterOverrides>;
      const resolvedWeight =
        typeof overrides.weight === 'number' && Number.isFinite(overrides.weight) ? overrides.weight : synapseModel.defaults.weight;
      const resolvedDelayMs =
        typeof overrides.delayMs === 'number' && Number.isFinite(overrides.delayMs) ? overrides.delayMs : synapseModel.defaults.delayMs;
      const resolvedGMax =
        typeof overrides.gMax === 'number' && Number.isFinite(overrides.gMax) ? overrides.gMax : synapseModel.defaults.gMax;
      const resolvedReversalPotential =
        typeof overrides.reversalPotential === 'number' && Number.isFinite(overrides.reversalPotential)
          ? overrides.reversalPotential
          : synapseModel.defaults.reversalPotential;
      const resolvedTauRiseMs =
        typeof overrides.tauRiseMs === 'number' && Number.isFinite(overrides.tauRiseMs)
          ? overrides.tauRiseMs
          : synapseModel.defaults.tauRiseMs;
      const resolvedTauDecayMs =
        typeof overrides.tauDecayMs === 'number' && Number.isFinite(overrides.tauDecayMs)
          ? overrides.tauDecayMs
          : synapseModel.defaults.tauDecayMs;

      if (
        !Number.isFinite(resolvedWeight) ||
        !Number.isFinite(resolvedDelayMs) ||
        !Number.isFinite(resolvedGMax) ||
        !Number.isFinite(resolvedReversalPotential) ||
        !Number.isFinite(resolvedTauRiseMs) ||
        !Number.isFinite(resolvedTauDecayMs) ||
        resolvedTauRiseMs <= 0 ||
        resolvedTauDecayMs <= 0
      ) {
        issues.push({
          code: 'invalid-synapse-parameter-resolution',
          message: `Agent connection "${connection.id}" could not resolve dual-exp-conductance parameters (weight, delayMs, gMax, reversalPotential, tauRiseMs>0, tauDecayMs>0) from synapse model "${synapseModel.id}".`,
        });
      }
      continue;
    }

    const overrides = (connection.parameterOverrides ?? {}) as Partial<DualExpStdpSynapseParameterOverrides>;
    const resolvedWeight =
      typeof overrides.weight === 'number' && Number.isFinite(overrides.weight) ? overrides.weight : synapseModel.defaults.weight;
    const resolvedDelayMs =
      typeof overrides.delayMs === 'number' && Number.isFinite(overrides.delayMs) ? overrides.delayMs : synapseModel.defaults.delayMs;
    const resolvedGMax =
      typeof overrides.gMax === 'number' && Number.isFinite(overrides.gMax) ? overrides.gMax : synapseModel.defaults.gMax;
    const resolvedReversalPotential =
      typeof overrides.reversalPotential === 'number' && Number.isFinite(overrides.reversalPotential)
        ? overrides.reversalPotential
        : synapseModel.defaults.reversalPotential;
    const resolvedTauRiseMs =
      typeof overrides.tauRiseMs === 'number' && Number.isFinite(overrides.tauRiseMs)
        ? overrides.tauRiseMs
        : synapseModel.defaults.tauRiseMs;
    const resolvedTauDecayMs =
      typeof overrides.tauDecayMs === 'number' && Number.isFinite(overrides.tauDecayMs)
        ? overrides.tauDecayMs
        : synapseModel.defaults.tauDecayMs;
    const resolvedAPlus =
      typeof overrides.aPlus === 'number' && Number.isFinite(overrides.aPlus) ? overrides.aPlus : synapseModel.defaults.aPlus;
    const resolvedAMinus =
      typeof overrides.aMinus === 'number' && Number.isFinite(overrides.aMinus) ? overrides.aMinus : synapseModel.defaults.aMinus;
    const resolvedTauPlusMs =
      typeof overrides.tauPlusMs === 'number' && Number.isFinite(overrides.tauPlusMs)
        ? overrides.tauPlusMs
        : synapseModel.defaults.tauPlusMs;
    const resolvedTauMinusMs =
      typeof overrides.tauMinusMs === 'number' && Number.isFinite(overrides.tauMinusMs)
        ? overrides.tauMinusMs
        : synapseModel.defaults.tauMinusMs;
    const resolvedWMin =
      typeof overrides.wMin === 'number' && Number.isFinite(overrides.wMin) ? overrides.wMin : synapseModel.defaults.wMin;
    const resolvedWMax =
      typeof overrides.wMax === 'number' && Number.isFinite(overrides.wMax) ? overrides.wMax : synapseModel.defaults.wMax;

    if (
      !Number.isFinite(resolvedWeight) ||
      !Number.isFinite(resolvedDelayMs) ||
      !Number.isFinite(resolvedGMax) ||
      !Number.isFinite(resolvedReversalPotential) ||
      !Number.isFinite(resolvedTauRiseMs) ||
      !Number.isFinite(resolvedTauDecayMs) ||
      !Number.isFinite(resolvedAPlus) ||
      !Number.isFinite(resolvedAMinus) ||
      !Number.isFinite(resolvedTauPlusMs) ||
      !Number.isFinite(resolvedTauMinusMs) ||
      !Number.isFinite(resolvedWMin) ||
      !Number.isFinite(resolvedWMax) ||
      resolvedTauRiseMs <= 0 ||
      resolvedTauDecayMs <= 0 ||
      resolvedTauPlusMs <= 0 ||
      resolvedTauMinusMs <= 0 ||
      resolvedWMin > resolvedWMax
    ) {
      issues.push({
        code: 'invalid-synapse-parameter-resolution',
        message: `Agent connection "${connection.id}" could not resolve dual-exp-stdp parameters (weight, delayMs, gMax, reversalPotential, tauRiseMs>0, tauDecayMs>0, aPlus, aMinus, tauPlusMs>0, tauMinusMs>0, wMin<=wMax) from synapse model "${synapseModel.id}".`,
      });
    }
  }

  if (issues.length > 0) {
    return {
      issues,
      bodyInputsById: bodyInputResolution.nodesById,
      bodyOutputsById: bodyOutputResolution.nodesById,
      summary: createCompiledAgentSummary(agent, bodyInputResolution.nodesById, bodyOutputResolution.nodesById),
      neuronNodes: [],
      connections: [],
    };
  }

  const neuronNodes = agent.brain.neurons.map((neuron) => createNeuronProgramNode(neuron, neuronModelsById));
  const connections = agent.connections.map((connection) => {
    const synapseModelId = connection.synapseModelId?.trim() ?? '';
    const synapseModel = synapseModelsById.get(synapseModelId);
    if (
      !synapseModel ||
      (synapseModel.kind !== 'static-current' &&
        synapseModel.kind !== 'single-exp-conductance' &&
        synapseModel.kind !== 'dual-exp-conductance' &&
        synapseModel.kind !== 'dual-exp-stdp')
    ) {
      throw new Error(
        `Connection "${connection.id}" cannot be lowered: unsupported synapse kind for model "${synapseModelId}".`
      );
    }

    return createProgramConnection(connection, synapseModel);
  });

  return {
    issues,
    bodyInputsById: bodyInputResolution.nodesById,
    bodyOutputsById: bodyOutputResolution.nodesById,
    summary: createCompiledAgentSummary(agent, bodyInputResolution.nodesById, bodyOutputResolution.nodesById),
    neuronNodes,
    connections,
  };
};

export const validateAgentIR = (agent: AgentIR, registry: WorldRegistry): AgentValidationIssue[] =>
  buildAgentCompilationContext(agent, registry).issues;

export const compileAgentIR = (agent: AgentIR, registry: WorldRegistry): AgentProgram => {
  const { issues, bodyInputsById, bodyOutputsById, summary, neuronNodes, connections } =
    buildAgentCompilationContext(agent, registry);
  if (issues.length > 0) {
    throw new AgentValidationError(issues);
  }

  const neuronNodeIndex = new Map(neuronNodes.map((node) => [node.id, node]));
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
    summary,
    inputPorts: [...bodyInputsById.values()]
      .sort((left, right) => left.source.localeCompare(right.source) || left.id.localeCompare(right.id))
      .map((node) => ({
        id: node.id,
        source: node.source,
        worldPort: node.worldPort,
        scale: node.scale,
      })),
    outputPorts: [...bodyOutputsById.values()]
      .sort((left, right) => left.target.localeCompare(right.target) || left.id.localeCompare(right.id))
      .map((node) => ({
        id: node.id,
        target: node.target,
        normalizedTarget: node.normalizedTarget,
        worldPort: node.worldPort,
        commandKind: node.commandKind,
        decayPerSecond: node.decayPerSecond,
      })),
    neuronNodes,
    connections,
    bodyInputsById,
    bodyOutputsById,
    neuronNodeIndex,
  };
};
