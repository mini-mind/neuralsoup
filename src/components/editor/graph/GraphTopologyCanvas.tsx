import React, { useCallback } from 'react';
import type { GraphViewLink } from './graphViewTypes';
import type { GraphInteractionState, GraphContextMenuState } from './interaction/interactionSession';
import type { GraphSceneProjection } from './graphSceneProjection';
import { getNodeCenter, normalizeRect } from './tools/canvasGeometry';

interface GraphTopologyCanvasProps {
  surfaceRef: React.RefObject<HTMLDivElement>;
  sceneRef: React.RefObject<HTMLDivElement>;
  width: number;
  height: number;
  scene: GraphSceneProjection;
  canvasViewport: {
    x: number;
    y: number;
  };
  canvasScale: number;
  interaction: GraphInteractionState | null;
  contextMenu: GraphContextMenuState | null;
  contextMenuPosition: {
    x: number;
    y: number;
  } | null;
  pendingLinkLine:
    | {
        from: { x: number; y: number };
        to: { x: number; y: number };
      }
    | null;
  selectionRect:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | null;
  links: GraphViewLink[];
  selectedNodeIds: string[];
  selectedLinkId: string | null;
  activeViewNodeIds: Set<string>;
  canCreateNeuronHere: boolean;
  canAggregateSelection: boolean;
  canUngroupNodesHere: boolean;
  onCanvasContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onNodeMouseDown: (event: React.MouseEvent<HTMLDivElement>, nodeId: string) => void;
  onNodeContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  onSelectLink: (linkId: string) => void;
  onOpenLinkDetail: (linkId: string) => void;
  onNavigateToNode: (nodeRefId: string) => void;
  onOpenNodeDetail: (nodeRefId: string) => void;
  getNodeDoubleClickAction: (nodeId: string) => 'navigate' | 'edit' | null;
  onCloseContextMenu: () => void;
  onAddNeuronAt: (x: number, y: number) => void;
  onAddNeuronGroupAt: (x: number, y: number) => void;
  onAggregateSelectedNodes: () => void;
  onUngroupNode: (nodeId: string) => void;
  onToggleGroupExpanded: (nodeId: string) => void;
}

const formatWeight = (weight: number) => (Number.isInteger(weight) ? `${weight}` : weight.toFixed(2));

