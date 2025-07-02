/**
 * 边处理相关类型定义
 * 统一不同类型边的处理接口
 */

/**
 * 边处理器接口
 * 定义了边的通用处理行为
 */
export interface IEdgeProcessor {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly type: EdgeType;
  
  /**
   * 获取边的状态信息
   */
  getState(): EdgeState;
  
  /**
   * 处理边的逻辑（突触传递或电压缩放）
   */
  process(input: number, deltaTime: number): number;
  
  /**
   * 重置边的状态
   */
  reset(): void;
  
  /**
   * 获取边的权重
   */
  getWeight(): number;
  
  /**
   * 设置边的权重
   */
  setWeight(weight: number): void;
}

/**
 * 边类型枚举
 */
export type EdgeType = 'synapse' | 'voltage_scaling';

/**
 * 边状态信息
 */
export interface EdgeState {
  weight: number;
  recentActivity: number;
  lastActivityTime: number;
  isActive: boolean;
}

/**
 * 突触边处理器
 * 处理神经元之间的突触连接
 */
export class SynapseEdgeProcessor implements IEdgeProcessor {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly type: EdgeType = 'synapse';
  
  private synapse: any; // 引用实际的突触对象
  
  constructor(synapse: any) {
    this.id = synapse.id;
    this.fromNodeId = synapse.preNeuronId;
    this.toNodeId = synapse.postNeuronId;
    this.synapse = synapse;
  }
  
  getState(): EdgeState {
    const synapseState = this.synapse.getState();
    return {
      weight: synapseState.weight,
      recentActivity: synapseState.recentActivity,
      lastActivityTime: synapseState.lastPreSpikeTime,
      isActive: true
    };
  }
  
  process(input: number, deltaTime: number): number {
    // 突触处理逻辑由底层突触对象处理
    // 这里主要是状态更新
    return input * this.synapse.weight;
  }
  
  reset(): void {
    this.synapse.reset();
  }
  
  getWeight(): number {
    return this.synapse.weight;
  }
  
  setWeight(weight: number): void {
    this.synapse.weight = weight;
  }
}

/**
 * 电压缩放边处理器
 * 处理输入节点到神经元或神经元到输出节点的连接
 */
export class VoltageScalingEdgeProcessor implements IEdgeProcessor {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly type: EdgeType = 'voltage_scaling';
  
  private weight: number;
  private lastActivity: number = 0;
  private lastActivityTime: number = -Infinity;
  
  constructor(id: string, fromNodeId: string, toNodeId: string, weight: number = 1.0) {
    this.id = id;
    this.fromNodeId = fromNodeId;
    this.toNodeId = toNodeId;
    this.weight = weight;
  }
  
  getState(): EdgeState {
    return {
      weight: this.weight,
      recentActivity: this.lastActivity,
      lastActivityTime: this.lastActivityTime,
      isActive: true
    };
  }
  
  process(input: number, deltaTime: number): number {
    // 简单的电压缩放处理
    const output = input * this.weight;
    this.lastActivity = Math.abs(output);
    this.lastActivityTime = Date.now();
    return output;
  }
  
  reset(): void {
    this.lastActivity = 0;
    this.lastActivityTime = -Infinity;
  }
  
  getWeight(): number {
    return this.weight;
  }
  
  setWeight(weight: number): void {
    this.weight = Math.max(0, Math.min(10, weight)); // 限制权重范围
  }
}

/**
 * 统一边包装器
 * 将不同类型的边统一包装为相同的接口
 */
export class UnifiedEdge {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly processor: IEdgeProcessor;
  
  // UI相关属性
  selected: boolean = false;
  
  constructor(processor: IEdgeProcessor) {
    this.id = processor.id;
    this.fromNodeId = processor.fromNodeId;
    this.toNodeId = processor.toNodeId;
    this.processor = processor;
  }
  
  /**
   * 获取边的状态
   */
  getState(): EdgeState {
    return this.processor.getState();
  }
  
  /**
   * 处理边的逻辑
   */
  process(input: number, deltaTime: number): number {
    return this.processor.process(input, deltaTime);
  }
  
  /**
   * 重置边的状态
   */
  reset(): void {
    this.processor.reset();
  }
  
  /**
   * 获取边的权重
   */
  getWeight(): number {
    return this.processor.getWeight();
  }
  
  /**
   * 设置边的权重
   */
  setWeight(weight: number): void {
    this.processor.setWeight(weight);
  }
  
  /**
   * 获取边的类型
   */
  getType(): EdgeType {
    return this.processor.type;
  }
}
