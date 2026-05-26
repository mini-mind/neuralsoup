import React, { useMemo, useRef, useState } from 'react';
import type { GraphCanvasSessionState, GraphCanvasViewport } from '../../../hooks/useSNNTopologyState';
import TopologyCanvasSurface from '../TopologyCanvasSurface';
import TopologyLinkLayer from '../TopologyLinkLayer';
import TopologyNodeLayer from '../TopologyNodeLayer';
import { useGraphViewSessionController } from '../interaction/useGraphViewSessionController';
import type { SharedCanvasCapabilities } from '../sharedCanvasCore';
import type { BodyCanvasModel, BodyCanvasSceneNode } from './bodySceneAdapter';

type BodyCanvasSelection =
  | { kind: 'node'; direction: 'input' | 'output'; endpointId: string; nodeId: string }
  | { kind: 'link'; direction: 'input' | 'output'; endpointId: string; mappingId: string; nodeId: string; linkId: string }
  | null;

interface BodyTopologyCanvasProps {
  model: BodyCanvasModel;
  selectedDirection: 'input' | 'output' | null;
  selectedEndpointId: string | null;
  highlightedNodeIds?: string[];
  highlightedMappingIds?: string[];
  capabilities?: Pick<SharedCanvasCapabilities, 'canCreateNodeAtCanvasContext' | 'canAggregateSelection'>;
  onCanvasSessionChange?: (nextSession: GraphCanvasSessionState) => void;
  onSelectionChange: (selection: BodyCanvasSelection) => void;
  onContextEditSelection: (selection: Exclude<BodyCanvasSelection, null>) => void;
  onDeleteLinkSelection?: (selection: Extract<BodyCanvasSelection, { kind: 'link' }>) => void;
  onBindNodeSelectionToEndpoint?: (selection: Extract<BodyCanvasSelection, { kind: 'node' }>) => void;
  beforeScene?: React.ReactNode;
}

const SECTION_TOP = 64;
const WORLD_INPUT_X = 120;
const BODY_INPUT_X = 420;
const BODY_OUTPUT_X = 860;
const WORLD_OUTPUT_X = 1160;

const sharedCapabilities = {
  canCreateNodeAtCanvasContext: false,
  canAggregateSelection: true,
} satisfies Pick<SharedCanvasCapabilities, 'canCreateNodeAtCanvasContext' | 'canAggregateSelection'>;

