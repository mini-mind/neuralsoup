import { type AgentIR, type BodyIR, type BrainContainerNode, type BrainNeuronNode } from '../domain/brain/agent-ir';
import type { Position } from '../domain/brain/shared';
import type {
  GraphIRDocument,
  LeafLink,
  NeuronGroupNode,
  NeuronNode,
  TopologyNode,
} from './legacyGraphIR';
import {
  createDefaultLegacyBodyDefinition,
  getLegacyBodyVisionCellCount,
  type BrainLayoutDocument,
  type LegacyBodyDefinition,
} from './legacyBrainPackage';
import { createDefaultGraphIRDocument } from './legacyGraphDefaults';
import {
  DEFAULT_OUTPUT_DECAY_PER_SECOND,
  DEFAULT_VISION_SCALE,
  INPUT_CHANNEL_PATTERN,
  LEGACY_CORE_INPUT_ADAPTER_ID,
  LEGACY_CORE_OUTPUT_ADAPTER_ID,
  LEGACY_INITIAL_STATE_U_KEY,
  LEGACY_INITIAL_STATE_V_KEY,
  LEGACY_ROOT_GROUP_ID,
  NEURON_INPUT_PORT,
  NEURON_OUTPUT_PORT,
  OUTPUT_CHANNEL_PATTERN,
  SIGNAL_INPUT_PORT,
  SIGNAL_OUTPUT_PORT,
  applyRuleTemplate,
  buildBodyIRFromCompatBody,
  clonePosition,
  resolveBodyInputScale,
  resolveBodyOutputDecay,
  resolveLegacyInputSignalNodeId,
  resolveLegacyOutputSignalNodeId,
} from './legacyGraphBridgeShared';
import { deriveAgentIRVisionCellCount } from './legacyVisionCellCount';

const createNeuronNodeFromAgent = (neuron: BrainNeuronNode, position?: Position): NeuronNode => ({
  kind: 'neuron',
  id: neuron.id,
  label: neuron.label,
  modelId: 'izhikevich-neuron',
  position,
  parameterOverrides: {
    a: neuron.params.a,
    b: neuron.params.b,
    c: neuron.params.c,
    d: neuron.params.d,
    threshold: neuron.params.threshold,
    [LEGACY_INITIAL_STATE_V_KEY]: neuron.initialState.v,
    ...(neuron.initialState.u !== undefined ? { [LEGACY_INITIAL_STATE_U_KEY]: neuron.initialState.u } : {}),
  },
});

const createContainerNodeFromAgent = (
  container: BrainContainerNode,
  agent: AgentIR,
  position?: Position
): NeuronGroupNode => {
  const children: TopologyNode[] = [];

  for (const childRef of container.children) {
    if (childRef.scope === 'brain') {
      const neuron = agent.brain.neurons.find((entry) => entry.id === childRef.nodeId);
      if (neuron) {
        children.push(createNeuronNodeFromAgent(neuron, agent.layout?.nodes[neuron.id]?.position));
      }
      continue;
    }

    const childContainer = agent.brain.containers.find((entry) => entry.id === childRef.nodeId);
    if (childContainer) {
      children.push(
        createContainerNodeFromAgent(childContainer, agent, agent.layout?.nodes[childContainer.id]?.position)
      );
    }
  }

  return {
    kind: 'neuron-group',
    id: container.id,
    label: container.label ?? container.id,
    position,
    collapsed: agent.layout?.nodes[container.id]?.collapsed,
    children,
  };
};

export interface LegacyGraphBridgeResult {
  document: GraphIRDocument;
  body: LegacyBodyDefinition;
  layout: BrainLayoutDocument;
  droppedConnectionIds: string[];
  documentOnlyLosses: string[];
}

