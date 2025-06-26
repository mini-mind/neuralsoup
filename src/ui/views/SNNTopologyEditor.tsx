import React, { useCallback, useState, useEffect } from "react";
import { globalState } from "../../core/services/GlobalState";
import { IzhikevichNeuron } from "../../core/entities/neuron";
import "../components/SNNTopologyEditor.css";
import { SNNCanvas } from "../components/SNNCanvas";
import NeuronDetailEditor from "../components/NeuronDetailEditor";
import SynapseDetailEditor from "../components/SynapseDetailEditor";
import { useLanguage } from "../../contexts/LanguageContext";

export interface SNNTopologyEditorProps {
  width: number;
  height: number;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  visible: boolean;
}

export interface InteractionState {
  isDragging: boolean;
  isSelecting: boolean;
  isPanning: boolean;
  isCreatingEdge: boolean;
  dragStartPos: { x: number; y: number };
  draggedNodes: string[];
  edgeStartNodeId: string | null;
  lastMousePos: { x: number; y: number };
  selectedNodes: string[];
  selectedEdges: string[];
  selectedGroups: string[];
  draggedGroups: string[];
}

export interface NeuronGroup {
  id: string;
  type: 'visual_receptor_group' | 'rotation_controller_group';
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  neurons: string[]; // 包含的神经元ID列表
}

