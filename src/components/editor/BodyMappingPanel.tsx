import React, { useEffect, useMemo, useState } from 'react';
import type {
  AgentIR,
  BodyIR,
  BodyInputEndpointIR,
  BodyInputMappingIR,
  BodyOutputEndpointIR,
  BodyOutputMappingIR,
  WorldRegistry,
} from '../../domain/brain';
import TopologyCanvasSurface from './graph/TopologyCanvasSurface';
import TopologyLinkLayer, { type TopologyLinkSceneNode } from './graph/TopologyLinkLayer';
import TopologyNodeLayer from './graph/TopologyNodeLayer';
import type {
  BodyIRDraftStatus,
  BodyIRPreviewData,
  BodyIRValidationMessage,
} from './types';

interface BodyMappingPanelProps {
  agent: AgentIR;
  worldRegistry: WorldRegistry;
  bodyDraftStatus: BodyIRDraftStatus;
  preview?: BodyIRPreviewData;
  validation?: BodyIRValidationMessage[];
  onBodyChange: (updater: (current: BodyIR) => BodyIR) => void;
  onApply: () => void;
  onReset: () => void;
}

type SelectedEndpoint =
  | { kind: 'input'; endpointId: string }
  | { kind: 'output'; endpointId: string }
  | null;

type BodyCanvasNodeKind = 'world-input' | 'body-input' | 'body-output' | 'world-output';
type BodyCanvasDirection = 'input' | 'output';

type BodyCanvasNode = {
  id: string;
  label: string;
  detail: string;
  kind: BodyCanvasNodeKind;
  direction: BodyCanvasDirection;
  x: number;
  y: number;
  labelSide: 'left' | 'right';
  relatedEndpointIds: string[];
};

