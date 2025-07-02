/**
 * UI状态同步器
 * 负责将节点状态实时同步到UI显示
 */

import type { 
  UIUpdateConfig, 
  UIUpdateEvent, 
  BatchUIUpdateEvent 
} from '../types';
import { globalEventBus } from '../../services/EventBus';

/**
 * UI性能统计
 */
export interface UIPerformanceStats {
  totalUpdates: number;
  batchUpdates: number;
  averageUpdateTime: number;
  lastUpdateTime: number;
  queueSize: number;
  droppedUpdates: number;
  throttledUpdates: number;
}

/**
 * 节点UI状态
 */
export interface NodeUIState {
  nodeId: string;
  currentState: any;
  targetState: any;
  position: { x: number; y: number };
  nodeType: string;
  lastUpdateTime: number;
  interpolationProgress: number;
  isVisible: boolean;
}

/**
 * UI状态同步器类
 */
export class UIStateSynchronizer {
  private config: UIUpdateConfig;
  private updateQueue: UIUpdateEvent[] = [];
  private nodeStates: Map<string, NodeUIState> = new Map();
  private stats: UIPerformanceStats;
  private isRunning: boolean = true;
  private isPaused: boolean = false;
  private lastBatchTime: number = 0;
  private animationFrameId: number | null = null;

  constructor(config?: Partial<UIUpdateConfig>) {
    this.config = {
      updateFrequency: 60,
      batchSize: 50,
      enableThrottling: true,
      enableDeltaUpdates: true,
      voltageThreshold: 0.1,
      enableInterpolation: true,
      interpolationSteps: 5,
      maxQueueSize: 1000,
      ...config
    };

    this.stats = {
      totalUpdates: 0,
      batchUpdates: 0,
      averageUpdateTime: 0,
      lastUpdateTime: 0,
      queueSize: 0,
      droppedUpdates: 0,
      throttledUpdates: 0
    };

    this.startUpdateLoop();
  }

