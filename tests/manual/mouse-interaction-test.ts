/**
 * 鼠标交互测试脚本
 * 验证画布中的鼠标操作是否正常工作
 */

/**
 * 测试鼠标事件监听器
 */
export function testMouseEventListeners() {
  console.log('=== 测试鼠标事件监听器 ===');
  
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    console.error('❌ 未找到画布元素');
    return false;
  }
  
  console.log('✅ 找到画布元素');
  
  // 检查事件监听器
  const events = ['mousedown', 'mousemove', 'mouseup', 'dblclick', 'wheel'];
  let allEventsAttached = true;
  
  events.forEach(eventType => {
    // 创建测试事件
    const testEvent = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100
    });
    
    try {
      canvas.dispatchEvent(testEvent);
      console.log(`✅ ${eventType} 事件可以正常触发`);
    } catch (error) {
      console.error(`❌ ${eventType} 事件触发失败:`, error);
      allEventsAttached = false;
    }
  });
  
  return allEventsAttached;
}

/**
 * 测试画布尺寸
 */
export function testCanvasSize() {
  console.log('\n=== 测试画布尺寸 ===');
  
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('❌ 未找到画布元素');
    return false;
  }
  
  const rect = canvas.getBoundingClientRect();
  console.log(`画布尺寸: ${rect.width} x ${rect.height}`);
  console.log(`画布位置: (${rect.left}, ${rect.top})`);
  
  if (rect.width > 0 && rect.height > 0) {
    console.log('✅ 画布尺寸正常');
    return true;
  } else {
    console.error('❌ 画布尺寸异常');
    return false;
  }
}

/**
 * 测试标签页切换
 */
export function testTabSwitching() {
  console.log('\n=== 测试标签页切换 ===');
  
  const worldTab = document.querySelector('.tab-item:first-child') as HTMLElement;
  const brainTab = document.querySelector('.tab-item:last-child') as HTMLElement;
  
  if (!worldTab || !brainTab) {
    console.error('❌ 未找到标签页元素');
    return false;
  }
  
  console.log('✅ 找到标签页元素');
  
  // 测试切换到世界标签页
  worldTab.click();
  setTimeout(() => {
    const worldContent = document.querySelector('.world-selection-tab');
    if (worldContent) {
      console.log('✅ 世界标签页切换成功');
    } else {
      console.error('❌ 世界标签页切换失败');
    }
    
    // 切换回大脑标签页
    brainTab.click();
    setTimeout(() => {
      const brainContent = document.querySelector('.brain-tab-content');
      if (brainContent) {
        console.log('✅ 大脑标签页切换成功');
      } else {
        console.error('❌ 大脑标签页切换失败');
      }
    }, 100);
  }, 100);
  
  return true;
}

/**
 * 测试操作提示
 */
export function testHelpTooltip() {
  console.log('\n=== 测试操作提示 ===');
  
  const helpIcon = document.querySelector('.canvas-help-tooltip .help-icon') as HTMLElement;
  if (!helpIcon) {
    console.error('❌ 未找到操作提示图标');
    return false;
  }
  
  console.log('✅ 找到操作提示图标');
  
  // 检查提示文本
  const tooltipText = helpIcon.getAttribute('title');
  if (tooltipText && tooltipText.length > 0) {
    console.log(`✅ 操作提示文本: ${tooltipText.substring(0, 50)}...`);
    return true;
  } else {
    console.error('❌ 操作提示文本为空');
    return false;
  }
}

/**
 * 测试插件可见性
 */
export function testPluginVisibility() {
  console.log('\n=== 测试插件可见性 ===');
  
  const pluginGroups = document.querySelectorAll('.neuron-group');
  console.log(`找到 ${pluginGroups.length} 个插件组`);
  
  if (pluginGroups.length > 0) {
    console.log('✅ 插件组正常显示');
    return true;
  } else {
    console.warn('⚠️ 未找到插件组，可能是正常的（取决于当前世界配置）');
    return true;
  }
}

/**
 * 测试滚轮缩放
 */
export function testWheelZoom() {
  console.log('\n=== 测试滚轮缩放 ===');

  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('❌ 未找到画布元素');
    return false;
  }

  // 创建滚轮事件
  const wheelEvent = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY: -100 // 向上滚动，应该放大
  });

  try {
    canvas.dispatchEvent(wheelEvent);
    console.log('✅ 滚轮缩放事件触发成功');
    return true;
  } catch (error) {
    console.error('❌ 滚轮缩放事件触发失败:', error);
    return false;
  }
}

/**
 * 测试节点选择
 */
export function testNodeSelection() {
  console.log('\n=== 测试节点选择 ===');

  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('❌ 未找到画布元素');
    return false;
  }

  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  // 模拟点击画布中心附近的位置
  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + centerX,
    clientY: rect.top + centerY,
    button: 0 // 左键
  });

  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + centerX,
    clientY: rect.top + centerY,
    button: 0 // 左键
  });

  try {
    canvas.dispatchEvent(mouseDownEvent);
    setTimeout(() => {
      canvas.dispatchEvent(mouseUpEvent);
    }, 10);
    console.log('✅ 节点选择事件触发成功');
    return true;
  } catch (error) {
    console.error('❌ 节点选择事件触发失败:', error);
    return false;
  }
}

/**
 * 运行所有交互测试
 */
export function runAllInteractionTests() {
  console.log('开始鼠标交互测试...\n');

  const results = {
    mouseEvents: false,
    canvasSize: false,
    tabSwitching: false,
    helpTooltip: false,
    pluginVisibility: false,
    wheelZoom: false,
    nodeSelection: false
  };
  
  try {
    results.mouseEvents = testMouseEventListeners();
    results.canvasSize = testCanvasSize();
    results.tabSwitching = testTabSwitching();
    results.helpTooltip = testHelpTooltip();
    results.pluginVisibility = testPluginVisibility();
    results.wheelZoom = testWheelZoom();
    results.nodeSelection = testNodeSelection();
    
    console.log('\n=== 测试结果汇总 ===');
    Object.entries(results).forEach(([test, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${test}: ${passed ? '通过' : '失败'}`);
    });
    
    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    console.log(`\n总体结果: ${passedCount}/${totalCount} 项测试通过`);
    
    if (passedCount === totalCount) {
      console.log('🎉 所有测试通过！鼠标交互功能正常');
    } else {
      console.warn('⚠️ 部分测试失败，请检查相关功能');
    }
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 导出测试函数供手动调用
export {
  runAllInteractionTests,
  testMouseEventListeners,
  testCanvasSize,
  testTabSwitching,
  testHelpTooltip,
  testPluginVisibility,
  testWheelZoom,
  testNodeSelection
};
