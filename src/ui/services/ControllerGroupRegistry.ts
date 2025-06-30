import { VisualReceptorGroupManager, HealthReceptorGroupManager } from "./VisualReceptorGroupManager";
import { RotationControllerGroupManager, MovementControllerGroupManager } from "./RotationControllerGroupManager";
import { NodeGroup, Vector2D } from "../types/editor.types";

/**
 * 控制器组注册表
 * 确保每种感受器和效应器只有一个实例
 */
export class ControllerGroupRegistry {
  private static instance: ControllerGroupRegistry | null = null;
  private initialized: boolean = false;
  
  // 存储已创建的控制器组
  private visualReceptorGroup: { group: NodeGroup; nodes: any[]; pluginInstance: any } | null = null;
  private rotationControllerGroup: { group: NodeGroup; nodes: any[]; pluginInstance: any } | null = null;
  private movementControllerGroup: { group: NodeGroup; nodes: any[]; pluginInstance: any } | null = null;
  private healthReceptorGroup: { group: NodeGroup; nodes: any[]; pluginInstance: any } | null = null;

  private constructor() {}

  static getInstance(): ControllerGroupRegistry {
    if (!ControllerGroupRegistry.instance) {
      ControllerGroupRegistry.instance = new ControllerGroupRegistry();
    }
    return ControllerGroupRegistry.instance;
  }

  /**
   * 初始化所有控制器组（只执行一次）
   */
  initializeControllerGroups(): {
    groups: NodeGroup[];
    nodes: any[];
  } {
    if (this.initialized) {
      console.warn('控制器组已经初始化，返回现有实例');
      return {
        groups: this.getAllGroups(),
        nodes: this.getAllNodes()
      };
    }

    console.log('开始初始化控制器组...');

    // 使用时间戳确保唯一性
    const timestamp = Date.now();

    // 创建每种控制器的唯一实例
    this.visualReceptorGroup = VisualReceptorGroupManager.createGroup({ x: 100, y: 50 }, timestamp);
    this.rotationControllerGroup = RotationControllerGroupManager.createGroup({ x: 100, y: 400 }, timestamp + 1);
    this.movementControllerGroup = MovementControllerGroupManager.createGroup({ x: 300, y: 400 }, timestamp + 2);
    this.healthReceptorGroup = HealthReceptorGroupManager.createGroup({ x: 100, y: 225 }, timestamp + 3);

    this.initialized = true;

    const groups = this.getAllGroups();
    const nodes = this.getAllNodes();

    console.log(`控制器组初始化完成: ${groups.length} 个组, ${nodes.length} 个节点`);
    console.log('组类型:', groups.map(g => g.type));

    return {
      groups,
      nodes
    };
  }

  /**
   * 获取所有控制器组
   */
  getAllGroups(): NodeGroup[] {
    const groups: NodeGroup[] = [];
    if (this.visualReceptorGroup) groups.push(this.visualReceptorGroup.group);
    if (this.rotationControllerGroup) groups.push(this.rotationControllerGroup.group);
    if (this.movementControllerGroup) groups.push(this.movementControllerGroup.group);
    if (this.healthReceptorGroup) groups.push(this.healthReceptorGroup.group);
    return groups;
  }

  /**
   * 获取所有控制器节点
   */
  getAllNodes(): any[] {
    const nodes: any[] = [];
    if (this.visualReceptorGroup) nodes.push(...this.visualReceptorGroup.nodes);
    if (this.rotationControllerGroup) nodes.push(...this.rotationControllerGroup.nodes);
    if (this.movementControllerGroup) nodes.push(...this.movementControllerGroup.nodes);
    if (this.healthReceptorGroup) nodes.push(...this.healthReceptorGroup.nodes);
    return nodes;
  }

  /**
   * 获取特定的控制器组
   */
  getVisualReceptorGroup() { return this.visualReceptorGroup; }
  getRotationControllerGroup() { return this.rotationControllerGroup; }
  getMovementControllerGroup() { return this.movementControllerGroup; }
  getHealthReceptorGroup() { return this.healthReceptorGroup; }

  /**
   * 重置注册表（用于测试或重新初始化）
   */
  reset(): void {
    this.initialized = false;
    this.visualReceptorGroup = null;
    this.rotationControllerGroup = null;
    this.movementControllerGroup = null;
    this.healthReceptorGroup = null;
    console.log('控制器组注册表已重置');
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 检查是否有重复的组类型
   */
  checkForDuplicates(allGroups: NodeGroup[]): void {
    const groupTypes = allGroups.map(g => g.type);
    const uniqueTypes = new Set(groupTypes);

    if (groupTypes.length !== uniqueTypes.size) {
      console.error('发现重复的控制器组类型!');
      const duplicates = groupTypes.filter((type, index) => groupTypes.indexOf(type) !== index);
      console.error('重复的类型:', duplicates);

      // 显示所有组的详细信息
      allGroups.forEach(group => {
        console.log(`组: ${group.id}, 类型: ${group.type}, 位置: (${group.x}, ${group.y})`);
      });
    } else {
      console.log('没有发现重复的控制器组');
    }
  }
} 