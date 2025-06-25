import React, { useState, useCallback } from "react";
import ScriptModals from "./ScriptModals";
import { useScriptOperations } from "./useScriptOperations";

interface ScriptManagerProps {
  currentScriptName: string;
  savedScripts: { [key: string]: string };
  onScriptChange: (scriptName: string, code: string) => void;
  onScriptApply: () => void;
  isScriptApplied: boolean;
}

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
  // 模态框状态
  const [showNewScriptDialog, setShowNewScriptDialog] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editScriptName, setEditScriptName] = useState("");
  const [editAction, setEditAction] = useState<"rename" | "delete">("rename");

  // 脚本操作hooks
  const { localSavedScripts, loadScript, createNewScript, deleteScript, renameScript } = 
    useScriptOperations({
      savedScripts,
      currentScriptName,
      onScriptChange,
    });

  // 创建新脚本处理
  const handleCreateNewScript = useCallback(() => {
    if (createNewScript(newScriptName)) {
      setShowNewScriptDialog(false);
      setNewScriptName("");
    }
  }, [newScriptName, createNewScript]);

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
    let success = false;
    
    if (editAction === "delete") {
      success = deleteScript(currentScriptName);
    } else if (editAction === "rename") {
      success = renameScript(currentScriptName, editScriptName);
    }
    
    if (success) {
      setShowEditDialog(false);
      setEditScriptName("");
    }
  }, [editAction, currentScriptName, editScriptName, deleteScript, renameScript]);

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
            >
              🗑
            </button>
          </div>
        </div>
        
        <div className="script-actions">
          <button
            onClick={onScriptApply}
            className={`btn btn-primary ${isScriptApplied ? 'applied' : ''}`}
            disabled={isScriptApplied}
          >
            {isScriptApplied ? '✓ 已应用' : '应用脚本'}
          </button>
        </div>
      </div>

      {/* 模态框组件 */}
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
        onCreateNewScript={handleCreateNewScript}
        onExecuteEditAction={executeEditAction}
      />
    </>
  );
};

export default ScriptManager;
