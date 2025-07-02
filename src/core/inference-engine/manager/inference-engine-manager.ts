/**
 * 推理引擎管理器
 * 负责协调推理引擎、状态更新引擎、UI同步器和现有系统的集成
 */

import { InferenceEngine } from '../core/inference-engine';
import { StateUpdateEngine } from '../update/state-update-engine';
import { UIStateSynchronizer } from '../ui/ui-state-synchronizer';
import { TopologyChecker } from '../topology/topology-checker';
import { UpdateStrategy } from '../types';
import type {
  InferenceEngineManagerConfig,
  SystemPerformanceMetrics,
  NodeType,
  ComputeNode,
  TopologyCheckResult
} from '../types';
import { globalEventBus } from '../../services/EventBus';
import { globalPluginManager } from '../../services/PluginManager';
import type { IPlugin } from '../../entities/plugins';
import type { INeuron, IProcessableNode } from '../../entities/neuron';

/**
 * 推理引擎管理器类
 */
export class InferenceEngineManager {
  private inferenceEngine: InferenceEngine;
  private stateUpdateEngine: StateUpdateEngine;
  private uiSynchronizer: UIStateSynchronizer;
  private topologyChecker: TopologyChecker;
  private config: InferenceEngineManagerConfig;

  // 性能监控
  private performanceMetrics: SystemPerformanceMetrics[] = [];
  private lastUpdateTime: number = 0;
  private frameCount: number = 0;
  private fpsCalculationInterval: number = 1000; // 1秒计算一次FPS

  // 状态管理
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private lastNetworkTopology: any = null;

  constructor(config?: InferenceEngineManagerConfig) {
    this.config = {
      enableTopologyValidation: true,
      enablePerformanceMonitoring: true,
      enableAutoOptimization: true,
      maxRetries: 3,
      fallbackToOriginal: true,
      ...config
    };

    this.inferenceEngine = new InferenceEngine();
    this.stateUpdateEngine = new StateUpdateEngine(this.config.updateConfig);
    this.uiSynchronizer = new UIStateSynchronizer(this.config.uiConfig);
    this.topologyChecker = new TopologyChecker();

    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听网络拓扑变化
    globalEventBus.on('topology:changed', () => {
      this.syncWithNetworkTopology();
    });

    // 监听插件状态变化
    globalEventBus.on('plugins:state-updated', () => {
      this.syncWithPlugins();
    });

    // 监听节点添加/删除
    globalEventBus.on('topology:node-added', (event: any) => {
      this.handleNodeAdded(event.nodeId, event.node);
    });

    globalEventBus.on('topology:node-removed', (event: any) => {
      this.handleNodeRemoved(event.nodeId);
    });

    // 监听连接添加/删除
    globalEventBus.on('topology:connection-added', (event: any) => {
      this.handleConnectionAdded(event.fromId, event.toId, event.weight);
    });

    globalEventBus.on('topology:connection-removed', (event: any) => {
      this.handleConnectionRemoved(event.fromId, event.toId);
    });
  }

  /**
   * 初始化推理引擎
   */
  async initialize(networkTopology: any): Promise<void> {
    if (this.isInitialized) {
      console.warn('推理引擎管理器已经初始化');
      return;
    }

    try {
      // 同步网络拓扑
      await this.syncWithNetworkTopology(networkTopology);
      
      // 同步插件状态
      await this.syncWithPlugins();

      // 验证拓扑结构
      if (this.config.enableTopologyValidation) {
        const validationResult = this.validateTopology();
        if (!validationResult.isValid) {
          console.warn('拓扑验证失败:', validationResult.errors);
        }
      }

      this.isInitialized = true;
      this.lastNetworkTopology = networkTopology;

      console.log('推理引擎管理器初始化完成');
      globalEventBus.emit('inference-engine:initialized');

    } catch (error) {
      console.error('推理引擎初始化失败:', error);
      throw error;
    }
  }

