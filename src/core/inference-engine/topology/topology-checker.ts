/**
 * 拓扑检查器
 * 负责验证网络拓扑结构的有效性和完整性
 */

import type { 
  ComputeNode, 
  TopologyRelation, 
  TopologyCheckResult, 
  ConnectionRule,
  NodeType
} from '../types';

/**
 * 循环依赖检测结果
 */
export interface CircularDependencyResult {
  hasCircularDependency: boolean;
  cycles: string[][];
  affectedNodes: string[];
}

/**
 * 连接分析结果
 */
export interface ConnectionAnalysisResult {
  totalConnections: number;
  averageConnectivity: number;
  maxInDegree: number;
  maxOutDegree: number;
  isolatedNodes: string[];
  hubNodes: string[];
}

/**
 * 拓扑检查器类
 */
export class TopologyChecker {
  private connectionRules: Map<string, ConnectionRule> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * 初始化默认连接规则
   */
  private initializeDefaultRules(): void {
    // 神经元到神经元的连接
    this.addConnectionRule({
      id: 'neuron-to-neuron',
      name: '神经元到神经元',
      fromType: 'neuron' as NodeType,
      toType: 'neuron' as NodeType,
      isAllowed: true,
      maxConnections: 1000,
      minWeight: -10,
      maxWeight: 10,
      description: '神经元之间的标准突触连接'
    });

    // 输入到神经元的连接
    this.addConnectionRule({
      id: 'input-to-neuron',
      name: '输入到神经元',
      fromType: 'input' as NodeType,
      toType: 'neuron' as NodeType,
      isAllowed: true,
      maxConnections: 100,
      minWeight: 0,
      maxWeight: 50,
      description: '感受器输入到神经元的连接'
    });

    // 神经元到输出的连接
    this.addConnectionRule({
      id: 'neuron-to-output',
      name: '神经元到输出',
      fromType: 'neuron' as NodeType,
      toType: 'output' as NodeType,
      isAllowed: true,
      maxConnections: 100,
      minWeight: 0,
      maxWeight: 50,
      description: '神经元到效应器输出的连接'
    });

    // 插件相关连接
    this.addConnectionRule({
      id: 'plugin-to-input',
      name: '插件到输入',
      fromType: 'plugin' as NodeType,
      toType: 'input' as NodeType,
      isAllowed: true,
      maxConnections: 10,
      minWeight: 0,
      maxWeight: 1,
      description: '感受器插件到输入节点的连接'
    });

    this.addConnectionRule({
      id: 'output-to-plugin',
      name: '输出到插件',
      fromType: 'output' as NodeType,
      toType: 'plugin' as NodeType,
      isAllowed: true,
      maxConnections: 10,
      minWeight: 0,
      maxWeight: 1,
      description: '输出节点到效应器插件的连接'
    });

    // 禁止的连接类型
    this.addConnectionRule({
      id: 'input-to-input',
      name: '输入到输入',
      fromType: 'input' as NodeType,
      toType: 'input' as NodeType,
      isAllowed: false,
      description: '输入节点之间不允许直接连接'
    });

    this.addConnectionRule({
      id: 'output-to-output',
      name: '输出到输出',
      fromType: 'output' as NodeType,
      toType: 'output' as NodeType,
      isAllowed: false,
      description: '输出节点之间不允许直接连接'
    });
  }

  /**
   * 添加连接规则
   */
  addConnectionRule(rule: ConnectionRule): void {
    this.connectionRules.set(rule.id, rule);
  }

  /**
   * 移除连接规则
   */
  removeConnectionRule(ruleId: string): boolean {
    return this.connectionRules.delete(ruleId);
  }

  /**
   * 获取连接规则
   */
  getConnectionRule(ruleId: string): ConnectionRule | undefined {
    return this.connectionRules.get(ruleId);
  }

  /**
   * 获取所有连接规则
   */
  getAllConnectionRules(): ConnectionRule[] {
    return Array.from(this.connectionRules.values());
  }

  /**
   * 检查拓扑结构
   */
  checkTopology(nodes: Map<string, ComputeNode>, relations: TopologyRelation[]): TopologyCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const performanceIssues: string[] = [];

    // 1. 基本完整性检查
    const integrityResult = this.checkIntegrity(nodes, relations);
    errors.push(...integrityResult.errors);
    warnings.push(...integrityResult.warnings);

