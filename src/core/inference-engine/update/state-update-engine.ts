/**
 * 状态更新引擎
 * 负责高效地更新节点状态，支持多种更新策略
 */

import { UpdateStrategy } from '../types';
import type {
  ComputeNode,
  TopologyRelation,
  UpdateConfig,
  BatchUpdateResult,
  ComputeOrderItem,
  NodeStateCache
} from '../types';

/**
 * 更新统计信息
 */
export interface UpdateStats {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  averageUpdateTime: number;
  lastUpdateTime: number;
  cacheHitRate: number;
}

/**
 * 状态更新引擎类
 */
export class StateUpdateEngine {
  private config: UpdateConfig;
  private stats: UpdateStats;
  private stateCache: Map<string, NodeStateCache> = new Map();
  private performanceWarnings: string[] = [];
  private updateHistory: number[] = [];

  constructor(config?: Partial<UpdateConfig>) {
    this.config = {
      strategy: UpdateStrategy.SEQUENTIAL,
      maxParallelTasks: 4,
      timeSliceMs: 10,
      enableProfiling: false,
      enableStateCache: true,
      cacheSize: 1000,
      timeoutMs: 5000,
      ...config
    };

    this.stats = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      averageUpdateTime: 0,
      lastUpdateTime: 0,
      cacheHitRate: 0
    };
  }

  /**
   * 更新节点状态
   */
  async updateNodes(
    nodes: Map<string, ComputeNode>,
    relations: Map<string, TopologyRelation>,
    computeOrder: ComputeOrderItem[],
    deltaTime: number,
    externalInputs?: Map<string, number>
  ): Promise<BatchUpdateResult> {
    const startTime = performance.now();
    const errors: Array<{ nodeId: string; error: string }> = [];
    const warnings: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      // 应用外部输入
      if (externalInputs) {
        this.applyExternalInputs(nodes, externalInputs);
      }

      // 根据策略选择更新方法
      switch (this.config.strategy) {
        case UpdateStrategy.SEQUENTIAL:
          ({ successCount, failureCount } = await this.updateSequentially(
            nodes, relations, computeOrder, deltaTime, errors
          ));
          break;

        case UpdateStrategy.PARALLEL:
          ({ successCount, failureCount } = await this.updateInParallel(
            nodes, relations, computeOrder, deltaTime, errors
          ));
          break;

        case UpdateStrategy.ADAPTIVE:
          ({ successCount, failureCount } = await this.updateAdaptively(
            nodes, relations, computeOrder, deltaTime, errors
          ));
          break;

        default:
          throw new Error(`未知的更新策略: ${this.config.strategy}`);
      }

      // 更新缓存
      if (this.config.enableStateCache) {
        this.updateStateCache(nodes);
      }

    } catch (error) {
      console.error('状态更新引擎错误:', error);
      errors.push({ nodeId: 'engine', error: (error as Error).message });
      failureCount++;
    }

    // 更新统计信息
    const totalTime = performance.now() - startTime;
    this.updateStats(totalTime, successCount, failureCount);

    // 性能检查
    if (totalTime > this.config.timeSliceMs * 2) {
      warnings.push(`更新时间超过预期: ${totalTime.toFixed(2)}ms`);
    }

    return {
      successCount,
      failureCount,
      totalTime,
      averageTime: successCount > 0 ? totalTime / successCount : 0,
      errors,
      warnings
    };
  }

  /**
   * 应用外部输入
   */
  private applyExternalInputs(nodes: Map<string, ComputeNode>, externalInputs: Map<string, number>): void {
    for (const [nodeId, inputValue] of externalInputs) {
      const node = nodes.get(nodeId);
      if (node) {
        // 设置电压值
        if (node.voltage !== undefined) {
          node.voltage = inputValue;
        }
        // 调用setInput方法
        if (typeof (node as any).setInput === 'function') {
          (node as any).setInput(inputValue);
        }
      }
    }
  }

  /**
   * 顺序更新
   */
  private async updateSequentially(
    nodes: Map<string, ComputeNode>,
    relations: Map<string, TopologyRelation>,
    computeOrder: ComputeOrderItem[],
    deltaTime: number,
    errors: Array<{ nodeId: string; error: string }>
  ): Promise<{ successCount: number; failureCount: number }> {
    let successCount = 0;
    let failureCount = 0;

    for (const orderItem of computeOrder) {
      const node = nodes.get(orderItem.nodeId);
      if (!node) continue;

      try {
        // 检查缓存
        if (this.config.enableStateCache && this.isStateCached(orderItem.nodeId)) {
          successCount++;
          continue;
        }

        // 计算输入值
        const inputValue = this.calculateNodeInput(orderItem.nodeId, nodes, relations);
        
        // 更新节点
        if (node.update) {
          const result = node.update(inputValue, deltaTime);
          if (result !== false) { // 假设返回false表示更新失败
            successCount++;
          } else {
            failureCount++;
            errors.push({ nodeId: orderItem.nodeId, error: '节点更新返回失败' });
          }
        } else {
          successCount++;
        }

      } catch (error) {
        failureCount++;
        errors.push({ 
          nodeId: orderItem.nodeId, 
          error: (error as Error).message 
        });
      }
    }

    return { successCount, failureCount };
  }

  /**
   * 并行更新
   */
  private async updateInParallel(
    nodes: Map<string, ComputeNode>,
    relations: Map<string, TopologyRelation>,
    computeOrder: ComputeOrderItem[],
    deltaTime: number,
    errors: Array<{ nodeId: string; error: string }>
  ): Promise<{ successCount: number; failureCount: number }> {
    let successCount = 0;
    let failureCount = 0;

    // 按层级分组
    const levelGroups = new Map<number, ComputeOrderItem[]>();
    for (const item of computeOrder) {
      if (!levelGroups.has(item.level)) {
        levelGroups.set(item.level, []);
      }
      levelGroups.get(item.level)!.push(item);
    }

    // 按层级顺序处理，每层内部并行
    for (const [level, items] of levelGroups) {
      const promises = items.map(async (orderItem) => {
        const node = nodes.get(orderItem.nodeId);
        if (!node) return { success: false, nodeId: orderItem.nodeId, error: '节点不存在' };

        try {
          // 检查缓存
          if (this.config.enableStateCache && this.isStateCached(orderItem.nodeId)) {
            return { success: true, nodeId: orderItem.nodeId };
          }

          // 计算输入值
          const inputValue = this.calculateNodeInput(orderItem.nodeId, nodes, relations);
          
          // 更新节点
          if (node.update) {
            const result = node.update(inputValue, deltaTime);
            return { 
              success: result !== false, 
              nodeId: orderItem.nodeId,
              error: result === false ? '节点更新返回失败' : undefined
            };
          } else {
            return { success: true, nodeId: orderItem.nodeId };
          }

        } catch (error) {
          return { 
            success: false, 
            nodeId: orderItem.nodeId, 
            error: (error as Error).message 
          };
        }
      });

      // 等待当前层级的所有更新完成
      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          if (result.error) {
            errors.push({ nodeId: result.nodeId, error: result.error });
          }
        }
      }
    }

    return { successCount, failureCount };
  }

  /**
   * 自适应更新
   */
  private async updateAdaptively(
    nodes: Map<string, ComputeNode>,
    relations: Map<string, TopologyRelation>,
    computeOrder: ComputeOrderItem[],
    deltaTime: number,
    errors: Array<{ nodeId: string; error: string }>
  ): Promise<{ successCount: number; failureCount: number }> {
    // 根据历史性能选择策略
    const avgUpdateTime = this.stats.averageUpdateTime;
    const nodeCount = nodes.size;

    if (nodeCount < 50 || avgUpdateTime < this.config.timeSliceMs / 2) {
      // 小规模网络或性能良好时使用顺序更新
      return this.updateSequentially(nodes, relations, computeOrder, deltaTime, errors);
    } else {
      // 大规模网络或性能压力大时使用并行更新
      return this.updateInParallel(nodes, relations, computeOrder, deltaTime, errors);
    }
  }

  /**
   * 计算节点输入值
   */
  private calculateNodeInput(
    nodeId: string, 
    nodes: Map<string, ComputeNode>, 
    relations: Map<string, TopologyRelation>
  ): number {
    let totalInput = 0;
    
    for (const relation of relations.values()) {
      if (relation.toNodeId === nodeId && relation.isActive) {
        const fromNode = nodes.get(relation.fromNodeId);
        if (fromNode) {
          let outputValue = 0;
          
          // 获取输出值
          if (fromNode.getOutput) {
            outputValue = fromNode.getOutput();
          } else if (fromNode.voltage !== undefined) {
            outputValue = fromNode.voltage;
          }
          
          totalInput += outputValue * relation.weight;
        }
      }
    }
    
    return totalInput;
  }

  /**
   * 检查状态是否已缓存
   */
  private isStateCached(nodeId: string): boolean {
    const cached = this.stateCache.get(nodeId);
    if (!cached) return false;

    // 检查缓存是否仍然有效
    const now = performance.now();
    const cacheAge = now - cached.timestamp;
    const isValid = cached.isValid && cacheAge < 100; // 100ms缓存有效期

    if (isValid) {
      cached.accessCount++;
    } else {
      this.stateCache.delete(nodeId);
    }

    return isValid;
  }

  /**
   * 更新状态缓存
   */
  private updateStateCache(nodes: Map<string, ComputeNode>): void {
    const now = performance.now();
    
    for (const [nodeId, node] of nodes) {
      if (this.stateCache.size >= (this.config.cacheSize || 1000)) {
        // 清理最旧的缓存项
        this.cleanupCache();
      }

      const state = node.getState ? node.getState() : { voltage: node.voltage };
      
      this.stateCache.set(nodeId, {
        nodeId,
        state,
        timestamp: now,
        isValid: true,
        accessCount: 0
      });
    }
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    // 移除最少使用的缓存项
    const entries = Array.from(this.stateCache.entries());
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    
    const toRemove = Math.floor(entries.length * 0.2); // 移除20%
    for (let i = 0; i < toRemove; i++) {
      this.stateCache.delete(entries[i][0]);
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(updateTime: number, successCount: number, failureCount: number): void {
    this.stats.totalUpdates++;
    this.stats.successfulUpdates += successCount;
    this.stats.failedUpdates += failureCount;
    this.stats.lastUpdateTime = updateTime;

    // 更新平均时间
    this.updateHistory.push(updateTime);
    if (this.updateHistory.length > 100) {
      this.updateHistory.shift();
    }
    this.stats.averageUpdateTime = this.updateHistory.reduce((a, b) => a + b, 0) / this.updateHistory.length;

    // 更新缓存命中率
    const totalCacheAccess = Array.from(this.stateCache.values()).reduce((sum, cache) => sum + cache.accessCount, 0);
    this.stats.cacheHitRate = totalCacheAccess / Math.max(1, this.stats.totalUpdates);

    // 性能警告
    if (updateTime > this.config.timeSliceMs * 3) {
      this.performanceWarnings.push(`更新时间过长: ${updateTime.toFixed(2)}ms`);
    }

    if (failureCount > successCount * 0.1) {
      this.performanceWarnings.push(`更新失败率过高: ${(failureCount / (successCount + failureCount) * 100).toFixed(1)}%`);
    }

    // 保持警告数量在合理范围内
    if (this.performanceWarnings.length > 50) {
      this.performanceWarnings = this.performanceWarnings.slice(-25);
    }
  }

  /**
   * 获取配置
   */
  getConfig(): UpdateConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<UpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取统计信息
   */
  getStats(): UpdateStats {
    return { ...this.stats };
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
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      averageUpdateTime: 0,
      lastUpdateTime: 0,
      cacheHitRate: 0
    };
    this.updateHistory = [];
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.stateCache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    totalAccess: number;
  } {
    const totalAccess = Array.from(this.stateCache.values()).reduce((sum, cache) => sum + cache.accessCount, 0);
    
    return {
      size: this.stateCache.size,
      hitRate: this.stats.cacheHitRate,
      totalAccess
    };
  }

  /**
   * 销毁更新引擎
   */
  destroy(): void {
    this.clearCache();
    this.resetStats();
    this.clearPerformanceWarnings();
  }
}
