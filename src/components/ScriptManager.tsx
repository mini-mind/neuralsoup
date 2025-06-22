import React, { useState, useCallback, useEffect } from "react";

interface ScriptManagerProps {
  currentScriptName: string;
  savedScripts: { [key: string]: string };
  onScriptChange: (scriptName: string, code: string) => void;
  onScriptApply: () => void;
  isScriptApplied: boolean;
}

interface ScriptModalProps {
  showNewScriptDialog: boolean;
  setShowNewScriptDialog: (show: boolean) => void;
  showEditDialog: boolean;
  setShowEditDialog: (show: boolean) => void;
  newScriptName: string;
  setNewScriptName: (name: string) => void;
  editScriptName: string;
  setEditScriptName: (name: string) => void;
  editAction: "rename" | "delete";
  currentScriptName: string;
  onCreateNewScript: () => void;
  onExecuteEditAction: () => void;
}

const ScriptModals: React.FC<ScriptModalProps> = ({
  showNewScriptDialog,
  setShowNewScriptDialog,
  showEditDialog,
  setShowEditDialog,
  newScriptName,
  setNewScriptName,
  editScriptName,
  setEditScriptName,
  editAction,
  currentScriptName,
  onCreateNewScript,
  onExecuteEditAction,
}) => (
  <>
    {/* 新脚本创建对话框 */}
    {showNewScriptDialog && (
      <div className="new-script-dialog">
        <div className="new-script-dialog-content">
          <h3>创建新脚本</h3>
          <input
            type="text"
            value={newScriptName}
            onChange={(e) => setNewScriptName(e.target.value)}
            placeholder="请输入脚本名称"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onCreateNewScript();
              } else if (e.key === "Escape") {
                setShowNewScriptDialog(false);
                setNewScriptName("");
              }
            }}
            autoFocus
          />
          <div className="new-script-dialog-actions">
            <button
              onClick={() => {
                setShowNewScriptDialog(false);
                setNewScriptName("");
              }}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              onClick={onCreateNewScript}
              className="btn btn-primary"
              disabled={!newScriptName.trim()}
            >
              创建
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 编辑脚本对话框 */}
    {showEditDialog && (
      <div className="new-script-dialog">
        <div className="new-script-dialog-content">
          <h3>{editAction === "rename" ? "重命名脚本" : "删除脚本"}</h3>
          {editAction === "rename" ? (
            <input
              type="text"
              value={editScriptName}
              onChange={(e) => setEditScriptName(e.target.value)}
              placeholder="请输入新的脚本名称"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onExecuteEditAction();
                } else if (e.key === "Escape") {
                  setShowEditDialog(false);
                  setEditScriptName("");
                }
              }}
              autoFocus
            />
          ) : (
            <p>
              确定要删除脚本 "<strong>{currentScriptName}</strong>" 吗？
            </p>
          )}
          <div className="new-script-dialog-actions">
            <button
              onClick={() => {
                setShowEditDialog(false);
                setEditScriptName("");
              }}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              onClick={onExecuteEditAction}
              className={`btn ${editAction === "delete" ? "btn-danger" : "btn-primary"}`}
              disabled={editAction === "rename" && !editScriptName.trim()}
            >
              {editAction === "rename" ? "重命名" : "删除"}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);

/**
 * 脚本管理组件
 * 负责脚本的版本管理、创建、编辑、删除等功能
 */
