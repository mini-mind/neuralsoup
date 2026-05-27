import { useCallback } from 'react';
import { mutateBodyIR, type AgentIR } from '../../domain/brain';
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
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

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

        const targetNeuron = current.brain.neurons.find((neuron) => neuron.id === nodeId) ?? null;
        const targetContainer = current.brain.containers.find((container) => container.id === nodeId) ?? null;
        const targetInputEndpoint = current.body.inputEndpoints.find((endpoint) => endpoint.id === nodeId) ?? null;
        const targetOutputEndpoint = current.body.outputEndpoints.find((endpoint) => endpoint.id === nodeId) ?? null;
        const requestedNodeKind = payload.nodeKind;
        const isContainerUpdate = requestedNodeKind === 'neuron-group' || (!requestedNodeKind && targetContainer != null);
        const isSignalUpdate = requestedNodeKind === 'signal' || (!requestedNodeKind && (targetInputEndpoint != null || targetOutputEndpoint != null));

        if (isContainerUpdate) {
          if (!targetContainer) {
            return current;
          }

          return {
            ...current,
            brain: {
              ...current.brain,
              containers: current.brain.containers.map((container) =>
                container.id === nodeId
                  ? {
                      ...container,
                      label: payload.label,
                    }
                  : container
              ),
            },
          };
        }

        if (isSignalUpdate) {
          if (targetInputEndpoint) {
            const requestedNodeId = payload.label?.trim();
            const nextNodeId =
              isNonEmptyString(requestedNodeId) && requestedNodeId !== nodeId ? requestedNodeId : nodeId;
            const layoutNodeState = current.layout?.nodes[nodeId];
            const nextBody = mutateBodyIR(current.body, [
              {
                type: 'input-endpoint.upsert',
                endpoint: {
                  ...targetInputEndpoint,
                  id: targetInputEndpoint.id,
                  source: payload.source?.trim() || targetInputEndpoint.source,
                  scale: payload.scale ?? targetInputEndpoint.scale,
                },
              },
              {
                type: 'mapping.replace-for-node',
                scope: 'input',
                nodeId: nextNodeId,
                mapping: {
                  id: `mapping-input-${nextNodeId}`,
                  kind: 'input',
                  endpointId: current.body.mappings.find((mapping) => mapping.kind === 'input' && mapping.nodeId === nodeId)?.endpointId ?? targetInputEndpoint.id,
                  nodeId: nextNodeId,
                },
              },
              ...(nextNodeId !== nodeId
                ? [
                    {
                      type: 'mapping.remove-for-node' as const,
                      scope: 'input' as const,
                      nodeId,
                    },
                  ]
                : []),
            ]).body;

            return {
              ...current,
              body: nextBody,
              connections:
                nextNodeId === nodeId
                  ? current.connections
                  : current.connections.map((connection) => ({
                      ...connection,
                      from:
                        connection.from.scope === 'bodyInput' && connection.from.nodeId === nodeId
                          ? { ...connection.from, nodeId: nextNodeId }
                          : connection.from,
                      to:
                        connection.to.scope === 'bodyInput' && connection.to.nodeId === nodeId
                          ? { ...connection.to, nodeId: nextNodeId }
                          : connection.to,
                    })),
              ...(nextNodeId === nodeId
                ? {}
                : {
                    layout: {
                      ...(current.layout ?? {}),
                      nodes: {
                        ...Object.fromEntries(
                          Object.entries(current.layout?.nodes ?? {}).filter(([layoutNodeId]) => layoutNodeId !== nodeId)
                        ),
                        ...(layoutNodeState ? { [nextNodeId]: layoutNodeState } : {}),
                      },
                    },
                  }),
            };
          }

          if (targetOutputEndpoint) {
            const requestedNodeId = payload.label?.trim();
            const nextNodeId =
              isNonEmptyString(requestedNodeId) && requestedNodeId !== nodeId ? requestedNodeId : nodeId;
            const layoutNodeState = current.layout?.nodes[nodeId];
            const nextBody = mutateBodyIR(current.body, [
              {
                type: 'output-endpoint.upsert',
                endpoint: {
                  ...targetOutputEndpoint,
                  id: targetOutputEndpoint.id,
                  target: payload.target?.trim() || targetOutputEndpoint.target,
                  decayPerSecond: payload.decayPerSecond ?? targetOutputEndpoint.decayPerSecond,
                },
              },
              {
                type: 'mapping.replace-for-node',
                scope: 'output',
                nodeId: nextNodeId,
                mapping: {
                  id: `mapping-output-${nextNodeId}`,
                  kind: 'output',
                  endpointId: current.body.mappings.find((mapping) => mapping.kind === 'output' && mapping.nodeId === nodeId)?.endpointId ?? targetOutputEndpoint.id,
                  nodeId: nextNodeId,
                },
              },
              ...(nextNodeId !== nodeId
                ? [
                    {
                      type: 'mapping.remove-for-node' as const,
                      scope: 'output' as const,
                      nodeId,
                    },
                  ]
                : []),
            ]).body;

            return {
              ...current,
              body: nextBody,
              connections:
                nextNodeId === nodeId
                  ? current.connections
                  : current.connections.map((connection) => ({
                      ...connection,
                      from:
                        connection.from.scope === 'bodyOutput' && connection.from.nodeId === nodeId
                          ? { ...connection.from, nodeId: nextNodeId }
                          : connection.from,
                      to:
                        connection.to.scope === 'bodyOutput' && connection.to.nodeId === nodeId
                          ? { ...connection.to, nodeId: nextNodeId }
                          : connection.to,
                    })),
              ...(nextNodeId === nodeId
                ? {}
                : {
                    layout: {
                      ...(current.layout ?? {}),
                      nodes: {
                        ...Object.fromEntries(
                          Object.entries(current.layout?.nodes ?? {}).filter(([layoutNodeId]) => layoutNodeId !== nodeId)
                        ),
                        ...(layoutNodeState ? { [nextNodeId]: layoutNodeState } : {}),
                      },
                    },
                  }),
            };
          }

          return current;
        }

        if (!targetNeuron) {
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

  const updateAggregateLinks = useCallback(
    (linkIds: string[], payload: GraphLinkUpdatePayload) => {
      if (!graphStructureEditable || linkIds.length === 0) {
        return;
      }

      const uniqueLinkIds = [...new Set(linkIds)];
      setAgent((current) => {
        if (!isCurrentBrainStructurallyEditable(current)) {
          return current;
        }

        const existingLinkIds = new Set(current.connections.map((link) => link.id));
        if (uniqueLinkIds.some((linkId) => !existingLinkIds.has(linkId))) {
          return current;
        }

        const synapseModelIdProvided = payload.synapseModelId !== undefined;
        const requestedSynapseModelId = payload.synapseModelId?.trim();
        const targetSynapseModelId = requestedSynapseModelId ?? null;
        if (synapseModelIdProvided && !requestedSynapseModelId) {
          return current;
        }
        if (targetSynapseModelId && !hasSynapseModelId(current, targetSynapseModelId)) {
          return current;
        }

        const linkIdSet = new Set(uniqueLinkIds);
        return {
          ...current,
          connections: current.connections.map((link) => {
            if (!linkIdSet.has(link.id)) {
              return link;
            }

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
          }),
        };
      }, GRAPH_SEMANTIC_CHANGE);
    },
    [graphStructureEditable, setAgent]
  );

  return {
    updateNodeLabelAndParams,
    updateLinkWeight,
    updateAggregateLinks,
  };
};