  /**
   * 启动更新循环
   */
  private startUpdateLoop(): void {
    const updateInterval = 1000 / this.config.updateFrequency;
    
    const update = () => {
      if (!this.isRunning || this.isPaused) {
        this.animationFrameId = requestAnimationFrame(update);
        return;
      }

      const now = performance.now();
      if (now - this.lastBatchTime >= updateInterval) {
        this.processBatchUpdates();
        this.lastBatchTime = now;
      }

      this.animationFrameId = requestAnimationFrame(update);
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * 同步单个节点状态
   */
  syncNodeState(
    nodeId: string, 
    state: any, 
    position: { x: number; y: number }, 
    nodeType: string
  ): void {
    if (!this.isRunning || this.isPaused) return;

    const now = performance.now();
    const updateEvent: UIUpdateEvent = {
      nodeId,
      state,
      position,
      nodeType,
      timestamp: now
    };

    // 检查是否需要节流
    if (this.config.enableThrottling && this.shouldThrottle(nodeId, state)) {
      this.stats.throttledUpdates++;
      return;
    }

    // 检查队列大小
    if (this.updateQueue.length >= (this.config.maxQueueSize || 1000)) {
      // 移除最旧的更新
      this.updateQueue.shift();
      this.stats.droppedUpdates++;
    }

    this.updateQueue.push(updateEvent);
    this.stats.queueSize = this.updateQueue.length;
  }

  /**
   * 同步多个节点状态
   */
  syncMultipleNodeStates(
    nodeStates: Map<string, { state: any; position: { x: number; y: number }; nodeType: string }>
  ): void {
    const now = performance.now();
    
    for (const [nodeId, { state, position, nodeType }] of nodeStates) {
      this.syncNodeState(nodeId, state, position, nodeType);
    }
  }

  /**
   * 检查是否应该节流
   */
  private shouldThrottle(nodeId: string, newState: any): boolean {
    const existingState = this.nodeStates.get(nodeId);
    if (!existingState) return false;

    // 检查电压变化阈值
    if (this.config.enableDeltaUpdates && newState.voltage !== undefined) {
      const voltageDiff = Math.abs(newState.voltage - (existingState.currentState.voltage || 0));
      if (voltageDiff < this.config.voltageThreshold) {
        return true;
      }
    }

    // 检查更新频率
    const now = performance.now();
    const timeSinceLastUpdate = now - existingState.lastUpdateTime;
    const minUpdateInterval = 1000 / this.config.updateFrequency;
    
    return timeSinceLastUpdate < minUpdateInterval;
  }

  /**
   * 处理批量更新
   */
  private processBatchUpdates(): void {
    if (this.updateQueue.length === 0) return;

    const startTime = performance.now();
    const batchSize = Math.min(this.config.batchSize, this.updateQueue.length);
    const batch = this.updateQueue.splice(0, batchSize);

    // 处理批量更新
    const processedUpdates: UIUpdateEvent[] = [];
    
    for (const update of batch) {
      const processed = this.processUpdate(update);
      if (processed) {
        processedUpdates.push(processed);
      }
    }

    // 发送批量更新事件
    if (processedUpdates.length > 0) {
      const batchEvent: BatchUIUpdateEvent = {
        updates: processedUpdates,
        totalCount: processedUpdates.length,
        timestamp: performance.now(),
        batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      globalEventBus.emit('ui:nodes-state-updated', batchEvent);
    }

    // 更新统计信息
    const updateTime = performance.now() - startTime;
    this.updateStats(updateTime, processedUpdates.length);
    this.stats.queueSize = this.updateQueue.length;
  }

  /**
   * 处理单个更新
   */
  private processUpdate(update: UIUpdateEvent): UIUpdateEvent | null {
    const existingState = this.nodeStates.get(update.nodeId);
    
    if (existingState) {
      // 更新现有状态
      if (this.config.enableInterpolation) {
        existingState.targetState = update.state;
        existingState.interpolationProgress = 0;
      } else {
        existingState.currentState = update.state;
      }
      existingState.position = update.position;
      existingState.lastUpdateTime = update.timestamp;
    } else {
      // 创建新状态
      const newState: NodeUIState = {
        nodeId: update.nodeId,
        currentState: update.state,
        targetState: update.state,
        position: update.position,
        nodeType: update.nodeType,
        lastUpdateTime: update.timestamp,
        interpolationProgress: 1,
        isVisible: true
      };
      this.nodeStates.set(update.nodeId, newState);
    }

    return update;
  }

  /**
   * 执行插值动画
   */
  private performInterpolation(): void {
    if (!this.config.enableInterpolation) return;

    const interpolationSpeed = 1 / (this.config.interpolationSteps || 5);
    
    for (const nodeState of this.nodeStates.values()) {
      if (nodeState.interpolationProgress < 1) {
        nodeState.interpolationProgress = Math.min(1, nodeState.interpolationProgress + interpolationSpeed);
        
        // 插值电压值
        if (nodeState.currentState.voltage !== undefined && nodeState.targetState.voltage !== undefined) {
          const currentVoltage = nodeState.currentState.voltage;
          const targetVoltage = nodeState.targetState.voltage;
          nodeState.currentState.voltage = currentVoltage + 
            (targetVoltage - currentVoltage) * nodeState.interpolationProgress;
        }

        // 插值其他数值属性
        for (const key in nodeState.targetState) {
          if (typeof nodeState.targetState[key] === 'number' && key !== 'voltage') {
            const current = nodeState.currentState[key] || 0;
            const target = nodeState.targetState[key];
            nodeState.currentState[key] = current + (target - current) * nodeState.interpolationProgress;
          }
        }
      }
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(updateTime: number, processedCount: number): void {
    this.stats.totalUpdates += processedCount;
    this.stats.batchUpdates++;
    this.stats.lastUpdateTime = updateTime;

    // 计算平均更新时间
    const alpha = 0.1; // 指数移动平均的平滑因子
    this.stats.averageUpdateTime = this.stats.averageUpdateTime * (1 - alpha) + updateTime * alpha;
  }

  /**
   * 获取节点UI状态
   */
  getNodeUIState(nodeId: string): NodeUIState | undefined {
    return this.nodeStates.get(nodeId);
  }

  /**
   * 获取所有节点UI状态
   */
  getAllNodeUIStates(): Map<string, NodeUIState> {
    return new Map(this.nodeStates);
  }

  /**
   * 清除节点状态
   */
  clearNodeState(nodeId: string): void {
    this.nodeStates.delete(nodeId);
  }

  /**
   * 清除所有节点状态
   */
  clearAllNodeStates(): void {
    this.nodeStates.clear();
  }

  /**
   * 强制更新所有节点
   */
  forceUpdateAll(): void {
    const batchEvent: BatchUIUpdateEvent = {
      updates: Array.from(this.nodeStates.values()).map(state => ({
        nodeId: state.nodeId,
        state: state.currentState,
        position: state.position,
        nodeType: state.nodeType,
        timestamp: performance.now()
      })),
      totalCount: this.nodeStates.size,
      timestamp: performance.now(),
      batchId: `force_update_${Date.now()}`
    };

    globalEventBus.emit('ui:nodes-state-updated', batchEvent);
  }

  /**
   * 暂停更新
   */
  pauseUpdates(): void {
    this.isPaused = true;
  }

  /**
   * 恢复更新
   */
  resumeUpdates(): void {
    this.isPaused = false;
  }

  /**
   * 获取配置
   */
  getConfig(): UIUpdateConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<UIUpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): UIPerformanceStats {
    return { ...this.stats };
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.stats = {
      totalUpdates: 0,
      batchUpdates: 0,
      averageUpdateTime: 0,
      lastUpdateTime: 0,
      queueSize: this.updateQueue.length,
      droppedUpdates: 0,
      throttledUpdates: 0
    };
  }

  /**
   * 设置节点可见性
   */
  setNodeVisibility(nodeId: string, isVisible: boolean): void {
    const nodeState = this.nodeStates.get(nodeId);
    if (nodeState) {
      nodeState.isVisible = isVisible;
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    size: number;
    maxSize: number;
    utilizationRate: number;
  } {
    const maxSize = this.config.maxQueueSize || 1000;
    return {
      size: this.updateQueue.length,
      maxSize,
      utilizationRate: this.updateQueue.length / maxSize
    };
  }

  /**
   * 清空更新队列
   */
  clearQueue(): void {
    this.updateQueue = [];
    this.stats.queueSize = 0;
  }

  /**
   * 销毁UI同步器
   */
  destroy(): void {
    this.isRunning = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.clearQueue();
    this.clearAllNodeStates();
    this.resetPerformanceStats();
  }
}
