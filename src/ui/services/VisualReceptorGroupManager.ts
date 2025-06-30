import { VoltageInputNode } from '../../core/entities/types';
import { VisualReceptor, HealthReceptor } from '../../core/entities/neuron';
import { NodeGroup, Vector2D } from '../types/editor.types';

/**
 * 视觉感受器组管理器
 * 专门管理视觉感受器组的创建、更新和维护
 */
export class VisualReceptorGroupManager {
  private static readonly NODE_COUNT = 8;
  private static readonly NODE_SPACING = 25;
  private static readonly GROUP_PADDING = 10;
  private static readonly GROUP_HEIGHT = 50;
  private static readonly TITLE_BAR_HEIGHT = 20;

  /**
   * 创建视觉感受器组
   */
  static createGroup(position: Vector2D, timestamp: number = Date.now()): {
    group: NodeGroup;
    nodes: any[];
    pluginInstance: VisualReceptor;
  } {
    const groupId = `visual_group_${timestamp}`;
    const nodes: any[] = [];

    // 创建视觉感受器插件实例
    const visualReceptor = new VisualReceptor(groupId, position.x, position.y);

    // 使用视觉感受器内部的节点
    const receptorNodes = visualReceptor.getReceptors();
    for (let i = 0; i < this.NODE_COUNT; i++) {
      const relativePos = this.getNodeRelativePosition(i);
      const absolutePos = {
        x: position.x + relativePos.x,
        y: position.y + relativePos.y
      };

      // 使用内部节点而不是创建新的
      const voltageInputNode = receptorNodes[i];
      voltageInputNode.setPosition(absolutePos.x, absolutePos.y);

      const node = {
        id: voltageInputNode.id,
        type: 'voltage_input',
        x: absolutePos.x,
        y: absolutePos.y,
        processor: voltageInputNode, // 使用内部节点
        getState: () => voltageInputNode.getState(),
        setPosition: (x: number, y: number) => voltageInputNode.setPosition(x, y),
        // 记录相对位置
        relativeX: relativePos.x,
        relativeY: relativePos.y
      };
      nodes.push(node);
    }

    // 创建节点组
    const group: NodeGroup = {
      id: groupId,
      type: 'visual_receptor_group',
      x: position.x,
      y: position.y,
      width: this.NODE_COUNT * this.NODE_SPACING + this.GROUP_PADDING * 2,
      height: this.GROUP_HEIGHT,
      collapsed: false,
      nodes: nodes.map(n => n.id),
      neurons: nodes.map(n => n.id),
      pluginInstance: visualReceptor // 关联插件实例
    };

    return { group, nodes, pluginInstance: visualReceptor };
  }

  /**
   * 获取单个节点的相对位置
   */
  private static getNodeRelativePosition(index: number): Vector2D {
    const nodeRadius = 4; // 组内节点半径
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
   * 验证是否为视觉感受器组
   */
  static isVisualReceptorGroup(group: NodeGroup): boolean {
    return group.type === 'visual_receptor_group';
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
 * 健康感受器组管理器
 * 专门管理健康感受器组的创建、更新和维护
 */
export class HealthReceptorGroupManager {
  private static readonly NODE_COUNT = 2; // 健康 + 非健康
  private static readonly NODE_SPACING = 40;
  private static readonly GROUP_PADDING = 10;
  private static readonly GROUP_HEIGHT = 50;
  private static readonly TITLE_BAR_HEIGHT = 20;

  /**
   * 创建健康感受器组
   */
  static createGroup(position: Vector2D, timestamp: number = Date.now()): {
    group: NodeGroup;
    nodes: any[];
    pluginInstance: HealthReceptor;
  } {
    const groupId = `health_group_${timestamp}`;
    const nodes: any[] = [];

    // 创建健康感受器插件实例
    const healthReceptor = new HealthReceptor(groupId, position.x, position.y);

    // 使用健康感受器内部的节点
    const nodeLabels = ['健康度', '非健康度'];
    const healthNode = healthReceptor.getHealthNode();
    const unhealthNode = healthReceptor.getUnhealthNode();
    const internalNodes = [healthNode, unhealthNode];

    for (let i = 0; i < this.NODE_COUNT; i++) {
      const relativePos = this.getNodeRelativePosition(i);
      const absolutePos = {
        x: position.x + relativePos.x,
        y: position.y + relativePos.y
      };

      // 使用内部节点而不是创建新的
      const voltageInputNode = internalNodes[i];
      voltageInputNode.setPosition(absolutePos.x, absolutePos.y);

      const node = {
        id: voltageInputNode.id,
        type: 'voltage_input',
        x: absolutePos.x,
        y: absolutePos.y,
        processor: voltageInputNode, // 使用内部节点
        getState: () => voltageInputNode.getState(),
        setPosition: (x: number, y: number) => voltageInputNode.setPosition(x, y),
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
      type: 'health_receptor_group',
      x: position.x,
      y: position.y,
      width: this.NODE_COUNT * this.NODE_SPACING + this.GROUP_PADDING * 2,
      height: this.GROUP_HEIGHT,
      collapsed: false,
      nodes: nodes.map(n => n.id),
      neurons: nodes.map(n => n.id),
      pluginInstance: healthReceptor // 关联插件实例
    };

    return { group, nodes, pluginInstance: healthReceptor };
  }

  /**
   * 获取单个节点的相对位置
   */
  private static getNodeRelativePosition(index: number): Vector2D {
    const nodeRadius = 4; // 组内节点半径
    return {
      x: this.GROUP_PADDING + nodeRadius + index * this.NODE_SPACING,
      y: this.TITLE_BAR_HEIGHT + (this.GROUP_HEIGHT - this.TITLE_BAR_HEIGHT) / 2
    };
  }
} 