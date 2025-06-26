import type { IBrain, ISensor } from '../entities/types';
// import type { IEffector } from '../entities/types';

// 定义模块构造函数类型
type BrainConstructor = new (...args: any[]) => IBrain;
type SensorConstructor = new (...args: any[]) => ISensor;
// type EffectorConstructor = new (...args: any[]) => IEffector;

/**
 * 模块注册表，用于管理和创建各种模块实例
 */
export class ModuleRegistry {
  private brains = new Map<string, BrainConstructor>();
  private sensors = new Map<string, SensorConstructor>();
  // private effectors = new Map<string, EffectorConstructor>();

  /**
   * 注册大脑模块
   */
  registerBrain(name: string, constructor: BrainConstructor): void {
    this.brains.set(name, constructor);
  }

  /**
   * 创建大脑实例
   */
  createBrain(name: string, ...args: any[]): IBrain | null {
    const Constructor = this.brains.get(name);
    if (!Constructor) {
      console.warn(`Brain module '${name}' not found`);
      return null;
    }
    return new Constructor(...args);
  }

  /**
   * 注册传感器模块
   */
  registerSensor(name: string, constructor: SensorConstructor): void {
    this.sensors.set(name, constructor);
  }

  /**
   * 创建传感器实例
   */
  createSensor(name: string, ...args: any[]): ISensor | null {
    const Constructor = this.sensors.get(name);
    if (!Constructor) {
      console.warn(`Sensor module '${name}' not found`);
      return null;
    }
    return new Constructor(...args);
  }

  // TODO: 添加执行器相关方法
}

// 全局模块注册表实例
export const globalModuleRegistry = new ModuleRegistry(); 