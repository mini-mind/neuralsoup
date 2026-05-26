import type {
  AgentIR,
  BodyIR,
  BodyInputMappingIR,
  BodyInputNodeRuntime,
  BodyOutputMappingIR,
  BodyOutputNodeRuntime,
} from './agent-ir';
import type { WorldInputBinding, WorldOutputBinding, WorldRegistry } from './world-registry';

export type AgentBodyEndpointScope = 'input' | 'output';
export type AgentBodyEndpointIssueKind = 'compile-error' | 'conflict' | 'unmatched';

export interface AgentBodyEndpointPreviewItem {
  nodeId: string;
  resolved: string;
}

export interface AgentBodyEndpointPreviewGroup {
  endpointId: string;
  mappingSelector: string;
  template: string;
  mappings: AgentBodyEndpointPreviewItem[];
}

export interface AgentBodyEndpointIssueSummaryItem {
  scope: AgentBodyEndpointScope;
  kind: AgentBodyEndpointIssueKind;
  message: string;
  endpointId?: string;
  nodeId?: string;
  relatedMappingIds?: string[];
  resolved?: string;
  target?: string;
}

export interface AgentBodyEndpointScopePreview {
  endpointNodeIds: string[];
  endpointMappings: AgentBodyEndpointPreviewGroup[];
  previewsByEndpointId: Record<string, AgentBodyEndpointPreviewItem[]>;
}

export interface AgentBodyEndpointPreviewModel {
  input: AgentBodyEndpointScopePreview;
  output: AgentBodyEndpointScopePreview;
  issues: AgentBodyEndpointIssueSummaryItem[];
}

interface BodyResolutionResult<RuntimeNode> {
  nodesById: Map<string, RuntimeNode>;
  issues: AgentBodyEndpointIssueSummaryItem[];
  endpointMappings: AgentBodyEndpointPreviewGroup[];
}

const dedupeSorted = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const buildEndpointPreviewRecord = (
  endpointMappings: AgentBodyEndpointPreviewGroup[]
): Record<string, AgentBodyEndpointPreviewItem[]> =>
  Object.fromEntries(endpointMappings.map((mapping) => [mapping.endpointId, [...mapping.mappings]]));

const sortPreviewItems = (items: AgentBodyEndpointPreviewItem[]): AgentBodyEndpointPreviewItem[] =>
  items.sort((left, right) => left.nodeId.localeCompare(right.nodeId) || left.resolved.localeCompare(right.resolved));