  /**
   * 更新系统状态（主要更新方法）
   */
  async update(deltaTime: number, externalInputs?: Map<string, number>): Promise<SystemPerformanceMetrics> {
    if (!this.isInitialized) {
      throw new Error('推理引擎未初始化');
    }

    const startTime = performance.now();
    let inferenceTime = 0;
    let updateTime = 0;
    let uiSyncTime = 0;

    try {
      // 1. 推理引擎更新
      const inferenceStart = performance.now();
      this.inferenceEngine.update(deltaTime, externalInputs);
      inferenceTime = performance.now() - inferenceStart;

      // 2. 状态更新引擎
      const updateStart = performance.now();
      const nodes = this.inferenceEngine.getAllNodes();
      const relations = new Map(this.inferenceEngine.getRelations().map(r => [r.id, r]));
      const computeOrder = this.inferenceEngine.getComputeOrder();
      
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      await this.stateUpdateEngine.updateNodes(nodeMap, relations, computeOrder, deltaTime, externalInputs);
      updateTime = performance.now() - updateStart;

      // 3. UI状态同步
      const uiSyncStart = performance.now();
      await this.syncUIStates();
      uiSyncTime = performance.now() - uiSyncStart;

      // 4. 性能监控
      const totalTime = performance.now() - startTime;
      const metrics = this.createPerformanceMetrics(inferenceTime, updateTime, uiSyncTime, totalTime);
      
      if (this.config.enablePerformanceMonitoring) {
        this.recordPerformanceMetrics(metrics);
      }

      // 5. 自动优化
      if (this.config.enableAutoOptimization) {
        this.performAutoOptimization(metrics);
      }

      return metrics;

    } catch (error) {
      console.error('推理引擎更新失败:', error);
      throw error;
    }
  }

  /**
   * 与NetworkTopology同步
   */
  private async syncWithNetworkTopology(networkTopology?: any): Promise<void> {
    const topology = networkTopology || this.lastNetworkTopology;
    if (!topology) return;

    // 清除现有节点和连接
    this.inferenceEngine.clearAll();

    // 添加神经元节点
    const nodes = topology.getAllNodes();
    for (const node of nodes) {
      this.inferenceEngine.addNode(node.id, node.neuron, 'neuron' as NodeType);
    }

    // 添加NetworkTopology中的边连接（包含神经元间连接和输入节点到神经元的连接）
    const edges = topology.getAllEdges();
    for (const edge of edges) {
      // 确定连接的节点类型
      const fromNodeType = this.determineNodeTypeFromId(edge.fromNodeId, topology);
      const toNodeType = this.determineNodeTypeFromId(edge.toNodeId, topology);

      // 如果无法确定节点类型，默认为神经元连接
      const actualFromType = fromNodeType || ('neuron' as NodeType);
      const actualToType = toNodeType || ('neuron' as NodeType);

      this.inferenceEngine.addRelation(
        edge.fromNodeId,
        edge.toNodeId,
        edge.synapse.weight,
        actualFromType,
        actualToType
      );
    }

    console.log(`同步了 ${nodes.length} 个神经元、${edges.length} 个突触和 ${edges.length} 个边连接`);
  }

  /**
   * 与插件系统同步
   */
  private async syncWithPlugins(): Promise<void> {
    const enabledPlugins = globalPluginManager.getComputingPlugins();

    // 添加插件节点
    for (const plugin of enabledPlugins) {
      this.inferenceEngine.addNode(plugin.id, plugin, 'plugin' as NodeType);

      // 添加插件内部节点
      const internalNodes = plugin.getNodes();
      for (const node of internalNodes) {
        const nodeType = this.determineNodeType(node, plugin);
        this.inferenceEngine.addNode(node.id, node, nodeType);

        // 建立插件与内部节点的关系
        if (plugin.pluginType === 'sensor') {
          // 感受器：插件输出到内部节点
          this.inferenceEngine.addRelation(plugin.id, node.id, 1.0, 'plugin' as NodeType, nodeType);
        } else if (plugin.pluginType === 'effector') {
          // 效应器：内部节点输入到插件
          this.inferenceEngine.addRelation(node.id, plugin.id, 1.0, nodeType, 'plugin' as NodeType);
        }
      }
    }

    console.log(`同步了 ${enabledPlugins.length} 个插件`);
  }

