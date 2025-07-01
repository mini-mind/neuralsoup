/**
 * 插件系统测试脚本
 * 验证世界特定插件配置和可见性控制
 */

import { globalPluginManager } from '../core/services/PluginManager';
import { getWorldPluginConfig, isPluginEnabledInWorld } from '../core/config/WorldPluginConfig';

/**
 * 测试世界插件配置
 */
export function testWorldPluginConfigs() {
  console.log('=== 测试世界插件配置 ===');
  
  const worlds = ['light-seeker', 'luminous-garden', 'echo-chamber', 'sentient-swarm', 'chromatic-composer'];
  
  worlds.forEach(worldType => {
    console.log(`\n世界: ${worldType}`);
    const config = getWorldPluginConfig(worldType);
    console.log(`  启用的感受器: ${config.enabledSensors.join(', ')}`);
    console.log(`  启用的效应器: ${config.enabledEffectors.join(', ')}`);
    console.log(`  描述: ${config.description}`);
  });
}

/**
 * 测试插件启用状态
 */
export function testPluginEnabledStates() {
  console.log('\n=== 测试插件启用状态 ===');
  
  const testCases = [
    { world: 'light-seeker', pluginType: 'sensor', pluginSubtype: 'light_receptor', expected: true },
    { world: 'light-seeker', pluginType: 'effector', pluginSubtype: 'gradient_movement_controller', expected: true },
    { world: 'light-seeker', pluginType: 'sensor', pluginSubtype: 'visual_receptor', expected: false },
    { world: 'luminous-garden', pluginType: 'sensor', pluginSubtype: 'visual_receptor', expected: true },
    { world: 'echo-chamber', pluginType: 'sensor', pluginSubtype: 'sonar_receptor', expected: true },
  ];
  
  testCases.forEach(testCase => {
    const result = isPluginEnabledInWorld(
      testCase.world, 
      testCase.pluginType as 'sensor' | 'effector', 
      testCase.pluginSubtype
    );
    const status = result === testCase.expected ? '✓' : '✗';
    console.log(`${status} ${testCase.world} - ${testCase.pluginType}:${testCase.pluginSubtype} = ${result} (期望: ${testCase.expected})`);
  });
}

/**
 * 测试插件管理器
 */
export function testPluginManager() {
  console.log('\n=== 测试插件管理器 ===');
  
  // 测试世界切换
  const worlds = ['light-seeker', 'luminous-garden', 'echo-chamber'];
  
  worlds.forEach(worldType => {
    console.log(`\n切换到世界: ${worldType}`);
    globalPluginManager.setCurrentWorld(worldType);
    
    console.log(`  当前世界: ${globalPluginManager.getCurrentWorldType()}`);
    console.log(`  可见插件数量: ${globalPluginManager.getVisiblePlugins().length}`);
    console.log(`  计算插件数量: ${globalPluginManager.getComputingPlugins().length}`);
    
    const config = globalPluginManager.getCurrentWorldConfig();
    console.log(`  配置: ${config.enabledSensors.length} 感受器, ${config.enabledEffectors.length} 效应器`);
  });
}

/**
 * 运行所有测试
 */
export function runAllTests() {
  console.log('开始插件系统测试...\n');
  
  try {
    testWorldPluginConfigs();
    testPluginEnabledStates();
    testPluginManager();
    
    console.log('\n=== 测试完成 ===');
    console.log('所有测试已执行，请检查上述输出结果');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 如果直接运行此文件，执行测试
if (typeof window !== 'undefined') {
  // 在浏览器环境中，将测试函数暴露到全局作用域
  (window as any).pluginSystemTest = {
    runAllTests,
    testWorldPluginConfigs,
    testPluginEnabledStates,
    testPluginManager
  };
  
  console.log('插件系统测试已加载。在浏览器控制台中运行:');
  console.log('pluginSystemTest.runAllTests()');
}
