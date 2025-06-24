import { moduleRegistry } from '../core/services/ModuleRegistry';

// 导入所有可用的模块实现
import { JsScriptBrain } from '../modules/brains/JsScriptBrain';
import { VisionSensor } from '../modules/sensors/VisionSensor';

/**
 * 在应用启动时注册所有可插拔的模块。
 */
export function registerAllModules() {
  moduleRegistry.registerBrain('JsScriptBrain', JsScriptBrain);
  // 在这里可以注册更多的大脑...
  // moduleRegistry.registerBrain('SNNBrain', SNNBrain);

  moduleRegistry.registerSensor('VisionSensor', VisionSensor);
  // 在这里可以注册更多的传感器...

  console.log('All available modules have been registered.');
} 