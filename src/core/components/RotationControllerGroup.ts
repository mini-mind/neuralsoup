import { VoltageAccumulatorNode } from '../entities/types';

// 定义核心层自己的基础类型，避免依赖UI层
interface Vector2D {
  x: number;
  y: number;
}

interface NodeGroup {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  nodes: string[];
  neurons: string[];
}

/**
 * 旋转控制器节点组类
 * 负责创建和管理旋转控制器节点组
 */
export class RotationControllerGroup {
  private static readonly NODE_COUNT = 2;
  private static readonly NODE_SPACING = 30;
  private static readonly GROUP_WIDTH = 75;
  private static readonly GROUP_HEIGHT = 50;
  private static readonly GROUP_PADDING = 12.5;
  private static readonly TITLE_BAR_HEIGHT = 20; // 标题栏高度

  /**
   * 创建旋转控制器组
   */
  static create(position: Vector2D, timestamp: number = Date.now()): {
    group: NodeGroup;
    nodes: any[];
  } {
    const groupId = `rotation_group_${timestamp}`;
    const nodes: any[] = [];
    
    // 创建2个电压累积节点水平排列（考虑标题栏高度）
    for (let i = 0; i < this.NODE_COUNT; i++) {
      const nodeId = `rotation_effector_${timestamp}_${i}`;
      const nodePos = {
        x: position.x + this.GROUP_PADDING + i * this.NODE_SPACING,
        y: position.y + this.TITLE_BAR_HEIGHT + (this.GROUP_HEIGHT - this.TITLE_BAR_HEIGHT) / 2
      };
      
      const voltageAccumulatorNode = new VoltageAccumulatorNode(nodeId, nodePos.x, nodePos.y);
      const node = {
        id: nodeId,
        type: 'voltage_accumulator',
        x: nodePos.x,
        y: nodePos.y,
        processor: voltageAccumulatorNode, // 使用processor而不是neuron
        getState: () => voltageAccumulatorNode.getState(),
        setPosition: (x: number, y: number) => voltageAccumulatorNode.setPosition(x, y)
      };
      nodes.push(node);
    }

    // 创建节点组
    const group: NodeGroup = {
      id: groupId,
      type: 'rotation_controller_group',
      x: position.x,
      y: position.y,
      width: this.GROUP_WIDTH,
      height: this.GROUP_HEIGHT,
      collapsed: false,
      nodes: nodes.map(n => n.id),
      neurons: nodes.map(n => n.id)
    };

    return { group, nodes };
  }

  /**
   * 获取组内节点的相对位置
   */
  static getNodeRelativePositions(): Vector2D[] {
    const positions: Vector2D[] = [];
    for (let i = 0; i < this.NODE_COUNT; i++) {
      positions.push({
        x: this.GROUP_PADDING + i * this.NODE_SPACING,
        y: this.TITLE_BAR_HEIGHT + (this.GROUP_HEIGHT - this.TITLE_BAR_HEIGHT) / 2
      });
    }
    return positions;
  }

  /**
   * 验证是否为旋转控制器组
   */
  static isRotationControllerGroup(group: NodeGroup): boolean {
    return group.type === 'rotation_controller_group';
  }
} 