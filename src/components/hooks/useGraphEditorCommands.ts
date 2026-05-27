import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  BrainStructuralPreflight,
  BrainContainerNode,
  AgentIR,
  BodyIRMutationAction,
} from '../../domain/brain';
import { mutateBodyIR, preflightBrainStructure } from '../../domain/brain';
import type { Position } from '../../domain/brain/shared';
import {
  AGENT_GRAPH_CHILD_SCOPE_OFFSET,
  AGENT_GRAPH_EXPANDED_GROUP_PADDING,
  AGENT_GRAPH_LEAF_NODE_SIZE,
} from '../editor/graph/agentGraphViewConstants';
import {
  type AgentGraphEditingResult,
  tryReparentAgentNode,
  tryAggregateAgentNodesIntoGroup,
  tryCreateNeuronAndConnectInContainer,
  tryUngroupAgentContainer,
} from '../editor/graph/agentGraphEditing';
import {
  GRAPH_LAYOUT_ONLY_CHANGE,
  GRAPH_SEMANTIC_CHANGE,
} from './graphDocumentChangePolicy';
import { useGraphEntityDetailCommands } from './useGraphEntityDetailCommands';
import type { GraphViewLink, GraphViewNode } from '../editor/graph/graphViewTypes';
import type { AgentGraphViewIndexes, AgentGraphViewNodeRecord } from '../editor/graph/agentGraphViewModel';
import { canGraphNodesConnect } from '../editor/graph/graphLinkPolicy';
import type {
  DetailModalData,
  GraphDocumentChangeOptions,
  GraphNodePositionUpdate,
  GraphPoint,
  GraphSelectionState,
} from './useSNNTopologyState';

type NodePositionDraftMap = Record<string, Position>;

const INPUT_PORT_ID = 'in';
const OUTPUT_PORT_ID = 'out';
const NEURON_INPUT_PORT_ID = 'dendrite';
const NEURON_OUTPUT_PORT_ID = 'axon';
const DEFAULT_NEURON_PARAMETER_OVERRIDES = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
} as const;
const DEFAULT_CONNECTION_PARAMETER_OVERRIDES = {
  weight: 0.8,
  delayMs: 0,
} as const;
const uniqueIds = (ids: string[]) => Array.from(new Set(ids));
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const hasNeuronModelId = (agent: AgentIR, modelId: string): boolean =>
  (agent.brain.neuronModels ?? []).some((model) => model.id === modelId);

const hasSynapseModelId = (agent: AgentIR, modelId: string): boolean =>
  (agent.brain.synapseModels ?? []).some((model) => model.id === modelId);

const resolveDefaultNeuronModelId = (agent: AgentIR): string | null => {
  const candidate = (agent.brain.neuronModels ?? []).find((model) => isNonEmptyString(model.id));
  return candidate ? candidate.id : null;
};

