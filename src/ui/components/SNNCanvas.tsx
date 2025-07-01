import React, { useRef, useEffect, useCallback } from "react";
import { InteractionState, SelectionBox, NodeGroup } from "../types/editor.types";
import { useLanguage } from "../../contexts/LanguageContext";
import { globalPluginManager } from "../../core/services/PluginManager";
import { globalEventBus } from "../../core/services/EventBus";
import { globalPerformanceMonitor } from "../../utils/PerformanceMonitor";

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
    const startTime = performance.now();

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

    // 记录渲染性能
    globalPerformanceMonitor.recordRenderTime(startTime);
  }, [networkTopology, snnTopology, selectedNodeId, selectedEdgeId, width, height, selectionBox, interactionState, neuronGroups]);

  const drawNeuronGroups = (ctx: CanvasRenderingContext2D) => {
    if (!snnTopology) return;

    // 过滤可见的插件组
    const visibleGroups = neuronGroups.filter(group => {
      // 如果组有插件实例，检查插件是否在当前世界中可见
      if (group.pluginInstance) {
        return globalPluginManager.isPluginVisible(group.pluginInstance);
      }
      // 对于没有插件实例的组（如普通神经元组），默认可见
      return true;
    });

    visibleGroups.forEach(group => {
      const isSelected = interactionState.selectedGroups.includes(group.id);
      
      // 缩放感知的尺寸计算
      const scale = snnTopology.canvasScale;

      // 计算标题文字所需的最小宽度
      const getGroupTitle = (groupType: string) => {
        switch (groupType) {
          case 'visual_receptor_group':
            return t('snn.group.visualReceptor');
          case 'health_receptor_group':
            return t('snn.group.healthReceptor');
          case 'rotation_controller_group':
            return t('snn.group.rotationController');
          case 'movement_controller_group':
            return t('snn.group.movementController');
          case 'gradient_movement_controller':
            return t('snn.group.gradientMovementController');
          case 'light_receptor_group':
            return t('snn.group.lightReceptor');
          default:
            return groupType;
        }
      };
      const title = getGroupTitle(group.type);
      const fontSize = Math.max(9, Math.min(14, 11 * Math.sqrt(scale)));

      // 创建临时canvas来测量文字宽度
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      let minWidthForTitle = 120; // 默认最小宽度

      if (tempCtx) {
        tempCtx.font = `bold ${fontSize}px Arial`;
        const textWidth = tempCtx.measureText(title).width;

        // 计算最小宽度：文字宽度 + 按钮 + 边距
        const buttonSize = Math.max(10, Math.min(16, 12 * Math.sqrt(scale)));
        const buttonMargin = Math.max(3, 4 * Math.sqrt(scale));
        minWidthForTitle = textWidth + buttonSize + buttonMargin * 3 + 8; // 额外8px边距
      }

      const minWidth = Math.max(120, minWidthForTitle); // 确保标题完全可见
      const minHeight = 30; // 最小高度
      const maxCollapsedWidth = Math.max(minWidth, 80 * Math.sqrt(scale)); // 缩放感知的收起宽度

      // 计算标题栏高度（需要在其他计算之前定义）
      const titleBarHeight = Math.max(20, 20 * Math.sqrt(scale));

      // 收起时调整框尺寸，考虑缩放因子
      const displayWidth = group.collapsed
        ? Math.max(minWidth, Math.min(group.width, maxCollapsedWidth))
        : Math.max(minWidth, group.width);
      const displayHeight = group.collapsed
        ? Math.max(minHeight, 30 * Math.sqrt(scale))
        : Math.max(minHeight * 2, group.height);

      // 对于感受器和效应器组，收起时只显示标题栏
      const isReceptorOrControllerGroup = group.type === 'visual_receptor_group' ||
                                         group.type === 'health_receptor_group' ||
                                         group.type === 'rotation_controller_group' ||
                                         group.type === 'movement_controller_group' ||
                                         group.type === 'gradient_movement_controller' ||
                                         group.type === 'light_receptor_group';
      const finalDisplayHeight = (group.collapsed && isReceptorOrControllerGroup)
        ? titleBarHeight
        : displayHeight;

      // 修复坐标变换：正确的顺序应该是先缩放再平移
      const screenPos = {
        x: group.x * scale + snnTopology.canvasOffset.x,
        y: group.y * scale + snnTopology.canvasOffset.y
      };
      const screenSize = {
        width: displayWidth * scale,
        height: finalDisplayHeight * scale
      };

      // 绘制组背景（只在非收起状态或非视觉感受器/旋转控制器组时绘制）
      if (!group.collapsed || !isReceptorOrControllerGroup) {
        ctx.fillStyle = isSelected ? 'rgba(255, 0, 0, 0.1)' : 'rgba(100, 100, 100, 0.2)';
        ctx.fillRect(screenPos.x, screenPos.y, screenSize.width, screenSize.height);

        // 绘制组边框
        ctx.strokeStyle = isSelected ? '#ff0000' : '#888';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(screenPos.x, screenPos.y, screenSize.width, screenSize.height);
      }

      // 计算标题位置
      let titleOffsetY, titleBarWidth;

      if (isReceptorOrControllerGroup) {
        // 视觉感受器和旋转控制器组：标题栏在组框上方
        titleOffsetY = -titleBarHeight - 5; // 标题显示在组框上方，留5px间距
        titleBarWidth = screenSize.width;
      } else {
        // 其他组：标题栏在组框内部顶部
        titleOffsetY = 0;
        titleBarWidth = screenSize.width;
      }

      // 绘制标题背景
      const titleBgColor = isReceptorOrControllerGroup
        ? (isSelected ? 'rgba(0, 123, 255, 0.3)' : 'rgba(108, 117, 125, 0.4)')
        : (isSelected ? 'rgba(255, 0, 0, 0.2)' : 'rgba(120, 120, 120, 0.3)');

      ctx.fillStyle = titleBgColor;
      ctx.fillRect(screenPos.x, screenPos.y + titleOffsetY, titleBarWidth, titleBarHeight);

      // 绘制标题边框
      ctx.strokeStyle = isSelected ? '#ff0000' : '#999';
      ctx.lineWidth = Math.max(1, scale * 0.8);
      ctx.strokeRect(screenPos.x, screenPos.y + titleOffsetY, titleBarWidth, titleBarHeight);

      // 绘制收起按钮 - 缩放感知的尺寸，位置在标题栏中
      const buttonSize = Math.max(10, Math.min(16, 12 * Math.sqrt(scale)));
      const buttonMargin = Math.max(3, 4 * Math.sqrt(scale));
      const buttonX = screenPos.x + buttonMargin;
      const buttonY = screenPos.y + titleOffsetY + buttonMargin;
      
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

      // 绘制标题文字 - 缩放感知的字体大小
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'left';
      const maxTitleWidth = screenSize.width - buttonSize - buttonMargin * 3 - 4;

      // Truncate title if too long in collapsed state
      let displayTitle = title;
      if (group.collapsed) {
        const collapsedFontSize = Math.max(8, Math.min(12, 10 * Math.sqrt(scale)));
        ctx.font = `bold ${collapsedFontSize}px Arial`;
        const titleWidth = ctx.measureText(title).width;
        if (titleWidth > maxTitleWidth) {
          displayTitle = title.substring(0, Math.floor(title.length * maxTitleWidth / titleWidth)) + '...';
        }
      }

      const textY = screenPos.y + titleOffsetY + titleBarHeight * 0.7; // 垂直居中在标题栏中
      ctx.fillText(displayTitle, screenPos.x + buttonSize + buttonMargin * 2 + 2, textY);

      // 如果组已收起，显示省略号（但视觉感受器和旋转控制器组不显示）
      if (group.collapsed && !isReceptorOrControllerGroup) {
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

    // 绘制感受器和效应器组内的节点
    const drawGroupNodes = (nodes: any[], groups: NodeGroup[]) => {
      // 过滤可见的组
      const visibleGroups = groups.filter(group => {
        if (group.pluginInstance) {
          return globalPluginManager.isPluginVisible(group.pluginInstance);
        }
        return true;
      });

      nodes.forEach(node => {
        // 检查节点是否属于某个可见组
        const parentGroup = visibleGroups.find(group =>
          (group.type === 'sensor_group' ||
           group.type === 'effector_group' ||
           group.type === 'visual_receptor_group' ||
           group.type === 'health_receptor_group' ||
           group.type === 'rotation_controller_group' ||
           group.type === 'movement_controller_group' ||
           group.type === 'gradient_movement_controller' ||
           group.type === 'light_receptor_group') &&
          (group.nodes?.includes(node.id) || group.neurons?.includes(node.id))
        );

        if (parentGroup && !parentGroup.collapsed) {
          // 使用世界坐标，让画布变换矩阵来处理坐标变换
          const nodeRadius = node.type === 'voltage_input' ? 4 : 8;
          const scaledRadius = nodeRadius * Math.sqrt(scale);

          // 节点颜色
          const nodeColor = node.type === 'voltage_input' ? '#28a745' : '#fd7e14';
          const isSelected = selectedNode === node.id;

          // 获取节点状态
          const state = node.getState ? node.getState() : { voltage: 0, isSpiking: false };

          // 绘制空心节点
          ctx.beginPath();
          ctx.arc(node.x, node.y, scaledRadius, 0, 2 * Math.PI);
          ctx.fillStyle = 'transparent';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#ff0000' : nodeColor;
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();

          // 在节点中心显示膜电位
          ctx.fillStyle = isSelected ? '#ff0000' : nodeColor;
          ctx.font = `${Math.max(8, scaledRadius * 0.6)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const voltage = Math.round(state.voltage || 0);
          ctx.fillText(voltage.toString(), node.x, node.y);

          // 绘制放电状态
          if (state.isSpiking) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, scaledRadius + 3, 0, 2 * Math.PI);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }
      });
    };
    
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
    
    // 绘制感受器和效应器组内的节点（统一处理，避免重复绘制）
    if (legacyTopology?.nodes) {
      drawGroupNodes(legacyTopology.nodes, neuronGroups);
    }

    ctx.restore();
  };
  
  const drawNode = (ctx: CanvasRenderingContext2D, node: any, isSelected: boolean) => {
    // 过滤可见的组
    const visibleGroups = neuronGroups.filter(group => {
      if (group.pluginInstance) {
        return globalPluginManager.isPluginVisible(group.pluginInstance);
      }
      return true;
    });

    const isInCollapsedGroup = visibleGroups.some(g => g.collapsed && (g.neurons?.includes(node.id) || g.nodes?.includes(node.id)));
    if (isInCollapsedGroup) return;

    // Check if node is in a visible group
    const parentGroup = visibleGroups.find(g => !g.collapsed && (g.neurons?.includes(node.id) || g.nodes?.includes(node.id)));
    const isInGroup = !!parentGroup;

    const isMultiSelected = interactionState.selectedNodes.includes(node.id);
    const shouldHighlight = isSelected || isMultiSelected;

    // Adjust node size based on type and whether it's in a group
    // 优化缩放算法，防止节点过大遮挡箭头，确保与边绘制逻辑一致
    const scale = snnTopology?.canvasScale || 1;
    let radius: number;

    if (node.type === 'voltage_input') {
      // 电压输入节点：基础尺寸4，使用更保守的缩放
      const baseSize = 4;
      radius = Math.max(2, Math.min(6, baseSize + (scale - 1) * 2));
    } else if (isInGroup) {
      // 组内节点：基础尺寸8，使用线性缩放但限制最大值
      const baseSize = 8;
      radius = Math.max(4, Math.min(10, baseSize + (scale - 1) * 1.5));
    } else {
      // 普通节点：基础尺寸15，使用对数缩放防止过大
      const baseSize = 15;
      radius = Math.max(8, Math.min(20, baseSize + Math.log(scale) * 3));
    }
    
    const state = node.getState ? node.getState() : { voltage: 0, isSpiking: false };

    let color = '#888888';
    if (state.isSpiking) color = '#ff6b6b';

    // 绘制空心节点
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'transparent';
    ctx.fill();

    if (shouldHighlight) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 在节点中心显示膜电位
    ctx.fillStyle = shouldHighlight ? '#ff0000' : color;
    ctx.font = `${Math.max(10, radius * 0.6)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const voltage = Math.round(state.voltage || 0);
    ctx.fillText(voltage.toString(), node.x, node.y);
  };
  
  const drawEdge = (ctx: CanvasRenderingContext2D, fromNode: any, toNode: any, edge: any, isSelected: boolean) => {
    const isMultiSelected = interactionState.selectedEdges.includes(edge.id);
    const shouldHighlight = isSelected || isMultiSelected;
    const state = edge.getState();
    
    // 获取节点实际半径的函数，与drawNode保持一致
    const getNodeRadius = (node: any, isInGroup: boolean, scale: number) => {
      if (node.type === 'voltage_input') {
        const baseSize = 4;
        return Math.max(2, Math.min(6, baseSize + (scale - 1) * 2));
      } else if (isInGroup) {
        const baseSize = 8;
        return Math.max(4, Math.min(10, baseSize + (scale - 1) * 1.5));
      } else {
        const baseSize = 15;
        return Math.max(8, Math.min(20, baseSize + Math.log(scale) * 3));
      }
    };

    const scale = snnTopology?.canvasScale || 1;

    // 检查节点是否在收起的组内，如果是则使用组的中心点
    let actualFromNode = fromNode;
    let actualToNode = toNode;
    let fromRadius = 15; // 默认普通节点半径
    let toRadius = 15; // 默认普通节点半径

    // 检查起点是否在收起的组内
    const fromNodeGroup = neuronGroups.find(g => g.collapsed && (g.neurons?.includes(fromNode.id) || g.nodes?.includes(fromNode.id)));
    if (fromNodeGroup) {
      actualFromNode = {
        x: fromNodeGroup.x + fromNodeGroup.width / 2,
        y: fromNodeGroup.y + fromNodeGroup.height / 2
      };
      fromRadius = Math.min(fromNodeGroup.width, fromNodeGroup.height) / 2;
    } else {
      // 获取起点节点的实际半径，与绘制逻辑保持一致
      const fromNodeInGroup = neuronGroups.some(g => !g.collapsed && (g.neurons?.includes(fromNode.id) || g.nodes?.includes(fromNode.id)));
      fromRadius = getNodeRadius(fromNode, fromNodeInGroup, scale);
    }

    // 检查终点是否在收起的组内
    const toNodeGroup = neuronGroups.find(g => g.collapsed && (g.neurons?.includes(toNode.id) || g.nodes?.includes(toNode.id)));
    if (toNodeGroup) {
      actualToNode = {
        x: toNodeGroup.x + toNodeGroup.width / 2,
        y: toNodeGroup.y + toNodeGroup.height / 2
      };
      toRadius = Math.min(toNodeGroup.width, toNodeGroup.height) / 2;
    } else {
      // 获取终点节点的实际半径，与绘制逻辑保持一致
      const toNodeInGroup = neuronGroups.some(g => !g.collapsed && (g.neurons?.includes(toNode.id) || g.nodes?.includes(toNode.id)));
      toRadius = getNodeRadius(toNode, toNodeInGroup, scale);
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
    const fromInGroup = neuronGroups.some(g => g.neurons?.includes(fromNode.id) || g.nodes?.includes(fromNode.id));
    const toInGroup = neuronGroups.some(g => g.neurons?.includes(toNode.id) || g.nodes?.includes(toNode.id));
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
    if (!selectionBox.visible) return;
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

  // 监听插件状态更新事件，触发重绘
  useEffect(() => {
    const unsubscribe = globalEventBus.on('plugins:state-updated', () => {
      draw();
    });
    return unsubscribe;
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