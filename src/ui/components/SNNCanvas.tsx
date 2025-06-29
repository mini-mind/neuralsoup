import React, { useRef, useEffect, useCallback } from "react";
import { globalState } from "../../core/services/GlobalState";
import { IzhikevichNeuron } from "../../core/entities/neuron";
import { InteractionState, SelectionBox, NodeGroup } from "../types/editor.types";
import { useLanguage } from "../../contexts/LanguageContext";

interface SNNCanvasProps {
  width: number;
  height: number;
  networkTopology: any;
  snnTopology: any;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  interactionState: InteractionState;
  selectionBox: SelectionBox;
  neuronGroups: NodeGroup[];
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWheel: (e: WheelEvent) => void;
}

export const SNNCanvas: React.FC<SNNCanvasProps> = ({
  width,
  height,
  networkTopology,
  snnTopology,
  selectedNodeId,
  selectedEdgeId,
  interactionState,
  selectionBox,
  neuronGroups,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick,
  onWheel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useLanguage();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    if (networkTopology) {
      drawNetworkTopology(ctx, networkTopology, snnTopology, selectedNodeId, selectedEdgeId);
    }
    
    drawNeuronGroups(ctx);
    
    if (selectionBox.visible) {
      drawSelectionBox(ctx);
    }
    
    if (interactionState.isCreatingEdge && interactionState.edgeStartNodeId) {
      drawCreatingEdge(ctx);
    }
  }, [networkTopology, snnTopology, selectedNodeId, selectedEdgeId, width, height, selectionBox, interactionState, neuronGroups]);

  const drawNeuronGroups = (ctx: CanvasRenderingContext2D) => {
    if (!snnTopology) return;

    neuronGroups.forEach(group => {
      const isSelected = interactionState.selectedGroups.includes(group.id);
      
      // 收起时调整框尺寸
      const displayWidth = group.collapsed ? Math.min(group.width, 80) : group.width;
      const displayHeight = group.collapsed ? 30 : group.height;
      
      // 修复坐标变换：正确的顺序应该是先缩放再平移
      const screenPos = {
        x: group.x * snnTopology.canvasScale + snnTopology.canvasOffset.x,
        y: group.y * snnTopology.canvasScale + snnTopology.canvasOffset.y
      };
      const screenSize = {
        width: displayWidth * snnTopology.canvasScale,
        height: displayHeight * snnTopology.canvasScale
      };

      // 绘制组背景
      ctx.fillStyle = isSelected ? 'rgba(255, 0, 0, 0.1)' : 'rgba(100, 100, 100, 0.2)';
      ctx.fillRect(screenPos.x, screenPos.y, screenSize.width, screenSize.height);
      
      // 绘制组边框
      ctx.strokeStyle = isSelected ? '#ff0000' : '#888';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(screenPos.x, screenPos.y, screenSize.width, screenSize.height);

      // 绘制标题栏
      const titleBarHeight = 20;
      ctx.fillStyle = isSelected ? 'rgba(255, 0, 0, 0.2)' : 'rgba(120, 120, 120, 0.3)';
      ctx.fillRect(screenPos.x, screenPos.y, screenSize.width, titleBarHeight);
      
      // 绘制标题栏边框
      ctx.strokeStyle = isSelected ? '#ff0000' : '#999';
      ctx.lineWidth = 1;
      ctx.strokeRect(screenPos.x, screenPos.y, screenSize.width, titleBarHeight);

      // 绘制收起按钮
      const buttonSize = 12;
      const buttonMargin = 4;
      const buttonX = screenPos.x + buttonMargin;
      const buttonY = screenPos.y + buttonMargin;
      
      ctx.fillStyle = group.collapsed ? '#ff6b6b' : '#4a90e2';
      ctx.fillRect(buttonX, buttonY, buttonSize, buttonSize);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(buttonX, buttonY, buttonSize, buttonSize);
      
      // 绘制按钮图标
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (group.collapsed) {
        // "+" 图标
        const centerX = buttonX + buttonSize / 2;
        const centerY = buttonY + buttonSize / 2;
        ctx.moveTo(centerX - 3, centerY);
        ctx.lineTo(centerX + 3, centerY);
        ctx.moveTo(centerX, centerY - 3);
        ctx.lineTo(centerX, centerY + 3);
      } else {
        // "-" 图标
        const centerX = buttonX + buttonSize / 2;
        const centerY = buttonY + buttonSize / 2;
        ctx.moveTo(centerX - 3, centerY);
        ctx.lineTo(centerX + 3, centerY);
      }
      ctx.stroke();

      // 绘制标题文字
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'left';
      const title = group.type === 'visual_receptor_group' ? t('snn.group.visualReceptor') : t('snn.group.rotationController');
      const maxTitleWidth = screenSize.width - buttonSize - buttonMargin * 3 - 4;
      
      // Truncate title if too long in collapsed state
      let displayTitle = title;
      if (group.collapsed) {
        ctx.font = 'bold 10px Arial';
        const titleWidth = ctx.measureText(title).width;
        if (titleWidth > maxTitleWidth) {
          displayTitle = title.substring(0, Math.floor(title.length * maxTitleWidth / titleWidth)) + '...';
        }
      }
      
      ctx.fillText(displayTitle, screenPos.x + buttonSize + buttonMargin * 2 + 2, screenPos.y + 14);

      // 如果组已收起，显示省略号
      if (group.collapsed) {
        ctx.fillStyle = '#999';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('...', screenPos.x + screenSize.width / 2, screenPos.y + screenSize.height - 8);
      }
    });
  };

  const drawNetworkTopology = (ctx: CanvasRenderingContext2D, topology: any, legacyTopology: any, selectedNode: string | null, selectedEdge: string | null) => {
    const offset = legacyTopology?.canvasOffset || { x: 0, y: 0 };
    const scale = legacyTopology?.canvasScale || 1;
    
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    
    // 创建节点查找函数，包括组内节点
    const findNode = (nodeId: string) => {
      // 先从网络拓扑中查找
      let node = topology.getNode(nodeId);
      if (node) return node;
      
      // 如果没找到，从snnTopology中查找组内节点
      if (legacyTopology?.nodes) {
        node = legacyTopology.nodes.find((n: any) => n.id === nodeId);
        if (node) return node;
      }
      
      return null;
    };
    
    // 渲染网络拓扑中的边
    topology.getAllEdges().forEach((edge: any) => {
      const fromNode = findNode(edge.fromNodeId);
      const toNode = findNode(edge.toNodeId);
      if (fromNode && toNode) {
        drawEdge(ctx, fromNode, toNode, edge, selectedEdge === edge.id);
      }
    });
    
    // 渲染网络拓扑中的节点
    topology.getAllNodes().forEach((node: any) => {
      drawNode(ctx, node, selectedNode === node.id);
    });
    
    // 渲染snnTopology中的组内节点（不在网络拓扑中）
    if (legacyTopology?.nodes) {
      legacyTopology.nodes.forEach((node: any) => {
        // 检查节点是否在某个组内
        const parentGroup = neuronGroups.find(g => g.neurons.includes(node.id));
        if (parentGroup) {
          drawNode(ctx, node, selectedNode === node.id);
        }
      });
    }
    
    ctx.restore();
  };
  
  const drawNode = (ctx: CanvasRenderingContext2D, node: any, isSelected: boolean) => {
    const isInCollapsedGroup = neuronGroups.some(g => g.collapsed && g.neurons.includes(node.id));
    if (isInCollapsedGroup) return;

    // Check if node is in a group
    const parentGroup = neuronGroups.find(g => !g.collapsed && g.neurons.includes(node.id));
    const isInGroup = !!parentGroup;

    const isMultiSelected = interactionState.selectedNodes.includes(node.id);
    const shouldHighlight = isSelected || isMultiSelected;

    // Adjust node size based on type and whether it's in a group
    let radius: number;
    if (node.type === 'voltage_input') {
      radius = 4; // Voltage input nodes are particularly small
    } else if (isInGroup) {
      radius = 8; // Other nodes in groups
    } else {
      radius = 15; // Regular nodes
    }
    
    const state = node.getState ? node.getState() : { voltage: 0, isSpiking: false };
    
    let color = '#888888';
    if (state.isSpiking) color = '#ff6b6b';
    
    ctx.fillStyle = color;
    
    // 所有节点都显示为圆形
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fill();
    
    if (shouldHighlight) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Only show text labels for regular nodes not in groups
    if (!isInGroup && node.type !== 'voltage_input' && node.type !== 'voltage_accumulator') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let typeLabel = 'B';
      if (node.type === 'sensor') typeLabel = 'S';
      if (node.type === 'effector') typeLabel = 'E';
      ctx.fillText(typeLabel, node.x, node.y);
    }
  };
  
  const drawEdge = (ctx: CanvasRenderingContext2D, fromNode: any, toNode: any, edge: any, isSelected: boolean) => {
    const isMultiSelected = interactionState.selectedEdges.includes(edge.id);
    const shouldHighlight = isSelected || isMultiSelected;
    const state = edge.getState();
    
    // 检查节点是否在收起的组内，如果是则使用组的中心点
    let actualFromNode = fromNode;
    let actualToNode = toNode;
    let fromRadius = 15; // 默认普通节点半径
    let toRadius = 15; // 默认普通节点半径
    
    // 检查起点是否在收起的组内
    const fromNodeGroup = neuronGroups.find(g => g.collapsed && g.neurons.includes(fromNode.id));
    if (fromNodeGroup) {
      actualFromNode = {
        x: fromNodeGroup.x + fromNodeGroup.width / 2,
        y: fromNodeGroup.y + fromNodeGroup.height / 2
      };
      fromRadius = Math.min(fromNodeGroup.width, fromNodeGroup.height) / 2;
    } else {
      // 获取起点节点的实际半径
      const fromNodeInGroup = neuronGroups.some(g => !g.collapsed && g.neurons.includes(fromNode.id));
      if (fromNode.type === 'voltage_input') {
        fromRadius = 4;
      } else if (fromNodeInGroup) {
        fromRadius = 8;
      }
    }
    
    // 检查终点是否在收起的组内
    const toNodeGroup = neuronGroups.find(g => g.collapsed && g.neurons.includes(toNode.id));
    if (toNodeGroup) {
      actualToNode = {
        x: toNodeGroup.x + toNodeGroup.width / 2,
        y: toNodeGroup.y + toNodeGroup.height / 2
      };
      toRadius = Math.min(toNodeGroup.width, toNodeGroup.height) / 2;
    } else {
      // 获取终点节点的实际半径
      const toNodeInGroup = neuronGroups.some(g => !g.collapsed && g.neurons.includes(toNode.id));
      if (toNode.type === 'voltage_input') {
        toRadius = 4;
      } else if (toNodeInGroup) {
        toRadius = 8;
      }
    }
    
    const dx = actualToNode.x - actualFromNode.x;
    const dy = actualToNode.y - actualFromNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const startX = actualFromNode.x + (dx / distance) * fromRadius;
    const startY = actualFromNode.y + (dy / distance) * fromRadius;
    const endX = actualToNode.x - (dx / distance) * toRadius;
    const endY = actualToNode.y - (dy / distance) * toRadius;
    
    const weight = state.weight;
    const lineWidth = Math.max(1, weight * 5);
    let color = `rgba(100, 100, 100, ${Math.max(0.3, weight)})`;
    if (state.recentActivity > 0.1) color = `rgba(255, 100, 100, ${Math.max(0.3, weight)})`;
    
    // 检查是否涉及组内节点，如果是则使用虚线
    const fromInGroup = neuronGroups.some(g => g.neurons.includes(fromNode.id));
    const toInGroup = neuronGroups.some(g => g.neurons.includes(toNode.id));
    const useDashedLine = fromInGroup || toInGroup;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = shouldHighlight ? '#ff0000' : color;
    ctx.lineWidth = shouldHighlight ? lineWidth + 2 : lineWidth;
    
    if (useDashedLine) {
      ctx.setLineDash([3, 3]);
    }
    
    ctx.stroke();
    
    if (useDashedLine) {
      ctx.setLineDash([]);
    }
    
    drawArrow(ctx, startX, startY, endX, endY, shouldHighlight ? '#ff0000' : color);
  };
  
  const drawArrow = (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number, color: string) => {
    const headLength = 8;
    const angle = Math.atan2(endY - startY, endX - startX);
    
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawSelectionBox = (ctx: CanvasRenderingContext2D) => {
    const { startX, startY, endX, endY } = selectionBox;
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.fillStyle = 'rgba(74, 144, 226, 0.1)';
    const width = endX - startX;
    const height = endY - startY;
    ctx.fillRect(startX, startY, width, height);
    ctx.strokeRect(startX, startY, width, height);
    ctx.setLineDash([]);
  };

  const drawCreatingEdge = (ctx: CanvasRenderingContext2D) => {
    if (!interactionState.edgeStartNodeId || !snnTopology) return;
    
    const edgeStartNodeId = interactionState.edgeStartNodeId;
    
    // 先从网络拓扑中查找起始节点
    let startNode = networkTopology?.getNode(edgeStartNodeId);
    
    // 如果网络拓扑中没有，从snnTopology中查找组内节点
    if (!startNode && snnTopology.nodes) {
      startNode = snnTopology.nodes.find((node: any) => node.id === edgeStartNodeId);
    }
    
    if (!startNode) return;

    const { canvasOffset, canvasScale } = snnTopology;
    const startX = startNode.x * canvasScale + canvasOffset.x;
    const startY = startNode.y * canvasScale + canvasOffset.y;
    const endX = interactionState.lastMousePos.x;
    const endY = interactionState.lastMousePos.y;
    
    // 检查起始节点是否在组内，如果是则使用虚线
    const startNodeInGroup = neuronGroups.some(g => g.neurons.includes(edgeStartNodeId));
    
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]); // 创建边时总是使用虚线
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  
  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', onWheel);
      };
    }
  }, [onWheel]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={onDoubleClick}
    />
  );
}; 