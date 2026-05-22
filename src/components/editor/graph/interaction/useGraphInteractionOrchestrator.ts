import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  clampNodePlacement,
  clampZoom,
  getScenePointFromClient,
  hasMovedPastThreshold,
  normalizeRect,
  type GraphPoint,
  type GraphViewport,
  type SceneNodeGeometry,
  ZOOM_STEP,
} from '../tools/canvasGeometry';
import { findIntersectedNodeIds, findSceneNodeAtClientPoint } from '../tools/nodeHitTest';
import type { GraphContextMenuState, GraphInteractionState } from './interactionSession';

interface OrchestratorNode extends SceneNodeGeometry {
  proxy: boolean;
  movable: boolean;
  local: boolean;
  connectableSource: boolean;
  ungroupable: boolean;
  expanded: boolean;
  expansionParentId: string | null;
}

interface GraphInteractionDependencies {
  isActive: boolean;
  surfaceRef: RefObject<HTMLDivElement>;
  sceneRef: RefObject<HTMLDivElement>;
  nodes: OrchestratorNode[];
  sceneOrigin: GraphPoint;
  viewport: GraphViewport;
  setViewport: (nextViewport: GraphViewport) => void;
  scale: number;
  setScale: (nextScale: number) => void;
  selectedNodeIds: string[];
  canCreateNeuronHere: boolean;
  canAggregateSelection: boolean;
  beginSelectionRect: (point: GraphPoint) => void;
  updateSelectionRect: (point: GraphPoint, intersectedNodeIds: string[]) => void;
  cancelSelectionRect: () => void;
  clearSelection: () => void;
  connectSourceNodesToTarget: (sourceNodeIds: string[], targetNodeId: string) => void;
  createNeuronAndConnectAt: (sourceNodeIds: string[], x: number, y: number) => void;
  updateNodePositionsInDraft: (updates: Array<{ nodeId: string; x: number; y: number }>) => void;
  discardNodeDraftPositions: () => void;
  persistNodePositions: (updates: Array<{ nodeId: string; x: number; y: number }>) => void;
  selectNode: (nodeId: string, options?: { additive?: boolean }) => void;
  selectNodes: (nodeIds: string[]) => void;
}

