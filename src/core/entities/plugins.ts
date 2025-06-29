/**
 * 插件基类体系
 * 定义了感受器和效应器的通用接口和基类
 * 感受器和效应器是包含多个内部节点的复合组件
 */

import { INeuron, NeuronState } from './neuron';
import { VoltageInputNode, VoltageAccumulatorNode } from './types';

/**
 * 插件基类接口
 * 所有感受器和效应器的共同接口
 * 插件是包含多个内部节点的复合组件
 */
export interface IPlugin {
  readonly id: string;
  readonly pluginType: 'sensor' | 'effector';
  readonly pluginSubtype: string;
  readonly x: number;
  readonly y: number;

  /**
   * 获取插件内部的所有节点
   */
  getNodes(): INeuron[];

  /**
   * 插件特定的处理方法
   */
  process(input: any, deltaTime?: number): any;

  /**
   * 设置插件位置（会同时更新内部节点位置）
   */
  setPosition(x: number, y: number): void;

  /**
   * 获取插件的配置信息
   */
  getConfig(): PluginConfig;

  /**
   * 重置插件状态
   */
  reset(): void;
}

/**
 * 插件配置接口
 */
export interface PluginConfig {
  id: string;
  type: string;
  subtype: string;
  position: { x: number; y: number };
  parameters: Record<string, any>;
}

/**
 * 抽象插件基类
 * 提供所有插件的通用实现
 */
export abstract class AbstractPlugin implements IPlugin {
  readonly id: string;
  readonly pluginType: 'sensor' | 'effector';
  readonly pluginSubtype: string;
  readonly x: number;
  readonly y: number;

  protected nodes: INeuron[] = [];

  constructor(
    id: string,
    pluginType: 'sensor' | 'effector',
    pluginSubtype: string,
    x: number = 0,
    y: number = 0
  ) {
    this.id = id;
    this.pluginType = pluginType;
    this.pluginSubtype = pluginSubtype;
    this.x = x;
    this.y = y;
  }

  /**
   * 获取插件内部的所有节点
   */
  getNodes(): INeuron[] {
    return [...this.nodes];
  }

  /**
   * 设置位置（会同时更新内部节点位置）
   */
  setPosition(x: number, y: number): void {
    const deltaX = x - this.x;
    const deltaY = y - this.y;

    // 更新内部节点位置
    this.nodes.forEach(node => {
      if (node.setPosition) {
        node.setPosition(node.x + deltaX, node.y + deltaY);
      }
    });

    // 更新自身位置
    (this as any).x = x;
    (this as any).y = y;
  }

  /**
   * 获取配置信息
   */
  getConfig(): PluginConfig {
    return {
      id: this.id,
      type: this.pluginSubtype,
      subtype: this.pluginSubtype,
      position: { x: this.x, y: this.y },
      parameters: this.getParameters()
    };
  }

  /**
   * 获取插件特定参数（子类实现）
   */
  protected abstract getParameters(): Record<string, any>;

  /**
   * 插件特定的处理方法（子类实现）
   */
  abstract process(input: any, deltaTime?: number): any;

  /**
   * 重置状态
   */
  reset(): void {
    this.nodes.forEach(node => node.reset());
  }
}

/**
 * 感受器基类
 * 所有感受器的通用基类，包含多个VoltageInputNode
 */
export abstract class AbstractSensor extends AbstractPlugin {
  readonly pluginType = 'sensor' as const;

  constructor(
    id: string,
    pluginSubtype: string,
    x: number = 0,
    y: number = 0,
    nodeCount: number = 1
  ) {
    super(id, 'sensor', pluginSubtype, x, y);
    this.initializeNodes(nodeCount);
  }

  /**
   * 初始化内部节点
   */
  protected initializeNodes(nodeCount: number): void {
    this.nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const nodeId = `${this.id}_input_${i}`;
      const node = new VoltageInputNode(nodeId, this.x + i * 30, this.y);
      this.nodes.push(node);
    }
  }

  /**
   * 获取输入节点
   */
  getInputNodes(): VoltageInputNode[] {
    return this.nodes as VoltageInputNode[];
  }

  /**
   * 感受器的通用处理方法
   */
  process(inputs: number[], deltaTime: number = 1): number[] {
    const results: number[] = [];
    const inputNodes = this.getInputNodes();

    for (let i = 0; i < Math.min(inputs.length, inputNodes.length); i++) {
      results.push(inputNodes[i].process(inputs[i]));
    }

    return results;
  }
}

/**
 * 效应器基类
 * 所有效应器的通用基类，包含多个VoltageAccumulatorNode
 */
export abstract class AbstractEffector extends AbstractPlugin {
  readonly pluginType = 'effector' as const;

  constructor(
    id: string,
    pluginSubtype: string,
    x: number = 0,
    y: number = 0,
    nodeCount: number = 1
  ) {
    super(id, 'effector', pluginSubtype, x, y);
    this.initializeNodes(nodeCount);
  }

  /**
   * 初始化内部节点
   */
  protected initializeNodes(nodeCount: number): void {
    this.nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      const nodeId = `${this.id}_accumulator_${i}`;
      const node = new VoltageAccumulatorNode(nodeId, this.x + i * 40, this.y);
      this.nodes.push(node);
    }
  }

  /**
   * 获取累积节点
   */
  getAccumulatorNodes(): VoltageAccumulatorNode[] {
    return this.nodes as VoltageAccumulatorNode[];
  }

  /**
   * 效应器的通用处理方法
   */
  process(inputs: number[], deltaTime: number = 1): number[] {
    const results: number[] = [];
    const accumulatorNodes = this.getAccumulatorNodes();

    for (let i = 0; i < Math.min(inputs.length, accumulatorNodes.length); i++) {
      results.push(accumulatorNodes[i].process(inputs[i], deltaTime));
    }

    return results;
  }

  /**
   * 获取所有累积值
   */
  getAccumulatedValues(): number[] {
    return this.getAccumulatorNodes().map(node => node.getOutput());
  }
}

/**
 * 插件工厂接口
 */
export interface IPluginFactory {
  createSensor(type: string, id: string, x: number, y: number, config?: any): AbstractSensor;
  createEffector(type: string, id: string, x: number, y: number, config?: any): AbstractEffector;
  getSupportedSensorTypes(): string[];
  getSupportedEffectorTypes(): string[];
}
