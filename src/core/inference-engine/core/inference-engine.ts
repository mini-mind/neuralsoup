/**
 * 推理引擎核心
 * 负责管理节点、连接关系和执行推理计算
 */

import type { 
  ComputeNode, 
  TopologyRelation, 
  NodeInfo, 
  EngineState, 
  PerformanceMetrics,
  ComputeOrderItem,
  TopologyCheckResult,
  NodeType
} from '../types';
import { ErrorType, type InferenceEngineError } from '../types';

/**
 * 推理引擎核心类
 */
export class InferenceEngine {
  private nodes: Map<string, NodeInfo> = new Map();
  private relations: Map<string, TopologyRelation> = new Map();
  private computeOrder: ComputeOrderItem[] = [];
  private isInitialized: boolean = false;
  private updateCount: number = 0;
  private totalUpdateTime: number = 0;
  private lastUpdateTime: number = 0;
  private performanceWarnings: string[] = [];

  constructor() {
    this.initialize();
  }

  /**
   * 初始化推理引擎
   */
  private initialize(): void {
    this.nodes.clear();
    this.relations.clear();
    this.computeOrder = [];
    this.updateCount = 0;
    this.totalUpdateTime = 0;
    this.lastUpdateTime = 0;
    this.performanceWarnings = [];
    this.isInitialized = true;
  }

  /**
   * 添加节点
   */
  addNode(nodeId: string, node: ComputeNode, type: NodeType): void {
    if (this.nodes.has(nodeId)) {
      console.warn(`节点 ${nodeId} 已存在，将被覆盖`);
    }

    const nodeInfo: NodeInfo = {
      id: nodeId,
      node,
      type,
      isActive: true,
      lastUpdateTime: 0,
      metadata: {}
    };

    this.nodes.set(nodeId, nodeInfo);
    this.invalidateComputeOrder();
  }

  /**
   * 移除节点
   */
  removeNode(nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) {
      return false;
    }

    // 移除相关的连接
    const relationsToRemove: string[] = [];
    for (const [relationId, relation] of this.relations) {
      if (relation.fromNodeId === nodeId || relation.toNodeId === nodeId) {
        relationsToRemove.push(relationId);
      }
    }

    relationsToRemove.forEach(relationId => {
      this.relations.delete(relationId);
    });

