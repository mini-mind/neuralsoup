import { VoltageAccumulatorNode } from '../../core/entities/types';
import { NodeGroup, Vector2D } from '../types/editor.types';

/**
 * 旋转控制器组管理器
 * 专门管理旋转控制器组的创建、更新和维护
 */
export class RotationControllerGroupManager {
  private static readonly NODE_COUNT = 2;
  private static readonly NODE_SPACING = 40;
  private static readonly GROUP_PADDING = 10;
  private static readonly GROUP_HEIGHT = 50;
  private static readonly TITLE_BAR_HEIGHT = 20;

  /**
   * 创建旋转控制器组
   */
  static createGroup(position: Vector2D, timestamp: number = Date.now()): {
    group: NodeGroup;
    nodes: any[];
  } {
    const groupId = `rotation_group_${timestamp}`;
    const nodes: any[] = [];
    
    // 创建节点
    for (let i = 0; i < this.NODE_COUNT; i++) {
      const nodeId = `rotation_controller_${timestamp}_${i}`;
      const relativePos = this.getNodeRelativePosition(i);
      const absolutePos = {
        x: position.x + relativePos.x,
        y: position.y + relativePos.y
      };
      
      const voltageAccumulatorNode = new VoltageAccumulatorNode(nodeId, absolutePos.x, absolutePos.y);
      const node = {
        id: nodeId,
        type: 'voltage_accumulator',
        x: absolutePos.x,
        y: absolutePos.y,
        processor: voltageAccumulatorNode,
        getState: () => voltageAccumulatorNode.getState(),
        setPosition: (x: number, y: number) => voltageAccumulatorNode.setPosition(x, y),
        // 记录相对位置
        relativeX: relativePos.x,
        relativeY: relativePos.y
      };
      nodes.push(node);
    }

    // 创建节点组
    const group: NodeGroup = {
      id: groupId,
      type: 'rotation_controller_group',
      x: position.x,
      y: position.y,
      width: this.NODE_COUNT * this.NODE_SPACING + this.GROUP_PADDING * 2,
      height: this.GROUP_HEIGHT,
      collapsed: false,
      nodes: nodes.map(n => n.id),
      neurons: nodes.map(n => n.id)
    };

    return { group, nodes };
  }

  /**
   * 获取单个节点的相对位置（水平排列）
   */
  private static getNodeRelativePosition(index: number): Vector2D {
    const nodeRadius = 8; // 组内节点半径
    return {
      x: this.GROUP_PADDING + nodeRadius + index * this.NODE_SPACING,
      y: this.TITLE_BAR_HEIGHT + (this.GROUP_HEIGHT - this.TITLE_BAR_HEIGHT) / 2
    };
  }

  /**
   * 更新组位置，同时保持节点相对位置
   */
  static updateGroupPosition(
    group: NodeGroup, 
    newPosition: Vector2D, 
    nodes: any[]
  ): { group: NodeGroup; nodes: any[] } {
    const deltaX = newPosition.x - group.x;
    const deltaY = newPosition.y - group.y;

    // 更新组位置
    const updatedGroup = { ...group, x: newPosition.x, y: newPosition.y };

    // 更新节点位置，保持相对位置
    const updatedNodes = nodes.map(node => {
      if (group.neurons.includes(node.id)) {
        const newX = newPosition.x + (node.relativeX || 0);
        const newY = newPosition.y + (node.relativeY || 0);
        
        // 更新节点位置
        if (node.processor && node.processor.setPosition) {
          node.processor.setPosition(newX, newY);
        }
        
        return {
          ...node,
          x: newX,
          y: newY
        };
      }
      return node;
    });

    return { group: updatedGroup, nodes: updatedNodes };
  }

  /**
   * 验证是否为旋转控制器组
   */
  static isRotationControllerGroup(group: NodeGroup): boolean {
    return group.type === 'rotation_controller_group';
  }

  /**
   * 获取组的默认尺寸
   */
  static getGroupDimensions(): { width: number; height: number } {
    return {
      width: this.NODE_COUNT * this.NODE_SPACING + this.GROUP_PADDING * 2,
      height: this.GROUP_HEIGHT
    };
  }
} 