const BodyTopologyCanvas: React.FC<BodyTopologyCanvasProps> = ({
  model,
  selectedDirection,
  selectedEndpointId,
  highlightedNodeIds = [],
  highlightedMappingIds = [],
  capabilities = sharedCapabilities,
  onCanvasSessionChange,
  onSelectionChange,
  onContextEditSelection,
  onDeleteLinkSelection,
  onBindNodeSelectionToEndpoint,
  beforeScene,
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const selectedNodeIds = useMemo(() => {
    if (!selectedDirection || !selectedEndpointId) {
      return [];
    }
    return model.nodes
      .filter((node) => node.direction === selectedDirection && node.relatedEndpointIds.includes(selectedEndpointId))
      .map((node) => node.id);
  }, [model.nodes, selectedDirection, selectedEndpointId]);
  const highlightedNodeIdSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);
  const highlightedMappingIdSet = useMemo(() => new Set(highlightedMappingIds), [highlightedMappingIds]);
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const [linkContextSelection, setLinkContextSelection] = useState<Exclude<BodyCanvasSelection, null> | null>(null);
  const [linkContextPosition, setLinkContextPosition] = useState<{ x: number; y: number } | null>(null);

  const viewport: GraphCanvasViewport = { x: 0, y: 0 };
  const session = useGraphViewSessionController({
    isActive: true,
    scopeKey: 'body',
    surfaceRef,
    sceneRef,
    hasOpenDetailModal: false,
    sceneOrigin: { x: 0, y: 0 },
    viewport,
    scale: 1,
    selectedNodeIds,
    capabilities,
    isEditableOrInteractiveTarget: () => false,
    nodes: model.nodes.map((node) => ({
      id: node.id,
      x: node.sceneX,
      y: node.sceneY,
      width: node.width,
      height: node.height,
      proxy: false,
      movable: false,
      local: true,
      previewOnly: true,
      connectableSource: false,
      ungroupable: false,
      contextMenuGroup: false,
      expanded: false,
      expansionParentId: null,
      titleDragHandleOnly: false,
    })),
    callbacks: {
      onViewportChange: () => undefined,
      onSessionChange: (nextSession) => {
        onCanvasSessionChange?.(nextSession);
      },
      onSelectionBoxStart: () => undefined,
      onSelectionBoxUpdate: (_point, intersectedNodeIds) => {
        const candidateNode = model.nodes.find((node) => intersectedNodeIds.includes(node.id));
        if (!candidateNode) {
          onSelectionChange(null);
          return;
        }
        onSelectionChange({
          kind: 'node',
          direction: candidateNode.direction,
          endpointId: candidateNode.relatedEndpointIds[0] ?? '',
          nodeId: candidateNode.id,
        });
      },
      onSelectionBoxCancel: () => undefined,
      onSelectionClear: () => {
        setLinkContextSelection(null);
        setLinkContextPosition(null);
        onSelectionChange(null);
      },
      onConnectNodes: () => undefined,
      onCreateNodeAndConnectAt: () => undefined,
      onDraftNodePositionsUpdate: () => undefined,
      onDraftNodePositionsDiscard: () => undefined,
      onNodePositionsPersist: () => undefined,
      onNodeSelect: (nodeId, options) => {
        const node = model.nodeById.get(nodeId);
        if (!node) {
          return;
        }
        if (!options?.additive) {
          onSelectionChange({
            kind: 'node',
            direction: node.direction,
            endpointId: node.relatedEndpointIds[0] ?? '',
            nodeId: node.id,
          });
        }
      },
      onNodesSelect: (nodeIds) => {
        const node = model.nodes.find((candidate) => nodeIds.includes(candidate.id));
        if (!node) {
          onSelectionChange(null);
          return;
        }
        onSelectionChange({
          kind: 'node',
          direction: node.direction,
          endpointId: node.relatedEndpointIds[0] ?? '',
          nodeId: node.id,
        });
      },
      onDetailClose: () => undefined,
      onSelectionRemove: () => undefined,
    },
  });

  return (
    <TopologyCanvasSurface
      surfaceRef={surfaceRef}
      sceneRef={sceneRef}
      width={model.surfaceWidth}
      height={Math.max(480, model.surfaceHeight)}
      sceneWidth={model.surfaceWidth}
      sceneHeight={model.surfaceHeight}
      canvasViewport={viewport}
      canvasScale={1}
      isPanning={session.interaction?.type === 'panning'}
      isSelecting={session.interaction?.type === 'selecting'}
      isLinking={session.interaction?.type === 'linking'}
      selectionRect={
        session.interaction?.type === 'selecting'
          ? {
              x: session.interaction.startScene.x,
              y: session.interaction.startScene.y,
              width: session.interaction.currentScene.x - session.interaction.startScene.x,
              height: session.interaction.currentScene.y - session.interaction.startScene.y,
            }
          : null
      }
      dataTestId="body-mapping-canvas"
      onCanvasMouseDown={(event) => {
        setLinkContextSelection(null);
        setLinkContextPosition(null);
        session.handleCanvasMouseDown(event);
      }}
      onCanvasContextMenu={session.handleCanvasContextMenu}
      beforeScene={
        <>
          {beforeScene}
          {(session.contextMenu && session.contextMenuPosition) || (linkContextSelection && linkContextPosition) ? (
            <div
              className="topology-context-menu"
              data-testid="body-mapping-context-menu"
              style={{
                left: session.contextMenuPosition?.x ?? linkContextPosition?.x ?? 0,
                top: session.contextMenuPosition?.y ?? linkContextPosition?.y ?? 0,
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="topology-context-menu-item"
                data-testid="body-mapping-context-edit-endpoint"
                onClick={() => {
                  if (linkContextSelection) {
                    onContextEditSelection(linkContextSelection);
                    setLinkContextSelection(null);
                    setLinkContextPosition(null);
                    session.closeContextMenu();
                    return;
                  }

                  const sourceNodeId = session.contextMenu?.nodeIds[0];
                  if (!sourceNodeId) {
                    session.closeContextMenu();
                    return;
                  }
                  const node = model.nodeById.get(sourceNodeId);
                  if (!node) {
                    session.closeContextMenu();
                    return;
                  }
                  onContextEditSelection({
                    kind: 'node',
                    direction: node.direction,
                    endpointId: node.relatedEndpointIds[0] ?? '',
                    nodeId: node.id,
                  });
                  session.closeContextMenu();
                  setLinkContextSelection(null);
                  setLinkContextPosition(null);
                }}
              >
                编辑所选节点的端点
              </button>
              {linkContextSelection?.kind === 'link' && onDeleteLinkSelection ? (
                <button
                  type="button"
                  className="topology-context-menu-item"
                  data-testid="body-mapping-context-delete-link"
                  onClick={() => {
                    onDeleteLinkSelection(linkContextSelection);
                    setLinkContextSelection(null);
                    setLinkContextPosition(null);
                    session.closeContextMenu();
                  }}
                >
                  删除映射连线
                </button>
              ) : null}
              {linkContextSelection?.kind === 'node' && onBindNodeSelectionToEndpoint ? (
                <button
                  type="button"
                  className="topology-context-menu-item"
                  data-testid="body-mapping-context-bind-node"
                  onClick={() => {
                    onBindNodeSelectionToEndpoint(linkContextSelection);
                    setLinkContextSelection(null);
                    setLinkContextPosition(null);
                    session.closeContextMenu();
                  }}
                >
                  绑定到当前端点
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      }
    >
      <svg className="body-topology-links" viewBox={`0 0 ${model.surfaceWidth} ${model.surfaceHeight}`} preserveAspectRatio="xMinYMin meet">
        <text className="body-topology-section-label" x={WORLD_INPUT_X - 28} y={SECTION_TOP - 20}>
          World Inputs
        </text>
        <text className="body-topology-section-label" x={BODY_INPUT_X - 28} y={SECTION_TOP - 20}>
          Body Inputs
        </text>
        <text className="body-topology-section-label" x={BODY_OUTPUT_X - 28} y={model.outputSectionTop - 20}>
          Body Outputs
        </text>
        <text className="body-topology-section-label" x={WORLD_OUTPUT_X - 28} y={model.outputSectionTop - 20}>
          World Outputs
        </text>
      </svg>

      <TopologyLinkLayer
        sceneNodeMap={model.nodeById}
        links={model.links.map((link) => ({
          id: link.id,
          fromNodeId: link.fromNodeId,
          toNodeId: link.toNodeId,
          label: link.label,
          selected:
            (selectedDirection === link.direction && selectedEndpointId === link.endpointId) ||
            highlightedMappingIdSet.has(link.mappingId),
          onClick: () =>
            {
              setLinkContextSelection(null);
              setLinkContextPosition(null);
              onSelectionChange({
                kind: 'link',
                direction: link.direction,
                endpointId: link.endpointId,
                mappingId: link.mappingId,
                nodeId: link.nodeId,
                linkId: link.id,
              });
            },
          onDoubleClick: undefined,
          onContextMenu: (event: React.MouseEvent<SVGGElement>) => {
            event.preventDefault();
            event.stopPropagation();
            const nextSelection: Exclude<BodyCanvasSelection, null> = {
              kind: 'link',
              direction: link.direction,
              endpointId: link.endpointId,
              mappingId: link.mappingId,
              nodeId: link.nodeId,
              linkId: link.id,
            };
            onSelectionChange(nextSelection);
            setLinkContextSelection(nextSelection);
            setLinkContextPosition({
              x: event.clientX,
              y: event.clientY,
            });
            session.closeContextMenu();
          },
        }))}
      />

      <TopologyNodeLayer
        nodes={model.nodes.map((node: BodyCanvasSceneNode) => ({
          id: node.id,
          x: node.sceneX,
          y: node.sceneY,
          width: node.width,
          height: node.height,
          className: `body-topology-node topology-node is-leaf ${
            selectedNodeIdSet.has(node.id) || highlightedNodeIdSet.has(node.id) ? 'is-selected' : ''
          }`,
          title: node.detail,
          dataTestId: `body-topology-node-${node.id}`,
          asButton: true,
          onMouseDown: (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) =>
            session.handleNodeMouseDown(event as React.MouseEvent<HTMLDivElement>, node.id),
          onContextMenu: (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
            session.handleNodeContextMenu(event as React.MouseEvent<HTMLDivElement>);
            setLinkContextSelection({
              kind: 'node',
              direction: node.direction,
              endpointId: node.relatedEndpointIds[0] ?? '',
              nodeId: node.id,
            });
            setLinkContextPosition({
              x: event.clientX,
              y: event.clientY,
            });
          },
          content: (
            <>
              <span className="topology-node-shape topology-node-dot" />
              <span className={`body-topology-node-label is-${node.labelSide}`}>{node.label}</span>
            </>
          ),
        }))}
      />
    </TopologyCanvasSurface>
  );
};

export default BodyTopologyCanvas;
