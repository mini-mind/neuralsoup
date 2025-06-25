import { useState, useCallback, useEffect } from "react";
import { useScriptTemplate } from "./useScriptTemplate";

interface UseScriptOperationsProps {
  savedScripts: { [key: string]: string };
  currentScriptName: string;
  onScriptChange: (scriptName: string, code: string) => void;
}

/**
 * 脚本操作管理Hook
 * 处理脚本的创建、删除、重命名等操作
 */
export const useScriptOperations = ({
  savedScripts,
  currentScriptName,
  onScriptChange,
}: UseScriptOperationsProps) => {
  const { getDefaultTemplate } = useScriptTemplate();
  
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
  const createNewScript = useCallback(
    (newScriptName: string) => {
      if (!newScriptName.trim()) {
        alert("请输入脚本名称");
        return false;
      }

      if (localSavedScripts[newScriptName]) {
        alert("脚本名称已存在，请使用其他名称");
        return false;
      }

      const templateCode = getDefaultTemplate(newScriptName);
      const newScripts = {
        ...localSavedScripts,
        [newScriptName]: templateCode,
      };
      
      setLocalSavedScripts(newScripts);
      saveToLocalStorage(newScripts);

      // 使用 setTimeout 确保状态更新完成后再切换
      setTimeout(() => {
        onScriptChange(newScriptName, templateCode);
        console.log("新脚本已创建并切换:", newScriptName);
      }, 0);

      return true;
    },
    [localSavedScripts, saveToLocalStorage, onScriptChange, getDefaultTemplate],
  );

  // 删除脚本
  const deleteScript = useCallback(
    (scriptName: string) => {
      if (Object.keys(localSavedScripts).length <= 1) {
        alert("至少需要保留一个脚本");
        return false;
      }

      if (!confirm(`确定要删除脚本"${scriptName}"吗？此操作不可撤销。`)) {
        return false;
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
      return true;
    },
    [localSavedScripts, currentScriptName, saveToLocalStorage, onScriptChange],
  );

  // 重命名脚本
  const renameScript = useCallback(
    (oldName: string, newName: string) => {
      if (!newName.trim()) {
        alert("请输入新的脚本名称");
        return false;
      }

      if (newName === oldName) {
        return true; // 名称未改变
      }

      if (localSavedScripts[newName]) {
        alert("脚本名称已存在，请使用其他名称");
        return false;
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
      return true;
    },
    [localSavedScripts, currentScriptName, saveToLocalStorage, onScriptChange],
  );

  return {
    localSavedScripts,
    loadScript,
    createNewScript,
    deleteScript,
    renameScript,
  };
}; 