  /**
   * 根据节点ID确定节点类型
   */
  private determineNodeTypeFromId(nodeId: string, topology: any): NodeType | null {
    // 检查是否是神经元
    if (topology.getNode && topology.getNode(nodeId)) {
      return 'neuron' as NodeType;
    }

    // 检查是否是插件节点
    const enabledPlugins = globalPluginManager.getComputingPlugins();
    for (const plugin of enabledPlugins) {
      const internalNodes = plugin.getNodes();
      for (const node of internalNodes) {
        if (node.id === nodeId) {
          return this.determineNodeType(node, plugin);
        }
      }
    }

    return null;
  }

  /**
   * 确定节点类型
   */
  private determineNodeType(node: IProcessableNode, plugin: IPlugin): NodeType {
    if (plugin.pluginType === 'sensor') {
      return 'input' as NodeType;
    } else if (plugin.pluginType === 'effector') {
      return 'output' as NodeType;
    }
    return 'input' as NodeType; // 默认
  }

  /**
   * 同步UI状态
   */
  private async syncUIStates(): Promise<void> {
    const allStates = this.inferenceEngine.getAllNodeStates();
    const nodeStates = new Map<string, { state: any; position: { x: number; y: number }; nodeType: string }>();

    for (const [nodeId, state] of allStates) {
      const nodeInfo = this.inferenceEngine.getNodeInfo(nodeId);
      if (nodeInfo) {
        // 获取节点位置（这里需要从UI系统获取实际位置）
        const position = this.getNodePosition(nodeId);
        nodeStates.set(nodeId, {
          state,
          position,
          nodeType: nodeInfo.type
        });
      }
    }

    this.uiSynchronizer.syncMultipleNodeStates(nodeStates);
  }

  /**
   * 获取节点位置（占位实现）
   */
  private getNodePosition(nodeId: string): { x: number; y: number } {
    // TODO: 从实际的UI系统获取节点位置
    return { x: 0, y: 0 };
  }

  /**
   * 验证拓扑结构
   */
  private validateTopology(): TopologyCheckResult {
    const nodes = new Map(this.inferenceEngine.getAllNodes().map(n => [n.id, n]));
    const relations = this.inferenceEngine.getRelations();
    
    return this.topologyChecker.checkTopology(nodes, relations);
  }

  /**
   * 创建性能指标
   */
  private createPerformanceMetrics(
    inferenceTime: number,
    updateTime: number,
    uiSyncTime: number,
    totalTime: number
  ): SystemPerformanceMetrics {
    const engineState = this.inferenceEngine.getEngineState();
    
    return {
      inferenceTime,
      updateTime,
      uiSyncTime,
      totalTime,
      nodeCount: engineState.totalNodes,
      relationCount: engineState.totalRelations,
      fps: this.calculateFPS()
    };
  }

  /**
   * 记录性能指标
   */
  private recordPerformanceMetrics(metrics: SystemPerformanceMetrics): void {
    this.performanceMetrics.push(metrics);
    
    // 保持最近100个记录
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics.shift();
    }