const buildCompatBodyFromAgent = (agent: AgentIR, visionCells: number): LegacyBodyDefinition => {
  const nextBody = createDefaultLegacyBodyDefinition(visionCells);
  const inputSignalsById = new Map(nextBody.inputSignals.map((signal) => [signal.id, signal]));
  const outputSignalsById = new Map(nextBody.outputSignals.map((signal) => [signal.id, signal]));

  for (const connection of agent.connections) {
    if (connection.from.scope !== 'bodyInput') {
      continue;
    }
    const legacyNodeId = resolveLegacyInputSignalNodeId(agent, connection.from.nodeId);
    const scale = resolveBodyInputScale(agent, connection.from.nodeId);
    const match = legacyNodeId?.match(INPUT_CHANNEL_PATTERN);
    if (!match || scale == null) {
      continue;
    }
    const signal = inputSignalsById.get(`vision-${match[1].toLowerCase()}-${match[2]}`);
    if (signal) {
      signal.scale = scale;
    }
  }

  for (const connection of agent.connections) {
    if (connection.to.scope !== 'bodyOutput') {
      continue;
    }
    const legacyNodeId = resolveLegacyOutputSignalNodeId(agent, connection.to.nodeId);
    const decayPerSecond = resolveBodyOutputDecay(agent, connection.to.nodeId);
    const match = legacyNodeId?.match(OUTPUT_CHANNEL_PATTERN);
    if (!match || decayPerSecond == null) {
      continue;
    }
    const signal = outputSignalsById.get(`motor-${match[1]}`);
    if (signal) {
      signal.decayPerSecond = decayPerSecond;
    }
  }

  return nextBody;
};

const resolveBodyInputSemantic = (body: BodyIR, nodeId: string): string => {
  const matches = body.inputRules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

  if (matches.length !== 1) {
    return matches.length === 0 ? 'unmatched' : 'ambiguous';
  }

  return `source:${applyRuleTemplate(matches[0].rule.sourceTemplate, matches[0].match)}|scale:${matches[0].rule.scale}`;
};

const resolveBodyOutputSemantic = (body: BodyIR, nodeId: string): string => {
  const matches = body.outputRules.flatMap((rule) => {
    try {
      const regex = new RegExp(rule.nodeIdPattern);
      const match = regex.exec(nodeId);
      return match ? [{ rule, match }] : [];
    } catch {
      return [];
    }
  });

  if (matches.length !== 1) {
    return matches.length === 0 ? 'unmatched' : 'ambiguous';
  }

  return `target:${applyRuleTemplate(matches[0].rule.targetTemplate, matches[0].match)}|decay:${matches[0].rule.decayPerSecond}`;
};