type BodyCanvasLink = {
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

type BodyCanvasSceneNode = TopologyLinkSceneNode & {
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

type BodySelection =
  | { kind: 'node'; direction: BodyCanvasDirection; endpointId: string; nodeId: string }
  | { kind: 'link'; direction: BodyCanvasDirection; endpointId: string; mappingId: string; nodeId: string; linkId: string }
  | null;

type BodyContextMenuState =
  | {
      selection: Exclude<BodySelection, null>;
      position: {
        x: number;
        y: number;
      };
    }
  | null;

type InputMatchRow = {
  key: string;
  mappingId: string;
  endpointId: string;
  endpointOrder: number;
  nodeId: string;
  resolvedSource: string;
  scale?: number;
};

type OutputMatchRow = {
  key: string;
  mappingId: string;
  endpointId: string;
  endpointOrder: number;
  nodeId: string;
  resolvedTarget: string;
  decayPerSecond?: number;
};

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

const createEndpointId = (prefix: 'input' | 'output') =>
  `${prefix}-endpoint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createMappingId = (prefix: 'input' | 'output') =>
  `${prefix}-mapping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultInputEndpoint = (body: BodyIR): BodyInputEndpointIR => {
  const fallback = body.inputEndpoints.at(-1);
  return {
    id: createEndpointId('input'),
    source: fallback?.source ?? 'vision.retina.0',
    worldPort: fallback?.worldPort ?? '',
    scale: fallback?.scale ?? 1,
  };
};

const createDefaultOutputEndpoint = (body: BodyIR): BodyOutputEndpointIR => {
  const fallback = body.outputEndpoints.at(-1);
  return {
    id: createEndpointId('output'),
    target: fallback?.target ?? 'action.move',
    worldPort: fallback?.worldPort ?? '',
    decayPerSecond: fallback?.decayPerSecond ?? 4,
  };
};

const createInputMapping = (endpointId: string): BodyInputMappingIR => ({
  id: createMappingId('input'),
  kind: 'input',
  endpointId,
  nodeId: '',
});

const createOutputMapping = (endpointId: string): BodyOutputMappingIR => ({
  id: createMappingId('output'),
  kind: 'output',
  endpointId,
  nodeId: '',
});

const dedupeSorted = (values: Iterable<string>): string[] => [...new Set(values)].sort((left, right) => left.localeCompare(right));

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

const getDefaultSelectedEndpoint = (body: BodyIR): SelectedEndpoint => {
  const inputEndpoint = body.inputEndpoints[0];
  if (inputEndpoint) {
    return { kind: 'input', endpointId: inputEndpoint.id };
  }
  const outputEndpoint = body.outputEndpoints[0];
  if (outputEndpoint) {
    return { kind: 'output', endpointId: outputEndpoint.id };
  }
  return null;
};

const updateInputEndpointById = (
  body: BodyIR,
  endpointId: string,
  updater: (endpoint: BodyInputEndpointIR) => BodyInputEndpointIR
): BodyIR => ({
  ...body,
  inputEndpoints: body.inputEndpoints.map((endpoint) =>
    endpoint.id === endpointId ? updater(endpoint) : endpoint
  ),
});

const updateOutputEndpointById = (
  body: BodyIR,
  endpointId: string,
  updater: (endpoint: BodyOutputEndpointIR) => BodyOutputEndpointIR
): BodyIR => ({
  ...body,
  outputEndpoints: body.outputEndpoints.map((endpoint) =>
    endpoint.id === endpointId ? updater(endpoint) : endpoint
  ),
});

const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const BodyMappingPanel: React.FC<BodyMappingPanelProps> = ({
  agent,
  worldRegistry,
  bodyDraftStatus,
  preview,
  validation = [],
  onBodyChange,
  onApply,
  onReset,
}) => {
  const body = agent.body;
  const [selectedEndpoint, setSelectedEndpoint] = useState<SelectedEndpoint>(() => getDefaultSelectedEndpoint(body));
  const [selection, setSelection] = useState<BodySelection>(null);
  const [contextMenu, setContextMenu] = useState<BodyContextMenuState>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!selectedEndpoint) {
      setSelectedEndpoint(getDefaultSelectedEndpoint(body));
      return;
    }

    if (
      selectedEndpoint.kind === 'input' &&
      !body.inputEndpoints.some((endpoint) => endpoint.id === selectedEndpoint.endpointId)
    ) {
      setSelectedEndpoint(getDefaultSelectedEndpoint(body));
      return;
    }

    if (
      selectedEndpoint.kind === 'output' &&
      !body.outputEndpoints.some((endpoint) => endpoint.id === selectedEndpoint.endpointId)
    ) {
      setSelectedEndpoint(getDefaultSelectedEndpoint(body));
    }
  }, [body, selectedEndpoint]);

  useEffect(() => {
    if (!editorOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditorOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [editorOpen]);

  const inputEndpointIdToIndex = useMemo(
    () => new Map(body.inputEndpoints.map((endpoint, index) => [endpoint.id, index])),
    [body.inputEndpoints]
  );
  const outputEndpointIdToIndex = useMemo(
    () => new Map(body.outputEndpoints.map((endpoint, index) => [endpoint.id, index])),
    [body.outputEndpoints]
  );
  const inputEndpointById = useMemo(
    () => new Map(body.inputEndpoints.map((endpoint) => [endpoint.id, endpoint])),
    [body.inputEndpoints]
  );
  const outputEndpointById = useMemo(
    () => new Map(body.outputEndpoints.map((endpoint) => [endpoint.id, endpoint])),
    [body.outputEndpoints]
  );

  const inputRows = useMemo<InputMatchRow[]>(
    () => body.mappings.flatMap((mapping, index) => {
      if (mapping.kind !== 'input') {
        return [];
      }
      const endpoint = inputEndpointById.get(mapping.endpointId);
      if (!endpoint) {
        return [];
      }
      return [{
        key: `input-${mapping.id}-${index}`,
        mappingId: mapping.id,
        endpointId: endpoint.id,
        endpointOrder: inputEndpointIdToIndex.get(endpoint.id) ?? -1,
        nodeId: mapping.nodeId,
        resolvedSource: endpoint.source,
        scale: endpoint.scale,
      }];
    }),
    [body.mappings, inputEndpointById, inputEndpointIdToIndex]
  );

  const outputRows = useMemo<OutputMatchRow[]>(
    () => body.mappings.flatMap((mapping, index) => {
      if (mapping.kind !== 'output') {
        return [];
      }
      const endpoint = outputEndpointById.get(mapping.endpointId);
      if (!endpoint) {
        return [];
      }
      return [{
        key: `output-${mapping.id}-${index}`,
        mappingId: mapping.id,
        endpointId: endpoint.id,
        endpointOrder: outputEndpointIdToIndex.get(endpoint.id) ?? -1,
        nodeId: mapping.nodeId,
        resolvedTarget: endpoint.target,
        decayPerSecond: endpoint.decayPerSecond,
      }];
    }),
    [body.mappings, outputEndpointById, outputEndpointIdToIndex]
  );

  const selectedInputEndpoint = selectedEndpoint?.kind === 'input'
    ? body.inputEndpoints.find((endpoint) => endpoint.id === selectedEndpoint.endpointId) ?? null
    : null;
  const selectedOutputEndpoint = selectedEndpoint?.kind === 'output'
    ? body.outputEndpoints.find((endpoint) => endpoint.id === selectedEndpoint.endpointId) ?? null
    : null;
  const selectedInputEndpointIndex = selectedInputEndpoint ? inputEndpointIdToIndex.get(selectedInputEndpoint.id) ?? -1 : -1;
  const selectedOutputEndpointIndex = selectedOutputEndpoint ? outputEndpointIdToIndex.get(selectedOutputEndpoint.id) ?? -1 : -1;

  const selectedValidation = useMemo(() => {
    if (!selectedEndpoint) {
      return validation;
    }

    return validation.filter(
      (item) =>
        item.scope === 'body' ||
        (selectedEndpoint.kind === 'input' &&
          item.scope === 'input-endpoint' &&
          item.endpointId === selectedEndpoint.endpointId) ||
        (selectedEndpoint.kind === 'output' &&
          item.scope === 'output-endpoint' &&
          item.endpointId === selectedEndpoint.endpointId)
    );
  }, [selectedEndpoint, validation]);

  const canvasModel = useMemo(() => {
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

    const nodes: BodyCanvasNode[] = [];

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
      });
    });

    const sceneNodes: BodyCanvasSceneNode[] = nodes.map((node) => ({
      ...node,
      sceneX: node.x - NODE_SIZE / 2,
      sceneY: node.y - NODE_SIZE / 2,
      width: NODE_SIZE,
      height: NODE_SIZE,
    }));
    const nodeById = new Map(sceneNodes.map((node) => [node.id, node]));

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
      nodes: sceneNodes,
      nodeById,
      links,
      surfaceHeight,
      outputSectionTop,
    };
  }, [agent.connections, inputRows, outputRows, worldRegistry]);

  const handleNodeSelect = (node: BodyCanvasNode) => {
    const nextEndpointId = node.relatedEndpointIds[0];
    if (!nextEndpointId) {
      return;
    }
    setSelectedEndpoint({ kind: node.direction, endpointId: nextEndpointId });
    setSelection({ kind: 'node', direction: node.direction, endpointId: nextEndpointId, nodeId: node.id });
    setContextMenu(null);
  };

  const handleNodeContextMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    node: BodyCanvasSceneNode
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const nextEndpointId = node.relatedEndpointIds[0];
    if (!nextEndpointId) {
      return;
    }

    const nextSelection: Exclude<BodySelection, null> = {
      kind: 'node',
      direction: node.direction,
      endpointId: nextEndpointId,
      nodeId: node.id,
    };

    setSelectedEndpoint({ kind: node.direction, endpointId: nextEndpointId });
    setSelection(nextSelection);
    setContextMenu({
      selection: nextSelection,
      position: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  const handleLinkSelect = (link: BodyCanvasLink) => {
    setSelectedEndpoint({ kind: link.direction, endpointId: link.endpointId });
    setSelection({
      kind: 'link',
      direction: link.direction,
      endpointId: link.endpointId,
      mappingId: link.mappingId,
      nodeId: link.nodeId,
      linkId: link.id,
    });
    setContextMenu(null);
  };

  const handleLinkContextMenu = (
    event: React.MouseEvent<SVGGElement>,
    link: BodyCanvasLink
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const nextSelection: Exclude<BodySelection, null> = {
      kind: 'link',
      direction: link.direction,
      endpointId: link.endpointId,
      mappingId: link.mappingId,
      nodeId: link.nodeId,
      linkId: link.id,
    };

    setSelectedEndpoint({ kind: link.direction, endpointId: link.endpointId });
    setSelection(nextSelection);
    setContextMenu({
      selection: nextSelection,
      position: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  const handleOpenSelectionEditor = () => {
    if (!contextMenu?.selection) {
      return;
    }

    setSelection(contextMenu.selection);
    setEditorOpen(true);
    setContextMenu(null);
  };

  const handleApplyAndClose = () => {
    onApply();
    setEditorOpen(false);
    setContextMenu(null);
  };

  const selectedDirection = selectedEndpoint?.kind ?? null;
  const selectedEndpointId = selectedEndpoint?.endpointId ?? null;
  const selectedLinkDetail = selection?.kind === 'link'
    ? canvasModel.links.find((link) => link.id === selection.linkId) ?? null
    : null;
  const selectedNodeDetail = selection?.kind === 'node'
    ? canvasModel.nodes.find((node) => node.id === selection.nodeId) ?? null
    : null;

  const selectedInputMappings =
    selectedInputEndpoint == null
      ? []
      : body.mappings.filter(
          (mapping): mapping is BodyInputMappingIR =>
            mapping.kind === 'input' && mapping.endpointId === selectedInputEndpoint.id
        );
  const selectedOutputMappings =
    selectedOutputEndpoint == null
      ? []
      : body.mappings.filter(
          (mapping): mapping is BodyOutputMappingIR =>
            mapping.kind === 'output' && mapping.endpointId === selectedOutputEndpoint.id
        );

  return (
    <div className="body-mapping-panel" data-testid="body-mapping-panel">
      <div className="body-mapping-summary">
        <span>{preview?.canonicalSummary ?? '暂无 BodyIR 端点预览。'}</span>
        <span>{preview?.compiledSummary ?? ''}</span>
        <span>{bodyDraftStatus.hasChanges ? '存在未应用变更' : '已与当前 Agent 同步'}</span>
      </div>

      <section className="body-mapping-graph-card">
        <TopologyCanvasSurface
          width={SURFACE_WIDTH}
          height={Math.max(480, canvasModel.surfaceHeight)}
          sceneWidth={SURFACE_WIDTH}
          sceneHeight={canvasModel.surfaceHeight}
          canvasViewport={{ x: 0, y: 0 }}
          canvasScale={1}
          dataTestId="body-mapping-canvas"
          onCanvasMouseDown={() => setContextMenu(null)}
          onCanvasContextMenu={(event) => {
            event.preventDefault();
            setContextMenu(null);
          }}
          beforeScene={
            <>
              <div className="body-mapping-floating-actions">
                <button
                  type="button"
                  className="settings-action-button secondary"
                  onClick={() => setEditorOpen(true)}
                >
                  端点
                </button>
                <button
                  type="button"
                  className="settings-action-button"
                  onClick={onApply}
                >
                  应用
                </button>
                <button
                  type="button"
                  className="settings-action-button secondary"
                  onClick={onReset}
                >
                  重置
                </button>
              </div>
              {contextMenu ? (
                <div
                  className="topology-context-menu"
                  data-testid="body-mapping-context-menu"
                  style={{
                    left: contextMenu.position.x,
                    top: contextMenu.position.y,
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="topology-context-menu-item"
                    data-testid="body-mapping-context-edit-endpoint"
                    onClick={handleOpenSelectionEditor}
                  >
                    编辑所选节点的端点
                  </button>
                </div>
              ) : null}
            </>
          }
        >
          <svg
            className="body-topology-links"
            viewBox={`0 0 ${SURFACE_WIDTH} ${canvasModel.surfaceHeight}`}
            preserveAspectRatio="xMinYMin meet"
          >
            <text className="body-topology-section-label" x={WORLD_INPUT_X - 28} y={SECTION_TOP - 20}>
              World Inputs
            </text>
            <text className="body-topology-section-label" x={BODY_INPUT_X - 28} y={SECTION_TOP - 20}>
              Body Inputs
            </text>
            <text className="body-topology-section-label" x={BODY_OUTPUT_X - 28} y={canvasModel.outputSectionTop - 20}>
              Body Outputs
            </text>
            <text className="body-topology-section-label" x={WORLD_OUTPUT_X - 28} y={canvasModel.outputSectionTop - 20}>
              World Outputs
            </text>
          </svg>

          <TopologyLinkLayer
            sceneNodeMap={canvasModel.nodeById}
            links={canvasModel.links.map((link) => ({
              id: link.id,
              fromNodeId: link.fromNodeId,
              toNodeId: link.toNodeId,
              label: link.label,
              selected: selectedDirection === link.direction && selectedEndpointId === link.endpointId,
              onClick: () => handleLinkSelect(link),
              onDoubleClick: undefined,
              onContextMenu: (event: React.MouseEvent<SVGGElement>) => handleLinkContextMenu(event, link),
            }))}
          />

          <TopologyNodeLayer
            nodes={canvasModel.nodes.map((node) => {
              const selected =
                selectedDirection === node.direction &&
                selectedEndpointId != null &&
                node.relatedEndpointIds.includes(selectedEndpointId);

              return {
                id: node.id,
                x: node.sceneX,
                y: node.sceneY,
                width: node.width,
                height: node.height,
                className: `body-topology-node topology-node is-leaf ${selected ? 'is-selected' : ''}`,
                title: node.detail,
                dataTestId: `body-topology-node-${node.id}`,
                asButton: true,
                onClick: () => handleNodeSelect(node),
                onContextMenu: (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) =>
                  handleNodeContextMenu(event as React.MouseEvent<HTMLButtonElement>, node),
                content: <>
                  <span className="topology-node-shape topology-node-dot" />
                  <span className={`body-topology-node-label is-${node.labelSide}`}>{node.label}</span>
                </>,
              };
            })}
          />
        </TopologyCanvasSurface>
      </section>

      {validation.length > 0 ? (
        <div className="body-mapping-validation body-mapping-validation-inline">
          {validation.slice(0, 3).map((item, index) => (
            <div key={`${item.level}-${index}`} className={`body-ir-message ${item.level}`}>
              <span className="body-ir-message-badge">{item.level}</span>
              <span>{item.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {editorOpen ? (
        <div
          className="modal-overlay"
          data-testid="body-mapping-editor-modal-overlay"
          onClick={() => setEditorOpen(false)}
        >
          <div
            className="modal-content"
            data-testid="body-mapping-editor-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="topology-detail-header">
              <button
                type="button"
                className="topology-detail-close"
                onClick={() => setEditorOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="topology-detail-editor">
              <div className="body-mapping-modal-summary">
                <h3>BodyIR 端点映射</h3>
                <p>优先从画布选中某条映射连线或端点节点，再在此直接编辑对应端点。</p>
              </div>

              {selectedLinkDetail ? (
                <div className="body-mapping-selection-summary">
                  <span>当前选中映射</span>
                  <strong>{selectedLinkDetail.detail}</strong>
                </div>
              ) : selectedNodeDetail ? (
                <div className="body-mapping-selection-summary">
                  <span>当前选中节点</span>
                  <strong>{selectedNodeDetail.label}</strong>
                </div>
              ) : null}

              <div className="body-mapping-modal-actions">
                <button
                  type="button"
                  className="settings-action-button secondary"
                  onClick={() =>
                    onBodyChange((current) => {
                      const endpoint = createDefaultInputEndpoint(current);
                      return {
                        ...current,
                        inputEndpoints: [...current.inputEndpoints, endpoint],
                        mappings: [...current.mappings, createInputMapping(endpoint.id)],
                      };
                    })
                  }
                >
                  新增输入端点
                </button>
                <button
                  type="button"
                  className="settings-action-button secondary"
                  onClick={() =>
                    onBodyChange((current) => {
                      const endpoint = createDefaultOutputEndpoint(current);
                      return {
                        ...current,
                        outputEndpoints: [...current.outputEndpoints, endpoint],
                        mappings: [...current.mappings, createOutputMapping(endpoint.id)],
                      };
                    })
                  }
                >
                  新增输出端点
                </button>
                <button
                  type="button"
                  className="settings-action-button secondary"
                  onClick={onReset}
                >
                  重置
                </button>
                <button
                  type="button"
                  className="settings-action-button"
                  onClick={handleApplyAndClose}
                >
                  应用
                </button>
              </div>

              <div className="body-mapping-endpoint-browser body-mapping-endpoint-browser-secondary">
                <section className="body-mapping-endpoint-list-card">
                  <div className="body-mapping-card-header">
                    <h4>输入端点</h4>
                    <span>{body.inputEndpoints.length} 项</span>
                  </div>
                  <div className="body-mapping-endpoint-list">
                    {body.inputEndpoints.map((endpoint, index) => {
                      const active = selectedEndpoint?.kind === 'input' && selectedEndpoint.endpointId === endpoint.id;
                      return (
                        <button
                          key={endpoint.id}
                          type="button"
                          className={`body-mapping-endpoint-item ${active ? 'is-active' : ''}`}
                          onClick={() => setSelectedEndpoint({ kind: 'input', endpointId: endpoint.id })}
                        >
                          <span className="body-mapping-endpoint-item-title">E{index + 1}</span>
                          <span className="body-mapping-endpoint-item-copy">{endpoint.source}</span>
                          <span className="body-mapping-endpoint-item-copy">
                            {body.mappings.filter(
                              (mapping) => mapping.kind === 'input' && mapping.endpointId === endpoint.id
                            ).length} 个节点
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="body-mapping-endpoint-list-card">
                  <div className="body-mapping-card-header">
                    <h4>输出端点</h4>
                    <span>{body.outputEndpoints.length} 项</span>
                  </div>
                  <div className="body-mapping-endpoint-list">
                    {body.outputEndpoints.map((endpoint, index) => {
                      const active = selectedEndpoint?.kind === 'output' && selectedEndpoint.endpointId === endpoint.id;
                      return (
                        <button
                          key={endpoint.id}
                          type="button"
                          className={`body-mapping-endpoint-item ${active ? 'is-active' : ''}`}
                          onClick={() => setSelectedEndpoint({ kind: 'output', endpointId: endpoint.id })}
                        >
                          <span className="body-mapping-endpoint-item-title">E{index + 1}</span>
                          <span className="body-mapping-endpoint-item-copy">{endpoint.target}</span>
                          <span className="body-mapping-endpoint-item-copy">
                            {body.mappings.filter(
                              (mapping) => mapping.kind === 'output' && mapping.endpointId === endpoint.id
                            ).length} 个节点
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="body-mapping-editor-card">
                <div className="body-mapping-card-header">
                  <h4>端点编辑</h4>
                  <span>
                    {selectedEndpoint
                      ? selectedEndpoint.kind === 'input'
                        ? selectedInputEndpointIndex >= 0
                          ? `输入端点 ${selectedInputEndpointIndex + 1}`
                          : '输入端点'
                        : selectedOutputEndpointIndex >= 0
                          ? `输出端点 ${selectedOutputEndpointIndex + 1}`
                          : '输出端点'
                      : '未选择端点'}
                  </span>
                </div>

                {selectedInputEndpoint ? (
                  <div className="body-mapping-form-grid">
                    <label className="body-mapping-field">
                      <span>World Source</span>
                      <input
                        value={selectedInputEndpoint.source}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateInputEndpointById(current, selectedInputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              source: event.target.value,
                            }))
                          )
                        }
                      />
                    </label>
                    <label className="body-mapping-field">
                      <span>World Port (可选)</span>
                      <input
                        value={selectedInputEndpoint.worldPort ?? ''}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateInputEndpointById(current, selectedInputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              worldPort: event.target.value,
                            }))
                          )
                        }
                      />
                    </label>
                    <label className="body-mapping-field">
                      <span>缩放系数</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedInputEndpoint.scale}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateInputEndpointById(current, selectedInputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              scale: parseNumber(event.target.value, endpoint.scale),
                            }))
                          )
                        }
                      />
                    </label>
                    {selectedInputMappings.map((mapping, index) => (
                      <label key={mapping.id} className="body-mapping-field">
                        <span>{`映射节点 ${index + 1}`}</span>
                        <input
                          value={mapping.nodeId}
                          onChange={(event) =>
                            onBodyChange((current) => ({
                              ...current,
                              mappings: current.mappings.map((entry) =>
                                entry.id === mapping.id ? { ...entry, nodeId: event.target.value } : entry
                              ),
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="settings-action-button secondary"
                          onClick={() =>
                            onBodyChange((current) => ({
                              ...current,
                              mappings: current.mappings.filter((entry) => entry.id !== mapping.id),
                            }))
                          }
                        >
                          删除映射
                        </button>
                      </label>
                    ))}
                    <button
                      type="button"
                      className="settings-action-button secondary"
                      onClick={() =>
                        onBodyChange((current) => ({
                          ...current,
                          mappings: [...current.mappings, createInputMapping(selectedInputEndpoint.id)],
                        }))
                      }
                    >
                      新增映射节点
                    </button>
                    <button
                      type="button"
                      className="settings-action-button secondary"
                      onClick={() =>
                        onBodyChange((current) => {
                          return {
                            ...current,
                            inputEndpoints: current.inputEndpoints.filter((endpoint) => endpoint.id !== selectedInputEndpoint.id),
                            mappings: current.mappings.filter(
                              (mapping) => !(mapping.kind === 'input' && mapping.endpointId === selectedInputEndpoint.id)
                            ),
                          };
                        })
                      }
                    >
                      删除输入端点
                    </button>
                  </div>
                ) : selectedOutputEndpoint ? (
                  <div className="body-mapping-form-grid">
                    <label className="body-mapping-field">
                      <span>World Target</span>
                      <input
                        value={selectedOutputEndpoint.target}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateOutputEndpointById(current, selectedOutputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              target: event.target.value,
                            }))
                          )
                        }
                      />
                    </label>
                    <label className="body-mapping-field">
                      <span>World Port (可选)</span>
                      <input
                        value={selectedOutputEndpoint.worldPort ?? ''}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateOutputEndpointById(current, selectedOutputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              worldPort: event.target.value,
                            }))
                          )
                        }
                      />
                    </label>
                    <label className="body-mapping-field">
                      <span>衰减 / 秒</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedOutputEndpoint.decayPerSecond}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateOutputEndpointById(current, selectedOutputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              decayPerSecond: parseNumber(event.target.value, endpoint.decayPerSecond),
                            }))
                          )
                        }
                      />
                    </label>
                    {selectedOutputMappings.map((mapping, index) => (
                      <label key={mapping.id} className="body-mapping-field">
                        <span>{`映射节点 ${index + 1}`}</span>
                        <input
                          value={mapping.nodeId}
                          onChange={(event) =>
                            onBodyChange((current) => ({
                              ...current,
                              mappings: current.mappings.map((entry) =>
                                entry.id === mapping.id ? { ...entry, nodeId: event.target.value } : entry
                              ),
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="settings-action-button secondary"
                          onClick={() =>
                            onBodyChange((current) => ({
                              ...current,
                              mappings: current.mappings.filter((entry) => entry.id !== mapping.id),
                            }))
                          }
                        >
                          删除映射
                        </button>
                      </label>
                    ))}
                    <button
                      type="button"
                      className="settings-action-button secondary"
                      onClick={() =>
                        onBodyChange((current) => ({
                          ...current,
                          mappings: [...current.mappings, createOutputMapping(selectedOutputEndpoint.id)],
                        }))
                      }
                    >
                      新增映射节点
                    </button>
                    <button
                      type="button"
                      className="settings-action-button secondary"
                      onClick={() =>
                        onBodyChange((current) => {
                          return {
                            ...current,
                            outputEndpoints: current.outputEndpoints.filter((endpoint) => endpoint.id !== selectedOutputEndpoint.id),
                            mappings: current.mappings.filter(
                              (mapping) => !(mapping.kind === 'output' && mapping.endpointId === selectedOutputEndpoint.id)
                            ),
                          };
                        })
                      }
                    >
                      删除输出端点
                    </button>
                  </div>
                ) : (
                  <div className="body-mapping-empty">先在端点列表中选择一项。</div>
                )}

                {selectedValidation.length > 0 ? (
                  <div className="body-mapping-validation">
                    {selectedValidation.map((item, index) => (
                      <div key={`${item.level}-${index}`} className={`body-ir-message ${item.level}`}>
                        <span className="body-ir-message-badge">{item.level}</span>
                        <span>{item.message}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BodyMappingPanel;
