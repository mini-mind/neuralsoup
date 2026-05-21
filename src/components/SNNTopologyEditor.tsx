import React, { useEffect } from 'react';
import { type GraphIRDocument } from '../domain/brain';
import type { GraphIRRuntimeActivitySnapshot, GraphIRRuntimeStatus } from '../types/graphIRRuntime';
import GraphDetailModal from './editor/graph/GraphDetailModal';
import GraphTopologyCanvas from './editor/graph/GraphTopologyCanvas';
import GraphTopologyDiagnostics from './editor/graph/GraphTopologyDiagnostics';
import { useGraphCanvasAssembly } from './editor/graph/useGraphCanvasAssembly';
import { useGraphTopologyDiagnosticsModel } from './editor/graph/useGraphTopologyDiagnosticsModel';
import type { GraphPathItem } from './editor/types';
import { useSNNTopologyState, type GraphDocumentChangeOptions } from './hooks/useSNNTopologyState';
import './SNNTopologyEditor.css';

interface SNNTopologyEditorProps {
  width: number;
  height: number;
  document: GraphIRDocument;
  visionCells?: number;
  onDocumentChange?: (document: GraphIRDocument, options?: GraphDocumentChangeOptions) => void;
  onGraphPathChange?: (graphPath: GraphPathItem[]) => void;
  onGraphPathNavigateRegister?: (navigate: (pathId: string) => void) => void;
  runtimeStatus: GraphIRRuntimeStatus;
  runtimeActivity: GraphIRRuntimeActivitySnapshot;
  isActive?: boolean;
}

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
    currentContainerKind,
    nodes,
    links,
    selectedNodeIds,
    selectedNodeId,
    selectedLinkId,
    selectionRect,
    showDetailModal,
    activeViewNodeIds,
    activeNode,
    activeLink,
    activeNeuronParameters,
    navigateTo,
    navigateToBreadcrumb,
    selectNodes,
    selectNode,
    selectLink,
    clearSelection,
    beginSelectionRect,
    updateSelectionRect,
    cancelSelectionRect,
    openNodeDetail,
    openLinkDetail,
    closeDetailModal,
    getNodeDoubleClickAction,
    connectSourceNodesToTarget,
    updateNodePositionsInDraft,
    discardNodeDraftPositions,
    persistNodePositions,
    removeSelected,
    addNeuronAt,
    addNeuronGroupAt,
    createNeuronAndConnectAt,
    aggregateSelectedNodes,
    ungroupNode,
    toggleGroupExpanded,
    setCanvasOffset: setCanvasOffsetState,
    setCanvasScale: setCanvasScaleState,
    canvasViewport,
    canvasScale,
    updateNodeLabelAndParams,
    updateLinkWeight,
  } = state;

  const selectedCount = selectedNodeIds.length + (selectedLinkId ? 1 : 0);

  const canCreateNeuronHere = currentContainerKind === 'neuron-group';
  const canAggregateSelection = currentContainerKind === 'neuron-group' && selectedNodeIds.length > 1;
  const canUngroupSelection = currentContainerKind === 'neuron-group' && selectedNodeIds.length === 1;

  const {
    surfaceRef,
    sceneRef,
    scene,
    nodeCentersSummary,
    nodeViewPositionsSummary,
    interaction,
    contextMenu,
    contextMenuPosition,
    pendingLinkLine,
    closeContextMenu,
    handleCanvasMouseDown,
    handleCanvasContextMenu,
  } = useGraphCanvasAssembly({
    width,
    height,
    isActive,
    currentScope,
    scopeKey,
    nodes,
    selectedNodeIds,
    canCreateNeuronHere,
    canAggregateSelection,
    canUngroupSelection,
    canvasViewport,
    setCanvasOffset: setCanvasOffsetState,
    canvasScale,
    setCanvasScale: setCanvasScaleState,
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
    closeDetailModal,
    hasOpenDetailModal: showDetailModal !== null,
    removeSelected,
  });

  const diagnostics = useGraphTopologyDiagnosticsModel({
    document,
    visionCells,
    runtimeStatus,
    runtimeActivity,
    nodeCount: nodes.length,
    synapseCount: links.filter((link) => !link.aggregate).length,
    selectedCount,
    selectedNodeId,
    selectedLinkId,
    nodeCentersSummary,
    nodeViewPositionsSummary,
    currentScope,
    canvasViewport,
    canvasScale,
  });

  useEffect(() => {
    onGraphPathChange?.(breadcrumbs.map((item) => ({ id: item.id, label: item.label })));
  }, [breadcrumbs, onGraphPathChange]);

  useEffect(() => {
    if (!onGraphPathNavigateRegister) {
      return;
    }

    onGraphPathNavigateRegister(navigateToBreadcrumb);
  }, [navigateToBreadcrumb, onGraphPathNavigateRegister]);

  return (
    <div className="snn-topology-editor" data-testid="topology-editor">
      <GraphTopologyDiagnostics
        {...diagnostics}
      />

      <GraphTopologyCanvas
        surfaceRef={surfaceRef}
        sceneRef={sceneRef}
        width={width}
        height={height}
        scene={scene}
        canvasViewport={canvasViewport}
        canvasScale={canvasScale}
        interaction={interaction}
        contextMenu={contextMenu}
        contextMenuPosition={contextMenuPosition}
        pendingLinkLine={pendingLinkLine}
        selectionRect={selectionRect}
        links={links}
        selectedNodeIds={selectedNodeIds}
        selectedLinkId={selectedLinkId}
        activeViewNodeIds={activeViewNodeIds}
        canCreateNeuronHere={canCreateNeuronHere}
        canAggregateSelection={canAggregateSelection}
        canUngroupSelection={canUngroupSelection}
        onCanvasContextMenu={handleCanvasContextMenu}
        onCanvasMouseDown={handleCanvasMouseDown}
        onSelectLink={selectLink}
        onOpenLinkDetail={openLinkDetail}
        onNavigateToNode={navigateTo}
        onOpenNodeDetail={openNodeDetail}
        getNodeDoubleClickAction={getNodeDoubleClickAction}
        onCloseContextMenu={closeContextMenu}
        onAddNeuronAt={addNeuronAt}
        onAddNeuronGroupAt={addNeuronGroupAt}
        onAggregateSelectedNodes={aggregateSelectedNodes}
        onUngroupNode={ungroupNode}
        onToggleGroupExpanded={toggleGroupExpanded}
      />

      <GraphDetailModal
        detailModal={showDetailModal}
        activeNode={activeNode}
        activeLink={activeLink}
        activeNeuronParameters={activeNeuronParameters}
        onClose={closeDetailModal}
        onUpdateNode={updateNodeLabelAndParams}
        onUpdateLink={updateLinkWeight}
      />
    </div>
  );
};

export default SNNTopologyEditor;