const compareCompatBodySemantics = (
  agent: AgentIR,
  compatBody: LegacyBodyDefinition
): string[] => {
  const losses: string[] = [];
  const rebuiltBody = buildBodyIRFromCompatBody(compatBody);
  const visionCellCount = deriveAgentIRVisionCellCount(agent);
  const buildRepresentativeNodeIdFromPattern = (pattern: string): string | null => {
    const source = pattern.startsWith('^') ? pattern.slice(1) : pattern;
    const normalized = source.endsWith('$') ? source.slice(0, -1) : source;

    let result = '';
    for (let index = 0; index < normalized.length; index += 1) {
      const token = normalized[index];
      if (token === '\\') {
        const escaped = normalized[index + 1];
        if (!escaped) {
          return null;
        }
        result += escaped === 'd' ? '0' : escaped;
        index += 1;
      } else if (token === '[') {
        const closeIndex = normalized.indexOf(']', index + 1);
        if (closeIndex === -1) {
          return null;
        }
        const charClass = normalized.slice(index + 1, closeIndex);
        if (charClass.length === 0) {
          return null;
        }
        result += charClass[0] ?? '';
        index = closeIndex;
      } else if (token === '(') {
        const closeIndex = normalized.indexOf(')', index + 1);
        if (closeIndex === -1) {
          return null;
        }
        const groupBody = normalized.slice(index + 1, closeIndex);
        const firstAlternative = groupBody.split('|')[0] ?? '';
        result += buildRepresentativeNodeIdFromPattern(firstAlternative) ?? '';
        index = closeIndex;
      } else if ('+*?'.includes(token)) {
        continue;
      } else {
        result += token;
      }
    }

    return result.length > 0 ? result : null;
  };
  const buildRuleSampleNodeIds = (
    rules: BodyIR['inputRules'] | BodyIR['outputRules'],
    fallbackPrefix: string
  ): string[] =>
    rules.map(
      (rule, index) => buildRepresentativeNodeIdFromPattern(rule.nodeIdPattern) ?? `${fallbackPrefix}-${index}`
    );

  if (getLegacyBodyVisionCellCount(compatBody) !== visionCellCount) {
    losses.push(
      `Legacy GraphIR compat getter cannot preserve BodyIR vision cell coverage (${visionCellCount} -> ${getLegacyBodyVisionCellCount(
        compatBody
      )}).`
    );
  }

  const inputCandidates = new Set<string>([
    ...Array.from({ length: visionCellCount }, (_, cellIndex) =>
      ['R', 'G', 'B'].map((channel) => `vision-${channel}-${cellIndex}`)
    ).flat(),
    ...agent.connections.flatMap((connection) => {
      const endpoints: string[] = [];
      if (connection.from.scope === 'bodyInput') {
        endpoints.push(connection.from.nodeId);
      }
      if (connection.to.scope === 'bodyInput') {
        endpoints.push(connection.to.nodeId);
      }
      return endpoints;
    }),
    ...buildRuleSampleNodeIds(agent.body.inputRules, '__body-input-rule-sample'),
  ]);
  const outputCandidates = new Set<string>([
    'output-turn-left',
    'output-move-forward',
    'output-turn-right',
    ...agent.connections.flatMap((connection) => {
      const endpoints: string[] = [];
      if (connection.from.scope === 'bodyOutput') {
        endpoints.push(connection.from.nodeId);
      }
      if (connection.to.scope === 'bodyOutput') {
        endpoints.push(connection.to.nodeId);
      }
      return endpoints;
    }),
    ...buildRuleSampleNodeIds(agent.body.outputRules, '__body-output-rule-sample'),
  ]);

  const inputMismatches = [...inputCandidates].filter(
    (nodeId) => resolveBodyInputSemantic(agent.body, nodeId) !== resolveBodyInputSemantic(rebuiltBody, nodeId)
  );
  if (inputMismatches.length > 0) {
    losses.push(
      `Legacy GraphIR compat getter cannot preserve full BodyIR input rule semantics for: ${inputMismatches.join(', ')}.`
    );
  }

  const outputMismatches = [...outputCandidates].filter(
    (nodeId) => resolveBodyOutputSemantic(agent.body, nodeId) !== resolveBodyOutputSemantic(rebuiltBody, nodeId)
  );
  if (outputMismatches.length > 0) {
    losses.push(
      `Legacy GraphIR compat getter cannot preserve full BodyIR output rule semantics for: ${outputMismatches.join(', ')}.`
    );
  }

  return losses;
};