    // 发送性能事件
    globalEventBus.emit('inference-engine:performance-update', metrics);
  }

  /**
   * 计算FPS
   */
  private calculateFPS(): number {
    const now = performance.now();
    this.frameCount++;

    if (now - this.lastUpdateTime >= this.fpsCalculationInterval) {
      const fps = (this.frameCount * 1000) / (now - this.lastUpdateTime);
      this.frameCount = 0;
      this.lastUpdateTime = now;
      return fps;
    }

    return 0; // 还未到计算时间
  }

  /**
   * 自动优化性能
   */
  private performAutoOptimization(metrics: SystemPerformanceMetrics): void {
    // 如果总时间超过16ms（60fps阈值），尝试优化
    if (metrics.totalTime > 16) {
      // 切换到自适应更新策略
      const currentConfig = this.stateUpdateEngine.getConfig();
      if (currentConfig.strategy !== UpdateStrategy.ADAPTIVE) {
        this.stateUpdateEngine.updateConfig({ strategy: UpdateStrategy.ADAPTIVE });
        console.log('切换到自适应更新策略以提高性能');
      }

      // 启用UI节流
      const uiConfig = this.uiSynchronizer.getConfig();
      if (!uiConfig.enableThrottling) {
        this.uiSynchronizer.updateConfig({ enableThrottling: true });
        console.log('启用UI更新节流以提高性能');
      }

      // 减少批量大小
      const currentBatchSize = uiConfig.batchSize;
      if (currentBatchSize > 20) {
        this.uiSynchronizer.updateConfig({ batchSize: Math.max(20, currentBatchSize - 10) });
        console.log('减少UI批量更新大小以提高性能');
      }
    }
  }

  /**
   * 处理节点添加
   */
  private handleNodeAdded(nodeId: string, node: INeuron | IProcessableNode | IPlugin): void {
    let nodeType: NodeType;

    if ('update' in node && 'voltage' in node) {
      nodeType = 'neuron' as NodeType;
    } else if ('pluginType' in node) {
      nodeType = 'plugin' as NodeType;
    } else {
      nodeType = 'input' as NodeType; // 默认
    }

    this.inferenceEngine.addNode(nodeId, node, nodeType);
    console.log(`添加节点: ${nodeId} (类型: ${nodeType})`);
  }

  /**
   * 处理节点删除
   */
  private handleNodeRemoved(nodeId: string): void {
    this.inferenceEngine.removeNode(nodeId);
    this.uiSynchronizer.clearNodeState(nodeId);
    console.log(`删除节点: ${nodeId}`);
  }

  /**
   * 处理连接添加
   */
  private handleConnectionAdded(fromId: string, toId: string, weight: number = 1.0): void {
    const fromNode = this.inferenceEngine.getNodeInfo(fromId);
    const toNode = this.inferenceEngine.getNodeInfo(toId);

    if (fromNode && toNode) {
      this.inferenceEngine.addRelation(fromId, toId, weight, fromNode.type, toNode.type);
      console.log(`添加连接: ${fromId} -> ${toId} (权重: ${weight})`);
    }
  }

  /**
   * 处理连接删除
   */
  private handleConnectionRemoved(fromId: string, toId: string): void {
    this.inferenceEngine.removeRelation(fromId, toId);
    console.log(`删除连接: ${fromId} -> ${toId}`);
  }

  /**
   * 获取系统状态
   */
  getSystemState(): {
    isInitialized: boolean;
    isRunning: boolean;
    engineState: any;
    updateStats: any;
    uiStats: any;
    performanceMetrics: SystemPerformanceMetrics[];
  } {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      engineState: this.inferenceEngine.getEngineState(),
      updateStats: this.stateUpdateEngine.getStats(),
      uiStats: this.uiSynchronizer.getPerformanceStats(),
      performanceMetrics: [...this.performanceMetrics]
    };
  }

  /**
   * 获取拓扑验证结果
   */
  getTopologyValidation(): TopologyCheckResult {
    return this.validateTopology();
  }

  /**
   * 获取性能警告
   */
  getPerformanceWarnings(): string[] {
    const warnings: string[] = [];

    warnings.push(...this.inferenceEngine.getPerformanceWarnings());
    warnings.push(...this.stateUpdateEngine.getPerformanceWarnings());

    return warnings;
  }

  /**
   * 启动推理引擎
   */
  start(): void {
    if (!this.isInitialized) {
      throw new Error('推理引擎未初始化');
    }

    this.isRunning = true;
    console.log('推理引擎已启动');
    globalEventBus.emit('inference-engine:started');
  }

  /**
   * 停止推理引擎
   */
  stop(): void {
    this.isRunning = false;
    console.log('推理引擎已停止');
    globalEventBus.emit('inference-engine:stopped');
  }

  /**
   * 销毁推理引擎管理器
   */
  destroy(): void {
    this.stop();
    this.uiSynchronizer.destroy();
    this.stateUpdateEngine.destroy();
    this.inferenceEngine.destroy();
    this.isInitialized = false;
    console.log('推理引擎管理器已销毁');
    globalEventBus.emit('inference-engine:destroyed');
  }
}
