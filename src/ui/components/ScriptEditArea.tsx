import React, { useState } from "react";
import CodeEditor from "./CodeEditor";
import { useLanguage } from "../../contexts/LanguageContext";

interface ScriptEditAreaProps {
  currentScriptName: string;
  savedScripts: { [key: string]: string };
  onFrameCode: string;
  isScriptApplied: boolean;
  onScriptChange: (scriptName: string, code: string) => void;
  onCodeChange: (code: string) => void;
  onScriptApply: () => void;
}

interface ToolItem {
  id: string;
  title: string;
  description: string;
  code: string;
  category: string;
}

/**
 * 脚本编辑区域组件
 * 包含可横向滚动的工具库和JS代码编辑区
 */
const ScriptEditArea: React.FC<ScriptEditAreaProps> = ({
  currentScriptName,
  savedScripts,
  onFrameCode,
  isScriptApplied,
  onScriptChange,
  onCodeChange,
  onScriptApply,
}) => {
  const { t } = useLanguage();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // 工具库数据
  const toolItems: ToolItem[] = [
    {
      id: 'move-forward',
      title: '前进',
      description: '让智能体向前移动',
      code: 'agent.move([1.0, 0, 0, 0]);',
      category: '移动'
    },
    {
      id: 'turn-left',
      title: '左转',
      description: '让智能体向左转',
      code: 'agent.move([0, -0.5, 0, 0]);',
      category: '移动'
    },
    {
      id: 'turn-right',
      title: '右转',
      description: '让智能体向右转',
      code: 'agent.move([0, 0.5, 0, 0]);',
      category: '移动'
    },
    {
      id: 'get-vision',
      title: '获取视觉',
      description: '获取智能体的视觉感知数据',
      code: 'const vision = agent.getVision();',
      category: '感知'
    },
    {
      id: 'detect-food',
      title: '检测食物',
      description: '从视觉数据中检测食物',
      code: 'const food = vision.filter(item => item.type === "food");',
      category: '感知'
    },
    {
      id: 'detect-obstacles',
      title: '检测障碍',
      description: '从视觉数据中检测障碍物',
      code: 'const obstacles = vision.filter(item => item.type === "obstacle");',
      category: '感知'
    },
    {
      id: 'random-walk',
      title: '随机移动',
      description: '让智能体进行随机移动',
      code: 'agent.move([Math.random(), Math.random() * 2 - 1, 0, 0]);',
      category: '行为'
    },
    {
      id: 'chase-target',
      title: '追逐目标',
      description: '朝向目标移动',
      code: `if (target.angle > 0.1) {
  agent.move([0, 0.5, 0, 0]); // 右转
} else if (target.angle < -0.1) {
  agent.move([0, -0.5, 0, 0]); // 左转
} else {
  agent.move([1.0, 0, 0, 0]); // 前进
}`,
      category: '行为'
    }
  ];

  const handleToolClick = (tool: ToolItem) => {
    setSelectedTool(tool.id);
    // 在代码编辑器的当前位置插入代码
    const currentCode = onFrameCode;
    const newCode = currentCode + '\n' + tool.code;
    onCodeChange(newCode);
  };

  const groupedTools = toolItems.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ToolItem[]>);

  return (
    <div className="script-edit-area">
      {/* 工具库 */}
      <div className="tool-library">
        <div className="tool-library-header">
          <h3>工具库</h3>
        </div>
        <div className="tool-library-content">
          {Object.entries(groupedTools).map(([category, tools]) => (
            <div key={category} className="tool-category">
              <div className="tool-category-header">{category}</div>
              <div className="tool-items">
                {tools.map((tool) => (
                  <div
                    key={tool.id}
                    className={`tool-item ${selectedTool === tool.id ? 'selected' : ''}`}
                    onClick={() => handleToolClick(tool)}
                    title={tool.description}
                  >
                    <div className="tool-title">{tool.title}</div>
                    <div className="tool-description">{tool.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 代码编辑器 */}
      <div className="code-editor-section">
        <div className="code-editor-header">
          <h3>JS 代码编辑器</h3>
          <div className="editor-controls">
            <button 
              className="apply-button"
              onClick={onScriptApply}
              disabled={isScriptApplied}
            >
              {isScriptApplied ? '已应用' : '应用代码'}
            </button>
          </div>
        </div>
        <div className="code-editor-content">
          <CodeEditor
            value={onFrameCode}
            onChange={onCodeChange}
            placeholder="// 在这里编写你的智能体行为代码
function onFrame(agent) {
  // 获取感知数据
  const vision = agent.getVision();
  
  // 编写你的逻辑
  agent.move([1.0, 0, 0, 0]); // [前进, 转向, 侧移, 开火]
}"
          />
        </div>
      </div>
    </div>
  );
};

export default ScriptEditArea;
