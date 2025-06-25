import React from "react";
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

/**
 * 脚本编辑区域组件
 * 专注于代码编辑功能
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

  return (
    <div className="script-edit-area">
      {/* 代码编辑器 */}
      <div className="code-editor-section">
        <div className="code-editor-header">
          <h3>{t('editor.title')}</h3>
          <div className="editor-controls">
            <button 
              className="apply-button"
              onClick={onScriptApply}
              disabled={isScriptApplied}
            >
              {isScriptApplied ? t('editor.applied') : t('editor.apply')}
            </button>
          </div>
        </div>
        <div className="code-editor-content">
          <CodeEditor
            value={onFrameCode}
            onChange={onCodeChange}
            placeholder={t('placeholder.script-example')}
          />
        </div>
      </div>
    </div>
  );
};

export default ScriptEditArea;
