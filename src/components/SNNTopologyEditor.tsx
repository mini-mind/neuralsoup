import React, { useEffect } from 'react';
import type { AgentIR, AgentIRSummary, WorldRegistry } from '../domain/brain';
import type { AgentDraftStatus, AgentRuntimeActivitySnapshot, AgentRuntimeStatus } from '../types/agentRuntime';
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
  agent: AgentIR;
  graphSessionToken: string;
  visionCells?: number;
  installedSummary: AgentIRSummary;
  worldRegistry: WorldRegistry;
  onAgentChange?: (updater: (current: AgentIR) => AgentIR, options?: GraphDocumentChangeOptions) => void;
  onMirroredGraphPathSync?: (graphPath: GraphPathItem[], sourceSessionToken: string) => void;
  onBridgePathNavigatorRegister?: (navigate: (pathId: string) => void, sourceSessionToken: string) => void;
  runtimeStatus: AgentRuntimeStatus;
  draftStatus: AgentDraftStatus;
  runtimeActivity: AgentRuntimeActivitySnapshot;
  isActive?: boolean;
}

const SNNTopologyEditor: React.FC<SNNTopologyEditorProps> = ({
  width,
  height,
  agent,
  graphSessionToken,
  visionCells = 36,
  installedSummary,
  worldRegistry,
  onAgentChange,
  onMirroredGraphPathSync,
  onBridgePathNavigatorRegister,
  runtimeStatus,
  draftStatus,
  runtimeActivity,
  isActive = true,
}) => {
  const state = useSNNTopologyState({
    agent,
    worldRegistry,
    projectedVisionCellCount: visionCells,
    graphSessionToken,
    runtimeActiveNodeIds: runtimeActivity.activeNodeIds,
    onAgentChange,
  });
  const {
    breadcrumbs,
    canvasScopeKey,
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
    enterScopeFromNode,
    toggleInlineExpansionForNode,
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
    setCanvasOffset: setCanvasOffsetState,
    setCanvasSession: setCanvasSessionState,
    syncCanvasViewportForScope,
    canvasViewport,
    canvasScale,
    updateNodeLabelAndParams,
    updateLinkWeight,
  } = state;

  const handleLinkDetailUpdate = (
    linkId: string,
    payload:
      | number
      | {
          weight: number;
          delayMs?: number;
          synapseModelId?: string;
          parameterOverrides?: {
            weight?: number;
            delayMs?: number;
          };
        }
  ) => {
    if (typeof payload === 'number') {
      updateLinkWeight(linkId, payload);
      return;
    }

    updateLinkWeight(linkId, payload);
  };

  const selectedCount = selectedNodeIds.length + (selectedLinkId ? 1 : 0);

  const canCreateNeuronHere = currentContainerKind === 'neuron-group';
  const canAggregateSelection = currentContainerKind === 'neuron-group' && selectedNodeIds.length > 1;
  const canUngroupNodesHere = currentContainerKind === 'neuron-group';
  const canvasCapabilities = {
    canCreateNodeAtCanvasContext: canCreateNeuronHere,
    canAggregateSelection,
    canUngroupGroupNode: canUngroupNodesHere,
  } as const;

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
    handleNodeMouseDown,
    handleNodeContextMenu,
  } = useGraphCanvasAssembly({
    width,
    height,
    isActive,
    currentScope,
    scopeKey: canvasScopeKey,
    nodes,
    selectedNodeIds,
    capabilities: canvasCapabilities,
    canvasViewport,
    setCanvasOffset: setCanvasOffsetState,
    setCanvasSession: setCanvasSessionState,
    syncCanvasViewportForScope,
    canvasScale,
    callbacks: {
      onSelectionBoxStart: beginSelectionRect,
      onSelectionBoxUpdate: updateSelectionRect,
      onSelectionBoxCancel: cancelSelectionRect,
      onSelectionClear: clearSelection,
      onConnectNodes: connectSourceNodesToTarget,
      onCreateNodeAndConnectAt: createNeuronAndConnectAt,
      onDraftNodePositionsUpdate: updateNodePositionsInDraft,
      onDraftNodePositionsDiscard: discardNodeDraftPositions,
      onNodePositionsPersist: persistNodePositions,
      onNodeSelect: selectNode,
      onNodesSelect: selectNodes,
      onDetailClose: closeDetailModal,
      onSelectionRemove: removeSelected,
    },
    hasOpenDetailModal: showDetailModal !== null,
  });

  const diagnostics = useGraphTopologyDiagnosticsModel({
    agent,
    visionCells,
    installedSummary,
    runtimeStatus,
    draftStatus,
    runtimeActivity,
    nodeCount: nodes.length,
    connectionCount: links.filter((link) => !link.aggregate).length,
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
    onMirroredGraphPathSync?.(
      breadcrumbs.map((item) => ({ id: item.id, label: item.label })),
      graphSessionToken
    );
  }, [breadcrumbs, graphSessionToken, onMirroredGraphPathSync]);

  useEffect(() => {
    if (!onBridgePathNavigatorRegister) {
      return;
    }

    onBridgePathNavigatorRegister(navigateToBreadcrumb, graphSessionToken);
  }, [graphSessionToken, navigateToBreadcrumb, onBridgePathNavigatorRegister]);

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
        capabilities={canvasCapabilities}
        onCanvasContextMenu={handleCanvasContextMenu}
        onCanvasMouseDown={handleCanvasMouseDown}
        onNodeMouseDown={handleNodeMouseDown}
        onNodeContextMenu={handleNodeContextMenu}
        onSelectLink={selectLink}
        onOpenLinkDetail={openLinkDetail}
        onNavigateToNode={enterScopeFromNode}
        onOpenNodeDetail={openNodeDetail}
        onCloseContextMenu={closeContextMenu}
        onAddNeuronAt={addNeuronAt}
        onAddNeuronGroupAt={addNeuronGroupAt}
        onAggregateSelectedNodes={aggregateSelectedNodes}
        onUngroupNode={ungroupNode}
        onToggleGroupExpanded={toggleInlineExpansionForNode}
      />

      <GraphDetailModal
        detailModal={showDetailModal}
        activeNode={activeNode}
        activeLink={activeLink}
        activeNeuronParameters={activeNeuronParameters}
        onClose={closeDetailModal}
        onUpdateNode={updateNodeLabelAndParams}
        onUpdateLink={handleLinkDetailUpdate}
      />
    </div>
  );
};

export default SNNTopologyEditor;
