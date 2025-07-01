import React, { createContext, useContext, useState, ReactNode } from "react";

export type Language = "zh" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

const translations = {
  zh: {
    // 控件
    "controls.start": "启动",
    "controls.stop": "停止",

    // 标签页
    "tab.script": "脚本编辑",
    "tab.agent-params": "智能体参数",
    "tab.settings": "设置",
    "tab.snn": "SNN 编辑器",
    "tabs.world": "世界",
    "tabs.brain": "大脑",

    // 按钮
    "btn.start": "开始",
    "btn.pause": "暂停",
    "btn.resume": "继续",
    "btn.apply-script": "✓ 应用脚本",
    "btn.manual-control": "🎮",
    "btn.cancel": "取消",
    "btn.create": "创建",
    "btn.rename": "重命名",
    "btn.delete": "删除",
    "btn.confirm": "确定",
    "btn.apply": "应用设置",
    "btn.applied": "已应用",

    // 头部导航
    "header.world": "世界",
    "header.world-tooltip": "选择仿真世界环境",
    "header.share": "分享",
    "header.share-tooltip": "分享当前配置",
    "header.user": "用户",
    "header.language-switch": "语言切换",

    // 侧边栏
    "sidebar.world": "世界",
    "sidebar.agent": "智能体",
    "sidebar.brain": "大脑",
    "sidebar.freemode": "自由模式",
    "sidebar.ranked": "排位",
    "sidebar.sensors": "感受器",
    "sidebar.effectors": "效应器",
    "sidebar.script": "脚本",
    "sidebar.snn": "SNN模型",
    "sidebar.leaderboard": "排行榜",
    "sidebar.share": "分享",
    "sidebar.user": "用户功能开发中",
    "sidebar.expand": "展开侧边栏",
    "sidebar.collapse": "收起侧边栏",
    "sidebar.feature-dev": "功能开发中",
    "sidebar.lang-switch-en": "切换到英文",

    // 脚本模态框
    "modal.create-script": "创建新脚本",
    "modal.rename-script": "重命名脚本",
    "modal.delete-script": "删除脚本",
    "modal.script-name": "请输入脚本名称",
    "modal.new-script-name": "请输入新的脚本名称",
    "modal.delete-confirm": "确定要删除脚本",

    // 分享模态框
    "modal.share-title": "分享配置",
    "modal.share-description": "分享当前的智能体配置和SNN拓扑",
    "modal.share-copy-link": "复制链接",
    "modal.share-download": "下载配置",
    "modal.share-close": "关闭",

    // 世界选择模态框
    "modal.world-selection-title": "选择仿真世界",
    "modal.world-selection-description": "选择一个世界环境来探索不同的智能体行为和学习场景",
    "modal.world-select": "选择此世界",
    "modal.cancel": "取消",

    // 智能体参数
    "agent.title": "智能体参数设置",
    "agent.vision-system": "视觉系统参数",
    "agent.vision-cells": "视野单元格数量",
    "agent.vision-range": "视野范围 (像素)",
    "agent.vision-angle": "视野角度 (度)",
    "agent.vision-desc-cells": "影响视觉输入维度",
    "agent.vision-desc-range": "智能体能够感知到的最大距离",
    "agent.vision-desc-angle": "智能体的视野扇形角度范围",
    "agent.dimension-unit": "维",

    // 设置页面
    "settings.title": "设置",
    "settings.language": "语言",
    "settings.language.chinese": "中文",
    "settings.language.english": "English",

    // 状态
    "stats.fps": "FPS",
    "stats.reward": "奖励",
    "stats.agentCount": "智能体数量",

    // 提示
    "tooltip.start": "启动仿真",
    "tooltip.pause": "暂停",
    "tooltip.resume": "继续",
    "tooltip.manual-control-off":
      "启用手动控制 (WASD/方向键: W↑前进 S↓后退 A←左转 D→右转)",
    "tooltip.manual-control-on": "关闭手动控制",
    "tooltip.apply-script": "应用脚本",

    // 占位符
    "placeholder.code-editor": "编写onFrame函数代码...",
    "placeholder.default-code": "编写代码...",
    "placeholder.script-example": "// 在这里编写你的智能体行为代码\nfunction onFrame(agent) {\n  // 获取感知数据\n  const vision = agent.getVision();\n  \n  // 编写你的逻辑\n  agent.move([1.0, 0, 0, 0]); // [前进, 转向, 侧移, 开火]\n}",

    // 移动端
    "mobile.collapse": "收起",

    // 编辑器
    "editor.title": "JS 代码编辑器",
    "editor.apply": "应用代码",
    "editor.applied": "已应用",

    // SNN 编辑器
    "snn.editor.title": "神经网络拓扑编辑器",
    "snn.editor.apply": "应用",
    "snn.editor.helpTooltip": "操作说明：\n• 左键拖拽：框选多个神经元\n• Ctrl+左键：多选神经元/组\n• 双击组合组件：切换收起/展开状态\n• 右键拖拽：平移画布\n• 滚轮：缩放画布（以中心为原点）\n• Ctrl+右键：创建连接\n• Del键：删除选中元素",
    "snn.group.visualReceptor": "视觉感受器",
    "snn.group.healthReceptor": "健康感受器",
    "snn.group.rotationController": "旋转控制器",
    "snn.group.movementController": "移动控制器",
    "snn.group.gradientMovementController": "梯度运动控制器",
    "snn.group.lightReceptor": "光感受器",
    "snn.details.neuron": "神经元详情",
    "snn.details.synapse": "突触详情",

    // 节点类型
    "node.type.sensor": "感受器",
    "node.type.effector": "效应器",
    "node.type.visualReceptor": "视觉感受器",
    "node.type.rotationController": "旋转控制器",

    // 警告信息
    "warning.effector-no-start": "效应器节点（旋转控制器）不能作为连接的起点。",
    "warning.sensor-no-end": "感受器节点（视觉感受器）不能作为连接的终点。",
    "warning.cannot-delete-protected-nodes": "感受器和效应器插件的内部节点受到保护，无法删除。",
    "warning.cannot-delete-group-nodes": "无法删除组内的节点，请删除整个组。",
    "warning.cannot-delete-protected-groups": "感受器和效应器插件组受到保护，无法删除。",

    // 感受器和效应器组标题
    "group.sensor.title": "感受器组",
    "group.effector.title": "效应器组",

    // 功能状态
    "status.dev-sensors": "感受器配置功能开发中...",
    "status.dev-effectors": "效应器配置功能开发中...",
    "status.dev-freemode": "自由模式配置功能开发中...",
    "status.dev-ranked": "排位模式配置功能开发中...",

    // 仿真控制
    "simulation.pause": "暂停仿真",
    "simulation.start": "开始仿真",

    // 世界类型 - 光影花园
    "world.luminous-garden.name": "光影花园",
    "world.luminous-garden.description": "一个充满动态光影的神秘世界，智能体需要学会趋光避暗，在能量与环境的平衡中生存。",
    "world.luminous-garden.feature1": "动态光斑提供能量补充",
    "world.luminous-garden.feature2": "暗物质区域消耗能量",
    "world.luminous-garden.feature3": "水晶碎片提供高能奖励",

    // 世界类型 - 回声洞穴
    "world.echo-chamber.name": "回声洞穴",
    "world.echo-chamber.description": "完全黑暗的迷宫世界，智能体必须通过声纳回声定位来探索和觅食。",
    "world.echo-chamber.feature1": "主动声纳探测机制",
    "world.echo-chamber.feature2": "回声信号模式识别",
    "world.echo-chamber.feature3": "空间记忆与地图构建",

    // 世界类型 - 意识集群
    "world.sentient-swarm.name": "意识集群",
    "world.sentient-swarm.description": "群体智能的展示舞台，多个智能体共享同一大脑设计，展现涌现的集体行为。",
    "world.sentient-swarm.feature1": "多智能体群体行为",
    "world.sentient-swarm.feature2": "信标通讯系统",
    "world.sentient-swarm.feature3": "角色分工与协作",

    // 世界类型 - 律动色域
    "world.chromatic-composer.name": "律动色域",
    "world.chromatic-composer.description": "艺术创作的数字画布，智能体通过移动和感知创造独特的视觉和听觉艺术作品。",
    "world.chromatic-composer.feature1": "动态绘画与色彩系统",
    "world.chromatic-composer.feature2": "节奏感知与响应",
    "world.chromatic-composer.feature3": "自指涉艺术创作",

    // 世界类型 - 追光者
    "world.light-seeker.name": "追光者",
    "world.light-seeker.description": "简化的测试环境，包含多个大光球随机缓慢运动，为测试视觉感受器和梯度运动控制器提供光源环境。",
    "world.light-seeker.feature1": "多个大光球光源",
    "world.light-seeker.feature2": "随机缓慢运动",
    "world.light-seeker.feature3": "适合测试光感受器",
  },
  en: {
    // Controls
    "controls.start": "Start",
    "controls.stop": "Stop",

    // 标签页
    "tab.script": "Script Editor",
    "tab.agent-params": "Agent Parameters",
    "tab.settings": "Settings",
    "tab.snn": "SNN Editor",
    "tabs.world": "World",
    "tabs.brain": "Brain",

    // 按钮
    "btn.start": "Start",
    "btn.pause": "Pause",
    "btn.resume": "Resume",
    "btn.apply-script": "✓ Apply Script",
    "btn.manual-control": "🎮",
    "btn.cancel": "Cancel",
    "btn.create": "Create",
    "btn.rename": "Rename",
    "btn.delete": "Delete",
    "btn.confirm": "Confirm",
    "btn.apply": "Apply Settings",
    "btn.applied": "Applied",

    // 头部导航
    "header.world": "World",
    "header.world-tooltip": "Select simulation world environment",
    "header.share": "Share",
    "header.share-tooltip": "Share current configuration",
    "header.user": "User",
    "header.language-switch": "Language Switch",

    // 侧边栏
    "sidebar.world": "World",
    "sidebar.agent": "Agent",
    "sidebar.brain": "Brain",
    "sidebar.freemode": "Free Mode",
    "sidebar.ranked": "Ranked",
    "sidebar.sensors": "Sensors",
    "sidebar.effectors": "Effectors",
    "sidebar.script": "Script",
    "sidebar.snn": "SNN Model",
    "sidebar.leaderboard": "Leaderboard",
    "sidebar.share": "Share",
    "sidebar.user": "User features in development",
    "sidebar.expand": "Expand sidebar",
    "sidebar.collapse": "Collapse sidebar",
    "sidebar.feature-dev": "Feature in development",
    "sidebar.lang-switch-zh": "Switch to Chinese",

    // 脚本模态框
    "modal.create-script": "Create New Script",
    "modal.rename-script": "Rename Script",
    "modal.delete-script": "Delete Script",
    "modal.script-name": "Enter script name",
    "modal.new-script-name": "Enter new script name",
    "modal.delete-confirm": "Are you sure you want to delete script",

    // 分享模态框
    "modal.share-title": "Share Configuration",
    "modal.share-description": "Share current agent configuration and SNN topology",
    "modal.share-copy-link": "Copy Link",
    "modal.share-download": "Download Config",
    "modal.share-close": "Close",

    // 世界选择模态框
    "modal.world-selection-title": "Select Simulation World",
    "modal.world-selection-description": "Choose a world environment to explore different agent behaviors and learning scenarios",
    "modal.world-select": "Select This World",
    "modal.cancel": "Cancel",

    // 智能体参数
    "agent.title": "Agent Parameter Settings",
    "agent.vision-system": "Vision System Parameters",
    "agent.vision-cells": "Vision Cell Count",
    "agent.vision-range": "Vision Range (pixels)",
    "agent.vision-angle": "Vision Angle (degrees)",
    "agent.vision-desc-cells": "Affects visual input dimensions",
    "agent.vision-desc-range": "Maximum distance agent can perceive",
    "agent.vision-desc-angle": "Agent's field of view angle range",
    "agent.dimension-unit": "dim",

    // 设置页面
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.language.chinese": "中文",
    "settings.language.english": "English",

    // 状态
    "stats.fps": "FPS",
    "stats.reward": "Reward",
    "stats.agentCount": "Agent Count",

    // 提示
    "tooltip.start": "Start Simulation",
    "tooltip.pause": "Pause",
    "tooltip.resume": "Resume",
    "tooltip.manual-control-off":
      "Enable manual control (WASD/Arrow keys: W↑Forward S↓Backward A←Turn Left D→Turn Right)",
    "tooltip.manual-control-on": "Disable manual control",
    "tooltip.apply-script": "Apply script",

    // 占位符
    "placeholder.code-editor": "Write onFrame function code...",
    "placeholder.default-code": "Write code...",
    "placeholder.script-example": "// Write your agent behavior code here\nfunction onFrame(agent) {\n  // Get perception data\n  const vision = agent.getVision();\n  \n  // Write your logic\n  agent.move([1.0, 0, 0, 0]); // [forward, turn, strafe, fire]\n}",

    // 移动端
    "mobile.collapse": "Collapse",

    // 编辑器
    "editor.title": "JS Code Editor",
    "editor.apply": "Apply Code",
    "editor.applied": "Applied",

    // SNN Editor
    "snn.editor.title": "SNN Topology Editor",
    "snn.editor.apply": "Apply",
    "snn.editor.helpTooltip": "Instructions:\n• Left Drag: Box select neurons\n• Ctrl+Left Click: Multi-select neurons/groups\n• Double Click Group: Toggle collapse\n• Right Drag: Pan canvas\n• Scroll: Zoom canvas (center-based)\n• Ctrl+Right Click: Create connection\n• Del Key: Delete selected elements",
    "snn.group.visualReceptor": "Visual Receptor",
    "snn.group.healthReceptor": "Health Receptor",
    "snn.group.rotationController": "Rotation Controller",
    "snn.group.movementController": "Movement Controller",
    "snn.group.gradientMovementController": "Gradient Movement Controller",
    "snn.group.lightReceptor": "Light Receptor",
    "snn.details.neuron": "Neuron Details",
    "snn.details.synapse": "Synapse Details",

    // Node Types
    "node.type.sensor": "Sensor",
    "node.type.effector": "Effector",
    "node.type.visualReceptor": "Visual Receptor",
    "node.type.rotationController": "Rotation Controller",

    // Warning Messages
    "warning.effector-no-start": "Effector nodes (Rotation Controllers) cannot be the starting point of an edge.",
    "warning.sensor-no-end": "Sensor nodes (Visual Receptors) cannot be the end point of an edge.",
    "warning.cannot-delete-protected-nodes": "Internal nodes of sensor and effector plugins are protected and cannot be deleted.",
    "warning.cannot-delete-group-nodes": "Cannot delete nodes that are part of a group. Delete the entire group instead.",
    "warning.cannot-delete-protected-groups": "Sensor and effector plugin groups are protected and cannot be deleted.",

    // Sensor and Effector Group Titles
    "group.sensor.title": "Sensor Group",
    "group.effector.title": "Effector Group",

    // 功能状态
    "status.dev-sensors": "Sensor configuration in development...",
    "status.dev-effectors": "Effector configuration in development...",
    "status.dev-freemode": "Free mode configuration in development...",
    "status.dev-ranked": "Ranked mode configuration in development...",

    // 仿真控制
    "simulation.pause": "Pause Simulation",
    "simulation.start": "Start Simulation",

    // 世界类型 - 光影花园
    "world.luminous-garden.name": "Luminous Garden",
    "world.luminous-garden.description": "A mysterious world filled with dynamic light and shadow, where agents must learn to seek light and avoid darkness, surviving in the balance between energy and environment.",
    "world.luminous-garden.feature1": "Dynamic light patches provide energy",
    "world.luminous-garden.feature2": "Dark matter zones consume energy",
    "world.luminous-garden.feature3": "Crystal fragments offer high-energy rewards",

    // 世界类型 - 回声洞穴
    "world.echo-chamber.name": "Echo Chamber",
    "world.echo-chamber.description": "A completely dark maze world where agents must use sonar echolocation to explore and forage.",
    "world.echo-chamber.feature1": "Active sonar detection mechanism",
    "world.echo-chamber.feature2": "Echo signal pattern recognition",
    "world.echo-chamber.feature3": "Spatial memory and map building",

    // 世界类型 - 意识集群
    "world.sentient-swarm.name": "Sentient Swarm",
    "world.sentient-swarm.description": "A showcase of collective intelligence where multiple agents share the same brain design, demonstrating emergent group behaviors.",
    "world.sentient-swarm.feature1": "Multi-agent swarm behavior",
    "world.sentient-swarm.feature2": "Beacon communication system",
    "world.sentient-swarm.feature3": "Role division and collaboration",

    // 世界类型 - 律动色域
    "world.chromatic-composer.name": "Chromatic Composer",
    "world.chromatic-composer.description": "A digital canvas for artistic creation where agents create unique visual and auditory artworks through movement and perception.",
    "world.chromatic-composer.feature1": "Dynamic painting and color system",
    "world.chromatic-composer.feature2": "Rhythm perception and response",
    "world.chromatic-composer.feature3": "Self-referential art creation",

    // 世界类型 - 追光者
    "world.light-seeker.name": "Light Seeker",
    "world.light-seeker.description": "A simplified test environment with multiple large light orbs moving randomly and slowly, providing light sources for testing visual receptors and gradient movement controllers.",
    "world.light-seeker.feature1": "Multiple large light orb sources",
    "world.light-seeker.feature2": "Random slow movement",
    "world.light-seeker.feature3": "Ideal for testing light receptors",
  },
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
}) => {
  const [language, setLanguage] = useState<Language>("zh");

  const t = (key: string): string => {
    return (translations[language] as Record<string, string>)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
