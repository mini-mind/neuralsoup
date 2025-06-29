/**
 * 神经元接口
 * 定义了神经元的基本行为和属性
 */

import { AbstractSensor, AbstractEffector } from './plugins';
export interface INeuron {
  readonly id: string;
  readonly type: 'izhikevich' | 'lif' | 'voltage_input' | 'voltage_accumulator';

  // 膜电位相关
  voltage: number;
  threshold: number;

  // 位置信息（用于UI显示）
  x: number;
  y: number;

  /**
   * 更新神经元状态
   * @param input 输入电流
   * @param deltaTime 时间步长
   * @returns 是否发放了动作电位
   */
  update(input: number, deltaTime: number): boolean;

  /**
   * 重置神经元状态
   */
  reset(): void;

  /**
   * 获取当前状态信息
   */
  getState(): NeuronState;
}

/**
 * 神经元状态信息
 */
export interface NeuronState {
  voltage: number;
  isSpiking: boolean;
  lastSpikeTime: number;
}

/**
 * Izhikevich神经元模型实现
 * 基于Izhikevich 2003年的简单神经元模型
 */
export class IzhikevichNeuron implements INeuron {
  readonly id: string;
  readonly type = 'izhikevich' as const;

  // 膜电位和恢复变量
  voltage: number = -70; // 膜电位 (mV)
  recovery: number = -14; // 恢复变量
  threshold: number = 30; // 阈值电位 (mV)

  // 位置信息
  x: number;
  y: number;

  // Izhikevich模型参数
  private a: number; // 恢复时间常数
  private b: number; // 恢复敏感性
  private c: number; // 重置后的电位值
  private d: number; // 重置后恢复变量的增量

  // 状态追踪
  private lastSpikeTime: number = -Infinity;
  private currentTime: number = 0;

  constructor(
    id: string,
    x: number = 0,
    y: number = 0,
    params?: Partial<IzhikevichParams>
  ) {
    this.id = id;
    this.x = x;
    this.y = y;

    // 设置默认参数（常规尖峰神经元）
    const defaultParams = { a: 0.02, b: 0.2, c: -65, d: 8 };
    this.a = params?.a ?? defaultParams.a;
    this.b = params?.b ?? defaultParams.b;
    this.c = params?.c ?? defaultParams.c;
    this.d = params?.d ?? defaultParams.d;
  }
  

  
  /**
   * 更新神经元状态
   */
  update(input: number, deltaTime: number = 1): boolean {
    this.currentTime += deltaTime;
    
    // Izhikevich模型的微分方程（欧拉方法数值积分）
    const dv = 0.04 * this.voltage * this.voltage + 5 * this.voltage + 140 - this.recovery + input;
    const du = this.a * (this.b * this.voltage - this.recovery);
    
    this.voltage += dv * deltaTime;
    this.recovery += du * deltaTime;
    
    // 检查是否发放动作电位
    if (this.voltage >= this.threshold) {
      this.voltage = this.c; // 重置膜电位
      this.recovery += this.d; // 增加恢复变量
      this.lastSpikeTime = this.currentTime;
      return true; // 发放了尖峰
    }
    
    return false;
  }
  
  /**
   * 重置神经元状态
   */
  reset(): void {
    this.voltage = -70;
    this.recovery = this.b * this.voltage;
    this.lastSpikeTime = -Infinity;
    this.currentTime = 0;
  }
  
  /**
   * 获取当前状态信息
   */
  getState(): NeuronState {
    return {
      voltage: this.voltage,
      isSpiking: this.currentTime - this.lastSpikeTime < 1, // 1ms内算作尖峰状态
      lastSpikeTime: this.lastSpikeTime
    };
  }
}

/**
 * LIF (Leaky Integrate-and-Fire) 神经元模型实现
 * 简单的积分发放神经元模型
 */
export class LIFNeuron implements INeuron {
  readonly id: string;
  readonly type = 'lif' as const;

  // 膜电位相关
  voltage: number = -70; // 膜电位 (mV)
  threshold: number = -55; // 阈值电位 (mV)

  // 位置信息
  x: number;
  y: number;

  // LIF模型参数
  private restingPotential: number = -70; // 静息电位 (mV)
  private membraneResistance: number = 10; // 膜阻抗 (MΩ)
  private membraneCapacitance: number = 1; // 膜电容 (nF)
  private refractoryPeriod: number = 2; // 不应期 (ms)