const collectEndpointNodeIdsFromConnections = (agent: AgentIR, scope: 'bodyInput' | 'bodyOutput'): Set<string> => {
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

const collectMappedInputNodeIds = (body: BodyIR): string[] =>
  body.mappings
    .filter((mapping): mapping is BodyInputMappingIR => mapping.kind === 'input')
    .map((mapping) => mapping.nodeId);

const collectMappedOutputNodeIds = (body: BodyIR): string[] =>
  body.mappings
    .filter((mapping): mapping is BodyOutputMappingIR => mapping.kind === 'output')
    .map((mapping) => mapping.nodeId);

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

const resolveBodyInputMappings = (
  registry: WorldRegistry,
  body: BodyIR,
  nodeIds: Iterable<string>
): BodyResolutionResult<BodyInputNodeRuntime> => {
  const nodesById = new Map<string, BodyInputNodeRuntime>();
  const endpointById = new Map(body.inputEndpoints.map((endpoint) => [endpoint.id, endpoint]));
  const mappingsByNodeId = new Map<string, BodyInputMappingIR[]>();
  const endpointMappings: AgentBodyEndpointPreviewGroup[] = body.inputEndpoints.map((endpoint) => ({
    endpointId: endpoint.id,
    mappingSelector: `mapping.endpointId == "${endpoint.id}"`,
    template: endpoint.source,
    mappings: [],
  }));
  const previewByEndpointId = new Map(endpointMappings.map((group) => [group.endpointId, group]));
  const issues: AgentBodyEndpointIssueSummaryItem[] = [];

  for (const mapping of body.mappings) {
    if (mapping.kind !== 'input') {
      continue;
    }
    const current = mappingsByNodeId.get(mapping.nodeId) ?? [];
    current.push(mapping);
    mappingsByNodeId.set(mapping.nodeId, current);
  }

  for (const nodeId of dedupeSorted(nodeIds)) {
    const matches = mappingsByNodeId.get(nodeId) ?? [];

    if (matches.length === 0) {
      issues.push({
        scope: 'input',
        kind: 'unmatched',
        nodeId,
        message: `Body input node "${nodeId}" does not match any BodyIR input mapping.`,
      });
      continue;
    }

    if (matches.length > 1) {
      const relatedMappingIds = matches.map((mapping) => mapping.id);
      issues.push({
        scope: 'input',
        kind: 'conflict',
        nodeId,
        relatedMappingIds,
        message: `Body input node "${nodeId}" matches multiple BodyIR input mappings: ${matches
          .map((mapping) => mapping.id)
          .join(', ')}.`,
      });
      continue;
    }

    const mapping = matches[0];
    const endpoint = endpointById.get(mapping.endpointId);
    if (!endpoint) {
      issues.push({
        scope: 'input',
        kind: 'compile-error',
        endpointId: mapping.endpointId,
        nodeId,
        relatedMappingIds: [mapping.id],
        message: `Body input mapping "${mapping.id}" references missing endpoint "${mapping.endpointId}".`,
      });
      continue;
    }

    const previewGroup = previewByEndpointId.get(endpoint.id);
    previewGroup?.mappings.push({
      nodeId,
      resolved: endpoint.source,
    });

    const binding = registry.resolveInputBinding(endpoint.source);
    const parsed = parseBodyInputSource(nodeId, binding, endpoint.scale);
    if (!parsed) {
      issues.push({
        scope: 'input',
        kind: 'compile-error',
        endpointId: endpoint.id,
        nodeId,
        resolved: endpoint.source,
        message: `Body input endpoint "${endpoint.id}" resolves node "${nodeId}" to unsupported source "${endpoint.source}".`,
      });
      continue;
    }

    nodesById.set(parsed.id, parsed);
  }

  for (const preview of endpointMappings) {
    sortPreviewItems(preview.mappings);
  }

  return { nodesById, issues, endpointMappings };
};

const resolveBodyOutputMappings = (
  registry: WorldRegistry,
  body: BodyIR,
  nodeIds: Iterable<string>
): BodyResolutionResult<BodyOutputNodeRuntime> => {
  const nodesById = new Map<string, BodyOutputNodeRuntime>();
  const endpointById = new Map(body.outputEndpoints.map((endpoint) => [endpoint.id, endpoint]));
  const mappingsByNodeId = new Map<string, BodyOutputMappingIR[]>();
  const endpointMappings: AgentBodyEndpointPreviewGroup[] = body.outputEndpoints.map((endpoint) => ({
    endpointId: endpoint.id,
    mappingSelector: `mapping.endpointId == "${endpoint.id}"`,
    template: endpoint.target,
    mappings: [],
  }));
  const previewByEndpointId = new Map(endpointMappings.map((group) => [group.endpointId, group]));
  const targetToNodeId = new Map<string, string>();
  const issues: AgentBodyEndpointIssueSummaryItem[] = [];

  for (const mapping of body.mappings) {
    if (mapping.kind !== 'output') {
      continue;
    }
    const current = mappingsByNodeId.get(mapping.nodeId) ?? [];
    current.push(mapping);
    mappingsByNodeId.set(mapping.nodeId, current);
  }

  for (const nodeId of dedupeSorted(nodeIds)) {
    const matches = mappingsByNodeId.get(nodeId) ?? [];

    if (matches.length === 0) {
      issues.push({
        scope: 'output',
        kind: 'unmatched',
        nodeId,
        message: `Body output node "${nodeId}" does not match any BodyIR output mapping.`,
      });
      continue;
    }

    if (matches.length > 1) {
      const relatedMappingIds = matches.map((mapping) => mapping.id);
      issues.push({
        scope: 'output',
        kind: 'conflict',
        nodeId,
        relatedMappingIds,
        message: `Body output node "${nodeId}" matches multiple BodyIR output mappings: ${matches
          .map((mapping) => mapping.id)
          .join(', ')}.`,
      });
      continue;
    }

    const mapping = matches[0];
    const endpoint = endpointById.get(mapping.endpointId);
    if (!endpoint) {
      issues.push({
        scope: 'output',
        kind: 'compile-error',
        endpointId: mapping.endpointId,
        nodeId,
        relatedMappingIds: [mapping.id],
        message: `Body output mapping "${mapping.id}" references missing endpoint "${mapping.endpointId}".`,
      });
      continue;
    }

    const previewGroup = previewByEndpointId.get(endpoint.id);
    previewGroup?.mappings.push({
      nodeId,
      resolved: endpoint.target,
    });

    const binding = registry.resolveOutputBinding(endpoint.target);
    const parsed = parseBodyOutputTarget(nodeId, binding, endpoint.decayPerSecond);
    if (!parsed) {
      issues.push({
        scope: 'output',
        kind: 'compile-error',
        endpointId: endpoint.id,
        nodeId,
        resolved: endpoint.target,
        message: `Body output endpoint "${endpoint.id}" resolves node "${nodeId}" to unsupported target "${endpoint.target}".`,
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

  for (const preview of endpointMappings) {
    sortPreviewItems(preview.mappings);
  }

  return { nodesById, issues, endpointMappings };
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
  issues: AgentBodyEndpointIssueSummaryItem[];
  endpointIds: AgentBodyEndpointIds;
}

export const resolveAgentBodyEndpointIds = (
  agent: AgentIR,
  _registry: WorldRegistry,
  _projectedVisionCellCount?: number
): AgentBodyEndpointIds => {
  const bodyInputNodeIds = dedupeSorted([
    ...collectEndpointNodeIdsFromConnections(agent, 'bodyInput'),
    ...collectMappedInputNodeIds(agent.body),
  ]);
  const bodyOutputNodeIds = dedupeSorted([
    ...collectEndpointNodeIdsFromConnections(agent, 'bodyOutput'),
    ...collectMappedOutputNodeIds(agent.body),
  ]);

  return {
    bodyInputNodeIds,
    bodyOutputNodeIds,
  };
};

export const resolveCompiledAgentBodyEndpointIds = (agent: AgentIR, registry: WorldRegistry): AgentCompiledBodyEndpointIds => {
  const referencedBodyInputNodeIds = collectEndpointNodeIdsFromConnections(agent, 'bodyInput');
  const referencedBodyOutputNodeIds = collectEndpointNodeIdsFromConnections(agent, 'bodyOutput');
  const input = resolveBodyInputMappings(registry, agent.body, referencedBodyInputNodeIds);
  const output = resolveBodyOutputMappings(registry, agent.body, referencedBodyOutputNodeIds);

  return {
    bodyInputNodeIds: dedupeSorted(input.nodesById.keys()),
    bodyOutputNodeIds: dedupeSorted(output.nodesById.keys()),
  };
};

export const resolveAgentBodyEndpointResolution = (agent: AgentIR, registry: WorldRegistry): AgentBodyEndpointResolution => {
  const endpointIds = resolveAgentBodyEndpointIds(agent, registry);
  const input = resolveBodyInputMappings(registry, agent.body, endpointIds.bodyInputNodeIds);
  const output = resolveBodyOutputMappings(registry, agent.body, endpointIds.bodyOutputNodeIds);

  return {
    inputNodesById: input.nodesById,
    outputNodesById: output.nodesById,
    issues: [...input.issues, ...output.issues],
    endpointIds,
  };
};

export const resolveAgentBodyInputEndpointMappings = (
  registry: WorldRegistry,
  body: BodyIR,
  nodeIds: Iterable<string>
): BodyResolutionResult<BodyInputNodeRuntime> => resolveBodyInputMappings(registry, body, nodeIds);

export const resolveAgentBodyOutputEndpointMappings = (
  registry: WorldRegistry,
  body: BodyIR,
  nodeIds: Iterable<string>
): BodyResolutionResult<BodyOutputNodeRuntime> => resolveBodyOutputMappings(registry, body, nodeIds);

export const buildAgentBodyEndpointPreviewModel = (
  agent: AgentIR,
  registry: WorldRegistry,
  projectedVisionCellCount?: number
): AgentBodyEndpointPreviewModel => {
  const endpointIds = resolveAgentBodyEndpointIds(agent, registry, projectedVisionCellCount);
  const input = resolveBodyInputMappings(registry, agent.body, endpointIds.bodyInputNodeIds);
  const output = resolveBodyOutputMappings(registry, agent.body, endpointIds.bodyOutputNodeIds);
  const inputPreviewByEndpointId = buildEndpointPreviewRecord(input.endpointMappings);
  const outputPreviewByEndpointId = buildEndpointPreviewRecord(output.endpointMappings);

  return {
    input: {
      endpointNodeIds: [...endpointIds.bodyInputNodeIds],
      endpointMappings: input.endpointMappings,
      previewsByEndpointId: inputPreviewByEndpointId,
    },
    output: {
      endpointNodeIds: [...endpointIds.bodyOutputNodeIds],
      endpointMappings: output.endpointMappings,
      previewsByEndpointId: outputPreviewByEndpointId,
    },
    issues: [...input.issues, ...output.issues],
  };
};