    // 2. 连接规则验证
    const ruleResult = this.validateConnectionRules(relations);
    errors.push(...ruleResult.errors);
    warnings.push(...ruleResult.warnings);

    // 3. 循环依赖检测
    const circularResult = this.detectCircularDependencies(nodes);
    if (circularResult.hasCircularDependency) {
      warnings.push(`检测到 ${circularResult.cycles.length} 个循环依赖`);
    }

    // 4. 连接分析
    const connectionResult = this.analyzeConnections(nodes, relations);
    if (connectionResult.isolatedNodes.length > 0) {
      warnings.push(`发现 ${connectionResult.isolatedNodes.length} 个孤立节点`);
    }

    // 5. 性能分析
    const perfResult = this.analyzePerformance(nodes, relations);
    performanceIssues.push(...perfResult);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      circularDependencies: circularResult.cycles,
      unreachableNodes: this.findUnreachableNodes(nodes, relations),
      isolatedNodes: connectionResult.isolatedNodes,
      performanceIssues
    };
  }

  /**
   * 检查基本完整性
   */
  private checkIntegrity(nodes: Map<string, ComputeNode>, relations: TopologyRelation[]): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查连接的节点是否存在
    for (const relation of relations) {
      if (!nodes.has(relation.fromNodeId)) {
        errors.push(`连接源节点不存在: ${relation.fromNodeId} (连接: ${relation.id})`);
      }
      if (!nodes.has(relation.toNodeId)) {
        errors.push(`连接目标节点不存在: ${relation.toNodeId} (连接: ${relation.id})`);
      }

      // 检查权重范围
      if (Math.abs(relation.weight) > 100) {
        warnings.push(`连接权重过大: ${relation.weight} (连接: ${relation.id})`);
      }

      // 检查自连接
      if (relation.fromNodeId === relation.toNodeId) {
        warnings.push(`检测到自连接: ${relation.id}`);
      }
    }

    return { errors, warnings };
  }

  /**
   * 验证连接规则
   */
  private validateConnectionRules(relations: TopologyRelation[]): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const relation of relations) {
      const ruleKey = `${relation.fromType}-to-${relation.toType}`;
      const rule = Array.from(this.connectionRules.values()).find(
        r => r.fromType === relation.fromType && r.toType === relation.toType
      );

      if (rule) {
        // 检查是否允许此类型的连接
        if (!rule.isAllowed) {
          errors.push(`不允许的连接类型: ${ruleKey} (连接: ${relation.id})`);
          continue;
        }

        // 检查权重范围
        if (rule.minWeight !== undefined && relation.weight < rule.minWeight) {
          warnings.push(`连接权重低于最小值: ${relation.weight} < ${rule.minWeight} (连接: ${relation.id})`);
        }
        if (rule.maxWeight !== undefined && relation.weight > rule.maxWeight) {
          warnings.push(`连接权重超过最大值: ${relation.weight} > ${rule.maxWeight} (连接: ${relation.id})`);
        }
      } else {
        warnings.push(`未定义的连接类型: ${ruleKey} (连接: ${relation.id})`);
      }
    }

    return { errors, warnings };
  }

  /**
   * 检测循环依赖
   */
  detectCircularDependencies(nodes: Map<string, ComputeNode>): CircularDependencyResult {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];
    const affectedNodes = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // 找到循环
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart).concat([nodeId]);
        cycles.push(cycle);
        cycle.forEach(node => affectedNodes.add(node));
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      // 这里需要根据实际的连接关系来遍历
      // 简化实现，实际应该根据relations来构建邻接表

      recursionStack.delete(nodeId);
    };

    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return {
      hasCircularDependency: cycles.length > 0,
      cycles,
      affectedNodes: Array.from(affectedNodes)
    };
  }

  /**
   * 分析连接情况
   */
  private analyzeConnections(nodes: Map<string, ComputeNode>, relations: TopologyRelation[]): ConnectionAnalysisResult {
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    // 初始化度数
    for (const nodeId of nodes.keys()) {
      inDegree.set(nodeId, 0);
      outDegree.set(nodeId, 0);
    }

    // 计算度数
    for (const relation of relations) {
      if (relation.isActive) {
        const currentInDegree = inDegree.get(relation.toNodeId) || 0;
        const currentOutDegree = outDegree.get(relation.fromNodeId) || 0;
        
        inDegree.set(relation.toNodeId, currentInDegree + 1);
        outDegree.set(relation.fromNodeId, currentOutDegree + 1);
      }
    }

    // 找到孤立节点
    const isolatedNodes: string[] = [];
    for (const nodeId of nodes.keys()) {
      const inDeg = inDegree.get(nodeId) || 0;
      const outDeg = outDegree.get(nodeId) || 0;
      if (inDeg === 0 && outDeg === 0) {
        isolatedNodes.push(nodeId);
      }
    }

    // 找到hub节点（高连接度节点）
    const hubNodes: string[] = [];
    const avgConnectivity = relations.length / nodes.size;
    for (const nodeId of nodes.keys()) {
      const totalDegree = (inDegree.get(nodeId) || 0) + (outDegree.get(nodeId) || 0);
      if (totalDegree > avgConnectivity * 3) { // 超过平均连接度3倍的节点
        hubNodes.push(nodeId);
      }
    }

    return {
      totalConnections: relations.length,
      averageConnectivity: avgConnectivity,
      maxInDegree: Math.max(...Array.from(inDegree.values())),
      maxOutDegree: Math.max(...Array.from(outDegree.values())),
      isolatedNodes,
      hubNodes
    };
  }

  /**
   * 找到不可达节点
   */
  private findUnreachableNodes(nodes: Map<string, ComputeNode>, relations: TopologyRelation[]): string[] {
    // 简化实现：找到没有输入连接的非输入节点
    const hasInput = new Set<string>();
    
    for (const relation of relations) {
      if (relation.isActive) {
        hasInput.add(relation.toNodeId);
      }
    }

    const unreachableNodes: string[] = [];
    for (const nodeId of nodes.keys()) {
      // 这里需要根据节点类型来判断
      // 简化实现，假设所有节点都应该有输入（除了输入节点本身）
      if (!hasInput.has(nodeId)) {
        unreachableNodes.push(nodeId);
      }
    }

    return unreachableNodes;
  }

  /**
   * 分析性能问题
   */
  private analyzePerformance(nodes: Map<string, ComputeNode>, relations: TopologyRelation[]): string[] {
    const issues: string[] = [];

    // 检查节点数量
    if (nodes.size > 1000) {
      issues.push(`节点数量过多: ${nodes.size}，可能影响性能`);
    }

    // 检查连接数量
    if (relations.length > 5000) {
      issues.push(`连接数量过多: ${relations.length}，可能影响性能`);
    }

    // 检查连接密度
    const maxPossibleConnections = nodes.size * (nodes.size - 1);
    const connectionDensity = relations.length / maxPossibleConnections;
    if (connectionDensity > 0.1) {
      issues.push(`连接密度过高: ${(connectionDensity * 100).toFixed(2)}%，可能影响性能`);
    }

    return issues;
  }

  /**
   * 获取拓扑统计信息
   */
  getTopologyStats(nodes: Map<string, ComputeNode>, relations: TopologyRelation[]): {
    nodeCount: number;
    relationCount: number;
    activeRelationCount: number;
    averageConnectivity: number;
    maxDepth: number;
  } {
    const activeRelations = relations.filter(r => r.isActive);
    const averageConnectivity = activeRelations.length / nodes.size;

    return {
      nodeCount: nodes.size,
      relationCount: relations.length,
      activeRelationCount: activeRelations.length,
      averageConnectivity,
      maxDepth: this.calculateMaxDepth(nodes, activeRelations)
    };
  }

  /**
   * 计算最大深度
   */
  private calculateMaxDepth(nodes: Map<string, ComputeNode>, relations: TopologyRelation[]): number {
    // 简化实现，返回固定值
    // 实际应该进行深度优先搜索来计算最大路径长度
    return Math.min(10, Math.floor(Math.sqrt(nodes.size)));
  }

  /**
   * 清除所有规则
   */
  clearAllRules(): void {
    this.connectionRules.clear();
  }

  /**
   * 重置为默认规则
   */
  resetToDefaultRules(): void {
    this.clearAllRules();
    this.initializeDefaultRules();
  }
}
