import type { IWorld, ICollidable } from '../world/types';
import { IProcessableNode, NodeState } from './neuron';

/**
 * 定义了智能体"大脑"的契约。
 */
export interface IBrain {
  /**
   * 根据当前状态决定下一步的动作。
   * @param state - 从传感器收集的当前环境状态。
   * @returns 一个或多个供执行器执行的动作。
   */
  decide(state: any): any;
}

/**
 * 定义了"传感器"的契约。
 */
export interface ISensor {
  /**
   * 从世界中读取数据。
   * @param world - 当前的世界实例。
   * @param agent - 拥有该传感器的智能体实例。
   * @returns 传感器读取到的状态信息。
   */
  read(world: IWorld, agent: IAgent): any;
}

/**
 * 定义了"执行器"的契约。
 */
export interface IEffector {
  /**
   * 在世界中执行一个动作。
   * @param action - 由大脑决定的动作。
   * @param world - 当前的世界实例。
   * @param agent - 执行该动作的智能体实例。
   */
  execute(action: any, world: IWorld, agent: IAgent): void;
}

/**
 * 定义了"智能体"的契约。
 * 智能体是环境中的自主实体，拥有大脑、传感器和执行器。
 * 它同时也是一个可碰撞的实体。
 */
export interface IAgent extends ICollidable {
  readonly id: string;
  readonly brain: IBrain;
  readonly sensors: ISensor[];
  readonly effectors: IEffector[];

  /**
   * 更新智能体的状态，通常在一个仿真时间步中调用。
   * @param world - 当前的世界实例。
   */
  update(world: IWorld): void;
}

/**
 * 电压输入节点类
 * 感受器的内部组件，输入多少就立刻输出多少，没有内在逻辑
 * 这不是真正的神经元，而是一个简单的电压传递节点
 */
export class VoltageInputNode implements IProcessableNode {
  readonly id: string;
  readonly type = 'voltage_input' as const;
  x: number;
  y: number;
  voltage: number = 0; // 当前电压值
  threshold: number = 0.5; // 阈值
  private currentOutput: number = 0;

  constructor(id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
  }

  /**
   * 设置位置
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * 处理输入并立即输出
   */
  process(input: number): number {
    this.currentOutput = input;
    this.voltage = input;
    return this.currentOutput;
  }

  /**
   * 更新神经元状态 - INeuron接口要求
   */
  update(input: number, _deltaTime: number): boolean {
    this.process(input);
    return this.voltage >= this.threshold;
  }

  /**
   * 获取当前输出
   */
  getOutput(): number {
    return this.currentOutput;
  }

  /**
   * 获取状态信息 - IProcessableNode接口要求
   */
  getState(): NodeState {
    return {
      voltage: this.voltage,
      isSpiking: this.voltage >= this.threshold,
      lastSpikeTime: -Infinity
    };
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.currentOutput = 0;
    this.voltage = 0;
  }
}

/**
 * 电压累积节点类
 * 输入的电压经过打折后累积起来但会随时间快速线性衰减
 * 已有电压越高则累加时打折力度越大
 */
/**
 * 电压累积节点类
 * 效应器的内部组件，累积输入电压，持续衰减，最大值限制为1
 * 这不是真正的神经元，而是一个电压累积和衰减节点
 */
export class VoltageAccumulatorNode implements IProcessableNode {
  readonly id: string;
  readonly type = 'voltage_accumulator' as const;
  x: number;
  y: number;
  voltage: number = 0; // 当前电压值，对外接口
  threshold: number = 50; // 阈值
  private accumulatedVoltage: number = 0;
  private lastUpdateTime: number = Date.now();

  // 参数配置
  private readonly decayRate: number = 0.95; // 每毫秒的衰减率
  private readonly maxVoltage: number = 100; // 最大电压
  private readonly discountFactor: number = 0.1; // 基础打折因子

  constructor(id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
  }

  /**
   * 设置位置
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /**
   * 处理输入并累积电压
   */
  process(input: number, _deltaTime: number = 1): number {
    const currentTime = Date.now();
    const timeDelta = Math.max(1, currentTime - this.lastUpdateTime);

    // 时间衰减
    this.accumulatedVoltage *= Math.pow(this.decayRate, timeDelta);

    // 计算打折因子（电压越高打折越厉害）
    const voltageRatio = this.accumulatedVoltage / this.maxVoltage;
    const currentDiscountFactor = this.discountFactor * (1 + voltageRatio * 2);

    // 累积新输入（打折后）
    const discountedInput = input * (1 - Math.min(0.9, currentDiscountFactor));
    this.accumulatedVoltage = Math.min(this.maxVoltage, this.accumulatedVoltage + discountedInput);

    // 更新对外接口的voltage值
    this.voltage = this.accumulatedVoltage;

    this.lastUpdateTime = currentTime;
    return this.accumulatedVoltage;
  }

  /**
   * 更新节点状态 - IProcessableNode接口要求
   */
  update(input: number, deltaTime: number): boolean {
    this.process(input, deltaTime);
    return this.voltage >= this.threshold;
  }

  /**
   * 获取当前累积电压
   */
  getOutput(): number {
    return this.accumulatedVoltage;
  }

  /**
   * 获取状态信息 - IProcessableNode接口要求
   */
  getState(): NodeState {
    return {
      voltage: this.voltage,
      isSpiking: this.voltage >= this.threshold,
      lastSpikeTime: -Infinity
    };
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.accumulatedVoltage = 0;
    this.voltage = 0;
    this.lastUpdateTime = Date.now();
  }
}