    this.nodes.delete(nodeId);
    this.invalidateComputeOrder();
    return true;
  }

  /**
   * 添加连接关系
   */
  addRelation(
    fromNodeId: string, 
    toNodeId: string, 
    weight: number, 
    fromType: NodeType, 
    toType: NodeType
  ): string {
    const relationId = `${fromNodeId}->${toNodeId}`;
    
    if (this.relations.has(relationId)) {
      console.warn(`连接 ${relationId} 已存在，将被覆盖`);
    }

    const relation: TopologyRelation = {
      id: relationId,
      fromNodeId,
      toNodeId,
      weight,
      fromType,
      toType,
      isActive: true,
      metadata: {}
    };

    this.relations.set(relationId, relation);
    this.invalidateComputeOrder();
    return relationId;
  }

  /**
   * 移除连接关系
   */
  removeRelation(fromNodeId: string, toNodeId: string): boolean {
    const relationId = `${fromNodeId}->${toNodeId}`;
    const removed = this.relations.delete(relationId);
    
    if (removed) {
      this.invalidateComputeOrder();
    }
    
    return removed;
  }

  /**
   * 主要更新方法
   */
  update(deltaTime: number, externalInputs?: Map<string, number>): void {
    const startTime = performance.now();

    try {
      // 确保计算顺序是最新的
      this.ensureComputeOrder();

      // 应用外部输入
      if (externalInputs) {
        this.applyExternalInputs(externalInputs);
      }

      // 按拓扑顺序更新节点
      this.updateNodesInOrder(deltaTime);

      // 更新性能统计
      const updateTime = performance.now() - startTime;
      this.updatePerformanceStats(updateTime);

    } catch (error) {
      this.handleUpdateError(error as Error);
    }
  }

  /**
   * 应用外部输入
   */
  private applyExternalInputs(externalInputs: Map<string, number>): void {
    for (const [nodeId, inputValue] of externalInputs) {
      const nodeInfo = this.nodes.get(nodeId);
      if (nodeInfo && nodeInfo.isActive) {
        // 对于输入节点，直接设置电压值
        if (nodeInfo.node.voltage !== undefined) {
          nodeInfo.node.voltage = inputValue;
        }
        // 对于有setInput方法的节点，调用该方法
        if (typeof (nodeInfo.node as any).setInput === 'function') {
          (nodeInfo.node as any).setInput(inputValue);
        }
      }
    }
  }

  /**
   * 按拓扑顺序更新节点
   */
  private updateNodesInOrder(deltaTime: number): void {
    for (const orderItem of this.computeOrder) {
      const nodeInfo = this.nodes.get(orderItem.nodeId);
      if (!nodeInfo || !nodeInfo.isActive) continue;

      try {
        // 计算输入值
        const inputValue = this.calculateNodeInput(orderItem.nodeId);
        
        // 更新节点
        if (nodeInfo.node.update) {
          nodeInfo.node.update(inputValue, deltaTime);
        }

        nodeInfo.lastUpdateTime = performance.now();

      } catch (error) {
        console.error(`更新节点 ${orderItem.nodeId} 时出错:`, error);
        this.performanceWarnings.push(`节点 ${orderItem.nodeId} 更新失败: ${(error as Error).message}`);
      }
    }
  }

  /**
   * 计算节点输入值
   */
  private calculateNodeInput(nodeId: string): number {
    let totalInput = 0;

    for (const relation of this.relations.values()) {
      if (relation.toNodeId === nodeId && relation.isActive) {
        const fromNode = this.nodes.get(relation.fromNodeId);
        if (fromNode && fromNode.isActive) {
          let outputValue = 0;

          // 根据节点类型正确获取输出值
          if (fromNode.node.getOutput) {
            // 对于VoltageAccumulatorNode等有getOutput方法的节点
            outputValue = fromNode.node.getOutput();
          } else if (fromNode.node.getState) {
            // 对于神经元节点，只有在发放动作电位时才传递信号
            const state = fromNode.node.getState();
            if (state.isSpiking) {
              // 神经元发放动作电位时，传递固定强度的信号（如30mV）
              outputValue = 30; // 标准动作电位幅度
            } else {
              outputValue = 0; // 没有发放时不传递信号
            }
          } else if (fromNode.node.voltage !== undefined) {
            // 兼容性处理：对于其他类型的节点，直接使用电压值
            outputValue = fromNode.node.voltage;
          }

          totalInput += outputValue * relation.weight;
        }
      }
    }

    return totalInput;
  }

  /**
   * 确保计算顺序是最新的
   */
  private ensureComputeOrder(): void {
    if (this.computeOrder.length === 0) {
      this.computeOrder = this.calculateComputeOrder();
    }
  }

  /**
   * 计算拓扑排序顺序
   */
  private calculateComputeOrder(): ComputeOrderItem[] {
    const inDegree = new Map<string, number>();
    const dependencies = new Map<string, string[]>();
    const dependents = new Map<string, string[]>();

    // 初始化
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
      dependencies.set(nodeId, []);
      dependents.set(nodeId, []);
    }

    // 计算入度和依赖关系
    for (const relation of this.relations.values()) {
      if (relation.isActive) {
        const currentInDegree = inDegree.get(relation.toNodeId) || 0;
        inDegree.set(relation.toNodeId, currentInDegree + 1);
        
        dependencies.get(relation.toNodeId)?.push(relation.fromNodeId);
        dependents.get(relation.fromNodeId)?.push(relation.toNodeId);
      }
    }

    // Kahn算法进行拓扑排序
    const queue: string[] = [];
    const result: ComputeOrderItem[] = [];
    let level = 0;

    // 找到所有入度为0的节点
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const currentLevelSize = queue.length;
      
      for (let i = 0; i < currentLevelSize; i++) {
        const nodeId = queue.shift()!;
        
        result.push({
          nodeId,
          level,
          dependencies: dependencies.get(nodeId) || [],
          dependents: dependents.get(nodeId) || []
        });

        // 减少相邻节点的入度
        for (const relation of this.relations.values()) {
          if (relation.fromNodeId === nodeId && relation.isActive) {
            const toNodeId = relation.toNodeId;
            const newInDegree = (inDegree.get(toNodeId) || 0) - 1;
            inDegree.set(toNodeId, newInDegree);
            
            if (newInDegree === 0) {
              queue.push(toNodeId);
            }
          }
        }
      }
      
      level++;
    }

    // 检查是否有循环依赖
    if (result.length !== this.nodes.size) {
      const remainingNodes = Array.from(this.nodes.keys()).filter(
        nodeId => !result.some(item => item.nodeId === nodeId)
      );
      this.performanceWarnings.push(`检测到循环依赖，涉及节点: ${remainingNodes.join(', ')}`);
    }

    return result;
  }

  /**
   * 使计算顺序失效
   */
  private invalidateComputeOrder(): void {
    this.computeOrder = [];
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(updateTime: number): void {
    this.updateCount++;
    this.totalUpdateTime += updateTime;
    this.lastUpdateTime = updateTime;

    // 性能警告
    if (updateTime > 16) { // 超过16ms (60fps阈值)
      this.performanceWarnings.push(`更新时间过长: ${updateTime.toFixed(2)}ms`);
    }

    // 保持警告数量在合理范围内
    if (this.performanceWarnings.length > 100) {
      this.performanceWarnings = this.performanceWarnings.slice(-50);
    }
  }

  /**
   * 处理更新错误
   */
  private handleUpdateError(error: Error): void {
    const inferenceError: InferenceEngineError = {
      type: ErrorType.UPDATE_ERROR,
      message: error.message,
      timestamp: Date.now(),
      stack: error.stack,
      context: {
        nodeCount: this.nodes.size,
        relationCount: this.relations.size,
        updateCount: this.updateCount
      }
    };

    console.error('推理引擎更新错误:', inferenceError);
    this.performanceWarnings.push(`更新错误: ${error.message}`);
  }

  // === 公共查询方法 ===

  /**
   * 获取所有节点
   */
  getAllNodes(): ComputeNode[] {
    return Array.from(this.nodes.values()).map(info => info.node);
  }

  /**
   * 获取所有连接关系
   */
  getRelations(): TopologyRelation[] {
    return Array.from(this.relations.values());
  }

  /**
   * 获取计算顺序
   */
  getComputeOrder(): ComputeOrderItem[] {
    this.ensureComputeOrder();
    return [...this.computeOrder];
  }

  /**
   * 获取所有节点状态
   */
  getAllNodeStates(): Map<string, any> {
    const states = new Map<string, any>();
    
    for (const [nodeId, nodeInfo] of this.nodes) {
      if (nodeInfo.node.getState) {
        states.set(nodeId, nodeInfo.node.getState());
      } else if (nodeInfo.node.voltage !== undefined) {
        states.set(nodeId, { voltage: nodeInfo.node.voltage });
      }
    }
    
    return states;
  }

  /**
   * 获取节点信息
   */
  getNodeInfo(nodeId: string): NodeInfo | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * 获取引擎状态
   */
  getEngineState(): EngineState {
    const activeNodes = Array.from(this.nodes.values()).filter(info => info.isActive).length;
    const activeRelations = Array.from(this.relations.values()).filter(rel => rel.isActive).length;

    return {
      isInitialized: this.isInitialized,
      isRunning: true, // 简化实现
      totalNodes: this.nodes.size,
      totalRelations: this.relations.size,
      activeNodes,
      activeRelations,
      lastUpdateTime: this.lastUpdateTime,
      updateCount: this.updateCount,
      averageUpdateTime: this.updateCount > 0 ? this.totalUpdateTime / this.updateCount : 0
    };
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return {
      updateTime: this.lastUpdateTime,
      nodeCount: this.nodes.size,
      relationCount: this.relations.size,
      warnings: [...this.performanceWarnings]
    };
  }

  /**
   * 获取性能警告
   */
  getPerformanceWarnings(): string[] {
    return [...this.performanceWarnings];
  }

  /**
   * 清除性能警告
   */
  clearPerformanceWarnings(): void {
    this.performanceWarnings = [];
  }

  /**
   * 验证拓扑结构
   */
  validateTopology(): TopologyCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const circularDependencies: string[][] = [];

    // 基本验证
    for (const relation of this.relations.values()) {
      if (!this.nodes.has(relation.fromNodeId)) {
        errors.push(`连接源节点不存在: ${relation.fromNodeId}`);
      }
      if (!this.nodes.has(relation.toNodeId)) {
        errors.push(`连接目标节点不存在: ${relation.toNodeId}`);
      }
    }

    // 检查计算顺序是否包含所有节点
    this.ensureComputeOrder();
    if (this.computeOrder.length < this.nodes.size) {
      const missingNodes = Array.from(this.nodes.keys()).filter(
        nodeId => !this.computeOrder.some(item => item.nodeId === nodeId)
      );
      warnings.push(`部分节点未包含在计算顺序中: ${missingNodes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      circularDependencies,
      unreachableNodes: [],
      isolatedNodes: [],
      performanceIssues: this.performanceWarnings
    };
  }

  /**
   * 清除所有数据
   */
  clearAll(): void {
    this.nodes.clear();
    this.relations.clear();
    this.computeOrder = [];
    this.performanceWarnings = [];
  }

  /**
   * 销毁推理引擎
   */
  destroy(): void {
    this.clearAll();
    this.isInitialized = false;
    this.updateCount = 0;
    this.totalUpdateTime = 0;
    this.lastUpdateTime = 0;
  }
}
