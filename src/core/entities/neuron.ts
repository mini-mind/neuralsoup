/**
 * 可处理节点接口
 * 定义了所有可以处理电压信号的节点的基本行为和属性
 * 包括真正的神经元以及电压输入/输出节点
 */

import { AbstractSensor, AbstractEffector } from './plugins';
import { VoltageInputNode, VoltageAccumulatorNode } from './types';

/**
 * 可处理节点的基础接口
 * 所有能够处理电压信号的节点都应该实现这个接口
 */
export interface IProcessableNode {
  readonly id: string;
  readonly type: 'izhikevich' | 'lif' | 'voltage_input' | 'voltage_accumulator';

  // 电压相关
  voltage: number;
  threshold: number;

  // 位置信息（用于UI显示）
  x: number;
  y: number;

  /**
   * 更新节点状态
   * @param input 输入电流/电压
   * @param deltaTime 时间步长
   * @returns 是否超过阈值或发放了动作电位
   */
  update(input: number, deltaTime: number): boolean;

  /**
   * 重置节点状态
   */
  reset(): void;

  /**
   * 获取当前状态信息
   */
  getState(): NodeState;
}

/**
 * 神经元接口
 * 专门用于真正的神经元（如Izhikevich、LIF等）
 */
export interface INeuron extends IProcessableNode {
  readonly type: 'izhikevich' | 'lif';
}

/**
 * 节点状态信息
 * 适用于所有可处理节点
 */
export interface NodeState {
  voltage: number;
  isSpiking: boolean;
  lastSpikeTime: number;
}

/**
 * 神经元状态信息（向后兼容别名）
 * @deprecated 使用 NodeState 替代
 */
export type NeuronState = NodeState;

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
  getState(): NodeState {
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
  getState(): NodeState {
    return {
      voltage: this.voltage,
      isSpiking: this.currentTime - this.lastSpikeTime < 1, // 1ms内算作尖峰状态
      lastSpikeTime: this.lastSpikeTime
    };
  }
}



/**
 * 视觉感受器
 * 包含8个电压输入节点，覆盖60度视角
 */
export class VisualReceptor extends AbstractSensor {
  private fieldOfView: number = 60; // 视角度数
  private numReceptors: number = 8;

  constructor(id: string, x: number = 0, y: number = 0) {
    super(id, 'visual_receptor', x, y, 8); // 8个感受器节点
  }

  /**
   * 实现抽象方法：获取插件特定参数
   */
  protected getParameters(): Record<string, any> {
    return {
      fieldOfView: this.fieldOfView,
      numReceptors: this.numReceptors,
      nodeCount: this.getInputNodes().length
    };
  }

  /**
   * 获取所有感受器输入节点
   */
  getReceptors(): VoltageInputNode[] {
    return this.getInputNodes();
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

    const inputNodes = this.getInputNodes();
    return inputNodes.map((node, index) =>
      node.update(visualInputs[index], deltaTime)
    );
  }

