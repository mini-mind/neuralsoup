import type { IBrain } from '../../shared/interfaces/IBrain';
import type { ISensor } from '../../shared/interfaces/ISensor';
// import type { IEffector } from '../../shared/interfaces/IEffector';

// 定义构造函数类型
type BrainConstructor = new (...args: any[]) => IBrain;
type SensorConstructor = new (...args: any[]) => ISensor;

/**
 * 模块注册表，用于动态管理和实例化可插拔模块。
 */
export class ModuleRegistry {
  private brainRegistry = new Map<string, BrainConstructor>();
  private sensorRegistry = new Map<string, SensorConstructor>();

  // --- Brain Registration ---
  registerBrain(name: string, constructor: BrainConstructor) {
    this.brainRegistry.set(name, constructor);
  }

  createBrain(name: string, ...args: any[]): IBrain | null {
    const Constructor = this.brainRegistry.get(name);
    if (Constructor) {
      return new Constructor(...args);
    }
    console.error(`Brain with name '${name}' not registered.`);
    return null;
  }

  // --- Sensor Registration ---
  registerSensor(name: string, constructor: SensorConstructor) {
    this.sensorRegistry.set(name, constructor);
  }

  createSensor(name: string, ...args: any[]): ISensor | null {
    const Constructor = this.sensorRegistry.get(name);
    if (Constructor) {
      return new Constructor(...args);
    }
    console.error(`Sensor with name '${name}' not registered.`);
    return null;
  }
}

// 创建一个全局单例供整个应用使用
export const moduleRegistry = new ModuleRegistry(); 