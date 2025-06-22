import React from "react";
import ScriptManager from "./ScriptManager";
import CodeEditor from "./CodeEditor";
import { useLanguage } from "../contexts/LanguageContext";

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
 * 整合脚本管理和代码编辑器功能
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
    <div className="script-tab-content">
      <div className="script-control">
        <ScriptManager
          currentScriptName={currentScriptName}
          savedScripts={savedScripts}
          onScriptChange={onScriptChange}
          onScriptApply={onScriptApply}
          isScriptApplied={isScriptApplied}
        />

        <div className="onframe-section">
          <CodeEditor
            value={onFrameCode}
            onChange={onCodeChange}
            placeholder={t("placeholder.code-editor")}
          />
        </div>
      </div>
    </div>
  );
};

export default ScriptEditArea;
