import type { AgentIR, BodyIR, WorldRegistry } from '../../../../domain/brain';
import type { TopologyLinkSceneNode } from '../TopologyLinkLayer';

export type BodyCanvasNodeKind = 'world-input' | 'body-input' | 'body-output' | 'world-output';
export type BodyCanvasDirection = 'input' | 'output';

export type BodyCanvasSceneNode = TopologyLinkSceneNode & {
  id: string;
  kind: BodyCanvasNodeKind;
  label: string;
  detail: string;
  direction: BodyCanvasDirection;
  labelSide: 'left' | 'right';
  relatedEndpointIds: string[];
  x: number;
  y: number;
};

export type BodyCanvasLink = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  direction: BodyCanvasDirection;
  endpointId: string;
  endpointOrder: number;
  mappingId: string;
  nodeId: string;
  label: string;
  detail: string;
};

interface InputMatchRow {
  mappingId: string;
  endpointId: string;
  endpointOrder: number;
  nodeId: string;
  resolvedSource: string;
}

interface OutputMatchRow {
  mappingId: string;
  endpointId: string;
  endpointOrder: number;
  nodeId: string;
  resolvedTarget: string;
}

export interface BodyCanvasModel {
  nodes: BodyCanvasSceneNode[];
  nodeById: Map<string, BodyCanvasSceneNode>;
  links: BodyCanvasLink[];
  surfaceWidth: number;
  surfaceHeight: number;
  outputSectionTop: number;
}

const SURFACE_WIDTH = 1280;
const NODE_SIZE = 16;
const SECTION_TOP = 64;
const ROW_SPACING = 28;
const SECTION_GAP = 132;
const SURFACE_BOTTOM = 56;

const WORLD_INPUT_X = 120;
const BODY_INPUT_X = 420;
const BODY_OUTPUT_X = 860;
const WORLD_OUTPUT_X = 1160;

const dedupeSorted = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const appendEndpointId = (map: Map<string, string[]>, key: string, endpointId: string) => {
  const current = map.get(key);
  if (!current) {
    map.set(key, [endpointId]);
    return;
  }
  if (!current.includes(endpointId)) {
    current.push(endpointId);
  }
};

