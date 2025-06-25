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

    // 功能状态
    "status.dev-sensors": "感受器配置功能开发中...",
    "status.dev-effectors": "效应器配置功能开发中...",
    "status.dev-freemode": "自由模式配置功能开发中...",
    "status.dev-ranked": "排位模式配置功能开发中...",

    // 仿真控制
    "simulation.pause": "暂停仿真",
    "simulation.start": "开始仿真",
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

    // 功能状态
    "status.dev-sensors": "Sensor configuration in development...",
    "status.dev-effectors": "Effector configuration in development...",
    "status.dev-freemode": "Free mode configuration in development...",
    "status.dev-ranked": "Ranked mode configuration in development...",

    // 仿真控制
    "simulation.pause": "Pause Simulation",
    "simulation.start": "Start Simulation",
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
