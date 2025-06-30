/**
 * 梯度运动控制器组管理器
 * 负责创建和管理梯度运动控制器的UI组件
 */

import { GradientMovementController } from '../../core/entities/neuron';
import { VoltageAccumulatorNode } from '../../core/entities/types';
import type { NodeGroup } from '../types/NodeTypes';
import type { Vector2D } from '../types/CommonTypes';

export class GradientMovementControllerGroupManager {
  private static readonly NODE_COUNT = 1;
  private static readonly GROUP_WIDTH = 80;
  private static readonly GROUP_HEIGHT = 60;

  /**
   * 创建梯度运动控制器组
   */
  static createGroup(position: Vector2D, timestamp: number = Date.now()): {
    group: NodeGroup;
    nodes: any[];
    pluginInstance: GradientMovementController;
  } {
    const groupId = `gradient_movement_group_${timestamp}`;
    const nodes: any[] = [];

    // 创建梯度运动控制器插件实例
    const gradientController = new GradientMovementController(groupId, position.x, position.y);

    // 使用梯度运动控制器内部的节点
    const gradientNode = gradientController.getGradientNode();
    const relativePos = this.getNodeRelativePosition(0);
    const absolutePos = {
      x: position.x + relativePos.x,
      y: position.y + relativePos.y
    };

    // 设置内部节点的位置
    gradientNode.setPosition(absolutePos.x, absolutePos.y);

    const node = {
      id: gradientNode.id,
      type: 'voltage_accumulator',
      x: absolutePos.x,
      y: absolutePos.y,
      processor: gradientNode, // 使用内部节点
      getState: () => gradientNode.getState(),
      setPosition: (x: number, y: number) => gradientNode.setPosition(x, y),
      // 记录相对位置和标签
      relativeX: relativePos.x,
      relativeY: relativePos.y,
      label: '梯度强度'
    };
    nodes.push(node);

    // 创建组
    const group: NodeGroup = {
      id: groupId,
      type: 'gradient_movement_controller',
      title: '梯度运动控制器',
      x: position.x,
      y: position.y,
      width: this.GROUP_WIDTH,
      height: this.GROUP_HEIGHT,
      nodes: nodes.map(n => n.id),
      isCollapsed: false,
      pluginInstance: gradientController,
      // 组的拖拽和缩放处理
      setPosition: (x: number, y: number) => {
        const deltaX = x - group.x;
        const deltaY = y - group.y;
        group.x = x;
        group.y = y;
        
        // 更新所有节点的位置
        nodes.forEach(node => {
          node.x += deltaX;
          node.y += deltaY;
          node.setPosition(node.x, node.y);
        });
        
        // 更新插件实例位置
        gradientController.setPosition(x, y);
      },
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
        gradientController.setPosition(newX, newY);
      }
    };

    return { group, nodes, pluginInstance: gradientController };
  }

  /**
   * 获取节点的相对位置
   */
  private static getNodeRelativePosition(index: number): Vector2D {
    // 单个节点居中放置
    return {
      x: this.GROUP_WIDTH / 2 - 15, // 节点宽度约30，所以偏移15
      y: this.GROUP_HEIGHT / 2 - 15 // 节点高度约30，所以偏移15
    };
  }

  /**
   * 更新组的标题位置
   */
  static updateGroupTitlePosition(group: NodeGroup): void {
    // 梯度运动控制器组的标题位置固定在顶部
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
    group.isCollapsed = !group.isCollapsed;
    
    // 根据折叠状态调整高度
    if (group.isCollapsed) {
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
      title: group.title,
      nodeCount: this.NODE_COUNT,
      isActive: group.pluginInstance ? true : false
    };
  }
}
