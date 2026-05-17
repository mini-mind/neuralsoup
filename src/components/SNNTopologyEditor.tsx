import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  summarizeGraphIRDocument,
  validateGraphIRDocument,
  type GraphIRDocument,
  type LiteralValue,
} from '../domain/brain';
import type { GraphIRRuntimeActivitySnapshot, GraphIRRuntimeStatus } from '../types/graphIRRuntime';
import type { GraphPathItem } from './editor/types';
import NeuronDetailEditor from './NeuronDetailEditor';
import SynapseDetailEditor from './SynapseDetailEditor';
import { useSNNTopologyState } from './hooks/useSNNTopologyState';
import './SNNTopologyEditor.css';

interface SNNTopologyEditorProps {
  width: number;
  height: number;
  document: GraphIRDocument;
  visionCells?: number;
  onDocumentChange?: (document: GraphIRDocument) => void;
  onGraphPathChange?: (graphPath: GraphPathItem[]) => void;
  onGraphPathNavigateRegister?: (navigate: (pathId: string) => void) => void;
  runtimeStatus: GraphIRRuntimeStatus;
  runtimeActivity: GraphIRRuntimeActivitySnapshot;
  isActive?: boolean;
}

interface Point {
  x: number;
  y: number;
}

type InteractionState =
  | {
      type: 'panning';
      startClient: Point;
      startOffset: Point;
      moved: boolean;
    }
  | {
      type: 'selecting';
      startScene: Point;
      currentScene: Point;
      moved: boolean;
    }
  | {
      type: 'moving';
      startClient: Point;
      startScene: Point;
      nodeIds: string[];
      basePositions: Record<string, Point>;
      moved: boolean;
    }
  | {
      type: 'linking';
      sourceNodeId: string;
      sourceScenePoint: Point;
      currentScenePoint: Point;
      moved: boolean;
    };

const SCENE_PADDING = 120;
const DRAG_THRESHOLD = 3;
const ZOOM_STEP = 1.2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
const NODE_PLACEMENT_MARGIN = 24;

const getNodeCenter = (node: { x: number; y: number; width: number; height: number }) => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
});

const formatWeight = (weight: number) => (Number.isInteger(weight) ? `${weight}` : weight.toFixed(2));

const isEditableOrInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  ) {
    return true;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest('button, input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
};

const hasMovedPastThreshold = (start: Point, end: Point) =>
  Math.abs(end.x - start.x) > DRAG_THRESHOLD || Math.abs(end.y - start.y) > DRAG_THRESHOLD;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

const normalizeRect = (rect: { x: number; y: number; width: number; height: number }) => ({
  x: rect.width >= 0 ? rect.x : rect.x + rect.width,
  y: rect.height >= 0 ? rect.y : rect.y + rect.height,
  width: Math.abs(rect.width),
  height: Math.abs(rect.height),
});

const rectIntersectsNode = (
  rect: { x: number; y: number; width: number; height: number },
  node: { x: number; y: number; width: number; height: number }
) =>
  rect.x <= node.x + node.width &&
  rect.x + rect.width >= node.x &&
  rect.y <= node.y + node.height &&
  rect.y + rect.height >= node.y;

const clampNodePlacement = (
  point: Point,
  node: { width: number; height: number },
  scene: { width: number; height: number }
): Point => ({
  x: Math.min(
    Math.max(NODE_PLACEMENT_MARGIN, Math.round(point.x)),
    Math.max(NODE_PLACEMENT_MARGIN, Math.round(scene.width - node.width - NODE_PLACEMENT_MARGIN))
  ),
  y: Math.min(
    Math.max(NODE_PLACEMENT_MARGIN, Math.round(point.y)),
    Math.max(NODE_PLACEMENT_MARGIN, Math.round(scene.height - node.height - NODE_PLACEMENT_MARGIN))
  ),
});

const SNNTopologyEditor: React.FC<SNNTopologyEditorProps> = ({
  width,
  height,
  document,
  visionCells = 36,
  onDocumentChange,
  onGraphPathChange,
  onGraphPathNavigateRegister,
  runtimeStatus,
  runtimeActivity,
  isActive = true,
}) => {
  const state = useSNNTopologyState({
    document,
    runtimeActiveNodeIds: runtimeActivity.activeNodeIds,
    onDocumentChange,
  });
  const {
    breadcrumbs,
    scopeKey,
    currentScope,
    nodes,
    links,
    selection,
    selectedNodeIds,
    selectedNodeId,
    selectedLinkId,
    selectionRect,
    pendingLinkSourceId,
    showDetailModal,
    activeViewNodeIds,
    activeNode,
    activeLink,
    activeNeuronParameters,
    navigateTo,
    navigateToBreadcrumb,
    setNodeSelection,
    selectNode,
    selectLink,
    clearSelection,
    beginSelectionRect,
    updateSelectionRect,
    commitSelectionRect,
    cancelSelectionRect,
    openNodeDetail,
    openLinkDetail,
    closeDetailModal,
    getNodeDoubleClickAction,
    startLinkCreation,
    finishLinkCreation,
    cancelPendingLink,
    updateNodePositionsInDraft,
    discardNodeDraftPositions,
    persistNodePositions,
    removeSelected,
    setCanvasOffset,
    canvasViewport,
    updateNodeLabelAndParams,
    updateLinkWeight,
  } = state;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const canvasViewportRef = useRef(canvasViewport);
  const canvasScaleRef = useRef(1);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);

  const setInteractionState = useCallback((nextInteraction: InteractionState | null) => {
    interactionRef.current = nextInteraction;
    setInteraction(nextInteraction);
  }, []);

  const setCanvasScaleState = useCallback((nextScale: number) => {
    canvasScaleRef.current = nextScale;
    setCanvasScale(nextScale);
  }, []);

  useEffect(() => {
    if (!isActive) {
      cancelPendingLink();
      setInteractionState(null);
      discardNodeDraftPositions();
      cancelSelectionRect();
      setCanvasScaleState(1);
    }
  }, [cancelPendingLink, cancelSelectionRect, discardNodeDraftPositions, isActive, setCanvasScaleState, setInteractionState]);

  useEffect(() => {
    onGraphPathChange?.(breadcrumbs.map((item) => ({ id: item.id, label: item.label })));
  }, [breadcrumbs, onGraphPathChange]);

  useEffect(() => {
    if (!onGraphPathNavigateRegister) {
      return;
    }

    onGraphPathNavigateRegister(navigateToBreadcrumb);
  }, [navigateToBreadcrumb, onGraphPathNavigateRegister]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace' && event.key !== 'Escape') {
        return;
      }

      if (event.key === 'Escape') {
        cancelPendingLink();
        closeDetailModal();
        setInteractionState(null);
        discardNodeDraftPositions();
        cancelSelectionRect();
        return;
      }

      if (isEditableOrInteractiveTarget(event.target)) {
        return;
      }

      removeSelected();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    cancelPendingLink,
    cancelSelectionRect,
    closeDetailModal,
    discardNodeDraftPositions,
    isActive,
    removeSelected,
    setInteractionState,
  ]);

  const sceneNodes = useMemo(() => {
    if (nodes.length === 0) {
      return {
        list: [] as Array<(typeof nodes)[number] & { sceneX: number; sceneY: number }>,
        map: new Map<string, (typeof nodes)[number] & { sceneX: number; sceneY: number }>(),
        origin: { x: 0, y: 0 },
        size: { width: Math.max(width, 1), height: Math.max(height, 1) },
      };
    }

    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxX = Math.max(...nodes.map((node) => node.x + node.width));
    const maxY = Math.max(...nodes.map((node) => node.y + node.height));
    const origin = {
      x: minX - SCENE_PADDING,
      y: minY - SCENE_PADDING,
    };
    const size = {
      width: Math.max(maxX - minX + SCENE_PADDING * 2, width),
      height: Math.max(maxY - minY + SCENE_PADDING * 2, height),
    };
    const list = nodes.map((node) => ({
      ...node,
      sceneX: node.x - origin.x,
      sceneY: node.y - origin.y,
    }));
    return {
      list,
      map: new Map(list.map((node) => [node.id, node])),
      origin,
      size,
    };
  }, [nodes, width, height]);
  const sceneNodesRef = useRef(sceneNodes);

  useEffect(() => {
    canvasViewportRef.current = canvasViewport;
  }, [canvasViewport]);

  useEffect(() => {
    sceneNodesRef.current = sceneNodes;
  }, [sceneNodes]);

  useEffect(() => {
    canvasScaleRef.current = canvasScale;
  }, [canvasScale]);

  useEffect(() => {
    interactionRef.current = interaction;
  }, [interaction]);

  useEffect(() => {
    const baseOffset = currentScope === 'root' ? { x: 0, y: 0 } : { x: 48, y: 36 };
    setCanvasOffset(baseOffset);
    setInteractionState(null);
    setCanvasScaleState(1);
  }, [currentScope, scopeKey, setCanvasOffset, setCanvasScaleState, setInteractionState]);

  const getScenePointFromClient = (clientX: number, clientY: number): Point => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    return {
      x: (clientX - rect.left - canvasViewportRef.current.x) / canvasScaleRef.current,
      y: (clientY - rect.top - canvasViewportRef.current.y) / canvasScaleRef.current,
    };
  };

  const nodeCentersSummary = useMemo(
    () =>
      sceneNodes.list
        .map((node) => {
          const center = getNodeCenter({
            x: node.sceneX,
            y: node.sceneY,
            width: node.width,
            height: node.height,
          });
          return `${node.id}:${Math.round(center.x)},${Math.round(center.y)}`;
        })
        .join('|'),
    [sceneNodes.list]
  );

  const draftSummary = useMemo(() => summarizeGraphIRDocument(document), [document]);
  const draftIssues = useMemo(() => validateGraphIRDocument(document), [document]);
  const selectedCount = selectedNodeIds.length + (selectedLinkId ? 1 : 0);
  const runtimeValidationCount = runtimeStatus.issues.length;
  const runtimeMessage = runtimeStatus.message ?? '';
  const runtimeStatusLabel = runtimeStatus.state === 'applied' ? '已安装' : '安装失败';

  const pendingLinkLine = useMemo(() => {
    if (interaction?.type !== 'linking') {
      return null;
    }

    return {
      from: interaction.sourceScenePoint,
      to: interaction.currentScenePoint,
    };
  }, [interaction]);

  const normalizedSelectionRect = useMemo(
    () => (selectionRect ? normalizeRect(selectionRect) : null),
    [selectionRect]
  );

  const endInteraction = useCallback(
    (currentInteraction: InteractionState | null) => {
      if (!currentInteraction) {
        return;
      }

      if (currentInteraction.type === 'selecting') {
        if (!currentInteraction.moved) {
          clearSelection();
          cancelPendingLink();
        } else {
          commitSelectionRect();
          cancelPendingLink();
        }
        cancelSelectionRect();
      }

      if (currentInteraction.type === 'moving') {
        if (currentInteraction.moved) {
          persistNodePositions(
            Object.entries(currentInteraction.basePositions).map(([nodeId]) => {
              const currentNode = sceneNodesRef.current.map.get(nodeId);
              return currentNode
                ? {
                    nodeId: currentNode.id,
                    x: currentNode.x,
                    y: currentNode.y,
                  }
                : {
                    nodeId,
                    x: currentInteraction.basePositions[nodeId].x,
                    y: currentInteraction.basePositions[nodeId].y,
                  };
            })
          );
        } else {
          discardNodeDraftPositions();
        }
      }

      if (currentInteraction.type === 'linking') {
        cancelPendingLink();
      }

      setInteractionState(null);
    },
    [
      cancelPendingLink,
      cancelSelectionRect,
      clearSelection,
      commitSelectionRect,
      discardNodeDraftPositions,
      persistNodePositions,
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
        endInteraction(currentInteraction);
        return;
      }

      if (currentInteraction.type === 'panning') {
        const nextInteraction = {
          ...currentInteraction,
          moved:
            currentInteraction.moved ||
            hasMovedPastThreshold(currentInteraction.startClient, { x: event.clientX, y: event.clientY }),
        };
        setCanvasOffset({
          x: currentInteraction.startOffset.x + (event.clientX - currentInteraction.startClient.x),
          y: currentInteraction.startOffset.y + (event.clientY - currentInteraction.startClient.y),
        });
        interactionRef.current = nextInteraction;
        if (nextInteraction.moved !== currentInteraction.moved) {
          setInteraction(nextInteraction);
        }
        return;
      }

      if (currentInteraction.type === 'selecting') {
        const nextScene = getScenePointFromClient(event.clientX, event.clientY);
        const nextRect = normalizeRect({
          x: currentInteraction.startScene.x,
          y: currentInteraction.startScene.y,
          width: nextScene.x - currentInteraction.startScene.x,
          height: nextScene.y - currentInteraction.startScene.y,
        });
        const intersectedNodeIds = sceneNodes.list
          .filter((node) =>
            !node.proxy &&
            rectIntersectsNode(nextRect, {
              x: node.sceneX,
              y: node.sceneY,
              width: node.width,
              height: node.height,
            })
          )
          .map((node) => node.id);
        updateSelectionRect(nextScene, { intersectedNodeIds });
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
        const currentScenePoint = getScenePointFromClient(event.clientX, event.clientY);
        const delta = {
          x: currentScenePoint.x - currentInteraction.startScene.x,
          y: currentScenePoint.y - currentInteraction.startScene.y,
        };
        const nextPositions = Object.fromEntries(
          Object.entries(currentInteraction.basePositions).map(([nodeId, point]) => {
            const currentNode = sceneNodesRef.current.map.get(nodeId);
            if (!currentNode) {
              return [
                nodeId,
                {
                  x: Math.round(point.x + delta.x),
                  y: Math.round(point.y + delta.y),
                },
              ];
            }

            return [
              nodeId,
              clampNodePlacement(
                {
                  x: point.x + delta.x,
                  y: point.y + delta.y,
                },
                currentNode,
                sceneNodesRef.current.size
              ),
            ];
          })
        );
        updateNodePositionsInDraft(
          Object.entries(nextPositions).map(([refNodeId, point]) => ({
            nodeId: refNodeId,
            x: point.x,
            y: point.y,
          }))
        );
        const nextInteraction = {
          ...currentInteraction,
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
        const currentScenePoint = getScenePointFromClient(event.clientX, event.clientY);
        setInteractionState({
          ...currentInteraction,
          currentScenePoint,
          moved: currentInteraction.moved || hasMovedPastThreshold(currentInteraction.sourceScenePoint, currentScenePoint),
        });
      }
    };

    const handleMouseUp = () => {
      endInteraction(interactionRef.current);
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
    endInteraction,
    isActive,
    setCanvasOffset,
    setInteractionState,
    updateNodePositionsInDraft,
    updateSelectionRect,
  ]);

  const handleCanvasWheel = useCallback((event: WheelEvent) => {
    if (!isActive || interactionRef.current) {
      return;
    }

    event.preventDefault();

    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const currentScale = canvasScaleRef.current;
    const nextScale = clampZoom(currentScale * (event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));

    if (nextScale === currentScale) {
      return;
    }

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const sceneX = (pointerX - canvasViewportRef.current.x) / currentScale;
    const sceneY = (pointerY - canvasViewportRef.current.y) / currentScale;

    setCanvasScaleState(nextScale);
    setCanvasOffset({
      x: pointerX - sceneX * nextScale,
      y: pointerY - sceneY * nextScale,
    });
  }, [isActive, setCanvasOffset, setCanvasScaleState]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    surface.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => {
      surface.removeEventListener('wheel', handleCanvasWheel);
    };
  }, [handleCanvasWheel]);

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isActive) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('[data-topology-node="true"], [data-topology-link="true"]')) {
      return;
    }

    if (event.button === 2) {
      event.preventDefault();
      const startClient = { x: event.clientX, y: event.clientY };
      setInteractionState({
        type: 'panning',
        startClient,
        startOffset: canvasViewport,
        moved: false,
      });
      return;
    }

    if (event.button === 0) {
      const startScene = getScenePointFromClient(event.clientX, event.clientY);
      beginSelectionRect(startScene);
      setInteractionState({
        type: 'selecting',
        startScene,
        currentScene: startScene,
        moved: false,
      });
    }
  };

  const handleNodeMouseDown = (event: React.MouseEvent<HTMLDivElement>, nodeId: string) => {
    const node = sceneNodes.map.get(nodeId);
    if (!node) {
      return;
    }

    if (event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
      if (!node.connectableSource) {
        return;
      }

      const sourceCenter = getNodeCenter({
        x: node.sceneX,
        y: node.sceneY,
        width: node.width,
        height: node.height,
      });
      startLinkCreation(node.id);
      setInteractionState({
        type: 'linking',
        sourceNodeId: node.id,
        sourceScenePoint: sourceCenter,
        currentScenePoint: sourceCenter,
        moved: false,
      });
      return;
    }

    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();

    if (!node.movable || node.proxy) {
      selectNode(node.id);
      return;
    }

    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const nextSelectionIds = selectedNodeIds.includes(node.id) && !additive ? selectedNodeIds : additive ? [...selectedNodeIds, node.id] : [node.id];
    if (additive) {
      selectNode(node.id, { additive: true });
    } else {
      setNodeSelection(nextSelectionIds);
    }
    const movableNodes = nextSelectionIds
      .map((id) => sceneNodes.map.get(id))
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate != null && candidate.movable && candidate.local);
    const basePositions = Object.fromEntries(
      movableNodes.map((candidate) => [
        candidate.id,
        {
          x: candidate.x,
          y: candidate.y,
        },
      ])
    );
    if (Object.keys(basePositions).length === 0) {
      return;
    }

    const startScene = getScenePointFromClient(event.clientX, event.clientY);
    setInteractionState({
      type: 'moving',
      startClient: { x: event.clientX, y: event.clientY },
      startScene,
      nodeIds: nextSelectionIds,
      basePositions,
      moved: false,
    });
  };

  const handleNodeMouseUp = (event: React.MouseEvent<HTMLDivElement>, nodeId: string) => {
    if (interaction?.type === 'linking' && event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
      finishLinkCreation(nodeId);
      setInteractionState(null);
      return;
    }

    if (interaction?.type === 'moving' && event.button === 0 && !interaction.moved) {
      event.stopPropagation();
      selectNode(nodeId, {
        additive: event.shiftKey || event.metaKey || event.ctrlKey,
      });
    }
  };

  return (
    <div className="snn-topology-editor" data-testid="topology-editor">
      <div className="topology-meta-hidden" data-testid="topology-runtime-summary" aria-hidden="true">
        <span data-testid="topology-draft-vision-cells">{visionCells}</span>
        <span data-testid="topology-draft-input-count">{draftSummary.inputSignalCount}</span>
        <span data-testid="topology-draft-output-count">{draftSummary.outputSignalCount}</span>
        <span data-testid="topology-draft-neuron-count">{draftSummary.neuronCount}</span>
        <span data-testid="topology-draft-synapse-count">{draftSummary.leafLinkCount}</span>
        <span data-testid="topology-draft-validation-count">{draftIssues.length}</span>
        <span data-testid="topology-runtime-state">{runtimeStatus.state}</span>
        <span data-testid="topology-runtime-status-label">{runtimeStatusLabel}</span>
        <span data-testid="topology-runtime-validation-count">{runtimeValidationCount}</span>
        <span data-testid="topology-runtime-input-count">{runtimeStatus.appliedSummary.inputSignalCount}</span>
        <span data-testid="topology-runtime-output-count">{runtimeStatus.appliedSummary.outputSignalCount}</span>
        <span data-testid="topology-runtime-neuron-count">{runtimeStatus.appliedSummary.neuronCount}</span>
        <span data-testid="topology-runtime-synapse-count">{runtimeStatus.appliedSummary.leafLinkCount}</span>
        <span data-testid="topology-runtime-message">{runtimeMessage}</span>
        <span data-testid="topology-runtime-active-node-count">{runtimeActivity.activeNodeIds.length}</span>
        <span data-testid="topology-runtime-active-node-ids">{runtimeActivity.activeNodeIds.join('|')}</span>
      </div>

      <div
        ref={surfaceRef}
        className={[
          'topology-surface',
          interaction?.type === 'panning' ? 'is-panning' : '',
          interaction?.type === 'selecting' ? 'is-marqueeing' : '',
          interaction?.type === 'linking' ? 'is-linking' : '',
        ].join(' ')}
        data-testid="topology-canvas"
        style={{
          width: Math.max(width, 1),
          height: Math.max(height, 1),
        }}
        onContextMenu={(event) => event.preventDefault()}
        onMouseDown={handleCanvasMouseDown}
      >
        {pendingLinkSourceId && (
          <div className="topology-pending-link" data-testid="topology-pending-link">
            右键拖到目标叶子节点完成连接
          </div>
        )}

        <div
          className="topology-scene"
          data-testid="topology-scene"
          style={{
            width: sceneNodes.size.width,
            height: sceneNodes.size.height,
            transform: `translate(${canvasViewport.x}px, ${canvasViewport.y}px) scale(${canvasScale})`,
            transformOrigin: '0 0',
          }}
        >
          <svg className="topology-links" aria-hidden="true">
            {links.map((link) => {
              const fromNode = sceneNodes.map.get(link.fromNodeId);
              const toNode = sceneNodes.map.get(link.toNodeId);
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
              const selected = selection.linkId === link.id;

              return (
                <g
                  key={link.id}
                  className={`topology-link ${link.aggregate ? 'is-aggregate' : 'is-leaf'} ${selected ? 'is-selected' : ''}`}
                  data-testid={`topology-link-${link.id}`}
                  data-topology-link="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    selectLink(link.id);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (!link.aggregate) {
                      openLinkDetail(link.id);
                    }
                  }}
                >
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                  <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>
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

          {sceneNodes.list.map((node) => {
            const selected = selectedNodeIds.includes(node.id);
            const active = activeViewNodeIds.has(node.id);
            const pending = pendingLinkSourceId === node.id;
            const nodeClassName = [
              'topology-node',
              node.leaf ? 'is-leaf' : 'is-group',
              `is-${node.kind}`,
              selected ? 'is-selected' : '',
              active ? 'is-active' : '',
              pending ? 'is-pending' : '',
              node.proxy ? 'is-proxy' : '',
            ].join(' ');

            return (
              <div
                key={node.id}
                className={nodeClassName}
                data-testid={`topology-node-${node.id}`}
                data-topology-node="true"
                style={{
                  left: node.sceneX,
                  top: node.sceneY,
                  width: node.width,
                  height: node.height,
                }}
                onMouseDown={(event) => handleNodeMouseDown(event, node.id)}
                onMouseUp={(event) => handleNodeMouseUp(event, node.id)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  const action = getNodeDoubleClickAction(node.id);
                  if (action === 'navigate') {
                    navigateTo(node.refNodeId);
                    return;
                  }

                  if (action === 'edit') {
                    openNodeDetail(node.refNodeId);
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

      <div className="topology-meta-hidden" data-testid="topology-state-summary" aria-hidden="true">
        <span data-testid="topology-node-count">{nodes.length}</span>
        <span data-testid="topology-synapse-count">{links.filter((link) => !link.aggregate).length}</span>
        <span data-testid="topology-selected-count">{selectedCount}</span>
        <span data-testid="topology-selected-node">{selectedNodeId ?? 'none'}</span>
        <span data-testid="topology-selected-link">{selectedLinkId ?? 'none'}</span>
        <span data-testid="topology-selected-synapse">{selectedLinkId ?? 'none'}</span>
        <span data-testid="topology-vision-cells">{visionCells}</span>
        <span data-testid="topology-input-count">{draftSummary.inputSignalCount}</span>
        <span data-testid="topology-output-count">{draftSummary.outputSignalCount}</span>
        <span data-testid="topology-validation-count">{draftIssues.length}</span>
        <span data-testid="topology-node-centers">{nodeCentersSummary}</span>
        <span data-testid="topology-scope">{currentScope}</span>
        <span data-testid="topology-canvas-offset">{`${Math.round(canvasViewport.x)},${Math.round(canvasViewport.y)}`}</span>
        <span data-testid="topology-canvas-scale">{canvasScale.toFixed(2)}</span>
      </div>

      {showDetailModal && (
        <div
          className="modal-overlay"
          data-testid="topology-detail-modal-overlay"
          onClick={closeDetailModal}
        >
          <div
            className="modal-content"
            data-testid="topology-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="topology-detail-header">
              <button
                type="button"
                className="topology-detail-close"
                data-testid="topology-detail-close"
                onClick={closeDetailModal}
              >
                关闭
              </button>
            </div>
            {showDetailModal.type === 'node' && activeNode && activeNode.kind === 'neuron' && activeNeuronParameters && (
              <NeuronDetailEditor
                neuron={{
                  id: activeNode.id,
                  label: activeNode.label,
                  params: activeNeuronParameters,
                }}
                onUpdate={(updatedNeuron) => {
                  const parameterOverrides: Record<string, LiteralValue> = {
                    a: updatedNeuron.params.a,
                    b: updatedNeuron.params.b,
                    c: updatedNeuron.params.c,
                    d: updatedNeuron.params.d,
                    threshold: updatedNeuron.params.threshold,
                  };
                  updateNodeLabelAndParams(activeNode.id, {
                    label: updatedNeuron.label,
                    parameterOverrides,
                  });
                }}
              />
            )}
            {showDetailModal.type === 'node' && activeNode && activeNode.kind === 'signal' && (
              <NeuronDetailEditor
                neuron={{
                  id: activeNode.id,
                  label: activeNode.label,
                  params: DEFAULT_SIGNAL_PARAMS,
                  readonly: true,
                  description: 'Signal adapter leaf 仅编辑标签；参数由模型层定义。',
                }}
                onUpdate={(updatedNeuron) => {
                  updateNodeLabelAndParams(activeNode.id, {
                    label: updatedNeuron.label,
                  });
                }}
              />
            )}
            {showDetailModal.type === 'link' && activeLink && (
              <SynapseDetailEditor
                synapse={{
                  id: activeLink.id,
                  from: activeLink.from.nodeId,
                  to: activeLink.to.nodeId,
                  weight: activeLink.weight,
                }}
                onUpdate={(updatedSynapse) => {
                  updateLinkWeight(activeLink.id, updatedSynapse.weight);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DEFAULT_SIGNAL_PARAMS = {
  a: 0,
  b: 0,
  c: 0,
  d: 0,
  threshold: 0,
};

export default SNNTopologyEditor;
