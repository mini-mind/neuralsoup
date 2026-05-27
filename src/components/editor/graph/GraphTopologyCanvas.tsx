import React, { useCallback } from 'react';
import type { GraphViewLink } from './graphViewTypes';
import { getGraphNodeInteractionDescriptor, type GraphNodeHitArea } from './brainGraphInteractionGrammar';
import type { GraphInteractionState, GraphContextMenuState } from './interaction/interactionSession';
import type { GraphSceneProjection } from './graphSceneProjection';
import { getNodeCenter } from './tools/canvasGeometry';
import type { SharedCanvasCapabilities } from './sharedCanvasCore';
import TopologyCanvasSurface from './TopologyCanvasSurface';
import TopologyLinkLayer from './TopologyLinkLayer';
import TopologyNodeLayer from './TopologyNodeLayer';

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
  capabilities: SharedCanvasCapabilities;
  onCanvasContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onNodeMouseDown: (event: React.MouseEvent<HTMLDivElement>, nodeId: string, hitArea?: GraphNodeHitArea) => void;
  onNodeContextMenu: (event: React.MouseEvent<HTMLDivElement>, nodeId: string, hitArea?: GraphNodeHitArea) => void;
  onSelectLink: (linkId: string) => void;
  onOpenLinkDetail: (linkId: string) => void;
  onNavigateToNode: (nodeRefId: string) => void;
  onOpenNodeDetail: (nodeRefId: string) => void;
  onCloseContextMenu: () => void;
  onAddNeuronAt: (x: number, y: number) => void;
  onAddNeuronGroupAt: (x: number, y: number) => void;
  onAddInputSignalAt: (x: number, y: number) => void;
  onAddOutputSignalAt: (x: number, y: number) => void;
  onAggregateSelectedNodes: () => void;
  onUngroupNode: (nodeId: string) => void;
  onToggleGroupExpanded: (nodeId: string) => void;
  onMoveNodeOutToParent: (nodeId: string) => void;
  onMoveSelectionIntoGroup: (nodeId: string) => void;
  onRemoveSelection: () => void;
}

const formatWeight = (weight: number) => (Number.isInteger(weight) ? `${weight}` : weight.toFixed(2));