export const createLegacyGraphBridgeFromAgent = (agent: AgentIR): LegacyGraphBridgeResult => {
  const visionCellIds = new Set<number>();
  for (const connection of agent.connections) {
    if (connection.from.scope !== 'bodyInput') {
      continue;
    }
    const legacyInputNodeId = resolveLegacyInputSignalNodeId(agent, connection.from.nodeId);
    const match = legacyInputNodeId?.match(INPUT_CHANNEL_PATTERN);
    if (!match) {
      continue;
    }
    visionCellIds.add(Number.parseInt(match[2], 10));
  }

  const visionCells = Math.max(
    deriveAgentIRVisionCellCount(agent),
    visionCellIds.size > 0 ? Math.max(...visionCellIds) + 1 : 0,
    1
  );
  const nextDocument = createDefaultGraphIRDocument(visionCells);
  const nextBody = buildCompatBodyFromAgent(agent, visionCells);
  const documentOnlyLosses = compareCompatBodySemantics(agent, nextBody);
  const defaultRootGroup = nextDocument.root.children.find(
    (node): node is NeuronGroupNode => node.kind === 'neuron-group' && node.id === LEGACY_ROOT_GROUP_ID
  );
  const defaultCoreInputAdapter = defaultRootGroup?.children.find(
    (node): node is Extract<TopologyNode, { kind: 'adapter' }> => node.kind === 'adapter' && node.id === LEGACY_CORE_INPUT_ADAPTER_ID
  );
  const defaultCoreOutputAdapter = defaultRootGroup?.children.find(
    (node): node is Extract<TopologyNode, { kind: 'adapter' }> => node.kind === 'adapter' && node.id === LEGACY_CORE_OUTPUT_ADAPTER_ID
  );

  const rootChildren: TopologyNode[] = nextDocument.root.children.map((node: TopologyNode) => {
    if (node.kind === 'neuron-group' && node.id === LEGACY_ROOT_GROUP_ID) {
      const rootContainer = agent.brain.containers.find((entry) => entry.id === agent.brain.rootContainerId);
      if (!rootContainer) {
        return node;
      }

      return {
        ...node,
        id: LEGACY_ROOT_GROUP_ID,
        label: rootContainer.label ?? rootContainer.id,
        position: agent.layout?.nodes[rootContainer.id]?.position ?? node.position,
        collapsed: agent.layout?.nodes[rootContainer.id]?.collapsed ?? node.collapsed,
        children: [
          ...(defaultCoreInputAdapter ? [{ ...defaultCoreInputAdapter }] : []),
          ...rootContainer.children.flatMap<TopologyNode>((childRef) => {
            if (childRef.scope === 'brain') {
              const neuron = agent.brain.neurons.find((entry) => entry.id === childRef.nodeId);
              if (!neuron) {
                return [];
              }
              return [createNeuronNodeFromAgent(neuron, agent.layout?.nodes[neuron.id]?.position)];
            }

            const container = agent.brain.containers.find((entry) => entry.id === childRef.nodeId);
            if (!container) {
              return [];
            }
            return [createContainerNodeFromAgent(container, agent, agent.layout?.nodes[container.id]?.position)];
          }),
          ...(defaultCoreOutputAdapter ? [{ ...defaultCoreOutputAdapter }] : []),
        ],
      };
    }

    return {
      ...node,
      position: agent.layout?.nodes[node.id]?.position ?? node.position,
      collapsed: 'collapsed' in node ? agent.layout?.nodes[node.id]?.collapsed ?? node.collapsed : undefined,
    };
  });

  const links: LeafLink[] = [];
  const rootInputLinkIds = new Set<string>();
  const coreInputLinkIds = new Set<string>();
  const rootOutputLinkIds = new Set<string>();
  const coreOutputLinkIds = new Set<string>();
  const coreInputLinkSemantics = new Map<string, string>();
  const coreOutputLinkSemantics = new Map<string, string>();
  const droppedConnectionIds = new Set<string>();

  for (const connection of agent.connections) {
    if (connection.from.scope === 'bodyOutput' || connection.to.scope === 'bodyInput') {
      continue;
    }

    if (connection.from.scope === 'bodyInput' && connection.to.scope === 'brain') {
      const legacyInputNodeId = resolveLegacyInputSignalNodeId(agent, connection.from.nodeId);
      if (!legacyInputNodeId) {
        droppedConnectionIds.add(connection.id);
        continue;
      }
      const channelMatch = legacyInputNodeId.match(INPUT_CHANNEL_PATTERN);
      if (!channelMatch) {
        continue;
      }

      const channel = channelMatch[1];
      const legacySignalNodeId = legacyInputNodeId;
      const coreInputNodeId = `core-input-${channel}`;
      const rootLinkId = `bridge-root:${legacySignalNodeId}:${coreInputNodeId}`;
      if (!rootInputLinkIds.has(rootLinkId)) {
        rootInputLinkIds.add(rootLinkId);
        links.push({
          id: rootLinkId,
          from: {
            nodeId: legacySignalNodeId,
            portId: connection.from.portId ?? SIGNAL_OUTPUT_PORT,
          },
          to: {
            nodeId: coreInputNodeId,
            portId: SIGNAL_INPUT_PORT,
          },
          weight: 1,
        });
      }

      const coreLinkId = `bridge-core:${coreInputNodeId}:${connection.to.nodeId}`;
      const coreLinkSemanticKey = `${connection.weight}:${connection.delayMs ?? 0}:${connection.to.portId ?? NEURON_INPUT_PORT}`;
      if (!coreInputLinkIds.has(coreLinkId)) {
        coreInputLinkIds.add(coreLinkId);
        coreInputLinkSemantics.set(coreLinkId, coreLinkSemanticKey);
        links.push({
          id: coreLinkId,
          from: {
            nodeId: coreInputNodeId,
            portId: SIGNAL_OUTPUT_PORT,
          },
          to: {
            nodeId: connection.to.nodeId,
            portId: connection.to.portId ?? NEURON_INPUT_PORT,
          },
          weight: connection.weight,
          delayMs: connection.delayMs,
        });
      } else if (coreInputLinkSemantics.get(coreLinkId) !== coreLinkSemanticKey) {
        droppedConnectionIds.add(connection.id);
      }
      continue;
    }

    if (connection.from.scope === 'brain' && connection.to.scope === 'brain') {
      links.push({
        id: connection.id,
        from: {
          nodeId: connection.from.nodeId,
          portId: connection.from.portId ?? NEURON_OUTPUT_PORT,
        },
        to: {
          nodeId: connection.to.nodeId,
          portId: connection.to.portId ?? NEURON_INPUT_PORT,
        },
        weight: connection.weight,
        delayMs: connection.delayMs,
      });
      continue;
    }

    if (connection.from.scope === 'brain' && connection.to.scope === 'bodyOutput') {
      const legacyOutputNodeId = resolveLegacyOutputSignalNodeId(agent, connection.to.nodeId);
      if (!legacyOutputNodeId) {
        droppedConnectionIds.add(connection.id);
        continue;
      }
      const outputMatch = legacyOutputNodeId.match(OUTPUT_CHANNEL_PATTERN);
      if (!outputMatch) {
        continue;
      }

      const action = outputMatch[1];
      const legacySignalNodeId = legacyOutputNodeId;
      const coreOutputNodeId = `core-output-${action}`;
      const coreLinkId = `bridge-core:${connection.from.nodeId}:${coreOutputNodeId}`;
      const coreLinkSemanticKey = `${connection.weight}:${connection.delayMs ?? 0}:${connection.from.portId ?? NEURON_OUTPUT_PORT}`;
      if (!coreOutputLinkIds.has(coreLinkId)) {
        coreOutputLinkIds.add(coreLinkId);
        coreOutputLinkSemantics.set(coreLinkId, coreLinkSemanticKey);
        links.push({
          id: coreLinkId,
          from: {
            nodeId: connection.from.nodeId,
            portId: connection.from.portId ?? NEURON_OUTPUT_PORT,
          },
          to: {
            nodeId: coreOutputNodeId,
            portId: SIGNAL_INPUT_PORT,
          },
          weight: connection.weight,
          delayMs: connection.delayMs,
        });
      } else if (coreOutputLinkSemantics.get(coreLinkId) !== coreLinkSemanticKey) {
        droppedConnectionIds.add(connection.id);
      }

      const rootLinkId = `bridge-root:${coreOutputNodeId}:${legacySignalNodeId}`;
      if (!rootOutputLinkIds.has(rootLinkId)) {
        rootOutputLinkIds.add(rootLinkId);
        links.push({
          id: rootLinkId,
          from: {
            nodeId: coreOutputNodeId,
            portId: SIGNAL_OUTPUT_PORT,
          },
          to: {
            nodeId: legacySignalNodeId,
            portId: connection.to.portId ?? SIGNAL_INPUT_PORT,
          },
          weight: 1,
        });
      }
    }
  }

  const layout: BrainLayoutDocument = {
    version: 1,
    nodes: Object.fromEntries(
      Object.entries(agent.layout?.nodes ?? {}).map(([nodeId, state]) => [
        nodeId,
        {
          position: clonePosition(state.position),
          collapsed: state.collapsed,
        },
      ])
    ),
  };

  if (
    documentOnlyLosses.length === 0 &&
    (
      nextBody.inputSignals.some((signal) => (signal.scale ?? DEFAULT_VISION_SCALE) !== DEFAULT_VISION_SCALE) ||
      nextBody.outputSignals.some(
        (signal) => (signal.decayPerSecond ?? DEFAULT_OUTPUT_DECAY_PER_SECOND) !== DEFAULT_OUTPUT_DECAY_PER_SECOND
      )
    )
  ) {
    documentOnlyLosses.push('Legacy GraphIR document-only getter cannot preserve BodyIR scale/decay semantics.');
  }

  return {
    document: {
      ...nextDocument,
      root: {
        ...nextDocument.root,
        children: rootChildren,
        links,
      },
    },
    body: nextBody,
    layout,
    droppedConnectionIds: [...droppedConnectionIds],
    documentOnlyLosses,
  };
};