const ScriptManager: React.FC<ScriptManagerProps> = ({
  currentScriptName,
  savedScripts,
  onScriptChange,
  onScriptApply,
  isScriptApplied,
}) => {
  // 内部状态
  const [showNewScriptDialog, setShowNewScriptDialog] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editScriptName, setEditScriptName] = useState("");
  const [editAction, setEditAction] = useState<"rename" | "delete">("rename");

  // 本地状态管理
  const [localSavedScripts, setLocalSavedScripts] = useState<{
    [key: string]: string;
  }>(savedScripts);

  // 同步外部状态
  useEffect(() => {
    setLocalSavedScripts(savedScripts);
  }, [savedScripts]);

  // 保存脚本到localStorage
  const saveToLocalStorage = useCallback(
    (scripts: { [key: string]: string }) => {
      localStorage.setItem("neuralSoup_savedScripts", JSON.stringify(scripts));
    },
    [],
  );

  // 加载脚本
  const loadScript = useCallback(
    (scriptName: string) => {
      if (localSavedScripts[scriptName]) {
        onScriptChange(scriptName, localSavedScripts[scriptName]);
        console.log("脚本已加载:", scriptName);
      }
    },
    [localSavedScripts, onScriptChange],
  );

  // 创建新脚本
  const createNewScript = useCallback(() => {
    if (!newScriptName.trim()) {
      alert("请输入脚本名称");
      return;
    }

    if (localSavedScripts[newScriptName]) {
      alert("脚本名称已存在，请使用其他名称");
      return;
    }

    const templateCode = `// ${newScriptName}
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

    const newScripts = {
      ...localSavedScripts,
      [newScriptName]: templateCode,
    };
    setLocalSavedScripts(newScripts);
    saveToLocalStorage(newScripts);

    // 关闭对话框
    setShowNewScriptDialog(false);
    setNewScriptName("");

    // 使用 setTimeout 确保状态更新完成后再切换
    setTimeout(() => {
      onScriptChange(newScriptName, templateCode);
      console.log("新脚本已创建并切换:", newScriptName);
    }, 0);
  }, [newScriptName, localSavedScripts, saveToLocalStorage, onScriptChange]);

  // 删除脚本
  const deleteScript = useCallback(
    (scriptName: string) => {
      if (Object.keys(localSavedScripts).length <= 1) {
        alert("至少需要保留一个脚本");
        return;
      }

      if (!confirm(`确定要删除脚本"${scriptName}"吗？此操作不可撤销。`)) {
        return;
      }

      const newSavedScripts = { ...localSavedScripts };
      delete newSavedScripts[scriptName];
      setLocalSavedScripts(newSavedScripts);
      saveToLocalStorage(newSavedScripts);

      // 如果删除的是当前脚本，切换到第一个可用脚本
      if (currentScriptName === scriptName) {
        const firstScript = Object.keys(newSavedScripts)[0];
        onScriptChange(firstScript, newSavedScripts[firstScript]);
      }

      console.log("脚本已删除:", scriptName);
    },
    [localSavedScripts, currentScriptName, saveToLocalStorage, onScriptChange],
  );

  // 重命名脚本
  const renameScript = useCallback(
    (oldName: string, newName: string) => {
      if (!newName.trim()) {
        alert("请输入新的脚本名称");
        return;
      }

      if (newName === oldName) {
        return; // 名称未改变
      }

      if (localSavedScripts[newName]) {
        alert("脚本名称已存在，请使用其他名称");
        return;
      }

      const newSavedScripts = { ...localSavedScripts };
      newSavedScripts[newName] = newSavedScripts[oldName];
      delete newSavedScripts[oldName];
      setLocalSavedScripts(newSavedScripts);
      saveToLocalStorage(newSavedScripts);

      // 如果重命名的是当前脚本，更新当前脚本名
      if (currentScriptName === oldName) {
        onScriptChange(newName, newSavedScripts[newName]);
      }

      console.log("脚本已重命名:", oldName, "->", newName);
    },
    [localSavedScripts, currentScriptName, saveToLocalStorage, onScriptChange],
  );

  // 处理编辑对话框
  const handleEditScript = useCallback(
    (action: "rename" | "delete") => {
      setEditAction(action);
      setEditScriptName(action === "rename" ? currentScriptName : "");
      setShowEditDialog(true);
    },
    [currentScriptName],
  );

  // 执行编辑操作
  const executeEditAction = useCallback(() => {
    if (editAction === "delete") {
      deleteScript(currentScriptName);
    } else if (editAction === "rename") {
      renameScript(currentScriptName, editScriptName);
    }
    setShowEditDialog(false);
    setEditScriptName("");
  }, [
    editAction,
    currentScriptName,
    editScriptName,
    deleteScript,
    renameScript,
  ]);

  return (
    <>
      {/* 脚本版本管理区域 */}
      <div className="script-manager">
        <div className="script-manager-header">
          <h4>脚本管理</h4>
          <div className="script-controls">
            <select
              value={currentScriptName}
              onChange={(e) => loadScript(e.target.value)}
              className="script-selector"
            >
              {Object.keys(localSavedScripts).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewScriptDialog(true)}
              className="btn btn-secondary btn-small btn-icon"
              title="创建新脚本"
            >
              +
            </button>
            <button
              onClick={() => handleEditScript("rename")}
              className="btn btn-secondary btn-small btn-icon"
              title="重命名当前脚本"
            >
              ✎
            </button>
            <button
              onClick={() => handleEditScript("delete")}
              className="btn btn-secondary btn-small btn-icon"
              title="删除当前脚本"
              disabled={Object.keys(localSavedScripts).length <= 1}
            >
              ×
            </button>
            <button
              onClick={onScriptApply}
              className={`btn ${isScriptApplied ? "btn-success" : "btn-apply"} btn-small`}
              title={
                isScriptApplied
                  ? "脚本已应用并保存"
                  : "应用脚本并保存到当前选项"
              }
            >
              {isScriptApplied ? "✓ 已应用" : "应用"}
            </button>
          </div>
        </div>
      </div>

      {/* 模态框 */}
      <ScriptModals
        showNewScriptDialog={showNewScriptDialog}
        setShowNewScriptDialog={setShowNewScriptDialog}
        showEditDialog={showEditDialog}
        setShowEditDialog={setShowEditDialog}
        newScriptName={newScriptName}
        setNewScriptName={setNewScriptName}
        editScriptName={editScriptName}
        setEditScriptName={setEditScriptName}
        editAction={editAction}
        currentScriptName={currentScriptName}
        onCreateNewScript={createNewScript}
        onExecuteEditAction={executeEditAction}
      />
    </>
  );
};

export default ScriptManager;
