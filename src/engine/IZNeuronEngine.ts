import { IZNeuronParams, IZNeuronState, SNNNode, SNNSynapse } from '../types/simulation';

/**
 * Izhikevich神经元模型计算引擎
 * 实现了Izhikevich 2003年提出的简化神经元模型
 */
export class IZNeuronEngine {
  private dt: number = 0.5; // 时间步长 (ms)
  
  constructor(timeStep: number = 0.5) {
    this.dt = timeStep;
  }

  /**
   * 更新单个神经元的状态
   * @param neuron 神经元节点
   * @param inputCurrent 输入电流
   * @param currentTime 当前时间 (ms)
   * @returns 是否发放脉冲
   */
  updateNeuron(neuron: SNNNode, inputCurrent: number, currentTime: number): boolean {
    if (!neuron.params || !neuron.state || neuron.type !== 'neuron') {
      return false;
    }

    const { a, b, c, d, threshold } = neuron.params;
    const state = neuron.state;

    // 数值积分求解微分方程
    // dv/dt = 0.04*v^2 + 5*v + 140 - u + I
    // du/dt = a*(b*v - u)
    
    const v = state.v;
    const u = state.u;
    
    // 使用欧拉方法进行数值积分
    const dv = (0.04 * v * v + 5 * v + 140 - u + inputCurrent) * this.dt;
    const du = a * (b * v - u) * this.dt;
    
    state.v += dv;
    state.u += du;
    
    // 检查是否发放脉冲
    if (state.v >= threshold) {
      state.v = c;  // 重置膜电位
      state.u += d; // 更新恢复变量
      state.spike = true;
      state.lastSpikeTime = currentTime;
      return true;
    } else {
      state.spike = false;
      return false;
    }
  }

  /**
   * 计算突触传导的电流
   * @param synapses 所有突触连接
   * @param neurons 所有神经元
   * @param receptorInputs 感受器输入电压
   * @param targetNeuronId 目标神经元ID
   * @param currentTime 当前时间
   * @returns 总的输入电流
   */
  calculateInputCurrent(
    synapses: SNNSynapse[], 
    neurons: SNNNode[], 
    receptorInputs: Map<string, number>,
    targetNeuronId: string, 
    currentTime: number
  ): number {
    let totalCurrent = 0;

    // 遍历所有连接到目标神经元的突触
    const incomingSynapses = synapses.filter(s => s.to === targetNeuronId);
    
    for (const synapse of incomingSynapses) {
      let presynapticSpike = false;
      let spikeTime = 0;

      // 检查前突触是否是神经元
      const presynapticNeuron = neurons.find(n => n.id === synapse.from);
      if (presynapticNeuron && presynapticNeuron.state) {
        presynapticSpike = presynapticNeuron.state.spike;
        spikeTime = presynapticNeuron.state.lastSpikeTime;
      }
      
      // 检查前突触是否是感受器输入
      const receptorVoltage = receptorInputs.get(synapse.from);
      if (receptorVoltage !== undefined) {
        // 感受器输入直接转换为电流（简化模型）
        totalCurrent += receptorVoltage * synapse.weight;
        continue;
      }

      // 如果前突触神经元发放了脉冲，计算传导延迟后的电流
      if (presynapticSpike && (currentTime - spikeTime) >= synapse.delay) {
        // 使用指数衰减的脉冲电流
        const timeSinceSpike = currentTime - spikeTime - synapse.delay;
        const tau = 5; // 衰减时间常数 (ms)
        const current = synapse.weight * Math.exp(-timeSinceSpike / tau);
        totalCurrent += current;
      }
    }

    return totalCurrent;
  }

  /**
   * 更新整个神经网络的状态
   * @param neurons 所有神经元
   * @param synapses 所有突触连接
   * @param receptorInputs 感受器输入电压映射
   * @param currentTime 当前时间
   * @returns 发放脉冲的神经元ID列表
   */
  updateNetwork(
    neurons: SNNNode[], 
    synapses: SNNSynapse[], 
    receptorInputs: Map<string, number>,
    currentTime: number
  ): string[] {
    const firingNeurons: string[] = [];

    // 更新每个神经元
    for (const neuron of neurons) {
      if (neuron.type === 'neuron') {
        const inputCurrent = this.calculateInputCurrent(
          synapses, 
          neurons, 
          receptorInputs,
          neuron.id, 
          currentTime
        );
        
        const fired = this.updateNeuron(neuron, inputCurrent, currentTime);
        if (fired) {
          firingNeurons.push(neuron.id);
        }
      }
    }

    return firingNeurons;
  }

  /**
   * 计算控制器输出信号强度
   * @param synapses 所有突触连接
   * @param neurons 所有神经元
   * @param controllerOutputId 控制器输出点ID
   * @param currentTime 当前时间
   * @returns 信号强度 [0-1]
   */
  calculateControllerOutput(
    synapses: SNNSynapse[], 
    neurons: SNNNode[], 
    controllerOutputId: string,
    currentTime: number
  ): number {
    // 找到连接到控制器输出的突触
    const incomingSynapses = synapses.filter(s => s.to === controllerOutputId);
    let totalSignal = 0;

    for (const synapse of incomingSynapses) {
      const sourceNeuron = neurons.find(n => n.id === synapse.from);
      if (sourceNeuron && sourceNeuron.state) {
        // 如果源神经元最近发放了脉冲，计算信号强度
        const timeSinceSpike = currentTime - sourceNeuron.state.lastSpikeTime;
        if (timeSinceSpike <= 10) { // 10ms内的脉冲有效
          const decay = Math.exp(-timeSinceSpike / 5); // 5ms衰减常数
          totalSignal += Math.abs(synapse.weight) * decay;
        }
      }
    }

    // 归一化到[0,1]范围，使用sigmoid函数
    return 1 / (1 + Math.exp(-totalSignal));
  }

  /**
   * 获取神经元的默认参数（不同类型）
   */
  static getDefaultParams(type: 'regular' | 'intrinsic' | 'chattering' | 'fast' = 'regular'): IZNeuronParams {
    switch (type) {
      case 'intrinsic': // 内在爆发型
        return { a: 0.02, b: 0.2, c: -50, d: 2, threshold: 30 };
      case 'chattering': // 连发型
        return { a: 0.02, b: 0.2, c: -50, d: 2, threshold: 30 };
      case 'fast': // 快速发放型
        return { a: 0.1, b: 0.2, c: -65, d: 2, threshold: 30 };
      default: // 常规发放型
        return { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 };
    }
  }

  /**
   * 创建初始神经元状态
   */
  static createInitialState(): IZNeuronState {
    return {
      v: -65,  // 静息膜电位
      u: 0,    // 初始恢复变量
      spike: false,
      lastSpikeTime: 0
    };
  }
} 