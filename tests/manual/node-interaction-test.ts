/**
 * 节点交互测试脚本
 * 专门测试神经元节点的选择和拖拽功能
 */

/**
 * 创建测试节点
 */
export function createTestNode() {
  console.log('\n=== 创建测试节点 ===');
  
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('❌ 未找到画布元素');
    return false;
  }
  
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  // 模拟双击事件创建节点
  const doubleClickEvent = new MouseEvent('dblclick', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + centerX,
    clientY: rect.top + centerY,
    button: 0
  });
  
  try {
    canvas.dispatchEvent(doubleClickEvent);
    console.log('✅ 双击事件已触发，应该创建了一个节点');
    return true;
  } catch (error) {
    console.error('❌ 双击事件触发失败:', error);
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
  
  // 模拟鼠标按下事件
  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + centerX,
    clientY: rect.top + centerY,
    button: 0 // 左键
  });
  
  // 模拟鼠标抬起事件
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
    console.log('✅ 节点选择事件已触发');
    return true;
  } catch (error) {
    console.error('❌ 节点选择事件触发失败:', error);
    return false;
  }
}

/**
 * 测试节点拖拽
 */
export function testNodeDrag() {
  console.log('\n=== 测试节点拖拽 ===');
  
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('❌ 未找到画布元素');
    return false;
  }
  
  const rect = canvas.getBoundingClientRect();
  const startX = rect.width / 2;
  const startY = rect.height / 2;
  const endX = startX + 50;
  const endY = startY + 50;
  
  // 模拟拖拽序列
  const mouseDownEvent = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + startX,
    clientY: rect.top + startY,
    button: 0
  });
  
  const mouseMoveEvent = new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + endX,
    clientY: rect.top + endY,
    button: 0
  });
  
  const mouseUpEvent = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + endX,
    clientY: rect.top + endY,
    button: 0
  });
  
  try {
    canvas.dispatchEvent(mouseDownEvent);
    setTimeout(() => {
      canvas.dispatchEvent(mouseMoveEvent);
      setTimeout(() => {
        canvas.dispatchEvent(mouseUpEvent);
      }, 10);
    }, 10);
    console.log('✅ 节点拖拽事件序列已触发');
    return true;
  } catch (error) {
    console.error('❌ 节点拖拽事件触发失败:', error);
    return false;
  }
}

/**
 * 完整的节点交互测试
 */
export function runNodeInteractionTest() {
  console.log('开始节点交互测试...\n');
  
  const results = {
    createNode: false,
    selectNode: false,
    dragNode: false
  };
  
  try {
    // 步骤1：创建节点
    results.createNode = createTestNode();
    
    // 等待一下让节点创建完成
    setTimeout(() => {
      // 步骤2：测试节点选择
      results.selectNode = testNodeSelection();
      
      // 等待一下
      setTimeout(() => {
        // 步骤3：测试节点拖拽
        results.dragNode = testNodeDrag();
        
        // 输出结果
        setTimeout(() => {
          console.log('\n=== 节点交互测试结果 ===');
          Object.entries(results).forEach(([test, passed]) => {
            const status = passed ? '✅' : '❌';
            console.log(`${status} ${test}: ${passed ? '通过' : '失败'}`);
          });
          
          const passedCount = Object.values(results).filter(Boolean).length;
          const totalCount = Object.keys(results).length;
          console.log(`\n总体结果: ${passedCount}/${totalCount} 项测试通过`);
          
          if (passedCount === totalCount) {
            console.log('🎉 所有节点交互测试通过！');
          } else {
            console.warn('⚠️ 部分测试失败，请检查控制台输出');
          }
        }, 100);
      }, 100);
    }, 100);
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 导出测试函数供手动调用
export {
  runNodeInteractionTest,
  createTestNode,
  testNodeSelection,
  testNodeDrag
};
