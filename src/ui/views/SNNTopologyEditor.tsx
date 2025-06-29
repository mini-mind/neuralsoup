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
      handleGroupCollapse(clickedButton);
      return;
    }

    // 检查是否点击了标题栏（用于拖动）
    const clickedTitleBar = InteractionHandler.findTitleBarAtPosition(
      worldPos,
      nodeGroups,
      snnTopology.canvasScale,
      snnTopology.canvasOffset
    );

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
        // Ctrl+左键：多选节点
        handleNodeSelection(clickedNode, true, canvasPos); // 强制使用多选模式
      } else if (e.ctrlKey && clickedGroup) {
        // Ctrl+左键：多选组
        handleGroupSelection(clickedGroup, true, canvasPos); // 强制使用多选模式
      } else if (e.ctrlKey && clickedTitleBar) {
        // Ctrl+左键：多选组（通过标题栏）
        handleGroupSelection(clickedTitleBar, true, canvasPos);
      } else if (e.ctrlKey && clickedEdge) {
        // Ctrl+左键：多选边
        handleEdgeSelection(clickedEdge, true);
      } else if (clickedNode) {
        // 左键点击节点：选中并准备拖动
        handleNodeSelection(clickedNode, false, canvasPos);
      } else if (clickedGroup) {
        // 左键点击节点组：选中并准备拖动
        handleGroupSelection(clickedGroup, false, canvasPos);
      } else if (clickedTitleBar) {
        // 左键点击标题栏：选中并准备拖动组
        handleGroupSelection(clickedTitleBar, false, canvasPos);
      } else if (clickedEdge) {
        // 左键点击边：选中边
        handleEdgeSelection(clickedEdge, false);
      } else {
        // 左键点击空白：开始框选
        startBoxSelection(canvasPos);
      }
    } else if (e.button === 2) { // 右键
      if (e.ctrlKey && clickedNode) {
        // Ctrl+右键：开始创建边
        // 效应器（旋转控制器）不能作为起点
        if (clickedNode.type === 'voltage_accumulator') {
          console.warn(t('warning.effector-no-start'));
          return;
        }

        setInteractionState(prev => ({
          ...prev,
          isCreatingEdge: true,
          edgeStartNodeId: clickedNode.id,
          lastMousePos: canvasPos
        }));
      } else {
        // 右键拖动空白：平移画布
        setInteractionState(prev => ({
          ...prev,
          isPanning: true,
          dragStartPos: canvasPos,
          lastMousePos: canvasPos
        }));
      }
    }
  };

  // 处理节点选择
  const handleNodeSelection = (node: any, isMultiSelect: boolean, canvasPos: Vector2D) => {
    // 检查节点是否在组内，如果在组内则选择整个组进行拖动
    const parentGroup = nodeGroups.find(g => g.neurons.includes(node.id));

    if (parentGroup) {
      // 如果节点在组内，选择组进行拖动
      const isAlreadySelected = interactionState.selectedGroups.includes(parentGroup.id);
      let newSelectedGroups: string[];

      if (isMultiSelect) {
        newSelectedGroups = isAlreadySelected
          ? interactionState.selectedGroups.filter(id => id !== parentGroup.id)
          : [...interactionState.selectedGroups, parentGroup.id];
      } else {
        // 如果已经选中了这个组且有多选状态，保持多选状态进行拖动
        if (isAlreadySelected && interactionState.selectedGroups.length > 1) {
          newSelectedGroups = interactionState.selectedGroups; // 保持当前多选状态
        } else if (isAlreadySelected && interactionState.selectedGroups.length === 1) {
          newSelectedGroups = [parentGroup.id]; // 单选状态
        } else {
          newSelectedGroups = [parentGroup.id]; // 新选择
        }
      }

      globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
      setInteractionState(prev => ({
        ...prev,
        isDragging: true,
        dragStartPos: canvasPos,
        draggedGroups: [parentGroup.id], // 只拖动当前点击的组
        selectedGroups: newSelectedGroups, // 但保持多选状态
        selectedNodes: [],
        selectedEdges: [],
        lastMousePos: canvasPos
      }));
      return;
    }

    // 普通节点选择逻辑
    const isAlreadySelected = interactionState.selectedNodes.includes(node.id);
    let newSelectedNodes: string[];

    if (isMultiSelect) {
      newSelectedNodes = isAlreadySelected
        ? interactionState.selectedNodes.filter(id => id !== node.id)
        : [...interactionState.selectedNodes, node.id];
    } else {
      // 如果已经选中了这个节点且有多选状态，保持多选状态进行拖动
      if (isAlreadySelected && interactionState.selectedNodes.length > 1) {
        newSelectedNodes = interactionState.selectedNodes; // 保持当前多选状态
      } else if (isAlreadySelected && interactionState.selectedNodes.length === 1) {
        newSelectedNodes = [node.id]; // 单选状态
      } else {
        newSelectedNodes = [node.id]; // 新选择
      }
    }

    globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
    setInteractionState(prev => ({
      ...prev,
      isDragging: true,
      dragStartPos: canvasPos,
      draggedNodes: [node.id], // 只拖动当前点击的节点
      selectedNodes: newSelectedNodes, // 但保持多选状态
      selectedEdges: [],
      selectedGroups: [],
      lastMousePos: canvasPos
    }));
  };

  // 处理节点组选择
  const handleGroupSelection = (group: NodeGroup, isMultiSelect: boolean, canvasPos: Vector2D) => {
    const isAlreadySelected = interactionState.selectedGroups.includes(group.id);
    let newSelectedGroups: string[];

    if (isMultiSelect) {
      newSelectedGroups = isAlreadySelected
        ? interactionState.selectedGroups.filter(id => id !== group.id)
        : [...interactionState.selectedGroups, group.id];
    } else {
      // 如果已经选中了这个组且有多选状态，保持多选状态进行拖动
      if (isAlreadySelected && interactionState.selectedGroups.length > 1) {
        newSelectedGroups = interactionState.selectedGroups; // 保持当前多选状态
      } else if (isAlreadySelected && interactionState.selectedGroups.length === 1) {
        newSelectedGroups = [group.id]; // 单选状态
      } else {
        newSelectedGroups = [group.id]; // 新选择
      }
    }

    globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
    setInteractionState(prev => ({
      ...prev,
      isDragging: true,
      dragStartPos: canvasPos,
      draggedGroups: [group.id], // 只拖动当前点击的组
      selectedGroups: newSelectedGroups, // 但保持多选状态
      selectedNodes: [],
      selectedEdges: [],
      lastMousePos: canvasPos
    }));
  };

  // 处理边选择
  const handleEdgeSelection = (edge: any, isMultiSelect: boolean) => {
    const isAlreadySelected = interactionState.selectedEdges.includes(edge.id);
    let newSelectedEdges: string[];

    if (isMultiSelect) {
      newSelectedEdges = isAlreadySelected
        ? interactionState.selectedEdges.filter(id => id !== edge.id)
        : [...interactionState.selectedEdges, edge.id];
    } else {
      // 如果当前有多选状态且点击的是已选中的边，则取消多选并只选中当前边
      if (interactionState.selectedEdges.length > 1 && isAlreadySelected) {
        newSelectedEdges = [edge.id];
      } else {
        newSelectedEdges = [edge.id];
      }
    }

    globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
    setInteractionState(prev => ({
      ...prev,
      selectedNodes: [],
      selectedEdges: newSelectedEdges,
      selectedGroups: []
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
      // 拖动节点 - 包括所有选中的节点
      const allSelectedNodes = [...new Set([...interactionState.draggedNodes, ...interactionState.selectedNodes])];
      InteractionHandler.handleNodeDrag(
        allSelectedNodes,
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
      // 拖动节点组 - 包括所有选中的组
      const allSelectedGroups = [...new Set([...interactionState.draggedGroups, ...interactionState.selectedGroups])];
      const result = InteractionHandler.handleGroupDrag(
        nodeGroups,
        allSelectedGroups,
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
          console.warn(t('warning.sensor-no-end'));
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

      // 框选完成后更新选中状态，但不重置交互状态
      if (selectedNodes.length > 0) {
        const selectedNodeIds = selectedNodes.map(n => n.id);
        setInteractionState(prev => ({
          ...prev,
          isSelecting: false,
          selectedNodes: selectedNodeIds,
          selectedEdges: [],
          selectedGroups: []
        }));
        return; // 提前返回，避免重置选中状态
      } else {
        // 如果没有选中任何节点，清空选中状态
        setInteractionState(prev => ({
          ...prev,
          isSelecting: false,
          selectedNodes: [],
          selectedEdges: [],
          selectedGroups: []
        }));
        return;
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
    const clickedTitleBar = clickedNode || clickedGroup ? null : InteractionHandler.findTitleBarAtPosition(
      worldPos,
      nodeGroups,
      snnTopology.canvasScale,
      snnTopology.canvasOffset
    );
    const clickedEdge = clickedNode || clickedGroup || clickedTitleBar ? null : InteractionHandler.findEdgeAtPosition(worldPos, networkTopology);
    
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
      handleGroupCollapse(clickedGroup);
    } else if (clickedTitleBar) {
      // 双击标题栏：切换收起/展开状态
      handleGroupCollapse(clickedTitleBar);
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
    const nodeId = `node-${Date.now()}`;
    const newNode = {
      id: nodeId,
      type: 'izhikevich', // Use simplified type system
      x: worldPos.x,
      y: worldPos.y,
      neuron: new IzhikevichNeuron(nodeId, worldPos.x, worldPos.y)
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

  // 滚轮缩放处理 - 以画布中心为缩放原点
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    if (snnTopology && ref.current) {
      const canvas = ref.current.querySelector('canvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;

      // 计算画布中心点在世界坐标系中的位置
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      // 将画布中心点转换为世界坐标
      const worldCenterX = (centerX - snnTopology.canvasOffset.x) / snnTopology.canvasScale;
      const worldCenterY = (centerY - snnTopology.canvasOffset.y) / snnTopology.canvasScale;

      const scaleAmount = -e.deltaY * 0.001;
      const oldScale = snnTopology.canvasScale;
      const newScale = Math.max(0.1, Math.min(3, oldScale + scaleAmount));

      // 计算新的偏移量，使缩放以画布中心为原点
      const newOffsetX = centerX - worldCenterX * newScale;
      const newOffsetY = centerY - worldCenterY * newScale;

      globalState.setState({
        snnTopology: {
          ...snnTopology,
          canvasScale: newScale,
          canvasOffset: {
            x: newOffsetX,
            y: newOffsetY
          }
        }
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

  // 处理组的收起/展开
  const handleGroupCollapse = (group: NodeGroup) => {
    const updatedGroups = nodeGroups.map(g => {
      if (g.id === group.id) {
        const newCollapsed = !g.collapsed;

        if (newCollapsed && networkTopology) {
          // 收起组时，记录连接到组内节点的边
          const managedEdges: ManagedEdge[] = [];
          const allEdges = networkTopology.getAllEdges();

          allEdges.forEach(edge => {
            const isFromNodeInGroup = g.neurons.includes(edge.fromNodeId);
            const isToNodeInGroup = g.neurons.includes(edge.toNodeId);

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
            ...g,
            collapsed: newCollapsed,
            managedEdges
          };
        } else {
          // 展开组时，清除托管的边信息
          return {
            ...g,
            collapsed: newCollapsed,
            managedEdges: []
          };
        }
      }
      return g;
    });
    setNodeGroups(updatedGroups);
  };

  // 键盘事件处理
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleDeleteSelected();
    }
  }, [interactionState, selectedNodeId, selectedEdgeId, networkTopology, nodeGroups]);

  // 检查节点是否为受保护的感受器或效应器内部组件
  const isProtectedNode = (nodeId: string): boolean => {
    const node = networkTopology?.getNode(nodeId);
    if (!node) return false;

    // 检查节点是否属于插件组（感受器或效应器）
    const parentGroup = nodeGroups.find(group =>
      group.neurons.includes(nodeId)
    );

    if (!parentGroup) return false;

    // 检查组是否为插件组
    return isProtectedGroup(parentGroup);
  };

  // 检查组是否为受保护的感受器或效应器组
  const isProtectedGroup = (group: NodeGroup): boolean => {
    // 首先检查是否有插件实例
    if (group.pluginInstance) {
      // 检查插件实例是否继承自AbstractSensor或AbstractEffector
      const pluginType = group.pluginInstance.pluginType;
      return pluginType === 'sensor' || pluginType === 'effector';
    }

    // 回退到基于组类型的检查（向后兼容）
    return group.type === 'visual_receptor_group' || group.type === 'rotation_controller_group';
  };

  // 删除选中的元素
  const handleDeleteSelected = () => {
    if (!networkTopology || !snnTopology) return;

    let hasChanges = false;
    let snnTopologyChanged = false;

    // 删除选中的单个节点
    if (selectedNodeId) {
      const node = networkTopology.getNode(selectedNodeId);
      if (node) {
        // 检查是否为受保护的节点
        if (isProtectedNode(selectedNodeId)) {
          console.warn(t('warning.cannot-delete-protected-nodes'));
          return;
        }

        // 检查节点是否在组内，如果在组内则不能单独删除
        const parentGroup = nodeGroups.find(g => g.neurons.includes(selectedNodeId));
        if (parentGroup) {
          console.warn(t('warning.cannot-delete-group-nodes'));
          return;
        }

        // 从网络拓扑中删除
        networkTopology.removeNode(selectedNodeId);

        // 从SNN拓扑中删除对应的节点
        const updatedSNNNodes = snnTopology.nodes.filter(n => n.id !== selectedNodeId);
        globalState.setState({
          selectedNodeId: null,
          snnTopology: { ...snnTopology, nodes: updatedSNNNodes }
        });
        hasChanges = true;
        snnTopologyChanged = true;
      }
    }

    // 删除选中的单个边
    if (selectedEdgeId) {
      const edge = networkTopology.getEdge(selectedEdgeId);
      if (edge) {
        networkTopology.removeEdge(selectedEdgeId);

        // 从SNN拓扑中删除对应的边
        const updatedSNNEdges = snnTopology.edges.filter(e => e.id !== selectedEdgeId);
        globalState.setState({
          selectedEdgeId: null,
          snnTopology: { ...snnTopology, edges: updatedSNNEdges }
        });
        hasChanges = true;
        snnTopologyChanged = true;
      }
    }

    // 删除多选的节点
    if (interactionState.selectedNodes.length > 0) {
      // 检查是否包含受保护的节点
      const protectedNodes = interactionState.selectedNodes.filter(nodeId => isProtectedNode(nodeId));
      if (protectedNodes.length > 0) {
        console.warn(t('warning.cannot-delete-protected-nodes'));
        return;
      }

      const nodesToDelete: string[] = [];
      interactionState.selectedNodes.forEach(nodeId => {
        const parentGroup = nodeGroups.find(g => g.neurons.includes(nodeId));
        if (!parentGroup) {
          networkTopology.removeNode(nodeId);
          nodesToDelete.push(nodeId);
          hasChanges = true;
        }
      });

      if (nodesToDelete.length > 0) {
        // 从SNN拓扑中删除对应的节点
        const updatedSNNNodes = snnTopology.nodes.filter(n => !nodesToDelete.includes(n.id));
        globalState.setState({
          snnTopology: { ...snnTopology, nodes: updatedSNNNodes }
        });
        snnTopologyChanged = true;
      }

      setInteractionState(prev => ({ ...prev, selectedNodes: [] }));
    }

    // 删除多选的边
    if (interactionState.selectedEdges.length > 0) {
      interactionState.selectedEdges.forEach(edgeId => {
        networkTopology.removeEdge(edgeId);
        hasChanges = true;
      });

      // 从SNN拓扑中删除对应的边
      const updatedSNNEdges = snnTopology.edges.filter(e => !interactionState.selectedEdges.includes(e.id));
      globalState.setState({
        snnTopology: { ...snnTopology, edges: updatedSNNEdges }
      });
      snnTopologyChanged = true;

      setInteractionState(prev => ({ ...prev, selectedEdges: [] }));
    }

    // 删除选中的组
    if (interactionState.selectedGroups.length > 0) {
      // 检查是否包含受保护的组（感受器/效应器组）
      const protectedGroups = interactionState.selectedGroups.filter(groupId => {
        const group = nodeGroups.find(g => g.id === groupId);
        return group && isProtectedGroup(group);
      });

      if (protectedGroups.length > 0) {
        console.warn(t('warning.cannot-delete-protected-groups'));
        return;
      }

      // 检查组内是否包含受保护的节点
      let hasProtectedNodes = false;
      interactionState.selectedGroups.forEach(groupId => {
        const group = nodeGroups.find(g => g.id === groupId);
        if (group) {
          const protectedNodes = group.neurons.filter(nodeId => isProtectedNode(nodeId));
          if (protectedNodes.length > 0) {
            hasProtectedNodes = true;
          }
        }
      });

      if (hasProtectedNodes) {
        console.warn(t('warning.cannot-delete-protected-nodes'));
        return;
      }

      const updatedGroups = nodeGroups.filter(group =>
        !interactionState.selectedGroups.includes(group.id)
      );

      const nodesToDelete: string[] = [];
      // 删除组内的所有节点
      interactionState.selectedGroups.forEach(groupId => {
        const group = nodeGroups.find(g => g.id === groupId);
        if (group) {
          group.neurons.forEach(nodeId => {
            networkTopology.removeNode(nodeId);
            nodesToDelete.push(nodeId);
          });
        }
      });

      if (nodesToDelete.length > 0) {
        // 从SNN拓扑中删除对应的节点
        const updatedSNNNodes = snnTopology.nodes.filter(n => !nodesToDelete.includes(n.id));
        globalState.setState({
          snnTopology: { ...snnTopology, nodes: updatedSNNNodes }
        });
        snnTopologyChanged = true;
      }

      setNodeGroups(updatedGroups);
      setInteractionState(prev => ({ ...prev, selectedGroups: [] }));
      hasChanges = true;
    }

    if (hasChanges && !snnTopologyChanged) {
      globalState.setState({ networkTopology });
    }
  };

  // 添加键盘事件监听
  useEffect(() => {
    const handleKeyDownEvent = (e: KeyboardEvent) => {
      // 检查是否在输入框中，如果是则不处理删除键
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true'
      )) {
        return;
      }

      // 处理删除键
      handleKeyDown(e);
    };

    document.addEventListener('keydown', handleKeyDownEvent);
    return () => {
      document.removeEventListener('keydown', handleKeyDownEvent);
    };
  }, [handleKeyDown]);

  return (
    <div className="snn-topology-editor" ref={ref} tabIndex={0}>
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
