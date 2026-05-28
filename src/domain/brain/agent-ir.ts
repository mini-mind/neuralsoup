import type { IzhikevichNeuronParameters, Position } from './shared';

export interface AgentMetadata {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BodyInputEndpointIR {
  id: string;
  source: string;
  worldPort?: string;
  scale: number;
}

export interface BodyOutputEndpointIR {
  id: string;
  target: string;
  worldPort?: string;
  decayPerSecond: number;
}

export interface BodyInputMappingIR {
  id: string;
  kind: 'input';
  endpointId: string;
  nodeId: string;
}

export interface BodyOutputMappingIR {
  id: string;
  kind: 'output';
  endpointId: string;
  nodeId: string;
}

export type BodyMappingIR = BodyInputMappingIR | BodyOutputMappingIR;

export interface BodyIR {
  inputEndpoints: BodyInputEndpointIR[];
  outputEndpoints: BodyOutputEndpointIR[];
  mappings: BodyMappingIR[];
}

export interface BrainNeuronInitialState {
  v: number;
  u?: number;
}

export interface NeuronModelIR {
  id: string;
  family: 'izhikevich';
  label?: string;
  params: IzhikevichNeuronParameters;
}

export interface StaticCurrentSynapseModelIR {
  id: string;
  label?: string;
  kind: 'static-current';
  defaults: {
    weight: number;
    delayMs: number;
  };
}

export interface SingleExpConductanceSynapseModelIR {
  id: string;
  label?: string;
  kind: 'single-exp-conductance';
  defaults: {
    weight: number;
    delayMs: number;
    gMax: number;
    reversalPotential: number;
    tauDecayMs: number;
  };
}

export interface DualExpConductanceSynapseModelIR {
  id: string;
  label?: string;
  kind: 'dual-exp-conductance';
  defaults: {
    weight: number;
    delayMs: number;
    gMax: number;
    reversalPotential: number;
    tauRiseMs: number;
    tauDecayMs: number;
  };
}

export interface DualExpStdpSynapseModelIR {
  id: string;
  label?: string;
  kind: 'dual-exp-stdp';
  defaults: {
    weight: number;
    delayMs: number;
    gMax: number;
    reversalPotential: number;
    tauRiseMs: number;
    tauDecayMs: number;
    aPlus: number;
    aMinus: number;
    tauPlusMs: number;
    tauMinusMs: number;
    wMin: number;
    wMax: number;
  };
}

export interface DualExpStpSynapseModelIR {
  id: string;
  label?: string;
  kind: 'dual-exp-stp';
  defaults: {
    weight: number;
    delayMs: number;
    gMax: number;
    reversalPotential: number;
    tauRiseMs: number;
    tauDecayMs: number;
    utilization: number;
    tauFacilitationMs: number;
    tauRecoveryMs: number;
  };
}

export type SynapseModelIR =
  | StaticCurrentSynapseModelIR
  | SingleExpConductanceSynapseModelIR
  | DualExpConductanceSynapseModelIR
  | DualExpStdpSynapseModelIR
  | DualExpStpSynapseModelIR;

export type NeuronParameterOverrides = Partial<IzhikevichNeuronParameters>;

export interface StaticCurrentSynapseParameterOverrides {
  weight?: number;
  delayMs?: number;
}

export interface SingleExpConductanceSynapseParameterOverrides extends StaticCurrentSynapseParameterOverrides {
  gMax?: number;
  reversalPotential?: number;
  tauDecayMs?: number;
}

export interface DualExpConductanceSynapseParameterOverrides extends StaticCurrentSynapseParameterOverrides {
  gMax?: number;
  reversalPotential?: number;
  tauRiseMs?: number;
  tauDecayMs?: number;
}

export interface DualExpStdpSynapseParameterOverrides extends DualExpConductanceSynapseParameterOverrides {
  aPlus?: number;
  aMinus?: number;
  tauPlusMs?: number;
  tauMinusMs?: number;
  wMin?: number;
  wMax?: number;
}

export interface DualExpStpSynapseParameterOverrides extends DualExpConductanceSynapseParameterOverrides {
  utilization?: number;
  tauFacilitationMs?: number;
  tauRecoveryMs?: number;
}

export type SynapseParameterOverrides =
  | StaticCurrentSynapseParameterOverrides
  | SingleExpConductanceSynapseParameterOverrides
  | DualExpConductanceSynapseParameterOverrides
  | DualExpStdpSynapseParameterOverrides
  | DualExpStpSynapseParameterOverrides;

export interface BrainNeuronNode {
  id: string;
  label?: string;
  neuronModelId: string;
  parameterOverrides?: NeuronParameterOverrides;
  initialState: BrainNeuronInitialState;
}

export interface BrainContainerChildRef {
  scope: 'brain' | 'signal' | 'container';
  nodeId: string;
}

export interface BrainContainerNode {
  id: string;
  label?: string;
  children: BrainContainerChildRef[];
}

export interface BrainIR {
  neuronModels: NeuronModelIR[];
  synapseModels: SynapseModelIR[];
  neurons: BrainNeuronNode[];
  containers: BrainContainerNode[];
  rootContainerId: string;
}

export type ConnectionEndpointIR =
  | { scope: 'bodyInput'; nodeId: string; portId?: string }
  | { scope: 'bodyOutput'; nodeId: string; portId?: string }
  | { scope: 'brain'; nodeId: string; portId?: string };

export interface ConnectionIR {
  id: string;
  from: ConnectionEndpointIR;
  to: ConnectionEndpointIR;
  synapseModelId: string;
  parameterOverrides?: SynapseParameterOverrides;
}

export type AgentConnectionEndpoint = ConnectionEndpointIR;
export type AgentConnection = ConnectionIR;

export interface AgentLayoutNodeState {
  position?: Position;
  collapsed?: boolean;
}

export interface AgentLayoutIR {
  nodes: Record<string, AgentLayoutNodeState>;
}

export interface AgentIR {
  metadata: AgentMetadata;
  body: BodyIR;
  brain: BrainIR;
  connections: ConnectionIR[];
  layout?: AgentLayoutIR;
}

export interface AgentIRSummary {
  inputSignalCount: number;
  outputSignalCount: number;
  neuronCount: number;
  connectionCount: number;
  leafLinkCount: number;
}

export type AgentIRModelValidationIssueCode =
  | 'missing-neuron-model'
  | 'missing-synapse-model'
  | 'duplicate-neuron-model-id'
  | 'duplicate-synapse-model-id'
  | 'invalid-neuron-parameter-override'
  | 'invalid-synapse-parameter-override';

export interface AgentIRModelValidationIssue {
  code: AgentIRModelValidationIssueCode;
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const IZHIKEVICH_PARAM_KEYS: (keyof IzhikevichNeuronParameters)[] = ['a', 'b', 'c', 'd', 'threshold'];
const STATIC_CURRENT_KEYS = ['weight', 'delayMs'] as const;
const SINGLE_EXP_KEYS = [...STATIC_CURRENT_KEYS, 'gMax', 'reversalPotential', 'tauDecayMs'] as const;
const DUAL_EXP_KEYS = [...STATIC_CURRENT_KEYS, 'gMax', 'reversalPotential', 'tauRiseMs', 'tauDecayMs'] as const;
const DUAL_EXP_STDP_KEYS = [
  ...DUAL_EXP_KEYS,
  'aPlus',
  'aMinus',
  'tauPlusMs',
  'tauMinusMs',
  'wMin',
  'wMax',
] as const;
const DUAL_EXP_STP_KEYS = [...DUAL_EXP_KEYS, 'utilization', 'tauFacilitationMs', 'tauRecoveryMs'] as const;

const validateNumericOverride = (
  override: Record<string, unknown>,
  allowedKeys: readonly string[],
  context: string,
  issueCode: AgentIRModelValidationIssueCode
): AgentIRModelValidationIssue | null => {
  for (const [key, value] of Object.entries(override)) {
    if (!allowedKeys.includes(key) || !isFiniteNumber(value)) {
      return {
        code: issueCode,
        message: `${context} has invalid override "${key}".`,
      };
    }
  }

  return null;
};

const validateNeuronParameterOverrides = (
  overrides: unknown,
  neuronId: string
): AgentIRModelValidationIssue | null => {
  if (!isRecord(overrides)) {
    return {
      code: 'invalid-neuron-parameter-override',
      message: `Neuron "${neuronId}" parameterOverrides must be an object.`,
    };
  }

  return validateNumericOverride(
    overrides,
    IZHIKEVICH_PARAM_KEYS,
    `Neuron "${neuronId}" parameterOverrides`,
    'invalid-neuron-parameter-override'
  );
};

const validateSynapseParameterOverrides = (
  overrides: unknown,
  synapseKind: SynapseModelIR['kind'],
  connectionId: string
): AgentIRModelValidationIssue | null => {
  if (!isRecord(overrides)) {
    return {
      code: 'invalid-synapse-parameter-override',
      message: `Connection "${connectionId}" parameterOverrides must be an object.`,
    };
  }

  const allowedKeys =
    synapseKind === 'static-current'
      ? STATIC_CURRENT_KEYS
      : synapseKind === 'single-exp-conductance'
        ? SINGLE_EXP_KEYS
        : synapseKind === 'dual-exp-conductance'
          ? DUAL_EXP_KEYS
          : synapseKind === 'dual-exp-stdp'
            ? DUAL_EXP_STDP_KEYS
            : DUAL_EXP_STP_KEYS;

  return validateNumericOverride(
    overrides,
    allowedKeys,
    `Connection "${connectionId}" parameterOverrides`,
    'invalid-synapse-parameter-override'
  );
};

export const validateAgentIRModelCatalog = (agent: AgentIR): AgentIRModelValidationIssue[] => {
  const issues: AgentIRModelValidationIssue[] = [];
  const neuronModelIds = new Set<string>();
  const synapseModelIds = new Set<string>();
  const synapseModelsById = new Map<string, SynapseModelIR>();

  for (const model of agent.brain.neuronModels) {
    if (neuronModelIds.has(model.id)) {
      issues.push({
        code: 'duplicate-neuron-model-id',
        message: `Neuron model id "${model.id}" is duplicated.`,
      });
      continue;
    }
    neuronModelIds.add(model.id);
  }

  for (const model of agent.brain.synapseModels) {
    if (synapseModelIds.has(model.id)) {
      issues.push({
        code: 'duplicate-synapse-model-id',
        message: `Synapse model id "${model.id}" is duplicated.`,
      });
      continue;
    }
    synapseModelIds.add(model.id);
    synapseModelsById.set(model.id, model);
  }

  for (const neuron of agent.brain.neurons) {
    if (!neuronModelIds.has(neuron.neuronModelId.trim())) {
      issues.push({
        code: 'missing-neuron-model',
        message: `Neuron "${neuron.id}" references missing neuron model "${neuron.neuronModelId}".`,
      });
    }

    if (neuron.parameterOverrides) {
      const overrideIssue = validateNeuronParameterOverrides(neuron.parameterOverrides, neuron.id);
      if (overrideIssue) {
        issues.push(overrideIssue);
      }
    }
  }

  for (const connection of agent.connections) {
    const synapseModel = synapseModelsById.get(connection.synapseModelId.trim());
    if (!synapseModel) {
      issues.push({
        code: 'missing-synapse-model',
        message: `Connection "${connection.id}" references missing synapse model "${connection.synapseModelId}".`,
      });
      continue;
    }

    if (connection.parameterOverrides) {
      const overrideIssue = validateSynapseParameterOverrides(
        connection.parameterOverrides,
        synapseModel.kind,
        connection.id
      );
      if (overrideIssue) {
        issues.push(overrideIssue);
      }
    }
  }

  return issues;
};

export interface BodyInputNodeRuntime {
  id: string;
  source: string;
  worldPort: string;
  scale: number;
}

export interface BodyOutputNodeRuntime {
  id: string;
  target: string;
  normalizedTarget: string;
  worldPort: string;
  commandKind: string;
  decayPerSecond: number;
}

export const resolveBodyInputVisionCellIndex = (
  nodeId: string,
  body: BodyIR
): number | null => {
  const mappings = body.mappings.filter(
    (mapping): mapping is BodyInputMappingIR => mapping.kind === 'input' && mapping.nodeId === nodeId
  );

  if (mappings.length !== 1) {
    return null;
  }

  const endpoint = body.inputEndpoints.find((entry) => entry.id === mappings[0].endpointId);
  if (!endpoint) {
    return null;
  }

  const match = endpoint.source.match(/^vision\.[^.]+\.(\d+)$/);
  if (!match) {
    return null;
  }

  const cellIndex = Number.parseInt(match[1], 10);
  return Number.isFinite(cellIndex) ? cellIndex : null;
};
