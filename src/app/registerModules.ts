import { globalModuleRegistry } from '../core/services/ModuleRegistry';

// 导入所有可用的模块实现
// import { SimpleBrain } from '../modules/brains/SimpleBrain';
// import { VisionSensor } from '../modules/sensors/VisionSensor';

/**
 * 注册所有可用的模块到全局注册表
 * 这个函数应该在应用启动时调用一次
 */
export function registerAllModules() {
  // 注册大脑模块
  // globalModuleRegistry.registerBrain('simple', SimpleBrain);
  
  // 注册传感器模块
  // globalModuleRegistry.registerSensor('vision', VisionSensor);
  
  console.log('All modules registered successfully');
} 