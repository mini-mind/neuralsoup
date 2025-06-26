import type { INeuron } from './neuron';

/**
 * 突触接口
 * 定义了突触的基本行为和属性
 */
export interface ISynapse {
  readonly id: string;
  readonly preNeuronId: string;
  readonly postNeuronId: string;
  
  // 突触权重
  weight: number;
  
  // 延迟（毫秒）
  delay: number;
  
  /**
   * 处理突触传递
   * @param preSpike 前突触神经元是否发放动作电位
   * @param preNeuron 前突触神经元
   * @param postNeuron 后突触神经元
   * @param deltaTime 时间步长
   * @returns 传递给后突触神经元的电流
   */
  process(preSpike: boolean, preNeuron: INeuron, postNeuron: INeuron, deltaTime: number): number;
  
  /**
   * 获取突触状态信息
   */
  getState(): SynapseState;
  
  /**
   * 重置突触状态
   */
  reset(): void;
}

/**
 * 突触状态信息
 */
export interface SynapseState {
  weight: number;
  lastPreSpikeTime: number;
  lastPostSpikeTime: number;
  recentActivity: number;
}

/**
 * STDP（Spike-Timing Dependent Plasticity）突触实现
 * 基于尖峰时序依赖的可塑性学习规则
 */
export class STDPSynapse implements ISynapse {
  readonly id: string;
  readonly preNeuronId: string;
  readonly postNeuronId: string;
  
  weight: number;
  delay: number;
  
  // STDP参数
  private learningRate: number;
  private tauPlus: number; // LTP时间常数
  private tauMinus: number; // LTD时间常数
  private aPlus: number; // LTP幅度
  private aMinus: number; // LTD幅度
  
  // 状态追踪
  private lastPreSpikeTime: number = -Infinity;
  private lastPostSpikeTime: number = -Infinity;
  private currentTime: number = 0;
  
  // 突触后电流追踪
  private synapticCurrent: number = 0;
  private currentDecay: number = 0.9; // 电流衰减因子
  
  constructor(
    id: string,
    preNeuronId: string,
    postNeuronId: string,
    initialWeight: number = 0.5,
    delay: number = 1,
    params?: Partial<STDPParams>
  ) {
    this.id = id;
    this.preNeuronId = preNeuronId;
    this.postNeuronId = postNeuronId;
    this.weight = Math.max(0, Math.min(1, initialWeight)); // 权重限制在[0,1]
    this.delay = delay;
    
    // 设置STDP参数
    this.learningRate = params?.learningRate ?? 0.01;
    this.tauPlus = params?.tauPlus ?? 20; // ms
    this.tauMinus = params?.tauMinus ?? 20; // ms
    this.aPlus = params?.aPlus ?? 0.1;
    this.aMinus = params?.aMinus ?? 0.12;
  }
  
  /**
   * 处理突触传递和STDP学习
   */
  process(preSpike: boolean, preNeuron: INeuron, postNeuron: INeuron, deltaTime: number = 1): number {
    this.currentTime += deltaTime;
    
    // 衰减突触后电流
    this.synapticCurrent *= this.currentDecay;
    
    // 检查前突触神经元是否发放动作电位
    if (preSpike) {
      this.lastPreSpikeTime = this.currentTime;
      
      // 增加突触后电流
      this.synapticCurrent += this.weight * 10; // 放大因子
      
      // 检查是否有LTD（前突触在后突触之后发放）
      if (this.lastPostSpikeTime > -Infinity) {
        const deltaT = this.currentTime - this.lastPostSpikeTime;
        if (deltaT > 0 && deltaT < 50) { // 50ms窗口
          const ltd = this.aMinus * Math.exp(-deltaT / this.tauMinus);
          this.updateWeight(-ltd);
        }
      }
    }
    
    // 检查后突触神经元是否发放动作电位
    const postState = postNeuron.getState();
    if (postState.isSpiking) {
      this.lastPostSpikeTime = this.currentTime;
      
      // 检查是否有LTP（后突触在前突触之后发放）
      if (this.lastPreSpikeTime > -Infinity) {
        const deltaT = this.currentTime - this.lastPreSpikeTime;
        if (deltaT > 0 && deltaT < 50) { // 50ms窗口
          const ltp = this.aPlus * Math.exp(-deltaT / this.tauPlus);
          this.updateWeight(ltp);
        }
      }
    }
    
    return this.synapticCurrent;
  }
  
  /**
   * 更新突触权重
   */
  private updateWeight(delta: number): void {
    this.weight += this.learningRate * delta;
    // 限制权重范围
    this.weight = Math.max(0, Math.min(1, this.weight));
  }
  
  /**
   * 获取突触状态信息
   */
  getState(): SynapseState {
    return {
      weight: this.weight,
      lastPreSpikeTime: this.lastPreSpikeTime,
      lastPostSpikeTime: this.lastPostSpikeTime,
      recentActivity: this.synapticCurrent
    };
  }
  
  /**
   * 重置突触状态
   */
  reset(): void {
    this.lastPreSpikeTime = -Infinity;
    this.lastPostSpikeTime = -Infinity;
    this.currentTime = 0;
    this.synapticCurrent = 0;
  }
}

/**
 * STDP突触参数接口
 */
export interface STDPParams {
  learningRate: number; // 学习率
  tauPlus: number; // LTP时间常数
  tauMinus: number; // LTD时间常数
  aPlus: number; // LTP幅度
  aMinus: number; // LTD幅度
} 