export interface GraphInteractionOrchestratorResult {
  interaction: GraphInteractionState | null;
  contextMenu: GraphContextMenuState | null;
  setContextMenu: Dispatch<SetStateAction<GraphContextMenuState | null>>;
  closeContextMenu: () => void;
  setInteractionState: (nextInteraction: GraphInteractionState | null) => void;
  handleCanvasWheel: (event: WheelEvent) => void;
  handleCanvasMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  handleCanvasContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  handleNodeMouseDown: (event: ReactMouseEvent<HTMLDivElement>, nodeId: string) => void;
  handleNodeContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

type MovingInteraction = Extract<GraphInteractionState, { type: 'moving' }>;

const getNodeCenterPoint = (node: Pick<OrchestratorNode, 'x' | 'y' | 'width' | 'height'>): GraphPoint => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

export const useGraphInteractionOrchestrator = ({
  isActive,
  surfaceRef,
  sceneRef,
  nodes,
  sceneOrigin,
  viewport,
  setViewport,
  scale,
  setScale,
  selectedNodeIds,
  canCreateNeuronHere,
  canAggregateSelection,
  beginSelectionRect,
  updateSelectionRect,
  cancelSelectionRect,
  clearSelection,
  connectSourceNodesToTarget,
  createNeuronAndConnectAt,
  updateNodePositionsInDraft,
  discardNodeDraftPositions,
  persistNodePositions,
  selectNode,
  selectNodes,
}: GraphInteractionDependencies): GraphInteractionOrchestratorResult => {
  const interactionRef = useRef<GraphInteractionState | null>(null);
  const viewportRef = useRef(viewport);
  const scaleRef = useRef(scale);
  const nodesRef = useRef(nodes);
  const sceneOriginRef = useRef(sceneOrigin);
  const [interaction, setInteraction] = useState<GraphInteractionState | null>(null);
  const [contextMenu, setContextMenu] = useState<GraphContextMenuState | null>(null);

  viewportRef.current = viewport;
  scaleRef.current = scale;
  nodesRef.current = nodes;
  sceneOriginRef.current = sceneOrigin;

  const setInteractionState = useCallback((nextInteraction: GraphInteractionState | null) => {
    interactionRef.current = nextInteraction;
    setInteraction(nextInteraction);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const focusSurface = useCallback(() => {
    surfaceRef.current?.focus();
  }, [surfaceRef]);

  const getScenePoint = useCallback(
    (client: GraphPoint) =>
      getScenePointFromClient(
        client,
        surfaceRef.current?.getBoundingClientRect() ?? null,
        viewportRef.current,
        scaleRef.current
      ),
    [surfaceRef]
  );

  const getNodeById = useCallback(
    (nodeId: string) => nodesRef.current.find((candidate) => candidate.id === nodeId) ?? null,
    []
  );

  const getSourceScenePoint = useCallback(
    (sourceNodeIds: string[]) => {
      const sourceNodes = sourceNodeIds
        .map((nodeId) => getNodeById(nodeId))
        .filter((candidate): candidate is OrchestratorNode => candidate != null);

      if (sourceNodes.length === 0) {
        return null;
      }

      return {
        x: sourceNodes.reduce((sum, candidate) => sum + getNodeCenterPoint(candidate).x, 0) / sourceNodes.length,
        y: sourceNodes.reduce((sum, candidate) => sum + getNodeCenterPoint(candidate).y, 0) / sourceNodes.length,
      };
    },
    [getNodeById]
  );

  const getNodeContextSourceNodeIds = useCallback(
    (node: OrchestratorNode) =>
      selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id)
        ? selectedNodeIds.filter((selectedId) => getNodeById(selectedId)?.connectableSource)
        : node.connectableSource
          ? [node.id]
          : [],
    [getNodeById, selectedNodeIds]
  );

  const resolveNodeHit = useCallback(
    (target: EventTarget | null, clientPoint: GraphPoint) => {
      const targetElement = target instanceof Element ? target : null;
      const domNodeId = targetElement?.closest<HTMLElement>('[data-topology-node-id]')?.dataset.topologyNodeId;
      if (domNodeId) {
        return getNodeById(domNodeId);
      }

      const hitNode = findSceneNodeAtClientPoint(
        nodesRef.current,
        clientPoint,
        sceneRef.current?.getBoundingClientRect() ?? null,
        scaleRef.current
      );

      return hitNode ? getNodeById(hitNode.id) : null;
    },
    [getNodeById, sceneRef]
  );

  const beginCanvasContextGesture = useCallback(
    (startClient: GraphPoint) => {
      closeContextMenu();
      focusSurface();
      setInteractionState({
        type: 'context-gesture',
        contextTarget: 'canvas',
        startClient,
        startScene: getScenePoint(startClient),
        startOffset: viewportRef.current,
        contextNodeIds: [],
        sourceNodeIds: [],
        sourceScenePoint: null,
        moved: false,
      });
    },
    [closeContextMenu, focusSurface, getScenePoint, setInteractionState]
  );

  const beginNodeContextGesture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, node: OrchestratorNode) => {
      closeContextMenu();
      focusSurface();
      const sourceNodeIds = getNodeContextSourceNodeIds(node);
      const selectionGesture = selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id);
      const singleGroupGesture = !selectionGesture && node.ungroupable;

      if (!selectionGesture && !singleGroupGesture && sourceNodeIds.length > 0) {
        const sourceScenePoint = getSourceScenePoint(sourceNodeIds);
        if (sourceScenePoint) {
          setInteractionState({
            type: 'linking',
            sourceNodeIds,
            mode: 'single',
            sourceScenePoint,
            currentScenePoint: sourceScenePoint,
            moved: false,
          });
          return;
        }
      }

      setInteractionState({
        type: 'context-gesture',
        contextTarget: 'selection',
        startClient: { x: event.clientX, y: event.clientY },
        startScene: getScenePoint({ x: event.clientX, y: event.clientY }),
        startOffset: viewportRef.current,
        contextNodeIds:
          selectedNodeIds.length > 0 && selectedNodeIds.includes(node.id) ? [...selectedNodeIds] : [node.id],
        sourceNodeIds,
        sourceScenePoint: getSourceScenePoint(sourceNodeIds),
        moved: false,
      });
    },
    [
      closeContextMenu,
      focusSurface,
      getNodeContextSourceNodeIds,
      getScenePoint,
      getSourceScenePoint,
      selectedNodeIds,
      setInteractionState,
    ]
  );

  const beginNodePressing = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, node: OrchestratorNode) => {
      closeContextMenu();
      focusSurface();
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      const startScene = getScenePoint({ x: event.clientX, y: event.clientY });
      setInteractionState({
        type: 'pressing',
        nodeId: node.id,
        additive,
        startClient: { x: event.clientX, y: event.clientY },
        startScene,
      });
    },
    [closeContextMenu, focusSurface, getScenePoint, setInteractionState]
  );

  const beginSurfacePressing = useCallback(
    (surfaceTarget: 'canvas' | 'link', clientPoint: GraphPoint) => {
      closeContextMenu();
      focusSurface();
      const startScene = getScenePoint(clientPoint);
      setInteractionState({
        type: 'surface-pressing',
        surfaceTarget,
        startClient: clientPoint,
        startScene,
      });
    },
    [closeContextMenu, focusSurface, getScenePoint, setInteractionState]
  );

  const getMovingPositions = useCallback(
    (currentInteraction: MovingInteraction, client: GraphPoint) => {
      const pointerDelta = {
        x: (client.x - currentInteraction.startClient.x) / scaleRef.current,
        y: (client.y - currentInteraction.startClient.y) / scaleRef.current,
      };
      const originDelta = {
        x: currentInteraction.startOrigin.x - sceneOriginRef.current.x,
        y: currentInteraction.startOrigin.y - sceneOriginRef.current.y,
      };

      return Object.fromEntries(
        Object.entries(currentInteraction.basePositions).map(([nodeId, point]) => {
          const currentNode = nodesRef.current.find((node) => node.id === nodeId);
          const nextPoint = {
            x: point.x + pointerDelta.x + originDelta.x,
            y: point.y + pointerDelta.y + originDelta.y,
          };

          if (!currentNode) {
            return [
              nodeId,
              {
                x: Math.round(nextPoint.x),
                y: Math.round(nextPoint.y),
              },
            ];
          }

          return [nodeId, clampNodePlacement(nextPoint)];
        })
      );
    },
    []
  );

  const endInteraction = useCallback(
    (currentInteraction: GraphInteractionState | null, finalMovingPositions?: Record<string, GraphPoint>) => {
      if (!currentInteraction) {
        return;
      }

      if (currentInteraction.type === 'pressing') {
        if (currentInteraction.additive) {
          selectNode(currentInteraction.nodeId, { additive: true });
        } else {
          selectNodes([currentInteraction.nodeId]);
        }
      }

      if (currentInteraction.type === 'surface-pressing' && currentInteraction.surfaceTarget === 'canvas') {
        clearSelection();
      }

      if (currentInteraction.type === 'selecting') {
        if (!currentInteraction.moved) {
          clearSelection();
        }
        cancelSelectionRect();
      }

      if (currentInteraction.type === 'context-gesture' && !currentInteraction.moved) {
        if (currentInteraction.contextTarget === 'canvas' && canCreateNeuronHere) {
          setContextMenu({
            kind: 'canvas',
            client: currentInteraction.startClient,
            scene: currentInteraction.startScene,
            nodeIds: [],
          });
        } else if (currentInteraction.contextTarget === 'selection' && currentInteraction.contextNodeIds.length === 1) {
          const contextNode = getNodeById(currentInteraction.contextNodeIds[0]);
          if (!contextNode?.ungroupable) {
            setInteractionState(null);
            return;
          }

          setContextMenu({
            kind: 'group',
            client: currentInteraction.startClient,
            scene: currentInteraction.startScene,
            nodeIds: currentInteraction.contextNodeIds,
          });
        } else if (currentInteraction.contextTarget === 'selection' && canAggregateSelection) {
          setContextMenu({
            kind: 'selection',
            client: currentInteraction.startClient,
            scene: currentInteraction.startScene,
            nodeIds: currentInteraction.sourceNodeIds,
          });
        }
      }

      if (currentInteraction.type === 'moving') {
        if (currentInteraction.moved) {
          const positions = finalMovingPositions ?? currentInteraction.currentPositions;
          persistNodePositions(
            Object.entries(positions).map(([nodeId, point]) => ({
              nodeId,
              x: point.x,
              y: point.y,
            }))
          );
        } else {
          discardNodeDraftPositions();
        }
      }

      setInteractionState(null);
    },
    [
      canAggregateSelection,
      canCreateNeuronHere,
      cancelSelectionRect,
      clearSelection,
      discardNodeDraftPositions,
      getNodeById,
      persistNodePositions,
      selectNode,
      selectNodes,
      setInteractionState,
    ]
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const currentInteraction = interactionRef.current;
      if (!currentInteraction) {
        return;
      }

      if (event.buttons === 0) {
        if (currentInteraction.type === 'moving' && currentInteraction.moved) {
          endInteraction(
            currentInteraction,
            getMovingPositions(currentInteraction, { x: event.clientX, y: event.clientY })
          );
          return;
        }

        endInteraction(currentInteraction);
        return;
      }

      if (currentInteraction.type === 'pressing') {
        const nextClient = { x: event.clientX, y: event.clientY };
        if (!hasMovedPastThreshold(currentInteraction.startClient, nextClient)) {
          return;
        }

        const pressedNode = getNodeById(currentInteraction.nodeId);
        if (!pressedNode || !pressedNode.movable || pressedNode.proxy || !pressedNode.local) {
          endInteraction(currentInteraction);
          return;
        }

        const shouldMoveSelection =
          !currentInteraction.additive &&
          selectedNodeIds.includes(pressedNode.id) &&
          selectedNodeIds.length > 1;
        const movingNodes = shouldMoveSelection
          ? nodesRef.current.filter(
              (candidate) =>
                selectedNodeIds.includes(candidate.id) &&
                candidate.movable &&
                candidate.local &&
                !candidate.proxy
            )
          : [pressedNode];
        const basePositions = Object.fromEntries(
          movingNodes.map((candidate) => [
            candidate.id,
            {
              x: candidate.x,
              y: candidate.y,
            },
          ])
        );

        if (!shouldMoveSelection) {
          selectNodes([pressedNode.id]);
        }

        setInteractionState({
          type: 'moving',
          startClient: currentInteraction.startClient,
          startScene: currentInteraction.startScene,
          startOrigin: sceneOriginRef.current,
          nodeIds: movingNodes.map((candidate) => candidate.id),
          basePositions,
          currentPositions: basePositions,
          moved: true,
        });
        return;
      }

      if (currentInteraction.type === 'surface-pressing') {
        const nextClient = { x: event.clientX, y: event.clientY };
        if (!hasMovedPastThreshold(currentInteraction.startClient, nextClient)) {
          return;
        }

        if (currentInteraction.surfaceTarget === 'link') {
          clearSelection();
          setInteractionState(null);
          return;
        }

        clearSelection();
        beginSelectionRect(currentInteraction.startScene);
        setInteractionState({
          type: 'selecting',
          startScene: currentInteraction.startScene,
          currentScene: currentInteraction.startScene,
          moved: false,
        });
        return;
      }

      if (currentInteraction.type === 'panning') {
        const nextInteraction = {
          ...currentInteraction,
          moved:
            currentInteraction.moved ||
            hasMovedPastThreshold(currentInteraction.startClient, { x: event.clientX, y: event.clientY }),
        };
        setViewport({
          x: currentInteraction.startOffset.x + (event.clientX - currentInteraction.startClient.x),
          y: currentInteraction.startOffset.y + (event.clientY - currentInteraction.startClient.y),
        });
        interactionRef.current = nextInteraction;
        if (nextInteraction.moved !== currentInteraction.moved) {
          setInteraction(nextInteraction);
        }
        return;
      }

      if (currentInteraction.type === 'context-gesture') {
        const nextClient = { x: event.clientX, y: event.clientY };
        const moved = currentInteraction.moved || hasMovedPastThreshold(currentInteraction.startClient, nextClient);
        if (!moved) {
          return;
        }

        if (currentInteraction.contextTarget === 'canvas') {
          setContextMenu(null);
          setInteractionState({
            type: 'panning',
            startClient: currentInteraction.startClient,
            startOffset: currentInteraction.startOffset,
            moved: true,
          });
          return;
        }

        if (currentInteraction.sourceScenePoint) {
          setContextMenu(null);
          setInteractionState({
            type: 'linking',
            sourceNodeIds: currentInteraction.sourceNodeIds,
            mode: 'multi',
            sourceScenePoint: currentInteraction.sourceScenePoint,
            currentScenePoint: getScenePoint({ x: event.clientX, y: event.clientY }),
            moved: true,
          });
          return;
        }
      }

      if (currentInteraction.type === 'selecting') {
        const nextScene = getScenePoint({ x: event.clientX, y: event.clientY });
        const nextRect = normalizeRect({
          x: currentInteraction.startScene.x,
          y: currentInteraction.startScene.y,
          width: nextScene.x - currentInteraction.startScene.x,
          height: nextScene.y - currentInteraction.startScene.y,
        });
        const intersectedNodeIds = findIntersectedNodeIds(nodesRef.current, nextRect, (node) => !node.proxy);
        updateSelectionRect(nextScene, intersectedNodeIds);
        const nextInteraction = {
          ...currentInteraction,
          currentScene: nextScene,
          moved: currentInteraction.moved || hasMovedPastThreshold(currentInteraction.startScene, nextScene),
        };
        interactionRef.current = nextInteraction;
        if (
          nextInteraction.moved !== currentInteraction.moved ||
          nextInteraction.currentScene.x !== currentInteraction.currentScene.x ||
          nextInteraction.currentScene.y !== currentInteraction.currentScene.y
        ) {
          setInteraction(nextInteraction);
        }
        return;
      }

      if (currentInteraction.type === 'moving') {
        const nextPositions = getMovingPositions(currentInteraction, { x: event.clientX, y: event.clientY });
        updateNodePositionsInDraft(
          Object.entries(nextPositions).map(([nodeId, point]) => ({
            nodeId,
            x: point.x,
            y: point.y,
          }))
        );
        const nextInteraction = {
          ...currentInteraction,
          currentPositions: nextPositions,
          moved:
            currentInteraction.moved ||
            hasMovedPastThreshold(currentInteraction.startClient, { x: event.clientX, y: event.clientY }),
        };
        interactionRef.current = nextInteraction;
        if (nextInteraction.moved !== currentInteraction.moved) {
          setInteraction(nextInteraction);
        }
        return;
      }

      if (currentInteraction.type === 'linking') {
        const currentScenePoint = getScenePoint({ x: event.clientX, y: event.clientY });
        setInteractionState({
          ...currentInteraction,
          currentScenePoint,
          moved: currentInteraction.moved || hasMovedPastThreshold(currentInteraction.sourceScenePoint, currentScenePoint),
        });
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      const currentInteraction = interactionRef.current;
      if (currentInteraction?.type === 'moving' && currentInteraction.moved) {
        endInteraction(
          currentInteraction,
          getMovingPositions(currentInteraction, { x: event.clientX, y: event.clientY })
        );
        return;
      }

      if (currentInteraction?.type === 'linking') {
        const targetNode =
          resolveNodeHit(event.target, { x: event.clientX, y: event.clientY }) ??
          findSceneNodeAtClientPoint(
            nodesRef.current,
            { x: event.clientX, y: event.clientY },
            sceneRef.current?.getBoundingClientRect() ?? null,
            scaleRef.current,
            {
              excludeNodeIds: currentInteraction.sourceNodeIds,
            }
          );
        const targetNodeId = targetNode?.id ?? null;

        if (targetNodeId && !currentInteraction.sourceNodeIds.includes(targetNodeId)) {
          connectSourceNodesToTarget(currentInteraction.sourceNodeIds, targetNodeId);
          setInteractionState(null);
          return;
        }

        if (currentInteraction.mode === 'multi' && canCreateNeuronHere) {
          const scenePoint = getScenePoint({ x: event.clientX, y: event.clientY });
          createNeuronAndConnectAt(currentInteraction.sourceNodeIds, scenePoint.x + sceneOriginRef.current.x, scenePoint.y + sceneOriginRef.current.y);
          setInteractionState(null);
          return;
        }
      }

      endInteraction(currentInteraction);
    };

    const handleWindowBlur = () => {
      endInteraction(interactionRef.current);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    canAggregateSelection,
    canCreateNeuronHere,
    cancelSelectionRect,
    clearSelection,
    connectSourceNodesToTarget,
    createNeuronAndConnectAt,
    discardNodeDraftPositions,
    endInteraction,
    getNodeById,
    getMovingPositions,
    getScenePoint,
    isActive,
    resolveNodeHit,
    sceneRef,
    selectedNodeIds,
    setInteractionState,
    setViewport,
    updateNodePositionsInDraft,
    updateSelectionRect,
  ]);

  const handleCanvasWheel = useCallback(
    (event: WheelEvent) => {
      if (!isActive || interactionRef.current) {
        return;
      }

      event.preventDefault();

      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const currentScale = scaleRef.current;
      const nextScale = clampZoom(currentScale * (event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
      if (nextScale === currentScale) {
        return;
      }

      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const sceneX = (pointerX - viewportRef.current.x) / currentScale;
      const sceneY = (pointerY - viewportRef.current.y) / currentScale;

      setScale(nextScale);
      setViewport({
        x: pointerX - sceneX * nextScale,
        y: pointerY - sceneY * nextScale,
      });
    },
    [isActive, setScale, setViewport, surfaceRef]
  );

  const handleCanvasMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isActive) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const clientPoint = { x: event.clientX, y: event.clientY };
      const hitLink = Boolean(target?.closest('[data-topology-link="true"]'));
      const hitNode = resolveNodeHit(event.target, clientPoint);

      if (event.button === 2) {
        event.preventDefault();
        if (hitNode) {
          beginNodeContextGesture(event, hitNode);
          return;
        }

        beginCanvasContextGesture(clientPoint);
        return;
      }

      if (event.button === 0) {
        if (hitNode) {
          beginNodePressing(event, hitNode);
          return;
        }

        beginSurfacePressing(hitLink ? 'link' : 'canvas', clientPoint);
      }
    },
    [
      beginSurfacePressing,
      beginCanvasContextGesture,
      beginNodeContextGesture,
      beginNodePressing,
      isActive,
      resolveNodeHit,
      setInteractionState,
    ]
  );

  const handleCanvasContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    interaction,
    contextMenu,
    setContextMenu,
    closeContextMenu,
    setInteractionState,
    handleCanvasWheel,
    handleCanvasMouseDown,
    handleCanvasContextMenu,
    handleNodeMouseDown: handleCanvasMouseDown as unknown as (
      event: ReactMouseEvent<HTMLDivElement>,
      nodeId: string
    ) => void,
    handleNodeContextMenu: handleCanvasContextMenu,
  };
};
