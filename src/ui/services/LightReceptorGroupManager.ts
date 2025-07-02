/**
 * 光感受器组管理器
 * 负责创建和管理光感受器的UI组件
 */

import { LightReceptor } from '../../core/entities/neuron';
// import { VoltageInputNode } from '../../core/entities/types';
import type { NodeGroup, Vector2D } from '../types/editor.types';

export class LightReceptorGroupManager {
  private static readonly NODE_COUNT = 1;
  private static readonly GROUP_WIDTH = 80;
  private static readonly GROUP_HEIGHT = 60;

  /**
   * 创建光感受器组
   */
  static createGroup(position: Vector2D, timestamp: number = Date.now()): {
    group: NodeGroup;
    nodes: any[];
    pluginInstance: LightReceptor;
  } {
    const groupId = `light_receptor_group_${timestamp}`;
    const nodes: any[] = [];

    // 创建光感受器插件实例
    const lightReceptor = new LightReceptor(groupId, position.x, position.y);

    // 使用光感受器内部的节点，而不是创建新的节点
    const lightNode = lightReceptor.getLightNode();
    const relativePos = this.getNodeRelativePosition(0);
    const absolutePos = {
      x: position.x + relativePos.x,
      y: position.y + relativePos.y
    };

    // 设置内部节点的位置
    lightNode.setPosition(absolutePos.x, absolutePos.y);

    const node = {
      id: lightNode.id,
      type: 'voltage_input',
      x: absolutePos.x,
      y: absolutePos.y,
      processor: lightNode, // 使用光感受器内部的节点
      getState: () => lightNode.getState(),
      setPosition: (x: number, y: number) => lightNode.setPosition(x, y),
      // 记录相对位置和标签
      relativeX: relativePos.x,
      relativeY: relativePos.y,
      label: '光强度'
    };
    nodes.push(node);

    // 创建组
    const group: NodeGroup = {
      id: groupId,
      type: 'light_receptor_group',
      title: '光感受器',
      x: position.x,
      y: position.y,
      width: this.GROUP_WIDTH,
      height: this.GROUP_HEIGHT,
      nodes: nodes.map(n => n.id),
      collapsed: false,
      pluginInstance: lightReceptor,
      // 组的拖拽和缩放处理通过外部管理器处理
      scale: (factor: number, centerX: number, centerY: number) => {
        // 缩放组
        const newX = centerX + (group.x - centerX) * factor;
        const newY = centerY + (group.y - centerY) * factor;
        const newWidth = group.width * factor;
        const newHeight = group.height * factor;
        
        group.x = newX;
        group.y = newY;
        group.width = newWidth;
        group.height = newHeight;
        
        // 缩放并重新定位节点
        nodes.forEach(node => {
          const newNodeX = newX + node.relativeX * factor;
          const newNodeY = newY + node.relativeY * factor;
          node.x = newNodeX;
          node.y = newNodeY;
          node.setPosition(newNodeX, newNodeY);
        });
        
        // 更新插件实例位置
        lightReceptor.setPosition(newX, newY);
      }
    };

    return { group, nodes, pluginInstance: lightReceptor };
  }

  /**
   * 获取节点的相对位置
   */
  private static getNodeRelativePosition(_index: number): Vector2D {
    // 单个节点居中放置
    return {
      x: this.GROUP_WIDTH / 2 - 15, // 节点宽度约30，所以偏移15
      y: this.GROUP_HEIGHT / 2 - 15 // 节点高度约30，所以偏移15
    };
  }

  /**
   * 更新组的标题位置
   */
  static updateGroupTitlePosition(_group: NodeGroup): void {
    // 光感受器组的标题位置固定在顶部
    // 这个方法供渲染器调用
  }

  /**
   * 检查点是否在组内
   */
  static isPointInGroup(group: NodeGroup, x: number, y: number): boolean {
    return x >= group.x && 
           x <= group.x + group.width && 
           y >= group.y && 
           y <= group.y + group.height;
  }

  /**
   * 获取组的边界框
   */
  static getGroupBounds(group: NodeGroup): {
    left: number;
    right: number;
    top: number;
    bottom: number;
  } {
    return {
      left: group.x,
      right: group.x + group.width,
      top: group.y,
      bottom: group.y + group.height
    };
  }

  /**
   * 切换组的折叠状态
   */
  static toggleCollapse(group: NodeGroup): void {
    group.collapsed = !group.collapsed;

    // 根据折叠状态调整高度
    if (group.collapsed) {
      group.height = 30; // 只显示标题的高度
    } else {
      group.height = this.GROUP_HEIGHT; // 恢复完整高度
    }
  }

  /**
   * 获取组的显示信息
   */
  static getGroupDisplayInfo(group: NodeGroup): {
    title: string;
    nodeCount: number;
    isActive: boolean;
  } {
    return {
      title: group.title || 'Untitled Group',
      nodeCount: this.NODE_COUNT,
      isActive: group.pluginInstance ? true : false
    };
  }
}