  // 状态追踪
  private lastSpikeTime: number = -Infinity;
  private currentTime: number = 0;

  constructor(
    id: string,
    x: number = 0,
    y: number = 0,
    params?: Partial<LIFParams>
  ) {
    this.id = id;
    this.x = x;
    this.y = y;

    // 设置参数
    if (params) {
      this.threshold = params.threshold ?? this.threshold;
      this.restingPotential = params.restingPotential ?? this.restingPotential;
      this.membraneResistance = params.membraneResistance ?? this.membraneResistance;
      this.membraneCapacitance = params.membraneCapacitance ?? this.membraneCapacitance;
      this.refractoryPeriod = params.refractoryPeriod ?? this.refractoryPeriod;
    }
  }

  /**
   * 更新神经元状态
   */
  update(input: number, deltaTime: number = 1): boolean {
    this.currentTime += deltaTime;

    // 检查是否在不应期
    if (this.currentTime - this.lastSpikeTime < this.refractoryPeriod) {
      return false;
    }

    // LIF模型的微分方程
    const tau = this.membraneResistance * this.membraneCapacitance; // 时间常数
    const dv = (-(this.voltage - this.restingPotential) + this.membraneResistance * input) / tau;

    this.voltage += dv * deltaTime;

    // 检查是否发放动作电位
    if (this.voltage >= this.threshold) {
      this.voltage = this.restingPotential; // 重置膜电位
      this.lastSpikeTime = this.currentTime;
      return true; // 发放了尖峰
    }

    return false;
  }

  /**
   * 重置神经元状态
   */
  reset(): void {
    this.voltage = this.restingPotential;
    this.lastSpikeTime = -Infinity;
    this.currentTime = 0;
  }

  /**
   * 获取当前状态信息
   */
  getState(): NeuronState {
    return {
      voltage: this.voltage,
      isSpiking: this.currentTime - this.lastSpikeTime < 1, // 1ms内算作尖峰状态
      lastSpikeTime: this.lastSpikeTime
    };
  }
}

/**
 * 效应神经元
 * 电压范围0-1，持续快速线性衰减到0，最大值限制为1
 */
export class EffectorNeuron implements INeuron {
  readonly id: string;
  readonly type = 'voltage_accumulator' as const;
  
  voltage: number = 0; // 电压范围 0-1
  threshold: number = 0.5; // 阈值
  
  x: number;
  y: number;
  
  // 衰减参数
  private decayRate: number = 0.01; // 每毫秒衰减量
  private lastSpikeTime: number = -Infinity;
  private currentTime: number = 0;
  
  constructor(id: string, x: number = 0, y: number = 0, decayRate: number = 0.01) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.decayRate = decayRate;
  }
  
  update(input: number, deltaTime: number = 1): boolean {
    this.currentTime += deltaTime;
    
    // 添加输入并限制最大值为1
    this.voltage = Math.min(1, this.voltage + input);
    
    // 线性衰减到0
    this.voltage = Math.max(0, this.voltage - this.decayRate * deltaTime);
    
    // 检查是否超过阈值
    if (this.voltage >= this.threshold) {
      this.lastSpikeTime = this.currentTime;
      return true;
    }
    
    return false;
  }
  
  reset(): void {
    this.voltage = 0;
    this.lastSpikeTime = -Infinity;
    this.currentTime = 0;
  }
  
  getState(): NeuronState {
    return {
      voltage: this.voltage,
      isSpiking: this.currentTime - this.lastSpikeTime < 1,
      lastSpikeTime: this.lastSpikeTime
    };
  }
}

/**
 * 视觉感受器
 * 包含8个神经元，覆盖60度视角
 */
export class VisualReceptor extends AbstractSensor {
  private neurons: IzhikevichNeuron[] = [];
  private fieldOfView: number = 60; // 视角度数
  private numReceptors: number = 8;

  constructor(id: string, x: number = 0, y: number = 0) {
    super(id, 'visual_receptor', x, y, 8); // 8个感受器节点

    // 创建8个感受器神经元（除了基类创建的VoltageInputNode）
    for (let i = 0; i < this.numReceptors; i++) {
      const neuronId = `${id}_receptor_${i}`;
      this.neurons.push(new IzhikevichNeuron(neuronId, x, y));
    }
  }

