/**
 * 推理引擎模块主入口
 * 导出所有推理引擎相关的类型和组件
 */

// 核心类型
export * from './types';

// 导入需要在配置中使用的枚举
import { UpdateStrategy } from './types';
import type { InferenceEngineManagerConfig } from './types';

// 核心组件
export { InferenceEngine } from './core/inference-engine';
export { TopologyChecker } from './topology/topology-checker';
export { StateUpdateEngine } from './update/state-update-engine';
export { UIStateSynchronizer } from './ui/ui-state-synchronizer';
export { InferenceEngineManager } from './manager/inference-engine-manager';

// 类型别名（为了向后兼容）
export type {
  ComputeNode,
  TopologyRelation,
  NodeInfo,
  EngineState,
  PerformanceMetrics,
  UpdateConfig,
  UIUpdateConfig,
  TopologyCheckResult,
  ConnectionRule,
  BatchUpdateResult,
  UIUpdateEvent,
  BatchUIUpdateEvent,
  SystemPerformanceMetrics,
  InferenceEngineManagerConfig,
  NodeStateCache,
  ComputeOrderItem,
  TopologyAnalysisResult,
  InferenceEngineError
} from './types';

// 枚举导出
export {
  NodeType,
  UpdateStrategy,
  ErrorType
} from './types';

// 默认配置
export const DEFAULT_INFERENCE_CONFIG: InferenceEngineManagerConfig = {
  enableTopologyValidation: true,
  enablePerformanceMonitoring: true,
  enableAutoOptimization: true,
  maxRetries: 3,
  fallbackToOriginal: true,
  updateConfig: {
    strategy: UpdateStrategy.ADAPTIVE,
    maxParallelTasks: 4,
    timeSliceMs: 8,
    enableProfiling: true,
    enableStateCache: true,
    cacheSize: 1000,
    timeoutMs: 5000
  },
  uiConfig: {
    updateFrequency: 60,
    batchSize: 50,
    enableThrottling: true,
    enableDeltaUpdates: true,
    voltageThreshold: 0.1,
    enableInterpolation: true,
    interpolationSteps: 5,
    maxQueueSize: 1000
  }
};

// 工厂函数
export function createInferenceEngineManager(
  config?: Partial<InferenceEngineManagerConfig>
): InferenceEngineManager {
  const finalConfig = {
    ...DEFAULT_INFERENCE_CONFIG,
    ...config,
    updateConfig: {
      ...DEFAULT_INFERENCE_CONFIG.updateConfig,
      ...config?.updateConfig
    },
    uiConfig: {
      ...DEFAULT_INFERENCE_CONFIG.uiConfig,
      ...config?.uiConfig
    }
  };

  return new InferenceEngineManager(finalConfig);
}

// 版本信息
export const INFERENCE_ENGINE_VERSION = '1.0.0';

// 模块信息
export const INFERENCE_ENGINE_INFO = {
  name: 'NeuralSoup Inference Engine',
  version: INFERENCE_ENGINE_VERSION,
  description: '高性能神经网络推理引擎，支持实时状态更新和UI同步',
  author: 'NeuralSoup Team',
  features: [
    '多种更新策略（顺序、并行、自适应）',
    '实时UI状态同步',
    '拓扑结构验证',
    '性能监控和自动优化',
    '状态缓存和插值动画',
    '事件驱动架构',
    '错误处理和回退机制'
  ]
};

// 调试工具
export const InferenceEngineDebug = {
  /**
   * 启用调试模式
   */
  enableDebug(): void {
    (window as any).__INFERENCE_ENGINE_DEBUG__ = true;
    console.log('推理引擎调试模式已启用');
  },

  /**
   * 禁用调试模式
   */
  disableDebug(): void {
    (window as any).__INFERENCE_ENGINE_DEBUG__ = false;
    console.log('推理引擎调试模式已禁用');
  },

  /**
   * 检查是否处于调试模式
   */
  isDebugEnabled(): boolean {
    return !!(window as any).__INFERENCE_ENGINE_DEBUG__;
  },

  /**
   * 调试日志
   */
  log(...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.log('[InferenceEngine]', ...args);
    }
  },

  /**
   * 调试警告
   */
  warn(...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.warn('[InferenceEngine]', ...args);
    }
  },

  /**
   * 调试错误
   */
  error(...args: any[]): void {
    if (this.isDebugEnabled()) {
      console.error('[InferenceEngine]', ...args);
    }
  }
};

// 性能分析工具
export const InferenceEngineProfiler = {
  timers: new Map<string, number>(),

  /**
   * 开始计时
   */
  start(label: string): void {
    this.timers.set(label, performance.now());
  },

  /**
   * 结束计时并返回耗时
   */
  end(label: string): number {
    const startTime = this.timers.get(label);
    if (startTime === undefined) {
      console.warn(`计时器 ${label} 未找到`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    this.timers.delete(label);

    if (InferenceEngineDebug.isDebugEnabled()) {
      console.log(`[Profiler] ${label}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  },

  /**
   * 测量函数执行时间
   */
  measure<T>(label: string, fn: () => T): T {
    this.start(label);
    try {
      return fn();
    } finally {
      this.end(label);
    }
  },

  /**
   * 测量异步函数执行时间
   */
  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label);
    }
  }
};

// 实用工具
export const InferenceEngineUtils = {
  /**
   * 验证节点ID格式
   */
  isValidNodeId(nodeId: string): boolean {
    return typeof nodeId === 'string' && nodeId.length > 0 && nodeId.length <= 100;
  },

  /**
   * 验证权重值
   */
  isValidWeight(weight: number): boolean {
    return typeof weight === 'number' && !isNaN(weight) && isFinite(weight);
  },

  /**
   * 验证电压值
   */
  isValidVoltage(voltage: number): boolean {
    return typeof voltage === 'number' && !isNaN(voltage) && isFinite(voltage);
  },

  /**
   * 生成唯一ID
   */
  generateId(prefix: string = 'node'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * 深度克隆对象
   */
  deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as any;
    }

    if (typeof obj === 'object') {
      const cloned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  },

  /**
   * 节流函数
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = performance.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  },

  /**
   * 防抖函数
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: number | null = null;
    return (...args: Parameters<T>) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }
};

// 导出默认实例（单例模式）
let defaultInstance: InferenceEngineManager | null = null;

export function getDefaultInferenceEngineManager(): InferenceEngineManager {
  if (!defaultInstance) {
    defaultInstance = createInferenceEngineManager();
  }
  return defaultInstance;
}

export function resetDefaultInferenceEngineManager(): void {
  if (defaultInstance) {
    defaultInstance.destroy();
    defaultInstance = null;
  }
}
