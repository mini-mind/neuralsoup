/**
 * 皮质柱神经网络实现
 * 基于脉冲神经网络的多层前馈网络
 */

interface CorticalColumnConfig {
  inputSize: number;
  hiddenSizes: number[];
  outputSize: number;
  dt: number;
}

export class CorticalColumn {
  private inputSize: number;
  private hiddenSizes: number[];
  private outputSize: number;
  private dt: number;
  
  // 网络参数
  private weights: number[][][];
  private biases: number[][];
  private layerSizes: number[];
  
  // 神经元状态
  private membranePotentials: number[][];
  private spikeMask: number[][];
  private refractoryTimers: number[][];
  
  // 网络参数
  private readonly V_THRESHOLD = -55.0;
  private readonly V_RESET = -70.0;
  private readonly V_REST = -65.0;
  private readonly TAU_MEMBRANE = 20.0;
  private readonly REFRACTORY_PERIOD = 2.0;
  
  // 情绪调节参数
  private synapticScaling = 1.0;
  private thresholdAdjustment = 0.0;

  constructor(config: CorticalColumnConfig) {
    this.inputSize = config.inputSize;
    this.hiddenSizes = config.hiddenSizes;
    this.outputSize = config.outputSize;
    this.dt = config.dt;
    
    this.layerSizes = [this.inputSize, ...this.hiddenSizes, this.outputSize];
    
    this.initializeNetwork();
  }

  private initializeNetwork(): void {
    this.weights = [];
    this.biases = [];
    this.membranePotentials = [];
    this.spikeMask = [];
    this.refractoryTimers = [];
    
    // 初始化权重和偏置
    for (let i = 0; i < this.layerSizes.length - 1; i++) {
      const inputSize = this.layerSizes[i];
      const outputSize = this.layerSizes[i + 1];
      
      // Xavier初始化
      const weightScale = Math.sqrt(2.0 / (inputSize + outputSize));
      const layerWeights: number[][] = [];
      
      for (let j = 0; j < inputSize; j++) {
        const neuronWeights: number[] = [];
        for (let k = 0; k < outputSize; k++) {
          neuronWeights.push((Math.random() - 0.5) * 2 * weightScale);
        }
        layerWeights.push(neuronWeights);
      }
      
      this.weights.push(layerWeights);
      this.biases.push(new Array(outputSize).fill(0));
    }
    
    // 初始化神经元状态（除输入层）
    for (let i = 1; i < this.layerSizes.length; i++) {
      const size = this.layerSizes[i];
      this.membranePotentials.push(new Array(size).fill(this.V_REST));
      this.spikeMask.push(new Array(size).fill(0));
      this.refractoryTimers.push(new Array(size).fill(0));
    }
  }

  applyEmotionModulation(synapticScaling: number, thresholdAdjustment: number): void {
    this.synapticScaling = synapticScaling;
    this.thresholdAdjustment = thresholdAdjustment;
  }

  forward(inputs: number[]): number[] {
    if (inputs.length !== this.inputSize) {
      throw new Error(`输入大小不匹配: 期望 ${this.inputSize}, 得到 ${inputs.length}`);
    }
    
    let currentInput = inputs;
    
    // 逐层前向传播
    for (let layerIdx = 0; layerIdx < this.weights.length; layerIdx++) {
      // 计算输入电流
      const inputCurrent = this.computeLayerOutput(currentInput, layerIdx);
      
      // 应用情绪调节
      for (let i = 0; i < inputCurrent.length; i++) {
        inputCurrent[i] *= this.synapticScaling;
      }
      
      // 更新膜电位
      this.updateMembranePotentials(layerIdx, inputCurrent);
      
      // 检查脉冲发放
      const spikes = this.checkSpikes(layerIdx);
      
      // 更新不应期
      this.updateRefractory(layerIdx, spikes);
      
      // 下一层的输入是当前层的脉冲
      currentInput = spikes;
    }
    
    // 返回输出层的活动（简化为速率编码）
    const outputLayer = this.membranePotentials[this.membranePotentials.length - 1];
    const outputs = outputLayer.map(v => {
      // 将膜电位映射到[0,1]范围，并增强信号
      const normalized = Math.max(0, (v - this.V_REST) / (this.V_THRESHOLD - this.V_REST));
      return Math.min(1.0, normalized * 2.0); // 增强输出信号
    });
    
    return outputs;
  }

  private computeLayerOutput(inputs: number[], layerIdx: number): number[] {
    const weights = this.weights[layerIdx];
    const biases = this.biases[layerIdx];
    const outputs = [...biases]; // 复制偏置
    
    for (let i = 0; i < inputs.length; i++) {
      for (let j = 0; j < outputs.length; j++) {
        outputs[j] += inputs[i] * weights[i][j];
      }
    }
    
    return outputs;
  }

  private updateMembranePotentials(layerIdx: number, inputCurrents: number[]): void {
    const potentials = this.membranePotentials[layerIdx];
    
    for (let i = 0; i < potentials.length; i++) {
      // 漏积分神经元模型
      const leakCurrent = (this.V_REST - potentials[i]) / this.TAU_MEMBRANE;
      const dvdt = leakCurrent + inputCurrents[i];
      potentials[i] += dvdt * this.dt;
    }
  }

  private checkSpikes(layerIdx: number): number[] {
    const potentials = this.membranePotentials[layerIdx];
    const refractory = this.refractoryTimers[layerIdx];
    const spikes = this.spikeMask[layerIdx];
    
    const effectiveThreshold = this.V_THRESHOLD + this.thresholdAdjustment;
    
    for (let i = 0; i < potentials.length; i++) {
      if (potentials[i] >= effectiveThreshold && refractory[i] <= 0) {
        spikes[i] = 1;
        potentials[i] = this.V_RESET; // 重置膜电位
      } else {
        spikes[i] = 0;
      }
    }
    
    return [...spikes];
  }

  private updateRefractory(layerIdx: number, spikes: number[]): void {
    const refractory = this.refractoryTimers[layerIdx];
    
    for (let i = 0; i < refractory.length; i++) {
      if (spikes[i] > 0) {
        refractory[i] = this.REFRACTORY_PERIOD;
      } else {
        refractory[i] = Math.max(0, refractory[i] - this.dt);
      }
    }
  }

  resetState(): void {
    // 重置所有神经元状态
    for (let layerIdx = 0; layerIdx < this.membranePotentials.length; layerIdx++) {
      const size = this.membranePotentials[layerIdx].length;
      this.membranePotentials[layerIdx] = new Array(size).fill(this.V_REST);
      this.spikeMask[layerIdx] = new Array(size).fill(0);
      this.refractoryTimers[layerIdx] = new Array(size).fill(0);
    }
  }

  getNetworkInfo(): any {
    return {
      layerSizes: this.layerSizes,
      synapticScaling: this.synapticScaling,
      thresholdAdjustment: this.thresholdAdjustment,
      totalParameters: this.weights.reduce((sum, layer) => 
        sum + layer.reduce((layerSum, neuron) => layerSum + neuron.length, 0), 0)
    };
  }
} 