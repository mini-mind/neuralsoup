import React from "react";
import { useLanguage } from "../../contexts/LanguageContext";

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

/**
 * 脚本相关的模态框组件
 * 包含新建脚本和编辑脚本的对话框
 */
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
}) => {
  const { t, language } = useLanguage();

  return (
    <>
      {/* 新脚本创建对话框 */}
      {showNewScriptDialog && (
        <div className="new-script-dialog">
          <div className="new-script-dialog-content">
            <h3>{t('modal.create-script')}</h3>
            <input
              type="text"
              value={newScriptName}
              onChange={(e) => setNewScriptName(e.target.value)}
              placeholder={t('modal.script-name')}
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
                {t('btn.cancel')}
              </button>
              <button
                onClick={onCreateNewScript}
                className="btn btn-primary"
                disabled={!newScriptName.trim()}
              >
                {t('btn.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑脚本对话框 */}
      {showEditDialog && (
        <div className="new-script-dialog">
          <div className="new-script-dialog-content">
            <h3>{editAction === "rename" ? t('modal.rename-script') : t('modal.delete-script')}</h3>
            {editAction === "rename" ? (
              <input
                type="text"
                value={editScriptName}
                onChange={(e) => setEditScriptName(e.target.value)}
                placeholder={t('modal.new-script-name')}
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
                {t('modal.delete-confirm')} "<strong>{currentScriptName}</strong>" {language === 'zh' ? '吗？' : '?'}
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
                {t('btn.cancel')}
              </button>
              <button
                onClick={onExecuteEditAction}
                className={`btn ${editAction === "delete" ? "btn-danger" : "btn-primary"}`}
                disabled={editAction === "rename" && !editScriptName.trim()}
              >
                {editAction === "rename" ? t('btn.rename') : t('btn.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScriptModals; 