import { useCallback } from 'react';
import type { AgentIR } from '../../domain/brain';
import { preflightBrainStructure } from '../../domain/brain';
import type { GraphLinkUpdatePayload, GraphNodeUpdatePayload } from '../editor/graph/graphNodeUpdate';
import { GRAPH_SEMANTIC_CHANGE } from './graphDocumentChangePolicy';
import type { GraphDocumentChangeOptions } from './useSNNTopologyState';

const DEFAULT_NEURON_PARAMETER_OVERRIDES = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
} as const;

const KNOWN_NEURON_PARAM_KEYS: Array<keyof typeof DEFAULT_NEURON_PARAMETER_OVERRIDES> = [
  'a',
  'b',
  'c',
  'd',
  'threshold',
];

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const toNumericRecord = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const numericRecord: Record<string, number> = {};
  for (const [key, candidate] of Object.entries(record)) {
    if (isFiniteNumber(candidate)) {
      numericRecord[key] = candidate;
    }
  }
  return numericRecord;
};

const hasNeuronModelId = (agent: AgentIR, modelId: string): boolean =>
  (agent.brain.neuronModels ?? []).some((model) => model.id === modelId);

const hasSynapseModelId = (agent: AgentIR, modelId: string): boolean =>
  (agent.brain.synapseModels ?? []).some((model) => model.id === modelId);

const resolveNeuronModelById = (agent: AgentIR, modelId: string) =>
  (agent.brain.neuronModels ?? []).find((model) => model.id === modelId) ?? null;

const isCurrentBrainStructurallyEditable = (agent: AgentIR) => preflightBrainStructure(agent.brain).ok;

interface UseGraphEntityDetailCommandsOptions {
  graphStructureEditable: boolean;
  setAgent: (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => void;
}

export const useGraphEntityDetailCommands = ({
  graphStructureEditable,
  setAgent,
}: UseGraphEntityDetailCommandsOptions) => {
  const updateNodeLabelAndParams = useCallback(
    (nodeId: string, payload: GraphNodeUpdatePayload) => {
      if (!graphStructureEditable) {
        return;
      }

      setAgent((current) => {
        if (!isCurrentBrainStructurallyEditable(current)) {
          return current;
        }

        const hasTargetNode = current.brain.neurons.some((neuron) => neuron.id === nodeId);
        if (!hasTargetNode) {
          return current;
        }

        const neuronModelIdProvided = payload.neuronModelId !== undefined;
        const nextNeuronModelId = payload.neuronModelId?.trim();
        if (neuronModelIdProvided && !nextNeuronModelId) {
          return current;
        }
        if (nextNeuronModelId && !hasNeuronModelId(current, nextNeuronModelId)) {
          return current;
        }

        const nextParameterOverrides = toNumericRecord(payload.parameterOverrides);
        const parameterOverridesProvided = payload.parameterOverrides !== undefined;
        const normalizedInitialState =
          payload.initialState && isFiniteNumber(payload.initialState.v)
            ? {
                v: payload.initialState.v,
                ...(isFiniteNumber(payload.initialState.u) ? { u: payload.initialState.u } : {}),
              }
            : undefined;

        return {
          ...current,
          brain: {
            ...current.brain,
            neurons: current.brain.neurons.map((neuron) =>
              neuron.id === nodeId
                ? {
                    ...neuron,
                    ...(() => {
                      const targetNeuronModelId = nextNeuronModelId ?? neuron.neuronModelId;
                      const modelParams = resolveNeuronModelById(current, targetNeuronModelId)?.params ?? null;
                      const effectiveParameterOverrides = parameterOverridesProvided
                        ? nextParameterOverrides
                        : toNumericRecord(neuron.parameterOverrides);
                      const resolvedParameters = modelParams
                        ? {
                            ...modelParams,
                            ...effectiveParameterOverrides,
                          }
                        : effectiveParameterOverrides;

                      return {
                        parameterOverrides: effectiveParameterOverrides,
                        ...(resolvedParameters
                          ? {
                              params: Object.fromEntries(
                                KNOWN_NEURON_PARAM_KEYS.flatMap((key) =>
                                  isFiniteNumber(resolvedParameters[key]) ? [[key, resolvedParameters[key]]] : []
                                )
                              ),
                            }
                          : {}),
                      };
                    })(),
                    label: payload.label,
                    ...(nextNeuronModelId ? { neuronModelId: nextNeuronModelId } : {}),
                    ...(normalizedInitialState ? { initialState: normalizedInitialState } : {}),
                  }
                : neuron
            ),
          },
        };
      }, GRAPH_SEMANTIC_CHANGE);
    },
    [graphStructureEditable, setAgent]
  );

  const updateLinkWeight = useCallback(
    (linkId: string, payloadOrWeight: number | GraphLinkUpdatePayload) => {
      if (!graphStructureEditable) {
        return;
      }

      setAgent((current) => {
        if (!isCurrentBrainStructurallyEditable(current)) {
          return current;
        }

        const hasTargetLink = current.connections.some((link) => link.id === linkId);
        if (!hasTargetLink) {
          return current;
        }

        const payload: GraphLinkUpdatePayload =
          typeof payloadOrWeight === 'number'
            ? {
                parameterOverrides: { weight: payloadOrWeight },
              }
            : payloadOrWeight;
        const synapseModelIdProvided = payload.synapseModelId !== undefined;
        const requestedSynapseModelId = payload.synapseModelId?.trim();
        const targetSynapseModelId = requestedSynapseModelId ?? null;
        if (synapseModelIdProvided && !requestedSynapseModelId) {
          return current;
        }
        if (targetSynapseModelId && !hasSynapseModelId(current, targetSynapseModelId)) {
          return current;
        }

        return {
          ...current,
          connections: current.connections.map((link) =>
            link.id !== linkId
              ? link
              : (() => {
                  const activeSynapseModelId = targetSynapseModelId ?? link.synapseModelId?.trim() ?? '';
                  if (!activeSynapseModelId || !hasSynapseModelId(current, activeSynapseModelId)) {
                    return link;
                  }

                  const incomingOverrides = toNumericRecord(payload.parameterOverrides);
                  const mergedParameterOverrides: Record<string, number> = {
                    ...toNumericRecord(link.parameterOverrides),
                    ...incomingOverrides,
                  };

                  return {
                    ...link,
                    synapseModelId: activeSynapseModelId,
                    parameterOverrides: mergedParameterOverrides,
                  };
                })()
          ),
        };
      }, GRAPH_SEMANTIC_CHANGE);
    },
    [graphStructureEditable, setAgent]
  );

  return {
    updateNodeLabelAndParams,
    updateLinkWeight,
  };
};
