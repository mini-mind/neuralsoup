/**
 * 推理引擎类型定义
 * 定义推理引擎系统中使用的所有类型和接口
 */

/**
 * 节点类型枚举
 */
export enum NodeType {
  NEURON = 'neuron',    // 神经元节点
  INPUT = 'input',      // 输入节点（通常来自感受器）
  OUTPUT = 'output',    // 输出节点（通常连接到效应器）
  PLUGIN = 'plugin'     // 插件节点（感受器/效应器本身）
}

/**
 * 更新策略枚举
 */
export enum UpdateStrategy {
  SEQUENTIAL = 'sequential',  // 顺序更新
  PARALLEL = 'parallel',      // 并行更新
  ADAPTIVE = 'adaptive'       // 自适应更新
}

/**
 * 计算节点接口
 * 所有可以参与推理计算的节点都必须实现此接口
 */
export interface ComputeNode {
  id: string;
  update?(input: number, deltaTime: number): boolean | void;
  getState?(): any;
  getOutput?(): number;
  voltage?: number;
  [key: string]: any;
}

/**
 * 拓扑关系接口
 * 描述节点间的连接关系
 */
export interface TopologyRelation {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  weight: number;
  fromType: NodeType;
  toType: NodeType;
  isActive: boolean;
  metadata?: Record<string, any>;
}

/**
 * 节点信息接口
 */
export interface NodeInfo {
  id: string;
  node: ComputeNode;
  type: NodeType;
  isActive: boolean;
  lastUpdateTime: number;
  metadata?: Record<string, any>;
}

/**
 * 引擎状态接口
 */
export interface EngineState {
  isInitialized: boolean;
  isRunning: boolean;
  totalNodes: number;
  totalRelations: number;
  activeNodes: number;
  activeRelations: number;
  lastUpdateTime: number;
  updateCount: number;
  averageUpdateTime: number;
}

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  updateTime: number;
  nodeCount: number;
  relationCount: number;
  memoryUsage?: number;
  cpuUsage?: number;
  warnings: string[];
}

/**
 * 更新配置接口
 */
export interface UpdateConfig {
  strategy: UpdateStrategy;
  maxParallelTasks: number;
  timeSliceMs: number;
  enableProfiling: boolean;
  enableStateCache: boolean;
  cacheSize?: number;
  timeoutMs?: number;
}

/**
 * UI更新配置接口
 */
export interface UIUpdateConfig {
  updateFrequency: number;
  batchSize: number;
  enableThrottling: boolean;
  enableDeltaUpdates: boolean;
  voltageThreshold: number;
  enableInterpolation: boolean;
  interpolationSteps?: number;
  maxQueueSize?: number;
}

/**
 * 拓扑检查结果接口
 */
export interface TopologyCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  circularDependencies: string[][];
  unreachableNodes: string[];
  isolatedNodes: string[];
  performanceIssues: string[];
}

/**
 * 连接规则接口
 */
export interface ConnectionRule {
  id: string;
  name: string;
  fromType: NodeType;
  toType: NodeType;
  isAllowed: boolean;
  maxConnections?: number;
  minWeight?: number;
  maxWeight?: number;
  description?: string;
}

/**
 * 批量更新结果接口
 */
export interface BatchUpdateResult {
  successCount: number;
  failureCount: number;
  totalTime: number;
  averageTime: number;
  errors: Array<{ nodeId: string; error: string }>;
  warnings: string[];
}

/**
 * UI更新事件接口
 */
export interface UIUpdateEvent {
  nodeId: string;
  state: any;
  position: { x: number; y: number };
  nodeType: string;
  timestamp: number;
  deltaTime?: number;
}

/**
 * 批量UI更新事件接口
 */
export interface BatchUIUpdateEvent {
  updates: UIUpdateEvent[];
  totalCount: number;
  timestamp: number;
  batchId: string;
}

/**
 * 系统性能指标接口
 */
export interface SystemPerformanceMetrics {
  inferenceTime: number;
  updateTime: number;
  uiSyncTime: number;
  totalTime: number;
  nodeCount: number;
  relationCount: number;
  fps: number;
  memoryUsage?: number;
  warnings?: string[];
}

/**
 * 推理引擎管理器配置接口
 */
export interface InferenceEngineManagerConfig {
  updateConfig?: Partial<UpdateConfig>;
  uiConfig?: Partial<UIUpdateConfig>;
  enableTopologyValidation: boolean;
  enablePerformanceMonitoring: boolean;
  enableAutoOptimization: boolean;
  maxRetries?: number;
  fallbackToOriginal?: boolean;
}

/**
 * 节点状态缓存接口
 */
export interface NodeStateCache {
  nodeId: string;
  state: any;
  timestamp: number;
  isValid: boolean;
  accessCount: number;
}

/**
 * 计算顺序项接口
 */
export interface ComputeOrderItem {
  nodeId: string;
  level: number;
  dependencies: string[];
  dependents: string[];
}

/**
 * 拓扑分析结果接口
 */
export interface TopologyAnalysisResult {
  nodeCount: number;
  relationCount: number;
  maxDepth: number;
  averageConnectivity: number;
  stronglyConnectedComponents: string[][];
  criticalPath: string[];
  bottlenecks: string[];
}

/**
 * 事件类型定义
 */
export type InferenceEngineEvent = 
  | 'initialized'
  | 'started'
  | 'stopped'
  | 'paused'
  | 'resumed'
  | 'destroyed'
  | 'performance-update'
  | 'topology-changed'
  | 'error'
  | 'warning';

/**
 * 事件数据接口
 */
export interface EventData {
  type: InferenceEngineEvent;
  timestamp: number;
  data?: any;
  source?: string;
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
  INITIALIZATION_ERROR = 'initialization_error',
  UPDATE_ERROR = 'update_error',
  TOPOLOGY_ERROR = 'topology_error',
  PERFORMANCE_ERROR = 'performance_error',
  UI_SYNC_ERROR = 'ui_sync_error',
  VALIDATION_ERROR = 'validation_error'
}

/**
 * 推理引擎错误接口
 */
export interface InferenceEngineError {
  type: ErrorType;
  message: string;
  nodeId?: string;
  relationId?: string;
  timestamp: number;
  stack?: string;
  context?: Record<string, any>;
}