interface TopologyContextMenuAction {
  key: string;
  label: string;
  onClick: () => void;
}

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
  capabilities,
  onCanvasContextMenu,
  onCanvasMouseDown,
  onNodeMouseDown,
  onNodeContextMenu,
  onSelectLink,
  onOpenLinkDetail,
  onNavigateToNode,
  onOpenNodeDetail,
  onCloseContextMenu,
  onAddNeuronAt,
  onAddNeuronGroupAt,
  onAddInputSignalAt,
  onAddOutputSignalAt,
  onAggregateSelectedNodes,
  onUngroupNode,
  onToggleGroupExpanded,
  onMoveNodeOutToParent,
  onMoveSelectionIntoGroup,
  onRemoveSelection,
}) => {
  const findEditableLinkNearClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const directLinkId = document
        .elementFromPoint(clientX, clientY)
        ?.closest<SVGGElement | HTMLElement>('[data-topology-link-id]')
        ?.getAttribute('data-topology-link-id');
      if (directLinkId) {
        const directLink = links.find((link) => link.id === directLinkId && link.inspectable);
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
        if (!link.inspectable) {
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

  const pendingNodeIds = interaction?.type === 'linking' ? interaction.sourceNodeIds : [];
  const renderLabel = (link: GraphViewLink): string => (link.aggregate ? `${link.count}` : formatWeight(link.weight));
  const contextMenuActions = React.useMemo<TopologyContextMenuAction[]>(() => {
    if (!contextMenu) {
      return [];
    }

    if (contextMenu.kind === 'canvas') {
      const actions: TopologyContextMenuAction[] = [];
      if (capabilities.canCreateNodeAtCanvasContext) {
        actions.push({
          key: 'topology-context-new-neuron',
          label: '新建神经元',
          onClick: () => {
            onAddNeuronAt(contextMenu.scene.x + scene.origin.x, contextMenu.scene.y + scene.origin.y);
            onCloseContextMenu();
          },
        });
        actions.push({
          key: 'topology-context-new-group',
          label: '新建分组',
          onClick: () => {
            onAddNeuronGroupAt(contextMenu.scene.x + scene.origin.x, contextMenu.scene.y + scene.origin.y);
            onCloseContextMenu();
          },
        });
      }
      if (capabilities.canCreateSignalAtCanvasContext) {
        actions.push({
          key: 'topology-context-new-input-signal',
          label: '新建输入信号',
          onClick: () => {
            onAddInputSignalAt(contextMenu.scene.x + scene.origin.x, contextMenu.scene.y + scene.origin.y);
            onCloseContextMenu();
          },
        });
        actions.push({
          key: 'topology-context-new-output-signal',
          label: '新建输出信号',
          onClick: () => {
            onAddOutputSignalAt(contextMenu.scene.x + scene.origin.x, contextMenu.scene.y + scene.origin.y);
            onCloseContextMenu();
          },
        });
      }
      return actions;
    }

    if (contextMenu.kind === 'selection') {
      const actions: TopologyContextMenuAction[] = [];
      if (contextMenu.selectionMode === 'leaf') {
        actions.push({
          key: 'topology-context-edit-node',
          label: '编辑节点',
          onClick: () => {
            const nodeId = contextMenu.nodeIds[0];
            if (nodeId) {
              const contextNode = scene.map.get(nodeId);
              if (contextNode) {
                onOpenNodeDetail(contextNode.refNodeId);
              }
            }
            onCloseContextMenu();
          },
        });
        actions.push({
          key: 'topology-context-delete-node',
          label: '删除节点',
          onClick: () => {
            onRemoveSelection();
            onCloseContextMenu();
          },
        });
      }
      if (contextMenu.selectionMode === 'selection' && capabilities.canAggregateSelection) {
        actions.push({
          key: 'topology-context-aggregate',
          label: '聚合',
          onClick: () => {
            onAggregateSelectedNodes();
            onCloseContextMenu();
          },
        });
      }
      if (capabilities.canMoveSelectionOutToParent) {
        actions.push({
          key: 'topology-context-move-out',
          label: '移到上一级',
          onClick: () => {
            onMoveNodeOutToParent(contextMenu.nodeIds[0] ?? '');
            onCloseContextMenu();
          },
        });
      }
      return actions;
    }

    const groupNodeId = contextMenu.nodeIds[0];
    const groupNode = scene.map.get(groupNodeId);
    const actions: TopologyContextMenuAction[] = [
      {
        key: 'topology-context-enter-group',
        label: '进入组',
        onClick: () => {
          onNavigateToNode(groupNodeId);
          onCloseContextMenu();
        },
      },
      {
        key: 'topology-context-toggle-group',
        label: groupNode?.expanded ? '收起' : '展开',
        onClick: () => {
          onToggleGroupExpanded(groupNodeId);
          onCloseContextMenu();
        },
      },
    ];

    if (capabilities.canUngroupGroupNode && groupNode?.kind === 'neuron-group') {
      actions.push({
        key: 'topology-context-ungroup',
        label: '拆开组',
        onClick: () => {
          onUngroupNode(groupNodeId);
          onCloseContextMenu();
        },
      });
    }
    if (capabilities.canMoveNodeOutToParent) {
      actions.push({
        key: 'topology-context-move-out',
        label: '移到上一级',
        onClick: () => {
          onMoveNodeOutToParent(groupNodeId);
          onCloseContextMenu();
        },
      });
    }
    if (capabilities.canMoveSelectionIntoGroup) {
      actions.push({
        key: 'topology-context-move-into-group',
        label: '选中项移入此组',
        onClick: () => {
          onMoveSelectionIntoGroup(groupNodeId);
          onCloseContextMenu();
        },
      });
    }
    return actions;
  }, [
    capabilities.canAggregateSelection,
    capabilities.canCreateNodeAtCanvasContext,
    capabilities.canCreateSignalAtCanvasContext,
    capabilities.canMoveNodeOutToParent,
    capabilities.canMoveSelectionIntoGroup,
    capabilities.canMoveSelectionOutToParent,
    capabilities.canUngroupGroupNode,
    contextMenu,
    onAddInputSignalAt,
    onAddNeuronAt,
    onAddNeuronGroupAt,
    onAddOutputSignalAt,
    onAggregateSelectedNodes,
    onCloseContextMenu,
    onMoveNodeOutToParent,
    onMoveSelectionIntoGroup,
    onNavigateToNode,
    onOpenNodeDetail,
    onRemoveSelection,
    onToggleGroupExpanded,
    onUngroupNode,
    scene.map,
    scene.origin.x,
    scene.origin.y,
  ]);

  return (
    <TopologyCanvasSurface
      surfaceRef={surfaceRef}
      sceneRef={sceneRef}
      width={width}
      height={height}
      sceneWidth={scene.size.width}
      sceneHeight={scene.size.height}
      canvasViewport={canvasViewport}
      canvasScale={canvasScale}
      isPanning={interaction?.type === 'panning'}
      isSelecting={interaction?.type === 'selecting'}
      isLinking={interaction?.type === 'linking'}
      selectionRect={selectionRect}
      onCanvasContextMenu={onCanvasContextMenu}
      onCanvasMouseDown={onCanvasMouseDown}
      onSceneDoubleClick={(event) => {
        const nearbyLink = findEditableLinkNearClientPoint(event.clientX, event.clientY);
        if (!nearbyLink) {
          return;
        }

        event.stopPropagation();
        onOpenLinkDetail(nearbyLink.id);
      }}
      beforeScene={
        <>
          {interaction?.type === 'linking' ? (
            <div className="topology-pending-link" data-testid="topology-pending-link">
              右键拖到目标叶子节点完成连接
            </div>
          ) : null}

          {contextMenu && contextMenuPosition ? (
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
              {contextMenuActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className="topology-context-menu-item"
                  data-testid={action.key}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      }
    >
      <TopologyLinkLayer
        sceneNodeMap={scene.map}
        links={links.map((link) => ({
          id: link.id,
          dataTestId: `topology-link-${link.id}`,
          fromNodeId: link.fromNodeId,
          toNodeId: link.toNodeId,
          aggregate: link.aggregate,
          selected: selectedLinkId === link.id,
          inspectable: link.inspectable,
          label: renderLabel(link),
          onClick: (event) => {
            event.stopPropagation();
            if (link.aggregate && link.inspectable) {
              onOpenLinkDetail(link.id);
              return;
            }
            if (link.inspectable) {
              onSelectLink(link.id);
            }
          },
          onDoubleClick: (event) => {
            event.stopPropagation();
            if (link.inspectable) {
              onOpenLinkDetail(link.id);
            }
          },
        }))}
        pendingLinkLine={pendingLinkLine}
      />
      <TopologyNodeLayer
        nodes={scene.list.map((node) => {
          const selected = selectedNodeIds.includes(node.viewId);
          const active = activeViewNodeIds.has(node.viewId);
          const pending = pendingNodeIds.includes(node.viewId);
          const canonicalOnly = !node.runtimeInstalled && node.kind === 'signal';
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
            canonicalOnly ? 'is-canonical-only' : '',
          ].join(' ');

          const descriptor = getGraphNodeInteractionDescriptor(node);
          const handleNodeDoubleClick = (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>, hitArea: GraphNodeHitArea) => {
            const intent = getGraphNodeInteractionDescriptor(node, hitArea).doubleClickIntent;
            if (!intent) {
              return;
            }

            event.stopPropagation();
            if (intent === 'navigate') {
              onNavigateToNode(node.viewId);
              return;
            }

            if (intent === 'edit') {
              onOpenNodeDetail(node.refNodeId);
              return;
            }

            if (intent === 'toggle-expand') {
              onToggleGroupExpanded(node.viewId);
            }
          };

          return {
            id: node.viewId,
            x: node.sceneX,
            y: node.sceneY,
            width: node.width,
            height: node.height,
            className: nodeClassName,
            title: canonicalOnly ? `${node.detail}，当前未安装到 runtime` : node.leaf ? node.detail : undefined,
            ariaLabel: canonicalOnly ? `${node.id} canonical-only` : undefined,
            dataTestId: `topology-node-${node.id}`,
            dataAttributes: {
              'data-topology-root-container': node.rootContainer ? 'true' : undefined,
              'data-topology-view-node-id': node.viewId,
              'data-topology-runtime-installed': node.runtimeInstalled ? 'true' : 'false',
              'data-topology-canonical-only': canonicalOnly ? 'true' : undefined,
              'data-topology-hit-area': 'node',
            },
            onMouseDown: descriptor.dispatchesNodePointer
              ? (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) =>
                  onNodeMouseDown(event as React.MouseEvent<HTMLDivElement>, node.viewId, 'node')
              : undefined,
            onContextMenu: descriptor.dispatchesNodePointer
              ? (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) =>
                  onNodeContextMenu(event as React.MouseEvent<HTMLDivElement>, node.viewId, 'node')
              : undefined,
            onDoubleClick: descriptor.dispatchesNodePointer
              ? (event: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => handleNodeDoubleClick(event, 'node')
              : undefined,
            content: node.leaf ? <>
              <div className="topology-node-shape topology-node-dot" />
              {node.expansionParentId ? <div className="topology-node-label topology-node-inline-label">{node.label}</div> : null}
              {canonicalOnly ? <div className="topology-node-canonical-badge" data-testid={`topology-node-canonical-only-${node.id}`}>C</div> : null}
            </> : (
              <div
                className="topology-node-shape"
                data-testid={node.kind === 'neuron-group' && node.expanded ? `topology-node-body-${node.id}` : undefined}
                data-topology-group-body={node.kind === 'neuron-group' && node.expanded ? 'true' : undefined}
                data-topology-hit-area={node.kind === 'neuron-group' && node.expanded ? 'group-body' : 'node'}
              >
                <div
                  className="topology-node-titlebar"
                  data-testid={node.kind === 'neuron-group' ? `topology-node-title-${node.id}` : undefined}
                  data-topology-group-title-handle={node.kind === 'neuron-group' && node.expanded ? 'true' : undefined}
                  data-topology-hit-area={node.kind === 'neuron-group' && node.expanded ? 'group-title' : undefined}
                  onMouseDown={
                    node.kind === 'neuron-group' && node.expanded
                      ? (event) => onNodeMouseDown(event, node.viewId, 'group-title')
                      : undefined
                  }
                  onContextMenu={
                    node.kind === 'neuron-group' && node.expanded
                      ? (event) => onNodeContextMenu(event, node.viewId, 'group-title')
                      : undefined
                  }
                  onDoubleClick={
                    node.kind === 'neuron-group' && node.expanded
                      ? (event) => handleNodeDoubleClick(event, 'group-title')
                      : undefined
                  }
                >
                  <div className="topology-node-label">{node.label}</div>
                  <div className="topology-node-detail">{node.detail}</div>
                </div>
                {node.kind !== 'neuron-group' || node.expanded ? null : (
                  <>
                    <div className="topology-node-label">{node.label}</div>
                    <div className="topology-node-detail">{node.detail}</div>
                  </>
                )}
              </div>
            ),
          };
        })}
      />
    </TopologyCanvasSurface>
  );
};

export default GraphTopologyCanvas;
