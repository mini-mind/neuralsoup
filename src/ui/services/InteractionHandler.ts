import { NetworkTopology } from '../../core/entities/topology';
import { Vector2D, InteractionState, NodeGroup, CanvasTransform } from '../types/editor.types';
import { canvasToWorld, distanceToLineSegment, distance } from '../utils/geometry.utils';
import { VisualReceptorGroupManager } from './VisualReceptorGroupManager';
import { RotationControllerGroupManager } from './RotationControllerGroupManager';

/**
 * 图交互处理服务
 * 负责处理画布上的各种鼠标交互逻辑
 */
export class InteractionHandler {
  private static readonly NODE_CLICK_RADIUS = 20;
  private static readonly EDGE_CLICK_TOLERANCE = 10;

  /**
   * 查找点击位置的节点
   */
  static findNodeAtPosition(
    worldPos: Vector2D,
    networkTopology: NetworkTopology | null
  ): any | null {
    if (!networkTopology) return null;
    
    return networkTopology.getAllNodes().find((node: any) => {
      const dist = distance(node, worldPos);
      return dist < this.NODE_CLICK_RADIUS;
    });
  }

  /**
   * 查找点击位置的边
   */
  static findEdgeAtPosition(
    worldPos: Vector2D,
    networkTopology: NetworkTopology | null
  ): any | null {
    if (!networkTopology) return null;
    
    const edges = networkTopology.getAllEdges();
    for (const edge of edges) {
      const fromNode = networkTopology.getNode(edge.fromNodeId);
      const toNode = networkTopology.getNode(edge.toNodeId);
      
      if (fromNode && toNode) {
        const dist = distanceToLineSegment(worldPos, fromNode, toNode);
        if (dist < this.EDGE_CLICK_TOLERANCE) return edge;
      }
    }
    return null;
  }

  /**
   * 查找点击位置的节点组
   */
  static findGroupAtPosition(
    worldPos: Vector2D,
    groups: NodeGroup[]
  ): NodeGroup | null {
    return groups.find(group => 
      worldPos.x >= group.x && 
      worldPos.x <= group.x + group.width &&
      worldPos.y >= group.y && 
      worldPos.y <= group.y + group.height
    ) || null;
  }

  /**
   * 获取选择框内的节点
   */
  static getNodesInSelectionBox(
    selectionBox: { startX: number; startY: number; endX: number; endY: number },
    transform: CanvasTransform,
    networkTopology: NetworkTopology | null
  ): any[] {
    if (!networkTopology) return [];
    
    const minX = Math.min(selectionBox.startX, selectionBox.endX);
    const maxX = Math.max(selectionBox.startX, selectionBox.endX);
    const minY = Math.min(selectionBox.startY, selectionBox.endY);
    const maxY = Math.max(selectionBox.startY, selectionBox.endY);
    
    return networkTopology.getAllNodes().filter((node: any) => {
      const screenX = node.x * transform.scale + transform.offset.x;
      const screenY = node.y * transform.scale + transform.offset.y;
      
      return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
    });
  }

  /**
   * 处理节点拖拽
   */
  static handleNodeDrag(
    nodeIds: string[],
    deltaX: number,
    deltaY: number,
    scale: number,
    networkTopology: NetworkTopology | null,
    nodeGroups?: NodeGroup[]
  ): void {
    if (!networkTopology) return;

    const scaledDx = deltaX / scale;
    const scaledDy = deltaY / scale;

    nodeIds.forEach(nodeId => {
      const node = networkTopology.getNode(nodeId);
      if (!node) return;

      // 检查节点是否在组内
      const parentGroup = nodeGroups?.find(g => g.neurons.includes(nodeId));
      
      let newX = node.x + scaledDx;
      let newY = node.y + scaledDy;

      // 如果节点在组内，限制其移动范围
      if (parentGroup) {
        const nodeRadius = 8; // 组内节点的半径
        const padding = 5; // 边界内边距
        const titleBarHeight = 20; // 标题栏高度
        
        // 限制x坐标
        const minX = parentGroup.x + padding + nodeRadius;
        const maxX = parentGroup.x + parentGroup.width - padding - nodeRadius;
        newX = Math.max(minX, Math.min(maxX, newX));
        
        // 限制y坐标（考虑标题栏高度）
        const minY = parentGroup.y + titleBarHeight + padding + nodeRadius;
        const maxY = parentGroup.y + parentGroup.height - padding - nodeRadius;
        newY = Math.max(minY, Math.min(maxY, newY));
      }

      node.setPosition(newX, newY);
    });
  }

