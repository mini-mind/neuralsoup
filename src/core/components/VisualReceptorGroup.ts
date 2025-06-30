import { VoltageInputNode } from '../entities/types';

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
 * 视觉感受器节点组类
 * 负责创建和管理视觉感受器节点组
 */
export class VisualReceptorGroup {
  private static readonly NODE_COUNT = 8;
  private static readonly NODE_SPACING = 25;
  private static readonly GROUP_PADDING = 10;
  private static readonly GROUP_HEIGHT = 50;
  private static readonly TITLE_BAR_HEIGHT = 20; // 标题栏高度

  /**
   * 创建视觉感受器组
   */
  static create(position: Vector2D, timestamp: number = Date.now()): {
    group: NodeGroup;
    nodes: any[];
  } {
    const groupId = `visual_group_${timestamp}`;
    const nodes: any[] = [];
    
    // 创建8个电压输入节点横向排列（考虑标题栏高度）
    for (let i = 0; i < this.NODE_COUNT; i++) {
      const nodeId = `visual_sensor_${timestamp}_${i}`;
      const nodePos = {
        x: position.x + this.GROUP_PADDING + i * this.NODE_SPACING,
        y: position.y + this.TITLE_BAR_HEIGHT + (this.GROUP_HEIGHT - this.TITLE_BAR_HEIGHT) / 2
      };
      
      const voltageInputNode = new VoltageInputNode(nodeId, nodePos.x, nodePos.y);
      const node = {
        id: nodeId,
        type: 'voltage_input',
        x: nodePos.x,
        y: nodePos.y,
        processor: voltageInputNode, // 使用processor而不是neuron
        getState: () => voltageInputNode.getState(),
        setPosition: (x: number, y: number) => voltageInputNode.setPosition(x, y)
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
   * 验证是否为视觉感受器组
   */
  static isVisualReceptorGroup(group: NodeGroup): boolean {
    return group.type === 'visual_receptor_group';
  }
} 