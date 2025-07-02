/**
 * 世界特定插件配置
 * 定义每个世界中启用的感受器和效应器
 */

export interface WorldPluginConfig {
  worldType: string;
  enabledSensors: string[];
  enabledEffectors: string[];
  description: string;
}

/**
 * 所有世界的插件配置
 */
export const WORLD_PLUGIN_CONFIGS: Record<string, WorldPluginConfig> = {
  'light-seeker': {
    worldType: 'light-seeker',
    enabledSensors: ['light_receptor'],
    enabledEffectors: ['gradient_movement_controller'],
    description: '追光者世界：只启用光感受器和梯度移动控制器，专注于光源追踪行为'
  },
  
  'luminous-garden': {
    worldType: 'luminous-garden',
    enabledSensors: ['light_receptor', 'visual_receptor'],
    enabledEffectors: ['movement_controller', 'rotation_controller'],
    description: '光影花园：启用光感受器、视觉感受器和基础移动控制器，支持复杂的光影环境导航'
  }
};

/**
 * 获取指定世界的插件配置
 */
export function getWorldPluginConfig(worldType: string): WorldPluginConfig {
  return WORLD_PLUGIN_CONFIGS[worldType] || WORLD_PLUGIN_CONFIGS['light-seeker'];
}

/**
 * 检查指定插件在指定世界中是否启用
 */
export function isPluginEnabledInWorld(worldType: string, pluginType: 'sensor' | 'effector', pluginSubtype: string): boolean {
  const config = getWorldPluginConfig(worldType);
  
  if (pluginType === 'sensor') {
    return config.enabledSensors.includes(pluginSubtype);
  } else {
    return config.enabledEffectors.includes(pluginSubtype);
  }
}

/**
 * 获取世界中启用的所有感受器类型
 */
export function getEnabledSensors(worldType: string): string[] {
  return getWorldPluginConfig(worldType).enabledSensors;
}

/**
 * 获取世界中启用的所有效应器类型
 */
export function getEnabledEffectors(worldType: string): string[] {
  return getWorldPluginConfig(worldType).enabledEffectors;
}