const GraphTopologyCanvas: React.FC<GraphTopologyCanvasProps> = ({
  surfaceRef,
  sceneRef,
  width,
  height,
  scene,
  canvasViewport,
  canvasScale,
  interaction,
  contextMenu,
  contextMenuPosition,
  pendingLinkLine,
  selectionRect,
  links,
  selectedNodeIds,
  selectedLinkId,
  activeViewNodeIds,
  canCreateNeuronHere,
  canAggregateSelection,
  canUngroupNodesHere,
  onCanvasContextMenu,
  onCanvasMouseDown,
  onNodeMouseDown,
  onNodeContextMenu,
  onSelectLink,
  onOpenLinkDetail,
  onNavigateToNode,
  onOpenNodeDetail,
  getNodeDoubleClickAction,
  onCloseContextMenu,
  onAddNeuronAt,
  onAddNeuronGroupAt,
  onAggregateSelectedNodes,
  onUngroupNode,
  onToggleGroupExpanded,
}) => {
  const findEditableLinkNearClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const directLinkId = document
        .elementFromPoint(clientX, clientY)
        ?.closest<SVGGElement | HTMLElement>('[data-topology-link-id]')
        ?.getAttribute('data-topology-link-id');
      if (directLinkId) {
        const directLink = links.find((link) => link.id === directLinkId && !link.aggregate && link.editable);
        if (directLink) {
          return directLink;
        }
      }

      const sceneElement = sceneRef.current;
      if (!sceneElement || canvasScale === 0) {
        return null;
      }

      const rect = sceneElement.getBoundingClientRect();
      const point = {
        x: (clientX - rect.left) / canvasScale,
        y: (clientY - rect.top) / canvasScale,
      };
      let nearestLink: GraphViewLink | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      const distanceToSegment = (
        segmentStart: { x: number; y: number },
        segmentEnd: { x: number; y: number }
      ) => {
        const dx = segmentEnd.x - segmentStart.x;
        const dy = segmentEnd.y - segmentStart.y;
        if (dx === 0 && dy === 0) {
          return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y);
        }

        const projection =
          ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / (dx * dx + dy * dy);
        const ratio = Math.max(0, Math.min(1, projection));
        const nearestPoint = {
          x: segmentStart.x + dx * ratio,
          y: segmentStart.y + dy * ratio,
        };
        return Math.hypot(point.x - nearestPoint.x, point.y - nearestPoint.y);
      };

      for (const link of links) {
        if (link.aggregate || !link.editable) {
          continue;
        }

        const fromNode = scene.map.get(link.fromNodeId);
        const toNode = scene.map.get(link.toNodeId);
        if (!fromNode || !toNode) {
          continue;
        }

        const from = getNodeCenter({
          x: fromNode.sceneX,
          y: fromNode.sceneY,
          width: fromNode.width,
          height: fromNode.height,
        });
        const to = getNodeCenter({
          x: toNode.sceneX,
          y: toNode.sceneY,
          width: toNode.width,
          height: toNode.height,
        });

        const distance = distanceToSegment(from, to);
        if (distance <= 12 && distance < nearestDistance) {
          nearestLink = link;
          nearestDistance = distance;
        }
      }

      return nearestLink;
    },
    [canvasScale, links, scene.map, sceneRef]
  );

  const normalizedSelectionRect = selectionRect ? normalizeRect(selectionRect) : null;
  const pendingNodeIds = interaction?.type === 'linking' ? interaction.sourceNodeIds : [];

  return (
    <div
      ref={surfaceRef}
      className={[
        'topology-surface',
        interaction?.type === 'panning' ? 'is-panning' : '',
        interaction?.type === 'selecting' ? 'is-marqueeing' : '',
        interaction?.type === 'linking' ? 'is-linking' : '',
      ].join(' ')}
      data-testid="topology-canvas"
      tabIndex={0}
      style={{
        width: Math.max(width, 1),
        height: Math.max(height, 1),
      }}
      onContextMenu={onCanvasContextMenu}
      onMouseDown={onCanvasMouseDown}
    >
      {interaction?.type === 'linking' && (
        <div className="topology-pending-link" data-testid="topology-pending-link">
          右键拖到目标叶子节点完成连接
        </div>
      )}

      {contextMenu && contextMenuPosition && (
        <div
          className="topology-context-menu"
          data-testid="topology-context-menu"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.kind === 'canvas' && canCreateNeuronHere && (
            <>
              <button
                type="button"
                className="topology-context-menu-item"
                data-testid="topology-context-new-neuron"
                onClick={() => {
                  onAddNeuronAt(contextMenu.scene.x + scene.origin.x, contextMenu.scene.y + scene.origin.y);
                  onCloseContextMenu();
                }}
              >
                新建神经元
              </button>
              <button
                type="button"
                className="topology-context-menu-item"
                data-testid="topology-context-new-group"
                onClick={() => {
                  onAddNeuronGroupAt(contextMenu.scene.x + scene.origin.x, contextMenu.scene.y + scene.origin.y);
                  onCloseContextMenu();
                }}
              >
                新建分组
              </button>
            </>
          )}
          {contextMenu.kind === 'selection' && canAggregateSelection && (
            <button
              type="button"
              className="topology-context-menu-item"
              data-testid="topology-context-aggregate"
              onClick={() => {
                onAggregateSelectedNodes();
                onCloseContextMenu();
              }}
            >
              聚合
            </button>
          )}
          {contextMenu.kind === 'group' && contextMenu.nodeIds.length === 1 && (
            <>
              <button
                type="button"
                className="topology-context-menu-item"
                data-testid="topology-context-toggle-group"
                onClick={() => {
                  onToggleGroupExpanded(contextMenu.nodeIds[0]);
                  onCloseContextMenu();
                }}
              >
                {scene.map.get(contextMenu.nodeIds[0])?.expanded ? '收起' : '展开'}
              </button>
              {canUngroupNodesHere && (
                <button
                  type="button"
                  className="topology-context-menu-item"
                  data-testid="topology-context-ungroup"
                  onClick={() => {
                    onUngroupNode(contextMenu.nodeIds[0]);
                    onCloseContextMenu();
                  }}
                >
                  拆开组
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div
        ref={sceneRef}
        className="topology-scene"
        data-testid="topology-scene"
        style={{
          width: scene.size.width,
          height: scene.size.height,
          transform: `translate(${canvasViewport.x}px, ${canvasViewport.y}px) scale(${canvasScale})`,
          transformOrigin: '0 0',
        }}
        onDoubleClick={(event) => {
          const nearbyLink = findEditableLinkNearClientPoint(event.clientX, event.clientY);
          if (!nearbyLink) {
            return;
          }

          event.stopPropagation();
          onOpenLinkDetail(nearbyLink.id);
        }}
      >
        <svg
          className="topology-links"
          aria-hidden="true"
          onDoubleClick={(event) => {
            const nearbyLink = findEditableLinkNearClientPoint(event.clientX, event.clientY);
            if (!nearbyLink) {
              return;
            }

            event.stopPropagation();
            onOpenLinkDetail(nearbyLink.id);
          }}
        >
          {links.map((link) => {
            const fromNode = scene.map.get(link.fromNodeId);
            const toNode = scene.map.get(link.toNodeId);
            if (!fromNode || !toNode) {
              return null;
            }

            const from = getNodeCenter({
              x: fromNode.sceneX,
              y: fromNode.sceneY,
              width: fromNode.width,
              height: fromNode.height,
            });
            const to = getNodeCenter({
              x: toNode.sceneX,
              y: toNode.sceneY,
              width: toNode.width,
              height: toNode.height,
            });
            const selected = selectedLinkId === link.id;

            return (
              <g
                key={link.id}
                className={`topology-link ${link.aggregate ? 'is-aggregate' : 'is-leaf'} ${selected ? 'is-selected' : ''}`}
                data-testid={`topology-link-${link.id}`}
                data-topology-link="true"
                data-topology-link-id={link.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectLink(link.id);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (!link.aggregate) {
                    onOpenLinkDetail(link.id);
                  }
                }}
              >
                <line
                  className="topology-link-hit"
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (!link.aggregate) {
                      onOpenLinkDetail(link.id);
                    }
                  }}
                />
                <line className="topology-link-stroke" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <line className="topology-link-flow" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 8}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (!link.aggregate) {
                      onOpenLinkDetail(link.id);
                    }
                  }}
                >
                  {link.aggregate ? `${link.count}` : formatWeight(link.weight)}
                </text>
              </g>
            );
          })}

          {pendingLinkLine && (
            <line
              className="topology-link-preview"
              x1={pendingLinkLine.from.x}
              y1={pendingLinkLine.from.y}
              x2={pendingLinkLine.to.x}
              y2={pendingLinkLine.to.y}
            />
          )}
        </svg>

        {normalizedSelectionRect && (
          <div
            className="topology-marquee"
            style={{
              left: normalizedSelectionRect.x,
              top: normalizedSelectionRect.y,
              width: normalizedSelectionRect.width,
              height: normalizedSelectionRect.height,
            }}
          />
        )}

        {scene.list.map((node) => {
          const selected = selectedNodeIds.includes(node.viewId);
          const active = activeViewNodeIds.has(node.viewId);
          const pending = pendingNodeIds.includes(node.viewId);
          const nodeClassName = [
            'topology-node',
            node.leaf ? 'is-leaf' : 'is-group',
            `is-${node.kind}`,
            node.expanded ? 'is-expanded' : '',
            node.expansionParentId ? 'is-expanded-child' : '',
            selected ? 'is-selected' : '',
            active ? 'is-active' : '',
            pending ? 'is-pending' : '',
            node.proxy ? 'is-proxy' : '',
          ].join(' ');

          return (
            <div
              key={node.viewId}
              className={nodeClassName}
              data-testid={`topology-node-${node.id}`}
              data-topology-view-node-id={node.viewId}
              style={{
                left: node.sceneX,
                top: node.sceneY,
                width: node.width,
                height: node.height,
              }}
              onMouseDown={(event) => onNodeMouseDown(event, node.viewId)}
              onContextMenu={onNodeContextMenu}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (node.expanded || node.expansionParentId) {
                  const nearbyLink = findEditableLinkNearClientPoint(event.clientX, event.clientY);
                  if (nearbyLink) {
                    onOpenLinkDetail(nearbyLink.id);
                    return;
                  }
                }

                const action = getNodeDoubleClickAction(node.viewId);
                if (action === 'navigate') {
                  onNavigateToNode(node.viewId);
                  return;
                }

                if (action === 'edit') {
                  onOpenNodeDetail(node.refNodeId);
                }
              }}
            >
              {node.leaf ? <div className="topology-node-shape topology-node-dot" /> : (
                <div className="topology-node-shape">
                  <div className="topology-node-label">{node.label}</div>
                  <div className="topology-node-detail">{node.detail}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GraphTopologyCanvas;