  /**
   * 处理节点组拖拽
   */
  static handleGroupDrag(
    groups: NodeGroup[],
    groupIds: string[],
    deltaX: number,
    deltaY: number,
    scale: number,
    networkTopology: NetworkTopology | null,
    snnTopology?: any
  ): { groups: NodeGroup[]; nodes: any[] } {
    const scaledDx = deltaX / scale;
    const scaledDy = deltaY / scale;

    let updatedGroups = [...groups];
    let updatedNodes = snnTopology?.nodes ? [...snnTopology.nodes] : [];

    // 为每个被拖拽的组更新位置
    groupIds.forEach(groupId => {
      const groupIndex = updatedGroups.findIndex(g => g.id === groupId);
      if (groupIndex !== -1) {
        const group = updatedGroups[groupIndex];
        const newPosition = {
          x: group.x + scaledDx,
          y: group.y + scaledDy
        };

        // 使用专门的管理器来更新组和节点位置
        if (VisualReceptorGroupManager.isVisualReceptorGroup(group)) {
          const result = VisualReceptorGroupManager.updateGroupPosition(
            group,
            newPosition,
            updatedNodes
          );
          updatedGroups[groupIndex] = result.group;
          updatedNodes = result.nodes;
        } else if (RotationControllerGroupManager.isRotationControllerGroup(group)) {
          const result = RotationControllerGroupManager.updateGroupPosition(
            group,
            newPosition,
            updatedNodes
          );
          updatedGroups[groupIndex] = result.group;
          updatedNodes = result.nodes;
        } else {
          // 对于其他类型的组，使用原来的逻辑
          updatedGroups[groupIndex] = { ...group, x: newPosition.x, y: newPosition.y };
          
          // 移动组内节点
          group.nodes.forEach(nodeId => {
            const networkNode = networkTopology?.getNode(nodeId);
            if (networkNode) {
              networkNode.setPosition(networkNode.x + scaledDx, networkNode.y + scaledDy);
            }
            
            const snnNodeIndex = updatedNodes.findIndex((node: any) => node.id === nodeId);
            if (snnNodeIndex !== -1) {
              updatedNodes[snnNodeIndex] = {
                ...updatedNodes[snnNodeIndex],
                x: updatedNodes[snnNodeIndex].x + scaledDx,
                y: updatedNodes[snnNodeIndex].y + scaledDy
              };
              if (updatedNodes[snnNodeIndex].processor?.setPosition) {
                updatedNodes[snnNodeIndex].processor.setPosition(
                  updatedNodes[snnNodeIndex].x,
                  updatedNodes[snnNodeIndex].y
                );
              }
            }
          });
        }
      }
    });

    return { groups: updatedGroups, nodes: updatedNodes };
  }

  /**
   * 转换鼠标事件坐标为世界坐标
   */
  static getWorldPosition(
    e: React.MouseEvent<HTMLCanvasElement>,
    transform: CanvasTransform
  ): Vector2D {
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    return canvasToWorld(canvasPos, transform);
  }

  /**
   * 获取画布坐标
   */
  static getCanvasPosition(e: React.MouseEvent<HTMLCanvasElement>): Vector2D {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * 检测收起按钮点击
   */
  static findCollapseButtonAtPosition(
    worldPos: Vector2D,
    groups: NodeGroup[],
    canvasScale: number,
    canvasOffset: Vector2D
  ): NodeGroup | null {
    const buttonSize = 12;
    const buttonMargin = 4;
    
    for (const group of groups) {
      // 计算按钮在世界坐标中的位置
      const buttonWorldX = group.x + buttonMargin / canvasScale;
      const buttonWorldY = group.y + buttonMargin / canvasScale;
      const buttonWorldSize = buttonSize / canvasScale;
      
      if (worldPos.x >= buttonWorldX && 
          worldPos.x <= buttonWorldX + buttonWorldSize &&
          worldPos.y >= buttonWorldY && 
          worldPos.y <= buttonWorldY + buttonWorldSize) {
        return group;
      }
    }
    
    return null;
  }
} 