  /**
   * 重置所有感受器
   */
  reset(): void {
    this.getInputNodes().forEach(node => node.reset());
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
 * 包含2个电压累积节点，控制顺时针和逆时针旋转
 */
export class RotationController extends AbstractEffector {
  constructor(id: string, x: number = 0, y: number = 0) {
    super(id, 'rotation_controller', x, y, 2); // 2个效应器节点
  }

  /**
   * 实现抽象方法：获取插件特定参数
   */
  protected getParameters(): Record<string, any> {
    const accumulatorNodes = this.getAccumulatorNodes();
    return {
      clockwiseNodeId: accumulatorNodes[0]?.id,
      counterclockwiseNodeId: accumulatorNodes[1]?.id
    };
  }

  /**
   * 获取顺时针控制节点
   */
  getClockwiseNode(): VoltageAccumulatorNode {
    return this.getAccumulatorNodes()[0];
  }

  /**
   * 获取逆时针控制节点
   */
  getCounterclockwiseNode(): VoltageAccumulatorNode {
    return this.getAccumulatorNodes()[1];
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
    const clockwiseNode = this.getClockwiseNode();
    const counterclockwiseNode = this.getCounterclockwiseNode();

    return {
      clockwise: clockwiseNode.update(clockwiseInput, deltaTime),
      counterclockwise: counterclockwiseNode.update(counterclockwiseInput, deltaTime)
    };
  }

  /**
   * 获取当前旋转速度（-1到1，负值为逆时针，正值为顺时针）
   */
  getRotationSpeed(): number {
    const cwState = this.getClockwiseNode().getState();
    const ccwState = this.getCounterclockwiseNode().getState();

    return (cwState.voltage - ccwState.voltage) / 100; // 归一化到-1到1
  }

  /**
   * 重置旋转控制器
   */
  reset(): void {
    this.getAccumulatorNodes().forEach(node => node.reset());
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

/**
 * 健康感受器
 * 包含2个电压输入节点：健康度感受器和非健康度感受器
 */
export class HealthReceptor extends AbstractSensor {
  constructor(id: string, x: number = 0, y: number = 0) {
    super(id, 'health_receptor', x, y, 2); // 2个感受器节点
  }

  /**
   * 实现抽象方法：获取插件特定参数
   */
  protected getParameters(): Record<string, any> {
    const inputNodes = this.getInputNodes();
    return {
      healthNodeId: inputNodes[0]?.id,
      unhealthNodeId: inputNodes[1]?.id,
      description: '健康感受器，监测智能体健康状况'
    };
  }

  /**
   * 获取健康度感受器节点
   */
  getHealthNode(): VoltageInputNode {
    return this.getInputNodes()[0];
  }

  /**
   * 获取非健康度感受器节点
   */
  getUnhealthNode(): VoltageInputNode {
    return this.getInputNodes()[1];
  }

  /**
   * 根据健康状态更新感受器
   * @param healthRatio 健康比例（0-1）
   * @param deltaTime 时间步长
   */
  updateWithHealth(healthRatio: number, deltaTime: number = 1): {
    healthSpike: boolean;
    unhealthSpike: boolean;
  } {
    // 健康度输入：健康比例越高，输入越强
    const healthInput = healthRatio * 20;

    // 非健康度输入：健康比例越低，输入越强
    const unhealthInput = (1 - healthRatio) * 20;

    const healthNode = this.getHealthNode();
    const unhealthNode = this.getUnhealthNode();

    return {
      healthSpike: healthNode.update(healthInput, deltaTime),
      unhealthSpike: unhealthNode.update(unhealthInput, deltaTime)
    };
  }

  /**
   * 重置所有感受器
   */
  reset(): void {
    this.getInputNodes().forEach(node => node.reset());
  }
}

/**
 * 移动控制器
 * 包含4个电压累积节点，控制上下左右移动
 */
export class MovementController extends AbstractEffector {
  constructor(id: string, x: number = 0, y: number = 0) {
    super(id, 'movement_controller', x, y, 4); // 4个效应器节点
  }

  /**
   * 实现抽象方法：获取插件特定参数
   */
  protected getParameters(): Record<string, any> {
    const accumulatorNodes = this.getAccumulatorNodes();
    return {
      upNodeId: accumulatorNodes[0]?.id,
      downNodeId: accumulatorNodes[1]?.id,
      leftNodeId: accumulatorNodes[2]?.id,
      rightNodeId: accumulatorNodes[3]?.id,
      description: '移动控制器，控制上下左右移动'
    };
  }

  /**
   * 获取上移动节点
   */
  getUpNode(): VoltageAccumulatorNode {
    return this.getAccumulatorNodes()[0];
  }

  /**
   * 获取下移动节点
   */
  getDownNode(): VoltageAccumulatorNode {
    return this.getAccumulatorNodes()[1];
  }

  /**
   * 获取左移动节点
   */
  getLeftNode(): VoltageAccumulatorNode {
    return this.getAccumulatorNodes()[2];
  }

  /**
   * 获取右移动节点
   */
  getRightNode(): VoltageAccumulatorNode {
    return this.getAccumulatorNodes()[3];
  }

  /**
   * 更新移动控制器
   * @param upInput 上移输入
   * @param downInput 下移输入
   * @param leftInput 左移输入
   * @param rightInput 右移输入
   * @param deltaTime 时间步长
   */
  update(upInput: number, downInput: number, leftInput: number, rightInput: number, deltaTime: number = 1): {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  } {
    const upNode = this.getUpNode();
    const downNode = this.getDownNode();
    const leftNode = this.getLeftNode();
    const rightNode = this.getRightNode();

    return {
      up: upNode.update(upInput, deltaTime),
      down: downNode.update(downInput, deltaTime),
      left: leftNode.update(leftInput, deltaTime),
      right: rightNode.update(rightInput, deltaTime)
    };
  }

  /**
   * 获取当前移动向量（-1到1）
   */
  getMovementVector(): { x: number; y: number } {
    const upState = this.getUpNode().getState();
    const downState = this.getDownNode().getState();
    const leftState = this.getLeftNode().getState();
    const rightState = this.getRightNode().getState();

    return {
      x: (rightState.voltage - leftState.voltage) / 100, // 右为正，左为负，归一化
      y: (upState.voltage - downState.voltage) / 100     // 上为正，下为负，归一化
    };
  }

  /**
   * 重置移动控制器
   */
  reset(): void {
    this.getAccumulatorNodes().forEach(node => node.reset());
  }
}

/**
 * 梯度运动控制器
 * 包含1个电压累积节点，用于接收梯度强度信号并控制朝梯度方向运动
 */
export class GradientMovementController extends AbstractEffector {
  constructor(id: string, x: number = 0, y: number = 0) {
    super(id, 'gradient_movement_controller', x, y, 1); // 1个效应器节点
  }

  /**
   * 实现抽象方法：获取插件特定参数
   */
  protected getParameters(): Record<string, any> {
    const accumulatorNodes = this.getAccumulatorNodes();
    return {
      gradientNodeId: accumulatorNodes[0]?.id,
      description: '梯度运动控制器，根据梯度强度控制运动'
    };
  }

  /**
   * 获取梯度强度节点
   */
  getGradientNode(): VoltageAccumulatorNode {
    return this.getAccumulatorNodes()[0];
  }

  /**
   * 更新梯度运动控制器
   * @param gradientInput 梯度强度输入
   * @param deltaTime 时间步长
   */
  update(gradientInput: number, deltaTime: number = 1): boolean {
    const gradientNode = this.getGradientNode();
    return gradientNode.update(gradientInput, deltaTime);
  }

  /**
   * 获取当前梯度强度（0到1）
   */
  getGradientStrength(): number {
    const gradientState = this.getGradientNode().getState();
    return Math.max(0, Math.min(1, gradientState.voltage / 100)); // 归一化到0-1
  }

  /**
   * 重置梯度运动控制器
   */
  reset(): void {
    this.getAccumulatorNodes().forEach(node => node.reset());
  }
}

/**
 * 光感受器
 * 包含1个电压输入节点，专门用于感知光强度
 */
export class LightReceptor extends AbstractSensor {
  constructor(id: string, x: number = 0, y: number = 0) {
    super(id, 'light_receptor', x, y, 1); // 1个感受器节点
  }

  /**
   * 实现抽象方法：获取插件特定参数
   */
  protected getParameters(): Record<string, any> {
    const inputNodes = this.getInputNodes();
    return {
      lightNodeId: inputNodes[0]?.id,
      description: '光感受器，感知环境中的光强度'
    };
  }

  /**
   * 获取光强度感受器节点
   */
  getLightNode(): VoltageInputNode {
    return this.getInputNodes()[0];
  }

  /**
   * 更新光感受器
   * @param lightIntensity 光强度输入 (0-1)
   * @param deltaTime 时间步长
   */
  update(lightIntensity: number, deltaTime: number = 1): boolean {
    const lightNode = this.getLightNode();
    return lightNode.update(lightIntensity * 100, deltaTime); // 转换为电压值
  }

  /**
   * 获取当前光强度（0到1）
   */
  getLightIntensity(): number {
    const lightState = this.getLightNode().getState();
    return Math.max(0, Math.min(1, lightState.voltage / 100)); // 归一化到0-1
  }

  /**
   * 重置光感受器
   */
  reset(): void {
    this.getInputNodes().forEach(node => node.reset());
  }
}