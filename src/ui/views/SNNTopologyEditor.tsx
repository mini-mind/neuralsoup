import React, { useCallback, useState, useEffect } from "react";
import { globalState } from "../../core/services/GlobalState";
import { IzhikevichNeuron } from "../../core/entities/neuron";
import { InteractionHandler } from "../services/InteractionHandler";
import { CanvasGraphManager } from "../services/CanvasGraphManager";
import { VisualReceptorGroupManager } from "../services/VisualReceptorGroupManager";
import { RotationControllerGroupManager } from "../services/RotationControllerGroupManager";
import { NeuronAdapter } from "../adapters/neuron.adapter";
import { SynapseAdapter } from "../adapters/synapse.adapter";
import { GraphEditorProps, SelectionBox, InteractionState, NodeGroup, Vector2D, CanvasTransform, ManagedEdge } from "../types/editor.types";
import "../components/SNNTopologyEditor.css";
import { SNNCanvas } from "../components/SNNCanvas";
import NeuronDetailEditor from "../components/NeuronDetailEditor";
import SynapseDetailEditor from "../components/SynapseDetailEditor";
import { useLanguage } from "../../contexts/LanguageContext";

const GraphEditor = React.forwardRef<HTMLDivElement, GraphEditorProps>(({
  width,
  height,
}, ref) => {
  const [selectionBox, setSelectionBox] = useState<SelectionBox>({
    startX: 0, startY: 0, endX: 0, endY: 0, visible: false
  });
  
  const [interactionState, setInteractionState] = useState<InteractionState>({
    isDragging: false,
    isSelecting: false,
    isPanning: false,
    isCreatingEdge: false,
    dragStartPos: { x: 0, y: 0 },
    draggedNodes: [],
    edgeStartNodeId: null,
    lastMousePos: { x: 0, y: 0 },
    selectedNodes: [],
    selectedEdges: [],
    selectedGroups: [],
    draggedGroups: []
  });

  const [nodeGroups, setNodeGroups] = useState<NodeGroup[]>([]);
  const [graphManager, setGraphManager] = useState<CanvasGraphManager | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { t } = useLanguage();

  const { networkTopology, snnTopology, selectedNodeId, selectedEdgeId } = globalState.useStore(s => ({ 
    networkTopology: s.networkTopology,
    snnTopology: s.snnTopology,
    selectedNodeId: s.selectedNodeId,
    selectedEdgeId: s.selectedEdgeId
  }));

  // 初始化图管理器
  useEffect(() => {
    if (networkTopology && !graphManager) {
      setGraphManager(new CanvasGraphManager(networkTopology));
    }
  }, [networkTopology, graphManager]);

  // Initialize default node groups
  useEffect(() => {
    if (snnTopology && networkTopology && !initialized) {
      // Create default visual receptor group (top of canvas viewport)
      const visualResult = VisualReceptorGroupManager.createGroup({ x: 100, y: 50 });
      // Create rotation controller group (bottom of canvas viewport)
      const rotationResult = RotationControllerGroupManager.createGroup({ x: 100, y: 400 });

      // Group nodes are not added to network topology, they have their own processing logic
      // Only update snnTopology for canvas rendering
      const allNewNodes = [...visualResult.nodes, ...rotationResult.nodes];

      // Update state
      globalState.setState({
        snnTopology: {
          ...snnTopology,
          nodes: [...snnTopology.nodes, ...allNewNodes]
        }
      });
      
      setNodeGroups([visualResult.group, rotationResult.group]);
      setInitialized(true);
    }
  }, [snnTopology, networkTopology, initialized]);

  // 获取当前画布变换
  const getCanvasTransform = (): CanvasTransform => ({
    offset: snnTopology?.canvasOffset || { x: 0, y: 0 },
    scale: snnTopology?.canvasScale || 1
  });

  // 鼠标按下处理
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!snnTopology) return;

    const canvasPos = InteractionHandler.getCanvasPosition(e);
    const worldPos = InteractionHandler.getWorldPosition(e, getCanvasTransform());

    // 检查是否点击了收起按钮
    const clickedButton = InteractionHandler.findCollapseButtonAtPosition(
      worldPos, 
      nodeGroups, 
      snnTopology.canvasScale, 
      snnTopology.canvasOffset
    );
    
    if (clickedButton) {
      // 切换组的收起状态
      const updatedGroups = nodeGroups.map(group => {
        if (group.id === clickedButton.id) {
          const newCollapsed = !group.collapsed;
          
          if (newCollapsed && networkTopology) {
            // 收起组时，记录连接到组内节点的边
            const managedEdges: ManagedEdge[] = [];
            const allEdges = networkTopology.getAllEdges();
            
            allEdges.forEach(edge => {
              const isFromNodeInGroup = group.neurons.includes(edge.fromNodeId);
              const isToNodeInGroup = group.neurons.includes(edge.toNodeId);
              
              if (isFromNodeInGroup || isToNodeInGroup) {
                managedEdges.push({
                  edgeId: edge.id,
                  originalFromNodeId: edge.fromNodeId,
                  originalToNodeId: edge.toNodeId,
                  isFromNodeInGroup,
                  isToNodeInGroup
                });
              }
            });
            
            return { 
              ...group, 
              collapsed: newCollapsed,
              managedEdges
            };
          } else {
            // 展开组时，清除托管的边信息
            return { 
              ...group, 
              collapsed: newCollapsed,
              managedEdges: []
            };
          }
        }
        return group;
      });
      setNodeGroups(updatedGroups);
      return;
    }

    // 首先从网络拓扑中查找节点
    let clickedNode = InteractionHandler.findNodeAtPosition(worldPos, networkTopology);
    
    // 如果网络拓扑中没有找到，从snnTopology中查找组内节点
    if (!clickedNode && snnTopology.nodes) {
      clickedNode = snnTopology.nodes.find((node: any) => {
        const dist = Math.sqrt((node.x - worldPos.x) ** 2 + (node.y - worldPos.y) ** 2);
        return dist < 20;
      });
    }
    
    const clickedGroup = clickedNode ? null : InteractionHandler.findGroupAtPosition(worldPos, nodeGroups);
    const clickedEdge = clickedNode || clickedGroup ? null : InteractionHandler.findEdgeAtPosition(worldPos, networkTopology);

    if (e.button === 0) { // 左键
      if (e.ctrlKey && clickedNode) {
        // Ctrl+左键：开始创建边
        // 效应器（旋转控制器）不能作为起点
        if (clickedNode.type === 'voltage_accumulator') {
          console.warn("Effector nodes (Rotation Controllers) cannot be the starting point of an edge.");
          return;
        }
        
        setInteractionState(prev => ({
          ...prev,
          isCreatingEdge: true,
          edgeStartNodeId: clickedNode.id,
          lastMousePos: canvasPos
        }));
      } else if (clickedNode) {
        // 左键点击节点：选中并准备拖动
        handleNodeSelection(clickedNode, e.shiftKey, canvasPos);
      } else if (clickedGroup) {
        // 左键点击节点组：选中并准备拖动
        handleGroupSelection(clickedGroup, e.shiftKey, canvasPos);
      } else if (clickedEdge) {
        // 左键点击边：选中边
        handleEdgeSelection(clickedEdge, e.shiftKey);
      } else {
        // 左键点击空白：开始框选
        startBoxSelection(canvasPos);
      }
    } else if (e.button === 2) { // 右键
      // 右键拖动空白：平移画布
      setInteractionState(prev => ({
        ...prev,
        isPanning: true,
        dragStartPos: canvasPos,
        lastMousePos: canvasPos
      }));
    }
  };

  // 处理节点选择
  const handleNodeSelection = (node: any, isShiftClick: boolean, canvasPos: Vector2D) => {
    // 检查节点是否在组内，如果在组内则选择整个组进行拖动
    const parentGroup = nodeGroups.find(g => g.neurons.includes(node.id));
    
    if (parentGroup) {
      // 如果节点在组内，选择组进行拖动
      const isAlreadySelected = interactionState.selectedGroups.includes(parentGroup.id);
      let newSelectedGroups: string[];
      
      if (isShiftClick) {
        newSelectedGroups = isAlreadySelected 
          ? interactionState.selectedGroups.filter(id => id !== parentGroup.id)
          : [...interactionState.selectedGroups, parentGroup.id];
      } else {
        newSelectedGroups = [parentGroup.id];
      }
      
      globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
      setInteractionState(prev => ({
        ...prev,
        isDragging: true,
        dragStartPos: canvasPos,
        draggedGroups: newSelectedGroups,
        selectedGroups: newSelectedGroups,
        selectedNodes: [],
        selectedEdges: [],
        lastMousePos: canvasPos
      }));
      return;
    }

    // 普通节点选择逻辑
    const isAlreadySelected = interactionState.selectedNodes.includes(node.id);
    let newSelectedNodes: string[];
    
    if (isShiftClick) {
      newSelectedNodes = isAlreadySelected 
        ? interactionState.selectedNodes.filter(id => id !== node.id)
        : [...interactionState.selectedNodes, node.id];
    } else {
      newSelectedNodes = [node.id];
    }
    
    globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
    setInteractionState(prev => ({
      ...prev,
      isDragging: true,
      dragStartPos: canvasPos,
      draggedNodes: newSelectedNodes,
      selectedNodes: newSelectedNodes,
      selectedEdges: [],
      selectedGroups: [],
      lastMousePos: canvasPos
    }));
  };

  // 处理节点组选择
  const handleGroupSelection = (group: NodeGroup, isShiftClick: boolean, canvasPos: Vector2D) => {
    const isAlreadySelected = interactionState.selectedGroups.includes(group.id);
    let newSelectedGroups: string[];
    
    if (isShiftClick) {
      newSelectedGroups = isAlreadySelected 
        ? interactionState.selectedGroups.filter(id => id !== group.id)
        : [...interactionState.selectedGroups, group.id];
    } else {
      newSelectedGroups = [group.id];
    }
    
    globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
    setInteractionState(prev => ({
      ...prev,
      isDragging: true,
      dragStartPos: canvasPos,
      draggedGroups: newSelectedGroups,
      selectedGroups: newSelectedGroups,
      selectedNodes: [],
      selectedEdges: [],
      lastMousePos: canvasPos
    }));
  };

  // 处理边选择
  const handleEdgeSelection = (edge: any, isShiftClick: boolean) => {
    const isAlreadySelected = interactionState.selectedEdges.includes(edge.id);
    let newSelectedEdges: string[];
    
    if (isShiftClick) {
      newSelectedEdges = isAlreadySelected 
        ? interactionState.selectedEdges.filter(id => id !== edge.id)
        : [...interactionState.selectedEdges, edge.id];
    } else {
      newSelectedEdges = [edge.id];
    }
    
    globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
    setInteractionState(prev => ({
      ...prev,
      selectedNodes: [],
      selectedEdges: newSelectedEdges
    }));
  };

  // 开始框选
  const startBoxSelection = (canvasPos: Vector2D) => {
    globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
    setSelectionBox({
      startX: canvasPos.x,
      startY: canvasPos.y,
      endX: canvasPos.x,
      endY: canvasPos.y,
      visible: true
    });
    setInteractionState(prev => ({
      ...prev,
      isSelecting: true,
      dragStartPos: canvasPos,
      selectedNodes: [],
      selectedEdges: [],
      lastMousePos: canvasPos
    }));
  };

  // 鼠标移动处理
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!snnTopology) return;

    const canvasPos = InteractionHandler.getCanvasPosition(e);
    setInteractionState(prev => ({ ...prev, lastMousePos: canvasPos }));

    const dx = canvasPos.x - interactionState.lastMousePos.x;
    const dy = canvasPos.y - interactionState.lastMousePos.y;

    if (interactionState.isDragging && interactionState.draggedNodes.length > 0) {
      // 拖动节点
      InteractionHandler.handleNodeDrag(
        interactionState.draggedNodes,
        dx,
        dy,
        snnTopology.canvasScale,
        networkTopology,
        nodeGroups
      );
      if (networkTopology) {
        globalState.setState({ networkTopology });
      }
    } else if (interactionState.isDragging && interactionState.draggedGroups.length > 0) {
      // 拖动节点组
      const result = InteractionHandler.handleGroupDrag(
        nodeGroups,
        interactionState.draggedGroups,
        dx,
        dy,
        snnTopology.canvasScale,
        networkTopology,
        snnTopology
      );
      setNodeGroups(result.groups);
      
      // 更新全局状态
      globalState.setState({ 
        networkTopology,
        snnTopology: { ...snnTopology, nodes: result.nodes }
      });
    } else if (interactionState.isSelecting) {
      // 更新选择框
      setSelectionBox(prev => ({
        ...prev,
        endX: canvasPos.x,
        endY: canvasPos.y
      }));
    } else if (interactionState.isPanning) {
      // 平移画布
      globalState.setState({
        snnTopology: {
          ...snnTopology,
          canvasOffset: {
            x: snnTopology.canvasOffset.x + dx,
            y: snnTopology.canvasOffset.y + dy
          }
        }
      });
    }
  };

  // 鼠标抬起处理
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvasPos = InteractionHandler.getCanvasPosition(e);

    if (interactionState.isCreatingEdge && interactionState.edgeStartNodeId) {
      // 完成边创建
      const worldPos = InteractionHandler.getWorldPosition(e, getCanvasTransform());
      
      // 查找目标节点（包括组内节点）
      let targetNode = InteractionHandler.findNodeAtPosition(worldPos, networkTopology);
      if (!targetNode && snnTopology.nodes) {
        targetNode = snnTopology.nodes.find((node: any) => {
          const dist = Math.sqrt((node.x - worldPos.x) ** 2 + (node.y - worldPos.y) ** 2);
          return dist < 20;
        });
      }

      if (targetNode && targetNode.id !== interactionState.edgeStartNodeId && graphManager) {
        // 感受器（视觉感受器）不能作为终点
        if (targetNode.type === 'voltage_input') {
          console.warn("Sensor nodes (Visual Receptors) cannot be the end point of an edge.");
        } else {
          // 创建边连接
          const success = graphManager.createEdge(interactionState.edgeStartNodeId, targetNode.id);
          if (success && networkTopology) {
            globalState.setState({ networkTopology });
          }
        }
      }

      setInteractionState(prev => ({
        ...prev,
        isCreatingEdge: false,
        edgeStartNodeId: null
      }));
    } else if (interactionState.isSelecting) {
      // 完成框选
      const selectedNodes = InteractionHandler.getNodesInSelectionBox(
        selectionBox,
        getCanvasTransform(),
        networkTopology
      );
      setSelectionBox(prev => ({ ...prev, visible: false }));
      
      if (selectedNodes.length > 0) {
        setInteractionState(prev => ({
          ...prev,
          selectedNodes: selectedNodes.map(n => n.id),
          selectedEdges: []
        }));
      }
    }

    // 重置所有交互状态
    setInteractionState({
      isDragging: false,
      isSelecting: false,
      isPanning: false,
      isCreatingEdge: false,
      dragStartPos: { x: 0, y: 0 },
      draggedNodes: [],
      edgeStartNodeId: null,
      lastMousePos: canvasPos,
      selectedNodes: interactionState.selectedNodes,
      selectedEdges: interactionState.selectedEdges,
      selectedGroups: interactionState.selectedGroups,
      draggedGroups: []
    });
  };

  // 双击处理
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!snnTopology) return;

    const worldPos = InteractionHandler.getWorldPosition(e, getCanvasTransform());
    const clickedNode = InteractionHandler.findNodeAtPosition(worldPos, networkTopology);
    const clickedGroup = clickedNode ? null : InteractionHandler.findGroupAtPosition(worldPos, nodeGroups);
    const clickedEdge = clickedNode || clickedGroup ? null : InteractionHandler.findEdgeAtPosition(worldPos, networkTopology);
    
    // 检查是否点击了组内的特殊节点
    let clickedSpecialNode = null;
    if (!clickedNode && snnTopology.nodes) {
      // 从snnTopology中查找特殊节点
      clickedSpecialNode = snnTopology.nodes.find((node: any) => {
        const dist = Math.sqrt((node.x - worldPos.x) ** 2 + (node.y - worldPos.y) ** 2);
        return dist < 20 && (node.type === 'voltage_input' || node.type === 'voltage_accumulator');
      });
    }
    
    if (clickedNode) {
      // 检查是否为特殊节点类型，不弹窗
      if (clickedNode.type === 'voltage_input' || clickedNode.type === 'voltage_accumulator') {
        return; // 电压输入和电压累积节点不弹窗
      }
      
      // 双击节点：弹出编辑弹窗
      globalState.setState({ selectedNodeId: clickedNode.id, selectedEdgeId: null });
      setInteractionState(prev => ({
        ...prev,
        selectedNodes: [],
        selectedEdges: []
      }));
    } else if (clickedSpecialNode) {
      // 点击了特殊节点，不弹窗
      return;
    } else if (clickedGroup) {
      // 双击节点组：切换收起/展开状态
      const updatedGroups = nodeGroups.map(group => {
        if (group.id === clickedGroup.id) {
          return { ...group, collapsed: !group.collapsed };
        }
        return group;
      });
      setNodeGroups(updatedGroups);
    } else if (clickedEdge) {
      // 双击边：弹出突触编辑弹窗
      globalState.setState({ selectedNodeId: null, selectedEdgeId: clickedEdge.id });
      setInteractionState(prev => ({
        ...prev,
        selectedNodes: [],
        selectedEdges: []
      }));
    } else {
      // 双击空白：创建新节点或节点组
      handleDoubleClickCreation(e, worldPos);
    }
  };

  // Handle double-click creation
  const handleDoubleClickCreation = (e: React.MouseEvent, worldPos: Vector2D) => {
    // Only allow creating regular nodes, no longer support creating groups
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'brain',
      x: worldPos.x,
      y: worldPos.y,
      neuron: new IzhikevichNeuron(`node-${Date.now()}`, 'hidden', worldPos.x, worldPos.y)
    };

    // Add node to network topology
    if (networkTopology) {
      networkTopology.addNode(newNode.neuron);
    }
    
    globalState.setState({
      snnTopology: {
        ...snnTopology!,
        nodes: [...snnTopology!.nodes, newNode]
      }
    });
  };

  // 滚轮缩放处理
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    if (snnTopology) {
      const scaleAmount = -e.deltaY * 0.001;
      const newScale = Math.max(0.1, Math.min(3, snnTopology.canvasScale + scaleAmount));
      globalState.setState({
        snnTopology: { ...snnTopology, canvasScale: newScale }
      });
    }
  }, [snnTopology]);

  // Get selected node and edge data
  const selectedNode = selectedNodeId && networkTopology ? networkTopology.getNode(selectedNodeId) : null;
  const selectedEdge = selectedEdgeId && networkTopology ? networkTopology.getEdge(selectedEdgeId) : null;

  // Update handler functions
  const handleNodeUpdate = (updatedNode: any) => {
    if (selectedNode && networkTopology) {
      NeuronAdapter.updateFromSNNNode(selectedNode, updatedNode);
      globalState.setState({ networkTopology });
      console.log('Node updated:', updatedNode);
    }
  };

  const handleEdgeUpdate = (updatedEdge: any) => {
    if (selectedEdge && graphManager) {
      graphManager.updateEdgeWeight(selectedEdge.id, updatedEdge.weight);
      globalState.setState({ networkTopology });
    }
  };

  const closeEditor = () => {
    globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
  };

  return (
    <div className="snn-topology-editor" ref={ref}>
      <SNNCanvas
        width={width}
        height={height}
        networkTopology={networkTopology}
        snnTopology={snnTopology}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        interactionState={interactionState}
        selectionBox={selectionBox}
        neuronGroups={nodeGroups}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
      
      {selectedNode && (
        <div className="detail-editor">
          <div className="detail-editor-header">
            <h4>{t('snn.details.neuron')}</h4>
            <button className="close-button" onClick={closeEditor}>×</button>
          </div>
          <NeuronDetailEditor 
            neuron={NeuronAdapter.toSNNNode(selectedNode)} 
            onUpdate={handleNodeUpdate}
          />
        </div>
      )}
      {selectedEdge && (
        <div className="detail-editor">
          <div className="detail-editor-header">
            <h4>{t('snn.details.synapse')}</h4>
            <button className="close-button" onClick={closeEditor}>×</button>
          </div>
          <SynapseDetailEditor 
            synapse={SynapseAdapter.toSynapseEditFormat(selectedEdge)} 
            onUpdate={handleEdgeUpdate}
          />
        </div>
      )}
    </div>
  );
});

export default GraphEditor;