const SNNTopologyEditor = React.forwardRef<HTMLDivElement, SNNTopologyEditorProps>(({
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

  const [neuronGroups, setNeuronGroups] = useState<NeuronGroup[]>([]);
  const [initialized, setInitialized] = useState(false);
  const { t } = useLanguage();

  // 创建视觉感受器组
  const createVisualReceptorGroup = (x: number, y: number) => {
    const { snnTopology } = globalState.getState();
    if (!snnTopology) return;

    const groupId = `visual_group_${Date.now()}`;
    const neurons: any[] = [];
    
    // 创建8个传感器神经元横向排列
    for (let i = 0; i < 8; i++) {
      const neuronId = `visual_sensor_${Date.now()}_${i}`;
      const neuron = {
        id: neuronId,
        type: 'sensor',
        x: x + 10 + i * 25, // 横向排列
        y: y + 25, // 在组合组件内垂直居中
        neuron: new IzhikevichNeuron(neuronId, 'input', x + 10 + i * 25, y + 25)
      };
      neurons.push(neuron);
    }

    // 创建组合组件
    const group: NeuronGroup = {
      id: groupId,
      type: 'visual_receptor_group',
      x: x,
      y: y,
      width: 8 * 25 + 20, // 调整宽度适应8个神经元
      height: 50,
      collapsed: false,
      neurons: neurons.map(n => n.id)
    };

    // 更新状态
    globalState.setState({
      snnTopology: {
        ...snnTopology,
        nodes: [...snnTopology.nodes, ...neurons]
      }
    });
    
    setNeuronGroups(prev => [...prev, group]);
  };

  // 创建旋转控制器组
  const createRotationControllerGroup = (x: number, y: number) => {
    const { snnTopology } = globalState.getState();
    if (!snnTopology) return;

    const groupId = `rotation_group_${Date.now()}`;
    const neurons: any[] = [];
    
    // 创建2个效应器神经元垂直排列
    for (let i = 0; i < 2; i++) {
      const neuronId = `rotation_effector_${Date.now()}_${i}`;
      const neuron = {
        id: neuronId,
        type: 'effector',
        x: x + 25, // 在组合组件内水平居中
        y: y + 15 + i * 30, // 垂直排列
        neuron: new IzhikevichNeuron(neuronId, 'output', x + 25, y + 15 + i * 30)
      };
      neurons.push(neuron);
    }

    // 创建组合组件
    const group: NeuronGroup = {
      id: groupId,
      type: 'rotation_controller_group',
      x: x,
      y: y,
      width: 50,
      height: 75, // 调整高度适应2个神经元
      collapsed: false,
      neurons: neurons.map(n => n.id)
    };

    // 更新状态
    globalState.setState({
      snnTopology: {
        ...snnTopology,
        nodes: [...snnTopology.nodes, ...neurons]
      }
    });
    
    setNeuronGroups(prev => [...prev, group]);
  };

  // 查找位置上的组合组件
  const findGroupAtPosition = (worldPos: { x: number; y: number }) => {
    return neuronGroups.find(group => 
      worldPos.x >= group.x && 
      worldPos.x <= group.x + group.width &&
      worldPos.y >= group.y && 
      worldPos.y <= group.y + group.height
    );
  };
  
  const { networkTopology, snnTopology, selectedNodeId, selectedEdgeId } = globalState.useStore(s => ({ 
    networkTopology: s.networkTopology,
    snnTopology: s.snnTopology,
    selectedNodeId: s.selectedNodeId,
    selectedEdgeId: s.selectedEdgeId
  }));

  // 初始化默认组合组件
  useEffect(() => {
    if (snnTopology && !initialized) {
      // 创建默认的视觉感受器组（上方）
      createVisualReceptorGroup(-100, -150);
      // 创建默认的旋转控制器组（下方）
      createRotationControllerGroup(-25, 50);
      setInitialized(true);
    }
  }, [snnTopology, initialized]);

  // 获取选中的节点和边数据
  const selectedNode = selectedNodeId && networkTopology ? networkTopology.getNode(selectedNodeId) : null;
  const selectedEdge = selectedEdgeId && networkTopology ? networkTopology.getEdge(selectedEdgeId) : null;

  // 坐标转换函数
  const canvasToWorld = (pos: { x: number; y: number }, offset: { x: number; y: number }, scale: number) => ({
    x: (pos.x - offset.x) / scale,
    y: (pos.y - offset.y) / scale,
  });

  // 查找点击的节点
  const findNodeAtPosition = (worldPos: { x: number; y: number }) => {
    if (!networkTopology) return null;
    
    return networkTopology.getAllNodes().find((node: any) => {
      const dist = Math.sqrt(Math.pow(node.x - worldPos.x, 2) + Math.pow(node.y - worldPos.y, 2));
      return dist < 20;
    });
  };

  // 查找点击的边
  const findEdgeAtPosition = (worldPos: { x: number; y: number }) => {
    if (!networkTopology) return null;
    
    const edges = networkTopology.getAllEdges();
    for (const edge of edges) {
      const fromNode = networkTopology.getNode(edge.fromNodeId);
      const toNode = networkTopology.getNode(edge.toNodeId);
      
      if (fromNode && toNode) {
        // 计算点到线段的距离
        const dist = distanceToLineSegment(worldPos, fromNode, toNode);
        if (dist < 10) return edge;
      }
    }
    return null;
  };

  // 计算点到线段的距离
  const distanceToLineSegment = (point: { x: number; y: number }, lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 获取选择框内的节点
  const getNodesInSelectionBox = () => {
    if (!networkTopology || !snnTopology) return [];
    
    const { startX, startY, endX, endY } = selectionBox;
    const offset = snnTopology.canvasOffset;
    const scale = snnTopology.canvasScale;
    
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);
    
    return networkTopology.getAllNodes().filter((node: any) => {
      const screenX = node.x * scale + offset.x;
      const screenY = node.y * scale + offset.y;
      
      return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
    });
  };

  // 鼠标按下处理
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect) return;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const { snnTopology } = globalState.getState();
    
    if (!snnTopology) return;
    
    const worldPos = canvasToWorld(
      { x: canvasX, y: canvasY }, 
      snnTopology.canvasOffset, 
      snnTopology.canvasScale
    );

    const clickedNode = findNodeAtPosition(worldPos);
    const clickedGroup = clickedNode ? null : findGroupAtPosition(worldPos);
    const clickedEdge = clickedNode || clickedGroup ? null : findEdgeAtPosition(worldPos);

    if (e.button === 0) { // 左键
      if (e.ctrlKey && clickedNode) {
        // Ctrl+左键：开始创建边
        setInteractionState(prev => ({
          ...prev,
          isCreatingEdge: true,
          edgeStartNodeId: clickedNode.id,
          lastMousePos: { x: canvasX, y: canvasY }
        }));
      } else if (clickedNode) {
        // 左键点击节点：选中并准备拖动
        const isAlreadySelected = interactionState.selectedNodes.includes(clickedNode.id);
        let newSelectedNodes;
        
        if (e.shiftKey) {
          // Shift+点击：添加到选择或从选择中移除
          if (isAlreadySelected) {
            newSelectedNodes = interactionState.selectedNodes.filter(id => id !== clickedNode.id);
          } else {
            newSelectedNodes = [...interactionState.selectedNodes, clickedNode.id];
          }
        } else {
          // 普通点击：只选中这个节点
          newSelectedNodes = [clickedNode.id];
        }
        
        globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
        setInteractionState(prev => ({
          ...prev,
          isDragging: true,
          dragStartPos: { x: canvasX, y: canvasY },
          draggedNodes: newSelectedNodes,
          selectedNodes: newSelectedNodes,
          selectedEdges: [],
          selectedGroups: [],
          lastMousePos: { x: canvasX, y: canvasY }
        }));
      } else if (clickedGroup) {
        // 左键点击组合组件：选中并准备拖动
        const isAlreadySelected = interactionState.selectedGroups.includes(clickedGroup.id);
        let newSelectedGroups;
        
        if (e.shiftKey) {
          // Shift+点击：添加到选择或从选择中移除
          if (isAlreadySelected) {
            newSelectedGroups = interactionState.selectedGroups.filter(id => id !== clickedGroup.id);
          } else {
            newSelectedGroups = [...interactionState.selectedGroups, clickedGroup.id];
          }
        } else {
          // 普通点击：只选中这个组合组件
          newSelectedGroups = [clickedGroup.id];
        }
        
        globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
        setInteractionState(prev => ({
          ...prev,
          isDragging: true,
          dragStartPos: { x: canvasX, y: canvasY },
          draggedGroups: newSelectedGroups,
          selectedGroups: newSelectedGroups,
          selectedNodes: [],
          selectedEdges: [],
          lastMousePos: { x: canvasX, y: canvasY }
        }));
      } else if (clickedEdge) {
        // 左键点击边：选中边
        const isAlreadySelected = interactionState.selectedEdges.includes(clickedEdge.id);
        let newSelectedEdges;
        
        if (e.shiftKey) {
          if (isAlreadySelected) {
            newSelectedEdges = interactionState.selectedEdges.filter(id => id !== clickedEdge.id);
          } else {
            newSelectedEdges = [...interactionState.selectedEdges, clickedEdge.id];
          }
        } else {
          newSelectedEdges = [clickedEdge.id];
        }
        
        globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
        setInteractionState(prev => ({
          ...prev,
          selectedNodes: [],
          selectedEdges: newSelectedEdges
        }));
      } else {
        // 左键点击空白：开始框选
        globalState.setState({ selectedNodeId: null, selectedEdgeId: null });
        setSelectionBox({
          startX: canvasX,
          startY: canvasY,
          endX: canvasX,
          endY: canvasY,
          visible: true
        });
        setInteractionState(prev => ({
          ...prev,
          isSelecting: true,
          dragStartPos: { x: canvasX, y: canvasY },
          selectedNodes: [],
          selectedEdges: [],
          lastMousePos: { x: canvasX, y: canvasY }
        }));
      }
    } else if (e.button === 2) { // 右键
      // 右键拖动空白：平移画布
      setInteractionState(prev => ({
        ...prev,
        isPanning: true,
        dragStartPos: { x: canvasX, y: canvasY },
        lastMousePos: { x: canvasX, y: canvasY }
      }));
    }
  };

  // 鼠标移动处理
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect) return;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    setInteractionState(prev => ({ ...prev, lastMousePos: { x: canvasX, y: canvasY } }));

    const { snnTopology } = globalState.getState();
    if (!snnTopology) return;

    if (interactionState.isDragging && interactionState.draggedNodes.length > 0) {
      // 拖动节点（支持多选）
      const dx = canvasX - interactionState.lastMousePos.x;
      const dy = canvasY - interactionState.lastMousePos.y;
      const scale = snnTopology.canvasScale;
      
      if (networkTopology) {
        // 拖动所有选中的节点
        interactionState.draggedNodes.forEach(nodeId => {
          const node = networkTopology.getNode(nodeId);
          if (node) {
            node.setPosition(node.x + dx / scale, node.y + dy / scale);
          }
        });
        globalState.setState({ networkTopology });
      } else if (snnTopology) {
        // 兼容旧拓扑，拖动选中的节点
        const newNodes = snnTopology.nodes.map((n: any) => {
          if (interactionState.draggedNodes.includes(n.id)) {
            return { ...n, x: n.x + dx / scale, y: n.y + dy / scale };
          }
          return n;
        });
        globalState.setState({ snnTopology: { ...snnTopology, nodes: newNodes } });
      }
    } else if (interactionState.isDragging && interactionState.draggedGroups.length > 0) {
      // 拖动组合组件（包括其内部神经元）
      const dx = canvasX - interactionState.lastMousePos.x;
      const dy = canvasY - interactionState.lastMousePos.y;
      const scale = snnTopology.canvasScale;
      
      // 更新组合组件位置
      const updatedGroups = neuronGroups.map(group => {
        if (interactionState.draggedGroups.includes(group.id)) {
          return { ...group, x: group.x + dx / scale, y: group.y + dy / scale };
        }
        return group;
      });
      setNeuronGroups(updatedGroups);
      
      // 同时移动组合组件内的神经元
      if (networkTopology) {
        interactionState.draggedGroups.forEach(groupId => {
          const group = neuronGroups.find(g => g.id === groupId);
          if (group) {
            group.neurons.forEach(neuronId => {
              const node = networkTopology.getNode(neuronId);
              if (node) {
                node.setPosition(node.x + dx / scale, node.y + dy / scale);
              }
            });
          }
        });
        globalState.setState({ networkTopology });
      } else if (snnTopology) {
        // 兼容旧拓扑
        const neuronIdsToMove: string[] = [];
        interactionState.draggedGroups.forEach(groupId => {
          const group = neuronGroups.find(g => g.id === groupId);
          if (group) {
            neuronIdsToMove.push(...group.neurons);
          }
        });
        
        const newNodes = snnTopology.nodes.map((n: any) => {
          if (neuronIdsToMove.includes(n.id)) {
            return { ...n, x: n.x + dx / scale, y: n.y + dy / scale };
          }
          return n;
        });
        globalState.setState({ snnTopology: { ...snnTopology, nodes: newNodes } });
      }
    } else if (interactionState.isSelecting) {
      // 更新选择框
      setSelectionBox(prev => ({
        ...prev,
        endX: canvasX,
        endY: canvasY
      }));
    } else if (interactionState.isPanning) {
      // 平移画布
      const dx = canvasX - interactionState.lastMousePos.x;
      const dy = canvasY - interactionState.lastMousePos.y;
      
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

  // 鼠标松开处理
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect) return;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const { snnTopology } = globalState.getState();

    if (interactionState.isCreatingEdge && interactionState.edgeStartNodeId) {
      // 完成创建边
      if (snnTopology) {
        const worldPos = canvasToWorld(
          { x: canvasX, y: canvasY }, 
          snnTopology.canvasOffset, 
          snnTopology.canvasScale
        );
        const targetNode = findNodeAtPosition(worldPos);
        
        if (targetNode && targetNode.id !== interactionState.edgeStartNodeId) {
          // 创建边
          console.log(`创建边: ${interactionState.edgeStartNodeId} -> ${targetNode.id}`);
          // 这里可以添加实际的边创建逻辑
        }
      }
    } else if (interactionState.isSelecting) {
      // 完成框选
      const selectedNodes = getNodesInSelectionBox();
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
      lastMousePos: { x: canvasX, y: canvasY },
      selectedNodes: interactionState.selectedNodes,
      selectedEdges: interactionState.selectedEdges,
      selectedGroups: interactionState.selectedGroups,
      draggedGroups: []
    });
  };

  // 双击处理
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect) return;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const { snnTopology } = globalState.getState();
    
    if (!snnTopology) return;
    
    const worldPos = canvasToWorld(
      { x: canvasX, y: canvasY }, 
      snnTopology.canvasOffset, 
      snnTopology.canvasScale
    );

        const clickedNode = findNodeAtPosition(worldPos);
    const clickedGroup = clickedNode ? null : findGroupAtPosition(worldPos);
    const clickedEdge = clickedNode || clickedGroup ? null : findEdgeAtPosition(worldPos);
    
    if (clickedNode) {
      // 双击节点：弹出编辑弹窗
      globalState.setState({ selectedNodeId: clickedNode.id, selectedEdgeId: null });
      setInteractionState(prev => ({
        ...prev,
        selectedNodes: [],
        selectedEdges: []
      }));
    } else if (clickedGroup) {
      // 双击组合组件：切换收起/展开状态
      const updatedGroups = neuronGroups.map(group => {
        if (group.id === clickedGroup.id) {
          return { ...group, collapsed: !group.collapsed };
        }
        return group;
      });
      setNeuronGroups(updatedGroups);
    } else if (clickedEdge) {
      // 双击边：弹出突触编辑弹窗
      globalState.setState({ selectedNodeId: null, selectedEdgeId: clickedEdge.id });
      setInteractionState(prev => ({
        ...prev,
        selectedNodes: [],
        selectedEdges: []
      }));
    } else {
      // 双击空白：创建新节点或组合组件（根据按键修饰符决定）
      if (e.altKey && e.shiftKey) {
        // Alt+Shift+双击：创建旋转控制器组
        createRotationControllerGroup(worldPos.x, worldPos.y);
      } else if (e.altKey) {
        // Alt+双击：创建视觉感受器组
        createVisualReceptorGroup(worldPos.x, worldPos.y);
      } else {
        // 普通双击：创建新节点
        const newNode = {
          id: `neuron-${Date.now()}`,
          type: 'brain',
          x: worldPos.x,
          y: worldPos.y,
          neuron: new IzhikevichNeuron(`neuron-${Date.now()}`, 'hidden', worldPos.x, worldPos.y)
        };
        
        globalState.setState({
          snnTopology: {
            ...snnTopology,
            nodes: [...snnTopology.nodes, newNode]
          }
        });
      }
    }
  };

  // 滚轮缩放处理 - 修复被动事件监听器问题
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const { snnTopology } = globalState.getState();
    if (snnTopology) {
      const scaleAmount = -e.deltaY * 0.001;
      const newScale = Math.max(0.1, Math.min(3, snnTopology.canvasScale + scaleAmount));
      globalState.setState({
        snnTopology: { ...snnTopology, canvasScale: newScale }
      });
    }
  }, []);

  // 转换NetworkNode为兼容的格式
  const convertNodeToLegacyFormat = (node: any) => {
    const state = node.getState();
    return {
      id: node.id,
      label: node.id,
      type: node.neuron.type,
      x: node.x,
      y: node.y,
      params: {
        a: 0.02, // 默认IZ参数
        b: 0.2,
        c: -65,
        d: 8,
        threshold: node.neuron.threshold
      },
      state: {
        v: state.voltage,
        u: 0, // 恢复变量，这里简化处理
        spike: state.isSpiking,
        lastSpikeTime: state.lastSpikeTime
      }
    };
  };

  // 转换NetworkEdge为兼容的格式
  const convertEdgeToLegacyFormat = (edge: any) => {
    const state = edge.getState();
    return {
      id: edge.id,
      from: edge.fromNodeId,
      to: edge.toNodeId,
      weight: state.weight,
      delay: edge.synapse.delay
    };
  };

  const handleNeuronUpdate = (updatedNeuron: any) => {
    console.log('神经元已更新:', updatedNeuron);
  };

  const handleSynapseUpdate = (updatedSynapse: any) => {
    if (selectedEdge && networkTopology) {
      selectedEdge.synapse.weight = updatedSynapse.weight;
      globalState.setState({ networkTopology: networkTopology });
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
        neuronGroups={neuronGroups}
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
            neuron={convertNodeToLegacyFormat(selectedNode)} 
            onUpdate={handleNeuronUpdate}
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
            synapse={convertEdgeToLegacyFormat(selectedEdge)} 
            onUpdate={handleSynapseUpdate}
          />
        </div>
      )}
    </div>
  );
});

export default SNNTopologyEditor;