export const buildBodyCanvasModel = (agent: AgentIR, body: BodyIR, worldRegistry: WorldRegistry): BodyCanvasModel => {
  const inputEndpointIdToIndex = new Map(body.inputEndpoints.map((endpoint, index) => [endpoint.id, index]));
  const outputEndpointIdToIndex = new Map(body.outputEndpoints.map((endpoint, index) => [endpoint.id, index]));
  const inputEndpointById = new Map(body.inputEndpoints.map((endpoint) => [endpoint.id, endpoint]));
  const outputEndpointById = new Map(body.outputEndpoints.map((endpoint) => [endpoint.id, endpoint]));

  const inputRows: InputMatchRow[] = body.mappings.flatMap((mapping) => {
    if (mapping.kind !== 'input') {
      return [];
    }
    const endpoint = inputEndpointById.get(mapping.endpointId);
    if (!endpoint) {
      return [];
    }
    return [
      {
        mappingId: mapping.id,
        endpointId: endpoint.id,
        endpointOrder: inputEndpointIdToIndex.get(endpoint.id) ?? -1,
        nodeId: mapping.nodeId,
        resolvedSource: endpoint.source,
      },
    ];
  });

  const outputRows: OutputMatchRow[] = body.mappings.flatMap((mapping) => {
    if (mapping.kind !== 'output') {
      return [];
    }
    const endpoint = outputEndpointById.get(mapping.endpointId);
    if (!endpoint) {
      return [];
    }
    return [
      {
        mappingId: mapping.id,
        endpointId: endpoint.id,
        endpointOrder: outputEndpointIdToIndex.get(endpoint.id) ?? -1,
        nodeId: mapping.nodeId,
        resolvedTarget: endpoint.target,
      },
    ];
  });

  const bodyInputNodeIds = dedupeSorted(inputRows.map((row) => row.nodeId));
  const bodyOutputNodeIds = dedupeSorted(outputRows.map((row) => row.nodeId));
  const worldInputSignals = dedupeSorted(inputRows.map((row) => row.resolvedSource));
  const worldOutputSignals = dedupeSorted(outputRows.map((row) => row.resolvedTarget));

  const inputSpan = Math.max(worldInputSignals.length, bodyInputNodeIds.length, 1);
  const outputSpan = Math.max(bodyOutputNodeIds.length, worldOutputSignals.length, 1);
  const inputSectionHeight = inputSpan * ROW_SPACING;
  const outputSectionTop = SECTION_TOP + inputSectionHeight + SECTION_GAP;
  const surfaceHeight = outputSectionTop + outputSpan * ROW_SPACING + SURFACE_BOTTOM;

  const inputSourceEndpoints = new Map<string, string[]>();
  const inputBodyEndpoints = new Map<string, string[]>();
  const outputBodyEndpoints = new Map<string, string[]>();
  const outputTargetEndpoints = new Map<string, string[]>();

  inputRows.forEach((row) => {
    appendEndpointId(inputSourceEndpoints, row.resolvedSource, row.endpointId);
    appendEndpointId(inputBodyEndpoints, row.nodeId, row.endpointId);
  });
  outputRows.forEach((row) => {
    appendEndpointId(outputBodyEndpoints, row.nodeId, row.endpointId);
    appendEndpointId(outputTargetEndpoints, row.resolvedTarget, row.endpointId);
  });

  const nodes: BodyCanvasSceneNode[] = [];

  worldInputSignals.forEach((signal, index) => {
    const binding = worldRegistry.resolveInputBinding(signal);
    nodes.push({
      id: `world-input:${signal}`,
      label: signal,
      detail: binding ? `World 输入端口 ${binding.worldPort}` : '未解析的 World 输入信号',
      kind: 'world-input',
      direction: 'input',
      x: WORLD_INPUT_X,
      y: SECTION_TOP + index * ROW_SPACING,
      labelSide: 'right',
      relatedEndpointIds: inputSourceEndpoints.get(signal) ?? [],
      sceneX: WORLD_INPUT_X - NODE_SIZE / 2,
      sceneY: SECTION_TOP + index * ROW_SPACING - NODE_SIZE / 2,
      width: NODE_SIZE,
      height: NODE_SIZE,
    });
  });

  bodyInputNodeIds.forEach((nodeId, index) => {
    const brainConnectionCount = agent.connections.filter(
      (connection) =>
        (connection.from.scope === 'bodyInput' && connection.from.nodeId === nodeId) ||
        (connection.to.scope === 'bodyInput' && connection.to.nodeId === nodeId)
    ).length;

    nodes.push({
      id: `body-input:${nodeId}`,
      label: nodeId,
      detail: `Body 输入信号节点，关联 Brain 连接 ${brainConnectionCount} 条`,
      kind: 'body-input',
      direction: 'input',
      x: BODY_INPUT_X,
      y: SECTION_TOP + index * ROW_SPACING,
      labelSide: 'right',
      relatedEndpointIds: inputBodyEndpoints.get(nodeId) ?? [],
      sceneX: BODY_INPUT_X - NODE_SIZE / 2,
      sceneY: SECTION_TOP + index * ROW_SPACING - NODE_SIZE / 2,
      width: NODE_SIZE,
      height: NODE_SIZE,
    });
  });

  bodyOutputNodeIds.forEach((nodeId, index) => {
    const brainConnectionCount = agent.connections.filter(
      (connection) =>
        (connection.from.scope === 'bodyOutput' && connection.from.nodeId === nodeId) ||
        (connection.to.scope === 'bodyOutput' && connection.to.nodeId === nodeId)
    ).length;

    nodes.push({
      id: `body-output:${nodeId}`,
      label: nodeId,
      detail: `Body 输出信号节点，关联 Brain 连接 ${brainConnectionCount} 条`,
      kind: 'body-output',
      direction: 'output',
      x: BODY_OUTPUT_X,
      y: outputSectionTop + index * ROW_SPACING,
      labelSide: 'left',
      relatedEndpointIds: outputBodyEndpoints.get(nodeId) ?? [],
      sceneX: BODY_OUTPUT_X - NODE_SIZE / 2,
      sceneY: outputSectionTop + index * ROW_SPACING - NODE_SIZE / 2,
      width: NODE_SIZE,
      height: NODE_SIZE,
    });
  });

  worldOutputSignals.forEach((signal, index) => {
    const binding = worldRegistry.resolveOutputBinding(signal);
    nodes.push({
      id: `world-output:${signal}`,
      label: signal,
      detail: binding ? `World 输出端口 ${binding.worldPort}` : '未解析的 World 输出信号',
      kind: 'world-output',
      direction: 'output',
      x: WORLD_OUTPUT_X,
      y: outputSectionTop + index * ROW_SPACING,
      labelSide: 'left',
      relatedEndpointIds: outputTargetEndpoints.get(signal) ?? [],
      sceneX: WORLD_OUTPUT_X - NODE_SIZE / 2,
      sceneY: outputSectionTop + index * ROW_SPACING - NODE_SIZE / 2,
      width: NODE_SIZE,
      height: NODE_SIZE,
    });
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const links: BodyCanvasLink[] = [
    ...inputRows.map((row) => ({
      id: `body-input-link-${row.mappingId}`,
      fromNodeId: `world-input:${row.resolvedSource}`,
      toNodeId: `body-input:${row.nodeId}`,
      direction: 'input' as const,
      endpointId: row.endpointId,
      endpointOrder: row.endpointOrder,
      mappingId: row.mappingId,
      nodeId: row.nodeId,
      label: row.endpointOrder >= 0 ? `E${row.endpointOrder + 1}` : 'E?',
      detail: `${row.resolvedSource} -> ${row.nodeId}`,
    })),
    ...outputRows.map((row) => ({
      id: `body-output-link-${row.mappingId}`,
      fromNodeId: `body-output:${row.nodeId}`,
      toNodeId: `world-output:${row.resolvedTarget}`,
      direction: 'output' as const,
      endpointId: row.endpointId,
      endpointOrder: row.endpointOrder,
      mappingId: row.mappingId,
      nodeId: row.nodeId,
      label: row.endpointOrder >= 0 ? `E${row.endpointOrder + 1}` : 'E?',
      detail: `${row.nodeId} -> ${row.resolvedTarget}`,
    })),
  ].filter((link) => nodeById.has(link.fromNodeId) && nodeById.has(link.toNodeId));

  return {
    nodes,
    nodeById,
    links,
    surfaceWidth: SURFACE_WIDTH,
    surfaceHeight,
    outputSectionTop,
  };
};
