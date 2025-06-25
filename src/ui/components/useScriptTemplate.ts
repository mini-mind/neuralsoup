/**
 * 脚本模板管理Hook
 * 提供标准的脚本模板代码
 */
export const useScriptTemplate = () => {
  const getDefaultTemplate = (scriptName: string) => {
    return `// ${scriptName}
// 自定义智能体行为脚本
//
// --- 使用说明 ---
//
// 1. **初始化**: 此脚本在点击"应用"按钮时执行一次，用于初始化。
//    您可以在此区域定义全局变量，以便在不同帧之间保持状态。
//
// 2. **每帧更新**: 'onFrame(agent)' 函数会在模拟的每一帧被调用。
//    所有智能体的核心逻辑都应在此函数中实现。
//
// 3. **智能体控制**: 通过 'agent' 对象与模拟世界交互。
//
// --- 智能体 API (agent) ---
//
// **属性:**
//
// - agent.vision: number[]
//   一个包含智能体视觉信息的数组，值为 0 到 1 之间的浮点数。
//   数据格式为 [R1, G1, B1, R2, G2, B2, ...]。
//   - 索引 0-11: 前方视野 (4x1 网格)
//   - 索引 12-23: 左侧视野 (4x1 网格)
//   - 索引 24-35: 右侧视野 (4x1 网格)
//   颜色解码:
//   - 绿色 (G > 0.5): 食物
//   - 红色 (R > 0.5) / 蓝色 (B > 0.5): 障碍物
//   - 黑色 (R,G,B 接近 0): 空地
//
// - agent.reward: number
//   当前帧获得的奖励值。
//   - 正值: 奖励 (例如，吃到食物)
//   - 负值: 惩罚 (例如，撞到障碍物)
//
// **方法:**
//
// - agent.move([forward, turnLeft, turnRight, backward]): void
//   控制智能体移动。参数是一个包含四个浮点数的数组，每个值的范围是 0 到 1。
//   - forward: 前进强度
//   - turnLeft: 左转强度
//   - turnRight: 右转强度
//   - backward: 后退强度
//   示例:
//   - agent.move([1, 0, 0, 0]); // 全速前进
//   - agent.move([0.5, 0.5, 0, 0]); // 前进的同时向左转
//
// --- 脚本开始 ---

// 全局变量区域 - 在这里定义需要在多帧之间保持状态的变量
let frameCounter = 0;

/**
 * 每帧调用的主函数
 * @param {object} agent - 智能体对象
 */
function onFrame(agent) {
  // 帧计数器增加
  frameCounter++;

  // 在这里编写您的智能体逻辑
  // 这是一个简单的例子：让智能体一直向前移动

  agent.move([1.0, 0, 0, 0]); // 指示智能体全速前进

  // 您可以在控制台打印信息以进行调试
  if (frameCounter % 60 === 0) { // 每 60 帧打印一次
    console.log("Frame: " + frameCounter + ", Reward: " + agent.reward);
    // console.log("Vision:", agent.vision); // 取消注释以查看视觉数据
  }
}
`;
  };

  return {
    getDefaultTemplate,
  };
}; 