  /**
   * 实现抽象方法：获取插件特定参数
   */
  protected getParameters(): Record<string, any> {
    return {
      fieldOfView: this.fieldOfView,
      numReceptors: this.numReceptors,
      neuronCount: this.neurons.length
    };
  }
  
  /**
   * 获取所有感受器神经元
   */
  getReceptors(): IzhikevichNeuron[] {
    return this.neurons;
  }
  
  /**
   * 根据视觉输入更新所有感受器
   * @param visualInputs 8个感受器的输入数组
   * @param deltaTime 时间步长
   */
  update(visualInputs: number[], deltaTime: number = 1): boolean[] {
    if (visualInputs.length !== this.numReceptors) {
      throw new Error(`视觉输入数量必须为${this.numReceptors}个`);
    }
    
    return this.neurons.map((neuron, index) => 
      neuron.update(visualInputs[index], deltaTime)
    );
  }
  
  /**
   * 重置所有感受器
   */
  reset(): void {
    this.neurons.forEach(neuron => neuron.reset());
  }
  
  /**
   * 获取每个感受器的视角方向（度数）
   */
  getReceptorAngles(): number[] {
    const angleStep = this.fieldOfView / (this.numReceptors - 1);
    const startAngle = -this.fieldOfView / 2;
    
    return Array.from({ length: this.numReceptors }, (_, i) => 
      startAngle + i * angleStep
    );
  }
}

/**
 * 旋转控制器
 * 包含2个效应神经元，控制顺时针和逆时针旋转
 */
export class RotationController extends AbstractEffector {
  private clockwiseNeuron: EffectorNeuron;
  private counterclockwiseNeuron: EffectorNeuron;

  constructor(id: string, x: number = 0, y: number = 0) {
    super(id, 'rotation_controller', x, y, 2); // 2个效应器节点

    this.clockwiseNeuron = new EffectorNeuron(`${id}_cw`, x, y);
    this.counterclockwiseNeuron = new EffectorNeuron(`${id}_ccw`, x, y);
  }

  /**
   * 实现抽象方法：获取插件特定参数
   */
  protected getParameters(): Record<string, any> {
    return {
      clockwiseNeuronId: this.clockwiseNeuron.id,
      counterclockwiseNeuronId: this.counterclockwiseNeuron.id
    };
  }
  
  /**
   * 获取顺时针控制神经元
   */
  getClockwiseNeuron(): EffectorNeuron {
    return this.clockwiseNeuron;
  }
  
  /**
   * 获取逆时针控制神经元
   */
  getCounterclockwiseNeuron(): EffectorNeuron {
    return this.counterclockwiseNeuron;
  }
  
  /**
   * 更新旋转控制器
   * @param clockwiseInput 顺时针输入
   * @param counterclockwiseInput 逆时针输入
   * @param deltaTime 时间步长
   */
  update(clockwiseInput: number, counterclockwiseInput: number, deltaTime: number = 1): {
    clockwise: boolean;
    counterclockwise: boolean;
  } {
    return {
      clockwise: this.clockwiseNeuron.update(clockwiseInput, deltaTime),
      counterclockwise: this.counterclockwiseNeuron.update(counterclockwiseInput, deltaTime)
    };
  }
  
  /**
   * 获取当前旋转速度（-1到1，负值为逆时针，正值为顺时针）
   */
  getRotationSpeed(): number {
    const cwState = this.clockwiseNeuron.getState();
    const ccwState = this.counterclockwiseNeuron.getState();
    
    return cwState.voltage - ccwState.voltage;
  }
  
  /**
   * 重置旋转控制器
   */
  reset(): void {
    this.clockwiseNeuron.reset();
    this.counterclockwiseNeuron.reset();
  }
}

/**
 * Izhikevich神经元参数接口
 */
export interface IzhikevichParams {
  a: number; // 恢复时间常数
  b: number; // 恢复敏感性
  c: number; // 重置后的电位值
  d: number; // 重置后恢复变量的增量
}

/**
 * LIF神经元参数接口
 */
export interface LIFParams {
  threshold: number; // 阈值电位
  restingPotential: number; // 静息电位
  membraneResistance: number; // 膜阻抗
  membraneCapacitance: number; // 膜电容
  refractoryPeriod: number; // 不应期
}