const resolveDefaultSynapseModelId = (agent: AgentIR): string | null => {
  const candidate = (agent.brain.synapseModels ?? []).find((model) => isNonEmptyString(model.id));
  return candidate ? candidate.id : null;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getNextNumericId = (ids: Iterable<string>, prefix: string) => {
  const pattern = new RegExp(`^${escapeRegex(prefix)}(\\d+)$`);
  let maxId = 0;

  for (const id of ids) {
    const match = id.match(pattern);
    if (!match) {
      continue;
    }

    maxId = Math.max(maxId, Number.parseInt(match[1], 10));
  }

  return maxId + 1;
};

const getAllBrainNodeIds = (agent: AgentIR) => [
  ...agent.brain.neurons.map((neuron) => neuron.id),
  ...agent.brain.containers.map((container) => container.id),
];

const isAcceptedGraphEdit = (result: AgentGraphEditingResult): result is Extract<AgentGraphEditingResult, { ok: true }> =>
  result.ok;

const isStructuralGraphEditable = (preflight: BrainStructuralPreflight) => preflight.ok;
const isCurrentBrainStructurallyEditable = (agent: AgentIR) => preflightBrainStructure(agent.brain).ok;
const matchesResolvedPortId = (actualPortId: string | undefined, expectedPortId: string) =>
  (actualPortId ?? expectedPortId) === expectedPortId;

const toRoundedPosition = ({ x, y }: GraphPoint): Position => ({
  x: Math.round(x),
  y: Math.round(y),
});

type AgentLeafNodeRecord = AgentGraphViewNodeRecord & { kind: 'neuron' | 'signal' };
type AgentSignalNodeRecord = AgentGraphViewNodeRecord & {
  kind: 'signal';
  endpoint: NonNullable<AgentGraphViewNodeRecord['endpoint']>;
};

const isAgentLeafNodeRecord = (node: AgentGraphViewNodeRecord | null | undefined): node is AgentLeafNodeRecord =>
  node?.kind === 'neuron' || node?.kind === 'signal';

const getLeafPortId = (node: AgentLeafNodeRecord, direction: 'input' | 'output') => {
  if (node.kind === 'neuron') {
    return direction === 'input' ? NEURON_INPUT_PORT_ID : NEURON_OUTPUT_PORT_ID;
  }

  return direction === 'input' ? INPUT_PORT_ID : OUTPUT_PORT_ID;
};

const toStoredPosition = (position: GraphPoint, scope: 'root' | 'child'): Position => {
  if (scope === 'child') {
    return toRoundedPosition({
      x: position.x - AGENT_GRAPH_CHILD_SCOPE_OFFSET.x,
      y: position.y - AGENT_GRAPH_CHILD_SCOPE_OFFSET.y,
    });
  }

  return toRoundedPosition(position);
};

const clampPositionInsideExpandedParent = (position: GraphPoint, viewNode: GraphViewNode, parentNode: GraphViewNode): GraphPoint => ({
  x: Math.round(
    Math.min(
      Math.max(position.x, parentNode.x + AGENT_GRAPH_EXPANDED_GROUP_PADDING),
      parentNode.x + parentNode.width - AGENT_GRAPH_EXPANDED_GROUP_PADDING - viewNode.width
    )
  ),
  y: Math.round(
    Math.min(
      Math.max(position.y, parentNode.y + AGENT_GRAPH_EXPANDED_GROUP_PADDING),
      parentNode.y + parentNode.height - AGENT_GRAPH_EXPANDED_GROUP_PADDING - viewNode.height
    )
  ),
});

const toStoredPositionForViewNode = (
  position: GraphPoint,
  viewNode: GraphViewNode,
  viewNodeByViewId: Map<string, GraphViewNode>,
  scope: 'root' | 'child'
): Position => {
  if (viewNode.expansionParentId) {
    const parentNode = viewNodeByViewId.get(viewNode.expansionParentId);
    if (parentNode) {
      const clampedPosition = clampPositionInsideExpandedParent(position, viewNode, parentNode);
      return toRoundedPosition({
        x: clampedPosition.x - parentNode.x - viewNode.expansionOffsetX,
        y: clampedPosition.y - parentNode.y - viewNode.expansionOffsetY,
      });
    }
  }

  return toStoredPosition(position, scope);
};

const toStoredPositionForScope = (position: GraphPoint, scope: 'root' | 'child'): Position =>
  toStoredPosition(position, scope);

const updateAgentLayoutNodeState = (
  agent: AgentIR,
  layoutNodeId: string,
  updater: (current: NonNullable<AgentIR['layout']>['nodes'][string]) => NonNullable<AgentIR['layout']>['nodes'][string]
): AgentIR => ({
  ...agent,
  layout: {
    ...(agent.layout ?? {}),
    nodes: {
      ...(agent.layout?.nodes ?? {}),
      [layoutNodeId]: updater(agent.layout?.nodes[layoutNodeId] ?? {}),
    },
  },
});

const updateBrainContainerById = (
  containers: BrainContainerNode[],
  containerId: string,
  updater: (container: BrainContainerNode) => BrainContainerNode
): BrainContainerNode[] =>
  containers.map((container) => (container.id === containerId ? updater(container) : container));

const resolveCurrentBrainContainerId = (agent: AgentIR, navigationPath: string[]): string | null => {
  if (navigationPath.length === 0) {
    return agent.brain.rootContainerId;
  }

  const currentNodeId = navigationPath[navigationPath.length - 1]!;
  return agent.brain.containers.some((container) => container.id === currentNodeId) ? currentNodeId : null;
};

const isBrainCanvasEditableScope = (currentContainerKind: 'root' | 'adapter' | 'neuron-group') =>
  currentContainerKind === 'root' || currentContainerKind === 'neuron-group';

const getAllSignalNodeIds = (agent: AgentIR) => [
  ...agent.body.mappings
    .map((mapping) => mapping.nodeId)
    .filter((nodeId) => isNonEmptyString(nodeId)),
  ...agent.connections
    .flatMap((connection) => [
      connection.from.scope === 'bodyInput' || connection.from.scope === 'bodyOutput' ? connection.from.nodeId : null,
      connection.to.scope === 'bodyInput' || connection.to.scope === 'bodyOutput' ? connection.to.nodeId : null,
    ])
    .filter((nodeId): nodeId is string => isNonEmptyString(nodeId)),
];

const toAgentEndpoint = (
  node: AgentLeafNodeRecord,
  direction: 'input' | 'output'
): AgentIR['connections'][number]['from'] => ({
  scope: node.kind === 'signal' ? (direction === 'output' ? 'bodyInput' : 'bodyOutput') : 'brain',
  nodeId: node.refNodeId,
  portId: getLeafPortId(node, direction),
});

const collectLeafRecordIds = (
  nodes: AgentGraphViewNodeRecord[],
  indexes: AgentGraphViewIndexes
): Set<string> => {
  const leafNodeIds = new Set<string>();

  const visit = (node: AgentGraphViewNodeRecord) => {
    if (isAgentLeafNodeRecord(node)) {
      leafNodeIds.add(node.refNodeId);
      return;
    }

    if (node.kind !== 'neuron-group') {
      return;
    }

    const container = node.container ?? indexes.containerById.get(node.refNodeId);
    if (!container) {
      return;
    }

    for (const child of indexes.childRefsByContainerId.get(container.id) ?? []) {
      const nextNode = indexes.nodeById.get(child.nodeId);
      if (nextNode) {
        visit(nextNode);
      }
    }
  };

  nodes.forEach(visit);
  return leafNodeIds;
};

const collectRemovableContainerIds = (
  containersById: Map<string, BrainContainerNode>,
  initialContainerIds: string[]
): Set<string> => {
  const removableContainerIds = new Set<string>();
  const visit = (containerId: string) => {
    if (removableContainerIds.has(containerId)) {
      return;
    }

    removableContainerIds.add(containerId);
    const container = containersById.get(containerId);
    if (!container) {
      return;
    }

    for (const child of container.children) {
      if (child.scope === 'container') {
        visit(child.nodeId);
      }
    }
  };

  initialContainerIds.forEach(visit);
  return removableContainerIds;
};

const collectSelectedContainerIds = (selectedNodes: AgentGraphViewNodeRecord[]): string[] =>
  selectedNodes
    .filter((node) => node.kind === 'neuron-group')
    .map((node) => node.refNodeId);

const collectNeuronIdsInContainers = (
  containersById: Map<string, BrainContainerNode>,
  containerIds: Set<string>
): Set<string> => {
  const neuronIds = new Set<string>();
  for (const containerId of containerIds) {
    const container = containersById.get(containerId);
    if (!container) {
      continue;
    }

    for (const child of container.children) {
      if (child.scope === 'brain') {
        neuronIds.add(child.nodeId);
      }
    }
  }
  return neuronIds;
};

interface GraphEditorCommandDependencies {
  setAgent: (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => void;
  currentScope: 'root' | 'child';
  currentContainerKind: 'root' | 'adapter' | 'neuron-group';
  currentChildren: AgentGraphViewNodeRecord[];
  navigationPath: string[];
  indexes: AgentGraphViewIndexes;
  localLeafIds: Set<string>;
  viewNodeByViewId: Map<string, GraphViewNode>;
  selectionState: GraphSelectionState;
  draftNodePositions: NodePositionDraftMap;
  links: GraphViewLink[];
  setDraftNodePositions: Dispatch<SetStateAction<NodePositionDraftMap>>;
  sessionEffects: {
    clearSelection: () => void;
    scheduleFocusNode: (nodeId: string | null) => void;
    scheduleFocusLink: (linkId: string | null) => void;
    clearSelectionRect: () => void;
    clearDraftNodePositions: () => void;
    closeDetailModal: () => void;
    dismissDetailModalIf: (predicate: (detail: DetailModalData) => boolean) => void;
  };
}

const resolveViewNode = (viewNodeByViewId: Map<string, GraphViewNode>, nodeId: string): GraphViewNode | null =>
  viewNodeByViewId.get(nodeId) ?? null;

export const useGraphEditorCommands = ({
  setAgent,
  currentScope,
  currentContainerKind,
  currentChildren,
  navigationPath,
  indexes,
  localLeafIds,
  viewNodeByViewId,
  selectionState,
  draftNodePositions,
  links,
  setDraftNodePositions,
  sessionEffects,
}: GraphEditorCommandDependencies) => {
  const graphStructureEditable = isStructuralGraphEditable(indexes.structuralPreflight);
  const { updateNodeLabelAndParams, updateLinkWeight, updateAggregateLinks } = useGraphEntityDetailCommands({
    graphStructureEditable,
    setAgent,
  });
  const commitAgentChange = useCallback(
    (updater: (current: AgentIR) => AgentIR, options: GraphDocumentChangeOptions) => {
      let committed = false;
      setAgent((current) => {
        if (!isCurrentBrainStructurallyEditable(current)) {
          return current;
        }

        const next = updater(current);
        if (next === current) {
          return current;
        }

        committed = true;
        return next;
      }, options);
      return committed;
    },
    [setAgent]
  );
  const resetInteractionTransients = useCallback(
    ({ clearSelection = false, closeDetailModal = false }: { clearSelection?: boolean; closeDetailModal?: boolean } = {}) => {
      if (clearSelection) {
        sessionEffects.clearSelection();
      }
      if (closeDetailModal) {
        sessionEffects.closeDetailModal();
      }
      sessionEffects.clearSelectionRect();
      sessionEffects.clearDraftNodePositions();
    },
    [
      sessionEffects.clearDraftNodePositions,
      sessionEffects.clearSelection,
      sessionEffects.clearSelectionRect,
      sessionEffects.closeDetailModal,
    ]
  );
  const resolveStoredPositionForNodeUpdate = useCallback(
    (update: GraphNodePositionUpdate): [string, Position] | null => {
      const viewNode = viewNodeByViewId.get(update.nodeId);
      if (!viewNode || viewNode.proxy) {
        return null;
      }

      return [
        viewNode.refNodeId,
        toStoredPositionForViewNode(update, viewNode, viewNodeByViewId, currentScope),
      ];
    },
    [currentScope, viewNodeByViewId]
  );

  const connectSourceNodesToTarget = useCallback(
    (sourceNodeIds: string[], targetNodeId: string) => {
      if (!graphStructureEditable) {
        return;
      }

      const targetViewNode = viewNodeByViewId.get(targetNodeId);
      if (!targetViewNode) {
        return;
      }

      const targetNode = indexes.nodeById.get(targetViewNode.refNodeId);
      if (!isAgentLeafNodeRecord(targetNode)) {
        return;
      }

      const uniqueSourceNodeIds = uniqueIds(sourceNodeIds);
      let resolvedSynapseModelId: string | null = null;
      const nextConnections: AgentIR['connections'] = [];
      const resolvedLinkIds: string[] = [];
      const attemptedEndpoints = new Set<string>();
      const timestamp = Date.now();

      for (const sourceNodeId of uniqueSourceNodeIds) {
        const sourceViewNode = viewNodeByViewId.get(sourceNodeId);
        if (!sourceViewNode) {
          continue;
        }

        const sourceNode = indexes.nodeById.get(sourceViewNode.refNodeId);
        if (!isAgentLeafNodeRecord(sourceNode)) {
          continue;
        }

        if (
          !canGraphNodesConnect({
            sourceNode: sourceViewNode,
            targetNode: targetViewNode,
            currentScope,
            localLeafIds,
          })
        ) {
          continue;
        }

        const fromEndpoint = toAgentEndpoint(sourceNode, 'output');
        const toEndpoint = toAgentEndpoint(targetNode, 'input');
        const fromPortId = fromEndpoint.portId ?? getLeafPortId(sourceNode, 'output');
        const toPortId = toEndpoint.portId ?? getLeafPortId(targetNode, 'input');
        const endpointKey = `${sourceNode.id}:${fromPortId}->${targetNode.id}:${toPortId}`;
        if (attemptedEndpoints.has(endpointKey)) {
          continue;
        }

        attemptedEndpoints.add(endpointKey);
        const existingLink = [...indexes.linkById.values()].find(
          (link) =>
            link.from.scope === fromEndpoint.scope &&
            link.from.nodeId === fromEndpoint.nodeId &&
            matchesResolvedPortId(link.from.portId, fromPortId) &&
            link.to.scope === toEndpoint.scope &&
            link.to.nodeId === toEndpoint.nodeId &&
            matchesResolvedPortId(link.to.portId, toPortId)
        );
        if (existingLink) {
          resolvedLinkIds.push(existingLink.id);
          continue;
        }

        const nextLinkId = `link-${sourceNode.id}-${targetNode.id}-${timestamp}-${nextConnections.length}`;
        const nextConnection: AgentIR['connections'][number] = {
          id: nextLinkId,
          from: fromEndpoint,
          to: toEndpoint,
          synapseModelId: '',
          parameterOverrides: {
            ...DEFAULT_CONNECTION_PARAMETER_OVERRIDES,
          },
        };
        nextConnections.push(nextConnection);
        resolvedLinkIds.push(nextLinkId);
      }

      if (nextConnections.length === 0) {
        if (resolvedLinkIds.length > 0) {
          sessionEffects.scheduleFocusLink(resolvedLinkIds.at(-1) ?? null);
        }
        return;
      }

      const committed = commitAgentChange((current) => {
        if (!resolvedSynapseModelId) {
          resolvedSynapseModelId = resolveDefaultSynapseModelId(current);
        }
        if (!resolvedSynapseModelId || !hasSynapseModelId(current, resolvedSynapseModelId)) {
          return current;
        }

        return {
          ...current,
          connections: [
            ...current.connections,
            ...nextConnections.map((connection) => ({
              ...connection,
              synapseModelId: resolvedSynapseModelId as string,
            })),
          ],
        };
      }, GRAPH_SEMANTIC_CHANGE);

      if (!committed || resolvedLinkIds.length === 0) {
        return;
      }

      sessionEffects.scheduleFocusLink(resolvedLinkIds.at(-1) ?? null);
    },
    [
      commitAgentChange,
      currentScope,
      graphStructureEditable,
      indexes.linkById,
      indexes.nodeById,
      localLeafIds,
      sessionEffects.scheduleFocusLink,
      viewNodeByViewId,
    ]
  );

  const updateNodePositionsInDraft = useCallback(
    (updates: GraphNodePositionUpdate[]) => {
      if (updates.length === 0) {
        return;
      }

      setDraftNodePositions((currentDrafts) => {
        if (!graphStructureEditable) {
          return Object.keys(currentDrafts).length === 0 ? currentDrafts : {};
        }

        const nextDrafts = { ...currentDrafts };
        for (const update of updates) {
          const resolvedPosition = resolveStoredPositionForNodeUpdate(update);
          if (!resolvedPosition) {
            continue;
          }

          const [refNodeId, storedPosition] = resolvedPosition;
          nextDrafts[refNodeId] = storedPosition;
        }
        return nextDrafts;
      });
    },
    [graphStructureEditable, resolveStoredPositionForNodeUpdate, setDraftNodePositions]
  );

  const commitNodeDraftPositions = useCallback(
    (positions?: NodePositionDraftMap) => {
      if (!graphStructureEditable) {
        return;
      }

      const positionsToCommit = positions ?? draftNodePositions;
      if (Object.keys(positionsToCommit).length === 0) {
        return;
      }

      const committed = commitAgentChange((current) => {
        let nextAgent = current;
        for (const [nodeId, position] of Object.entries(positionsToCommit)) {
          nextAgent = updateAgentLayoutNodeState(nextAgent, nodeId, (layoutNode) => ({
            ...layoutNode,
            position,
          }));
        }
        return nextAgent;
      }, GRAPH_LAYOUT_ONLY_CHANGE);

      if (!committed) {
        return;
      }

      setDraftNodePositions({});
    },
    [commitAgentChange, draftNodePositions, graphStructureEditable, setDraftNodePositions]
  );

  const discardNodeDraftPositions = useCallback(() => {
    setDraftNodePositions({});
  }, [setDraftNodePositions]);

  const persistNodePositions = useCallback(
    (updates: GraphNodePositionUpdate[]) => {
      if (updates.length === 0) {
        return;
      }

      if (!graphStructureEditable) {
        setDraftNodePositions({});
        return;
      }

      const positions: NodePositionDraftMap = {};
      for (const update of updates) {
        const resolvedPosition = resolveStoredPositionForNodeUpdate(update);
        if (!resolvedPosition) {
          continue;
        }

        const [refNodeId, storedPosition] = resolvedPosition;
        positions[refNodeId] = storedPosition;
      }

      if (Object.keys(positions).length === 0) {
        return;
      }

      commitNodeDraftPositions(positions);
    },
    [commitNodeDraftPositions, graphStructureEditable, resolveStoredPositionForNodeUpdate, setDraftNodePositions]
  );

  const removeSelected = useCallback(() => {
    if (selectionState.linkId) {
      const removableLinkId = selectionState.linkId;
      const selectedLink = links.find((link) => link.id === removableLinkId);
      if (!selectedLink?.editable) {
        sessionEffects.clearSelection();
        sessionEffects.dismissDetailModalIf((detail) => detail.type === 'link' && detail.id === removableLinkId);
        return;
      }
      if (!graphStructureEditable) {
        return;
      }
      const committed = commitAgentChange(
        (current) => ({
          ...current,
          connections: current.connections.filter((link) => link.id !== removableLinkId),
        }),
        GRAPH_SEMANTIC_CHANGE
      );

      if (!committed) {
        return;
      }

      sessionEffects.clearSelection();
      sessionEffects.dismissDetailModalIf((detail) => detail.type === 'link' && detail.id === removableLinkId);
      return;
    }

    if (selectionState.nodeIds.length === 0) {
      return;
    }
    if (!graphStructureEditable) {
      return;
    }

    const selectedViewNodes = selectionState.nodeIds
      .map((nodeId) => viewNodeByViewId.get(nodeId))
      .filter((node): node is GraphViewNode => node != null)
      .filter((node) => !node.proxy);
    if (selectedViewNodes.length === 0) {
      return;
    }

    const removableNodeIds = new Set(selectedViewNodes.map((node) => node.refNodeId));
    const selectedNodeRecords = selectedViewNodes
      .map((node) => indexes.nodeById.get(node.refNodeId))
      .filter((node): node is AgentGraphViewNodeRecord => node != null);
    const removableSignalNodes = selectedNodeRecords.filter(
      (node): node is AgentSignalNodeRecord => node.kind === 'signal' && node.endpoint != null
    );
    const removableLeafNodeIds = collectLeafRecordIds(
      selectedNodeRecords,
      indexes
    );
    const removableContainerIds = collectRemovableContainerIds(
      indexes.containerById,
      collectSelectedContainerIds(selectedNodeRecords)
    );
    const committed = commitAgentChange((current) => {
      const containersById = new Map(current.brain.containers.map((container) => [container.id, container]));
      const expandedRemovableContainerIds = collectRemovableContainerIds(containersById, [...removableContainerIds]);
      const expandedRemovableNeuronIds = new Set([
        ...removableLeafNodeIds,
        ...collectNeuronIdsInContainers(containersById, expandedRemovableContainerIds),
      ]);
      const nextLayout: AgentIR['layout'] = current.layout
        ? {
            ...current.layout,
            nodes: Object.fromEntries(
              Object.entries(current.layout.nodes).filter(
                ([nodeId]) =>
                  !expandedRemovableNeuronIds.has(nodeId) &&
                  !expandedRemovableContainerIds.has(nodeId) &&
                  !removableNodeIds.has(nodeId)
              )
            ),
          }
        : current.layout;
      const nextBody = mutateBodyIR(
        current.body,
        removableSignalNodes.flatMap<BodyIRMutationAction>((node) => {
          const endpointId = node.endpoint.endpointId;
          if (!endpointId) {
            return [
              {
                type: 'mapping.remove-for-node' as const,
                scope: node.endpoint.scope === 'bodyInput' ? 'input' as const : 'output' as const,
                nodeId: node.refNodeId,
              },
            ];
          }

          if (node.endpoint.scope === 'bodyInput') {
            return [
              {
                type: 'input-endpoint.remove' as const,
                endpointId,
                pruneMappings: true,
              },
            ];
          }

          return [
            {
              type: 'output-endpoint.remove' as const,
              endpointId,
              pruneMappings: true,
            },
          ];
        })
      ).body;

      return {
        ...current,
        body: nextBody,
        brain: {
          ...current.brain,
          neurons: current.brain.neurons.filter((neuron) => !expandedRemovableNeuronIds.has(neuron.id)),
          containers: current.brain.containers
            .filter((container) => !expandedRemovableContainerIds.has(container.id))
            .map((container) => ({
              ...container,
              children: container.children.filter(
                (child) =>
                  !expandedRemovableNeuronIds.has(child.nodeId) &&
                  !expandedRemovableContainerIds.has(child.nodeId)
              ),
            })),
        },
        connections: current.connections.filter(
          (link) =>
            !expandedRemovableNeuronIds.has(link.from.nodeId) &&
            !expandedRemovableNeuronIds.has(link.to.nodeId) &&
            !removableNodeIds.has(link.from.nodeId) &&
            !removableNodeIds.has(link.to.nodeId)
        ),
        layout: nextLayout,
      };
    }, GRAPH_SEMANTIC_CHANGE);

    if (!committed) {
      return;
    }

    sessionEffects.clearSelection();
    sessionEffects.dismissDetailModalIf((detail) => detail.type === 'node' && removableNodeIds.has(detail.id));
  }, [
    commitAgentChange,
    sessionEffects.clearSelection,
    sessionEffects.dismissDetailModalIf,
    graphStructureEditable,
    indexes.nodeById,
    links,
    navigationPath,
    selectionState,
    viewNodeByViewId,
  ]);

  const addNeuronAt = useCallback(
    (x: number, y: number) => {
      if (!isBrainCanvasEditableScope(currentContainerKind) || !graphStructureEditable) {
        return null;
      }

      const siblingIndex = currentChildren.filter((child) => child.kind === 'neuron').length + 1;
      const storedPosition = toStoredPosition({ x, y }, currentScope);
      let createdNeuronId: string | null = null;
      let resolvedNeuronModelId: string | null = null;
      setAgent((current) => {
        if (!isCurrentBrainStructurallyEditable(current)) {
          return current;
        }

        const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
        if (!currentContainerId) {
          return current;
        }
        if (!resolvedNeuronModelId) {
          resolvedNeuronModelId = resolveDefaultNeuronModelId(current);
        }
        if (!resolvedNeuronModelId || !hasNeuronModelId(current, resolvedNeuronModelId)) {
          return current;
        }

        const nextNeuronId = `neuron-${getNextNumericId(getAllBrainNodeIds(current), 'neuron-')}`;
        createdNeuronId = nextNeuronId;
        return updateAgentLayoutNodeState(
          {
            ...current,
            brain: {
              ...current.brain,
              neurons: [
                ...current.brain.neurons,
                {
                  id: nextNeuronId,
                  label: `神经元${siblingIndex}`,
                  neuronModelId: resolvedNeuronModelId,
                  parameterOverrides: {
                    ...DEFAULT_NEURON_PARAMETER_OVERRIDES,
                  },
                  initialState: {
                    v: -65,
                  },
                },
              ],
              containers: updateBrainContainerById(current.brain.containers, currentContainerId, (container) => ({
                ...container,
                children: [...container.children, { scope: 'brain', nodeId: nextNeuronId }],
              })),
            },
          },
          nextNeuronId,
          (layoutNode) => ({
            ...layoutNode,
            position: storedPosition,
          })
        );
      }, GRAPH_SEMANTIC_CHANGE);
      if (!createdNeuronId) {
        return null;
      }
      sessionEffects.scheduleFocusNode(createdNeuronId);
      return createdNeuronId;
    },
    [currentChildren, currentContainerKind, currentScope, graphStructureEditable, navigationPath, sessionEffects.scheduleFocusNode, setAgent]
  );

  const addNeuronGroupAt = useCallback(
    (x: number, y: number) => {
      if (!isBrainCanvasEditableScope(currentContainerKind) || !graphStructureEditable) {
        return null;
      }

      const groupIndex = currentChildren.filter((child) => child.kind === 'neuron-group').length + 1;
      const storedPosition = toStoredPosition({ x, y }, currentScope);
      let createdGroupId: string | null = null;

      setAgent((current) => {
        if (!isCurrentBrainStructurallyEditable(current)) {
          return current;
        }

        const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
        if (!currentContainerId) {
          return current;
        }

        const nextGroupId = `group-${getNextNumericId(getAllBrainNodeIds(current), 'group-')}`;
        createdGroupId = nextGroupId;
        return updateAgentLayoutNodeState(
          {
            ...current,
            brain: {
              ...current.brain,
              containers: [
                ...updateBrainContainerById(current.brain.containers, currentContainerId, (container) => ({
                  ...container,
                  children: [...container.children, { scope: 'container', nodeId: nextGroupId }],
                })),
                {
                  id: nextGroupId,
                  label: `神经元组${groupIndex}`,
                  children: [],
                },
              ],
            },
          },
          nextGroupId,
          (layoutNode) => ({
            ...layoutNode,
            position: storedPosition,
          })
        );
      }, GRAPH_SEMANTIC_CHANGE);
      if (!createdGroupId) {
        return null;
      }
      sessionEffects.scheduleFocusNode(createdGroupId);
      return createdGroupId;
    },
    [currentChildren, currentContainerKind, currentScope, graphStructureEditable, navigationPath, sessionEffects.scheduleFocusNode, setAgent]
  );

  const createNeuronAndConnectAt = useCallback(
    (sourceNodeIds: string[], x: number, y: number) => {
      if (!isBrainCanvasEditableScope(currentContainerKind) || !graphStructureEditable) {
        return;
      }

      const siblingIndex = currentChildren.filter((child) => child.kind === 'neuron').length + 1;
      const nextNeuronId = `neuron-${getNextNumericId(indexes.nodeById.keys(), 'neuron-')}`;
      const nextTargetNode: GraphViewNode = {
        id: nextNeuronId,
        viewId: nextNeuronId,
        refNodeId: nextNeuronId,
        rootContainer: false,
        label: nextNeuronId,
        kind: 'neuron',
        x,
        y,
        width: AGENT_GRAPH_LEAF_NODE_SIZE,
        height: AGENT_GRAPH_LEAF_NODE_SIZE,
        parentId: navigationPath.at(-1) ?? null,
        detail: '',
        editable: true,
        navigable: false,
        leaf: true,
        proxy: false,
        movable: true,
        local: true,
        previewOnly: false,
        rootExpandedProjection: false,
        direction: 'internal',
        connectableSource: true,
        connectableTarget: true,
        expanded: false,
        expansionParentId: null,
        expansionOffsetX: 0,
        expansionOffsetY: 0,
        runtimeInstalled: true,
        runtimeInstalledLeafCount: 1,
        adapterNavigable: false,
      };

      const uniqueSourceNodeIds = uniqueIds(sourceNodeIds);
      const nextConnections: AgentIR['connections'] = [];
      const resolvedLinkIds: string[] = [];
      const attemptedEndpoints = new Set<string>();
      const timestamp = Date.now();

      for (const sourceNodeId of uniqueSourceNodeIds) {
        const sourceViewNode = viewNodeByViewId.get(sourceNodeId);
        if (!sourceViewNode) {
          continue;
        }

        const sourceNode = indexes.nodeById.get(sourceViewNode.refNodeId);
        if (!isAgentLeafNodeRecord(sourceNode)) {
          continue;
        }

        if (
          !canGraphNodesConnect({
            sourceNode: sourceViewNode,
            targetNode: nextTargetNode,
            currentScope,
            localLeafIds,
          })
        ) {
          continue;
        }

        const fromPortId = getLeafPortId(sourceNode, 'output');
        const toPortId = NEURON_INPUT_PORT_ID;
        const endpointKey = `${sourceNode.id}:${fromPortId}->${nextNeuronId}:${toPortId}`;
        if (attemptedEndpoints.has(endpointKey)) {
          continue;
        }

        attemptedEndpoints.add(endpointKey);
        const nextLinkId = `link-${sourceNode.id}-${nextNeuronId}-${timestamp}-${nextConnections.length}`;
        nextConnections.push({
          id: nextLinkId,
          from: toAgentEndpoint(sourceNode, 'output'),
          to: {
            scope: 'brain',
            nodeId: nextNeuronId,
            portId: toPortId,
          },
          synapseModelId: '',
          parameterOverrides: {
            ...DEFAULT_CONNECTION_PARAMETER_OVERRIDES,
          },
        });
        resolvedLinkIds.push(nextLinkId);
      }

      if (nextConnections.length === 0) {
        return;
      }

      let createdNeuronId: string | null = null;
      let createdLinkId: string | null = null;
      setAgent((current) => {
        if (!isCurrentBrainStructurallyEditable(current)) {
          return current;
        }

        const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
        if (!currentContainerId) {
          return current;
        }

        const resolvedNeuronId = `neuron-${getNextNumericId(getAllBrainNodeIds(current), 'neuron-')}`;
        const resolvedConnections = nextConnections.map((connection, index) => ({
          ...connection,
          id: `link-${connection.from.nodeId}-${resolvedNeuronId}-${timestamp}-${index}`,
          to: {
            ...connection.to,
            nodeId: resolvedNeuronId,
          },
        }));
        const result = tryCreateNeuronAndConnectInContainer(current, {
          parentContainerId: currentContainerId,
          nextNeuronId: resolvedNeuronId,
          nextNeuronLabel: `神经元${siblingIndex}`,
          nextNeuronPosition: toStoredPosition({ x, y }, currentScope),
          connections: resolvedConnections,
          neuronModelId: resolveDefaultNeuronModelId(current) ?? undefined,
          neuronParameterOverrides: {
            ...DEFAULT_NEURON_PARAMETER_OVERRIDES,
          },
          neuronInitialState: {
            v: -65,
          },
        });
        if (!isAcceptedGraphEdit(result)) {
          return current;
        }

        createdNeuronId = resolvedNeuronId;
        createdLinkId = resolvedConnections.at(-1)?.id ?? null;
        return result.agent;
      }, GRAPH_SEMANTIC_CHANGE);
      if (!createdNeuronId) {
        return;
      }
      sessionEffects.scheduleFocusNode(createdNeuronId);
      sessionEffects.scheduleFocusLink(createdLinkId ?? resolvedLinkIds.at(-1) ?? null);
    },
    [
      currentChildren,
      currentContainerKind,
      currentScope,
      graphStructureEditable,
      indexes.nodeById,
      localLeafIds,
      navigationPath,
      sessionEffects.scheduleFocusNode,
      sessionEffects.scheduleFocusLink,
      setAgent,
      viewNodeByViewId,
    ]
  );

  const addInputSignalAt = useCallback(
    (x: number, y: number) => {
      if (currentScope !== 'root' || !graphStructureEditable) {
        return null;
      }

      let createdSignalNodeId: string | null = null;
      setAgent((current) => {
        if (!isCurrentBrainStructurallyEditable(current)) {
          return current;
        }

        const nextIndex = getNextNumericId(getAllSignalNodeIds(current), 'input-signal-');
        const nextNodeId = `input-signal-${nextIndex}`;
        const nextEndpointId = `input-endpoint-${nextIndex}`;
        createdSignalNodeId = nextNodeId;
        const nextBody = mutateBodyIR(current.body, [
          {
            type: 'input-endpoint.upsert',
            endpoint: {
              id: nextEndpointId,
              source: 'vision.R.0',
              scale: 1,
            },
          },
          {
            type: 'mapping.upsert',
            mapping: {
              id: `mapping-input-${nextNodeId}`,
              kind: 'input',
              endpointId: nextEndpointId,
              nodeId: nextNodeId,
            },
          },
        ]).body;

        return updateAgentLayoutNodeState(
          {
            ...current,
            body: nextBody,
          },
          nextNodeId,
          (layoutNode) => ({
            ...layoutNode,
            position: toStoredPosition({ x, y }, 'root'),
          })
        );
      }, GRAPH_SEMANTIC_CHANGE);

      if (!createdSignalNodeId) {
        return null;
      }

      sessionEffects.scheduleFocusNode(createdSignalNodeId);
      return createdSignalNodeId;
    },
    [currentScope, graphStructureEditable, sessionEffects.scheduleFocusNode, setAgent]
  );

  const addOutputSignalAt = useCallback(
    (x: number, y: number) => {
      if (currentScope !== 'root' || !graphStructureEditable) {
        return null;
      }

      let createdSignalNodeId: string | null = null;
      setAgent((current) => {
        if (!isCurrentBrainStructurallyEditable(current)) {
          return current;
        }

        const nextIndex = getNextNumericId(getAllSignalNodeIds(current), 'output-signal-');
        const nextNodeId = `output-signal-${nextIndex}`;
        const nextEndpointId = `output-endpoint-${nextIndex}`;
        createdSignalNodeId = nextNodeId;
        const nextBody = mutateBodyIR(current.body, [
          {
            type: 'output-endpoint.upsert',
            endpoint: {
              id: nextEndpointId,
              target: 'action.move-forward',
              decayPerSecond: 4,
            },
          },
          {
            type: 'mapping.upsert',
            mapping: {
              id: `mapping-output-${nextNodeId}`,
              kind: 'output',
              endpointId: nextEndpointId,
              nodeId: nextNodeId,
            },
          },
        ]).body;

        return updateAgentLayoutNodeState(
          {
            ...current,
            body: nextBody,
          },
          nextNodeId,
          (layoutNode) => ({
            ...layoutNode,
            position: toStoredPosition({ x, y }, 'root'),
          })
        );
      }, GRAPH_SEMANTIC_CHANGE);

      if (!createdSignalNodeId) {
        return null;
      }

      sessionEffects.scheduleFocusNode(createdSignalNodeId);
      return createdSignalNodeId;
    },
    [currentScope, graphStructureEditable, sessionEffects.scheduleFocusNode, setAgent]
  );

  const aggregateSelectedNodes = useCallback(() => {
    if (
      !isBrainCanvasEditableScope(currentContainerKind) ||
      selectionState.nodeIds.length < 2 ||
      !graphStructureEditable
    ) {
      return;
    }

    const selectedNodeIdSet = new Set(
      selectionState.nodeIds
        .map((nodeId) => resolveViewNode(viewNodeByViewId, nodeId)?.refNodeId)
        .filter((nodeId): nodeId is string => Boolean(nodeId))
    );
    const selectedChildren = currentChildren.filter((child) => selectedNodeIdSet.has(child.refNodeId));
    if (selectedChildren.length < 2) {
      return;
    }

    const selectedViewNodes = selectedChildren
      .map((child) => viewNodeByViewId.get(child.id))
      .filter((node): node is GraphViewNode => node != null && !node.proxy);
    if (selectedViewNodes.length !== selectedChildren.length) {
      return;
    }

    const minX = Math.min(...selectedViewNodes.map((node) => node.x));
    const minY = Math.min(...selectedViewNodes.map((node) => node.y));
    const groupIndex = currentChildren.filter((child) => child.kind === 'neuron-group').length + 1;
    let createdGroupId: string | null = null;
    setAgent((current) => {
      if (!isCurrentBrainStructurallyEditable(current)) {
        return current;
      }

      const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
      if (!currentContainerId) {
        return current;
      }

      const nextGroupId = `group-${getNextNumericId(getAllBrainNodeIds(current), 'group-')}`;
      const result = tryAggregateAgentNodesIntoGroup(current, {
        parentContainerId: currentContainerId,
        selectedNodeIds: selectedChildren.map((child) => child.refNodeId),
        nextGroupId,
        nextGroupLabel: `神经元组${groupIndex}`,
        nextGroupPosition: toStoredPosition({ x: minX, y: minY }, currentScope),
        childPositionsById: Object.fromEntries(
          selectedChildren.map((child) => {
            const viewNode = viewNodeByViewId.get(child.id);
            return [
              child.refNodeId,
              viewNode
                ? {
                    x: Math.round(viewNode.x - minX),
                    y: Math.round(viewNode.y - minY),
                  }
                : { x: 0, y: 0 },
            ];
          })
        ),
      });
      if (!isAcceptedGraphEdit(result)) {
        return current;
      }

      createdGroupId = nextGroupId;
      return result.agent;
    }, GRAPH_SEMANTIC_CHANGE);
    if (!createdGroupId) {
      return;
    }
    sessionEffects.scheduleFocusNode(createdGroupId);
    resetInteractionTransients({ closeDetailModal: true });
  }, [
    currentChildren,
    currentContainerKind,
    currentScope,
    graphStructureEditable,
    navigationPath,
    resetInteractionTransients,
    sessionEffects.scheduleFocusNode,
    selectionState.nodeIds,
    setAgent,
    viewNodeByViewId,
  ]);

  const ungroupNode = useCallback(
    (nodeId: string) => {
      if (!isBrainCanvasEditableScope(currentContainerKind) || !graphStructureEditable) {
        return;
      }

      const targetGroupViewNode = resolveViewNode(viewNodeByViewId, nodeId);
      const targetGroupRefNodeId = targetGroupViewNode?.refNodeId ?? nodeId;
      const targetGroup = currentChildren.find((child) => child.id === targetGroupRefNodeId);
      if (!targetGroup || targetGroup.kind !== 'neuron-group') {
        return;
      }

      const committed = commitAgentChange((current) => {
        const currentContainerId = resolveCurrentBrainContainerId(current, navigationPath);
        if (!currentContainerId) {
          return current;
        }

        const result = tryUngroupAgentContainer(current, currentContainerId, targetGroup.refNodeId);
        if (!isAcceptedGraphEdit(result)) {
          return current;
        }

        return result.agent;
      }, GRAPH_SEMANTIC_CHANGE);
      if (!committed) {
        return;
      }
      resetInteractionTransients({ clearSelection: true, closeDetailModal: true });
    },
    [
      commitAgentChange,
      currentChildren,
      currentContainerKind,
      graphStructureEditable,
      navigationPath,
      resetInteractionTransients,
      viewNodeByViewId,
    ]
  );

  const toggleGroupExpanded = useCallback(
    (nodeId: string) => {
      if (!graphStructureEditable) {
        return;
      }

      const viewNode = viewNodeByViewId.get(nodeId);
      const layoutNodeId = viewNode?.refNodeId ?? nodeId;
      setAgent(
        (current) => {
          if (!isCurrentBrainStructurallyEditable(current)) {
            return current;
          }

          return updateAgentLayoutNodeState(current, layoutNodeId, (layoutNode) => ({
            ...layoutNode,
            collapsed: layoutNode.collapsed === false ? true : false,
          }));
        },
        GRAPH_LAYOUT_ONLY_CHANGE
      );
      resetInteractionTransients({ clearSelection: true });
    },
    [graphStructureEditable, resetInteractionTransients, setAgent, viewNodeByViewId]
  );

  const moveNodeOutToParent = useCallback(
    (nodeId: string) => {
      if (currentContainerKind !== 'neuron-group' || !graphStructureEditable) {
        return;
      }

      const viewNode = resolveViewNode(viewNodeByViewId, nodeId);
      const targetRefNodeId = viewNode?.refNodeId ?? nodeId;
      const targetNode =
        currentChildren.find((child) => child.refNodeId === targetRefNodeId) ??
        indexes.nodeById.get(targetRefNodeId) ??
        null;
      if (!targetNode) {
        return;
      }

      const sourceContainerId =
        viewNode?.expansionParentId ??
        navigationPath[navigationPath.length - 1] ??
        null;
      if (!sourceContainerId) {
        return;
      }

      const parentContainerId = indexes.parentContainerIdByNodeId.get(sourceContainerId) ?? null;
      if (!parentContainerId) {
        return;
      }

      const currentViewNode = viewNodeByViewId.get(nodeId);
      const nextPosition =
        currentViewNode
          ? toStoredPositionForScope(
              {
                x: currentViewNode.x,
                y: currentViewNode.y,
              },
              currentScope
            )
          : undefined;

      const committed = commitAgentChange((current) => {
        const result = tryReparentAgentNode(current, {
          nodeId: targetNode.refNodeId,
          fromContainerId: sourceContainerId,
          toContainerId: parentContainerId,
          nextPosition,
        });
        if (!isAcceptedGraphEdit(result)) {
          return current;
        }

        return result.agent;
      }, GRAPH_SEMANTIC_CHANGE);

      if (!committed) {
        return;
      }

      resetInteractionTransients({ clearSelection: true, closeDetailModal: true });
      sessionEffects.scheduleFocusNode(targetNode.refNodeId);
    },
    [
      commitAgentChange,
      currentChildren,
      currentContainerKind,
      graphStructureEditable,
      indexes.parentContainerIdByNodeId,
      navigationPath,
      resetInteractionTransients,
      sessionEffects,
      viewNodeByViewId,
    ]
  );

  const moveSelectionIntoGroup = useCallback(
    (nodeId: string) => {
      if (!isBrainCanvasEditableScope(currentContainerKind) || !graphStructureEditable) {
        return;
      }

      const targetGroupViewNode = resolveViewNode(viewNodeByViewId, nodeId);
      const targetGroupRefNodeId = targetGroupViewNode?.refNodeId ?? nodeId;
      const targetGroup = currentChildren.find((child) => child.refNodeId === targetGroupRefNodeId);
      if (!targetGroup || targetGroup.kind !== 'neuron-group') {
        return;
      }

      const currentContainerId = navigationPath[navigationPath.length - 1] ?? null;
      if (!currentContainerId) {
        return;
      }

      const selectedRefNodeIds = uniqueIds(
        selectionState.nodeIds
          .map((selectedNodeId) => resolveViewNode(viewNodeByViewId, selectedNodeId)?.refNodeId ?? null)
          .filter((selectedNodeId): selectedNodeId is string => selectedNodeId != null)
          .filter((selectedNodeId) => selectedNodeId !== targetGroup.refNodeId)
      );

      if (selectedRefNodeIds.length === 0) {
        return;
      }

      const targetGroupView = viewNodeByViewId.get(nodeId) ?? null;
      const viewNodeByRefNodeId = new Map<string, GraphViewNode>();
      for (const candidate of viewNodeByViewId.values()) {
        if (!viewNodeByRefNodeId.has(candidate.refNodeId)) {
          viewNodeByRefNodeId.set(candidate.refNodeId, candidate);
        }
      }

      let committedAny = false;
      commitAgentChange((current) => {
        let nextAgent = current;
        for (const selectedRefNodeId of selectedRefNodeIds) {
          const selectedViewNode = viewNodeByRefNodeId.get(selectedRefNodeId) ?? null;
          const nextPosition =
            selectedViewNode && targetGroupView
              ? {
                  x: Math.max(0, Math.round(selectedViewNode.x - targetGroupView.x)),
                  y: Math.max(0, Math.round(selectedViewNode.y - targetGroupView.y)),
                }
              : undefined;
          const result = tryReparentAgentNode(nextAgent, {
            nodeId: selectedRefNodeId,
            fromContainerId: currentContainerId,
            toContainerId: targetGroup.refNodeId,
            nextPosition,
          });
          if (!isAcceptedGraphEdit(result)) {
            return current;
          }
          nextAgent = result.agent;
          committedAny = true;
        }

        return nextAgent;
      }, GRAPH_SEMANTIC_CHANGE);

      if (!committedAny) {
        return;
      }

      resetInteractionTransients({ closeDetailModal: true });
      sessionEffects.scheduleFocusNode(targetGroup.refNodeId);
    },
    [
      commitAgentChange,
      currentChildren,
      currentContainerKind,
      graphStructureEditable,
      navigationPath,
      selectionState.nodeIds,
      resetInteractionTransients,
      sessionEffects,
      viewNodeByViewId,
    ]
  );

  return {
    connectSourceNodesToTarget,
    updateNodePositionsInDraft,
    discardNodeDraftPositions,
    persistNodePositions,
    removeSelected,
    addNeuronAt,
    addNeuronGroupAt,
    addInputSignalAt,
    addOutputSignalAt,
    createNeuronAndConnectAt,
    aggregateSelectedNodes,
    ungroupNode,
    toggleGroupExpanded,
    moveNodeOutToParent,
    moveSelectionIntoGroup,
    updateNodeLabelAndParams,
    updateLinkWeight,
    updateAggregateLinks,
  };
};
