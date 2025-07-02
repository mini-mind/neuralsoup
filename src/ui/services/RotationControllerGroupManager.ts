// import { VoltageAccumulatorNode } from '../../core/entities/types';
import { RotationController, MovementController } from '../../core/entities/neuron';
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
    pluginInstance: RotationController;
  } {
    const groupId = `rotation_group_${timestamp}`;
    const nodes: any[] = [];

    // 创建旋转控制器插件实例
    const rotationController = new RotationController(groupId, position.x, position.y);

    // 使用旋转控制器内部的节点
    const nodeLabels = ['顺时针', '逆时针'];
    const clockwiseNode = rotationController.getClockwiseNode();
    const counterclockwiseNode = rotationController.getCounterclockwiseNode();
    const internalNodes = [clockwiseNode, counterclockwiseNode];

    for (let i = 0; i < this.NODE_COUNT; i++) {
      const relativePos = this.getNodeRelativePosition(i);
      const absolutePos = {
        x: position.x + relativePos.x,
        y: position.y + relativePos.y
      };

      // 使用内部节点而不是创建新的
      const voltageAccumulatorNode = internalNodes[i];
      voltageAccumulatorNode.setPosition(absolutePos.x, absolutePos.y);

      const node = {
        id: voltageAccumulatorNode.id,
        type: 'voltage_accumulator',
        x: absolutePos.x,
        y: absolutePos.y,
        processor: voltageAccumulatorNode, // 使用内部节点
        getState: () => voltageAccumulatorNode.getState(),
        setPosition: (x: number, y: number) => voltageAccumulatorNode.setPosition(x, y),
        // 记录相对位置和标签
        relativeX: relativePos.x,
        relativeY: relativePos.y,
        label: nodeLabels[i]
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
      neurons: nodes.map(n => n.id),
      pluginInstance: rotationController // 关联插件实例
    };

    return { group, nodes, pluginInstance: rotationController };
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
    // 更新组位置
    const updatedGroup = { ...group, x: newPosition.x, y: newPosition.y };

    // 更新节点位置，保持相对位置
    const updatedNodes = nodes.map(node => {
      if (group.neurons && group.neurons.includes(node.id)) {
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

/**
 * 移动控制器组管理器
 * 专门管理移动控制器组的创建、更新和维护
 */
export class MovementControllerGroupManager {
  private static readonly NODE_COUNT = 4; // 上下左右
  private static readonly GROUP_WIDTH = 150;
  private static readonly GROUP_HEIGHT = 80;
  // private static readonly _TITLE_BAR_HEIGHT = 20;

  /**
   * 创建移动控制器组
   */
  static createGroup(position: Vector2D, timestamp: number = Date.now()): {
    group: NodeGroup;
    nodes: any[];
    pluginInstance: MovementController;
  } {
    const groupId = `movement_group_${timestamp}`;
    const nodes: any[] = [];

    // 创建移动控制器插件实例
    const movementController = new MovementController(groupId, position.x, position.y);

    // 使用移动控制器内部的节点
    const nodeLabels = ['上', '下', '左', '右'];
    const upNode = movementController.getUpNode();
    const downNode = movementController.getDownNode();
    const leftNode = movementController.getLeftNode();
    const rightNode = movementController.getRightNode();
    const internalNodes = [upNode, downNode, leftNode, rightNode];

    for (let i = 0; i < this.NODE_COUNT; i++) {
      const relativePos = this.getNodeRelativePosition(i);
      const absolutePos = {
        x: position.x + relativePos.x,
        y: position.y + relativePos.y
      };

      // 使用内部节点而不是创建新的
      const voltageAccumulatorNode = internalNodes[i];
      voltageAccumulatorNode.setPosition(absolutePos.x, absolutePos.y);

      const node = {
        id: voltageAccumulatorNode.id,
        type: 'voltage_accumulator',
        x: absolutePos.x,
        y: absolutePos.y,
        processor: voltageAccumulatorNode, // 使用内部节点
        getState: () => voltageAccumulatorNode.getState(),
        setPosition: (x: number, y: number) => voltageAccumulatorNode.setPosition(x, y),
        // 记录相对位置和标签
        relativeX: relativePos.x,
        relativeY: relativePos.y,
        label: nodeLabels[i]
      };
      nodes.push(node);
    }

    // 创建节点组
    const group: NodeGroup = {
      id: groupId,
      type: 'movement_controller_group',
      x: position.x,
      y: position.y,
      width: this.GROUP_WIDTH,
      height: this.GROUP_HEIGHT,
      collapsed: false,
      nodes: nodes.map(n => n.id),
      neurons: nodes.map(n => n.id),
      pluginInstance: movementController // 关联插件实例
    };

    return { group, nodes, pluginInstance: movementController };
  }

  /**
   * 获取单个节点的相对位置（十字形排列）
   */
  private static getNodeRelativePosition(index: number): Vector2D {
    const padding = 25;
    const nodePositions = [
      { x: this.GROUP_WIDTH / 2, y: padding },           // 上
      { x: this.GROUP_WIDTH / 2, y: this.GROUP_HEIGHT - padding }, // 下
      { x: padding, y: this.GROUP_HEIGHT / 2 },          // 左
      { x: this.GROUP_WIDTH - padding, y: this.GROUP_HEIGHT / 2 }  // 右
    ];
    
    return nodePositions[index] || { x: 0, y: 0 };
  }

  /**
   * 更新组位置，同时保持节点相对位置
   */
  static updateGroupPosition(
    group: NodeGroup, 
    newPosition: Vector2D, 
    nodes: any[]
  ): { group: NodeGroup; nodes: any[] } {
    // 更新组位置
    const updatedGroup = { ...group, x: newPosition.x, y: newPosition.y };

    // 更新节点位置，保持相对位置
    const updatedNodes = nodes.map(node => {
      if (group.neurons && group.neurons.includes(node.id)) {
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
   * 验证是否为移动控制器组
   */
  static isMovementControllerGroup(group: NodeGroup): boolean {
    return group.type === 'movement_controller_group';
  }

  /**
   * 获取组的默认尺寸
   */
  static getGroupDimensions(): { width: number; height: number } {
    return {
      width: this.GROUP_WIDTH,
      height: this.GROUP_HEIGHT
    };
  }

  /**
   * 获取移动控制器实例
   */
  static getMovementController(group: NodeGroup): MovementController | null {
    return group.pluginInstance as MovementController || null;
  }
} 