import React, { useId, useRef, useState } from 'react';
import type { AgentPackage, BrainPackage } from '../../domain/brain';

interface BrainLibraryModalProps {
  activeBrainId: string | null;
  brains: AgentPackage[];
  isOpen: boolean;
  statusMessage: string | null;
  onClose: () => void;
  onCreateFromCurrent: (name: string) => void;
  onSelectBrain: (brainId: string) => void;
  onRenameBrain: (brainId: string, name: string) => void;
  onDeleteBrain: (brainId: string) => void;
  onDuplicateBrain: (brainId: string) => void;
  onExportBrain: (brainId: string) => void;
  onImportBrain: (name: string, payload: BrainPackage | AgentPackage) => void;
}

const parseImportedBrainPackage = (rawValue: string): BrainPackage | AgentPackage => {
  try {
    return JSON.parse(rawValue) as BrainPackage;
  } catch (error) {
    throw new Error(`JSON 解析失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
};

const BrainLibraryModal: React.FC<BrainLibraryModalProps> = ({
  activeBrainId,
  brains,
  isOpen,
  statusMessage,
  onClose,
  onCreateFromCurrent,
  onSelectBrain,
  onRenameBrain,
  onDeleteBrain,
  onDuplicateBrain,
  onExportBrain,
  onImportBrain,
}) => {
  const importInputId = useId();
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [newBrainName, setNewBrainName] = useState('当前 Brain');
  const [importName, setImportName] = useState('导入 Brain');
  const [renamingBrainId, setRenamingBrainId] = useState<string | null>(null);
  const [renamingBrainName, setRenamingBrainName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      onImportBrain(importName || file.name.replace(/\.json$/i, ''), parseImportedBrainPackage(text));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '导入失败');
    }
  };

  const startRenamingBrain = (brain: AgentPackage) => {
    setRenamingBrainId(brain.metadata.id);
    setRenamingBrainName(brain.metadata.name);
  };

  const submitRename = () => {
    if (!renamingBrainId) {
      return;
    }

    const trimmedName = renamingBrainName.trim();
    if (!trimmedName) {
      setErrorMessage('Brain 名称不能为空。');
      return;
    }

    onRenameBrain(renamingBrainId, trimmedName);
    setRenamingBrainId(null);
    setRenamingBrainName('');
    setErrorMessage(null);
  };

  const deleteBrain = (brain: AgentPackage) => {
    if (!window.confirm(`删除 Brain "${brain.metadata.name}"？此操作不能撤销。`)) {
      return;
    }

    onDeleteBrain(brain.metadata.id);
    if (renamingBrainId === brain.metadata.id) {
      setRenamingBrainId(null);
      setRenamingBrainName('');
    }
  };

  return (
    <div className="brain-library-modal-overlay" data-testid="brain-library-modal-overlay" onMouseDown={onClose}>
      <div
        className="brain-library-modal"
        data-testid="brain-library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={importInputId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="brain-library-header">
          <div>
            <h3 id={importInputId}>Brain 切换</h3>
            <p>使用 LocalStorage 保存完整 BrainPackage，包含 Brain、Body 和布局。</p>
          </div>
          <button type="button" className="brain-library-close" data-testid="brain-library-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="brain-library-section">
          <div className="brain-library-section-title">已保存 Brain</div>
          {statusMessage ? (
            <div className="brain-library-warning" data-testid="brain-library-status-message">
              {statusMessage}
            </div>
          ) : null}
          <div className="brain-library-list" data-testid="brain-library-list">
            {brains.length === 0 ? (
              <div className="brain-library-empty">暂无已保存 Brain</div>
            ) : (
              brains.map((brain) => (
                <div
                  key={brain.metadata.id}
                  className={`brain-library-item ${brain.metadata.id === activeBrainId ? 'active' : ''}`}
                  data-testid={`brain-library-item-${brain.metadata.id}`}
                >
                  <div className="brain-library-item-main">
                    {renamingBrainId === brain.metadata.id ? (
                      <div className="brain-library-rename-row">
                        <input
                          value={renamingBrainName}
                          data-testid={`brain-library-rename-input-${brain.metadata.id}`}
                          onChange={(event) => setRenamingBrainName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              submitRename();
                            }
                            if (event.key === 'Escape') {
                              setRenamingBrainId(null);
                              setRenamingBrainName('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="brain-library-small-button"
                          data-testid={`brain-library-rename-save-${brain.metadata.id}`}
                          onClick={submitRename}
                        >
                          保存
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="brain-library-item-title"
                        onClick={() => onSelectBrain(brain.metadata.id)}
                      >
                        <span>{brain.metadata.name}</span>
                        <small>{new Date(brain.metadata.updatedAt).toLocaleString()}</small>
                      </button>
                    )}
                  </div>
                  <div className="brain-library-item-actions">
                    <button
                      type="button"
                      className="brain-library-small-button"
                      data-testid={`brain-library-rename-${brain.metadata.id}`}
                      onClick={() => startRenamingBrain(brain)}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      className="brain-library-small-button"
                      data-testid={`brain-library-duplicate-${brain.metadata.id}`}
                      onClick={() => onDuplicateBrain(brain.metadata.id)}
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      className="brain-library-small-button"
                      data-testid={`brain-library-export-${brain.metadata.id}`}
                      onClick={() => onExportBrain(brain.metadata.id)}
                    >
                      导出
                    </button>
                    <button
                      type="button"
                      className="brain-library-small-button danger"
                      data-testid={`brain-library-delete-${brain.metadata.id}`}
                      onClick={() => deleteBrain(brain)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="brain-library-section brain-library-actions">
          <label className="brain-library-field">
            <span>保存当前 Brain</span>
            <input
              value={newBrainName}
              data-testid="brain-library-save-name"
              onChange={(event) => setNewBrainName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="brain-library-primary"
            data-testid="brain-library-save-current"
            onClick={() => onCreateFromCurrent(newBrainName)}
          >
            保存到库
          </button>
        </div>

        <div className="brain-library-section brain-library-actions">
          <label className="brain-library-field">
            <span>导入名称</span>
            <input
              value={importName}
              data-testid="brain-library-import-name"
              onChange={(event) => setImportName(event.target.value)}
            />
          </label>
          <input
            ref={importFileInputRef}
            className="brain-library-file-input"
            data-testid="brain-library-import-file"
            type="file"
            accept="application/json,.json"
            onChange={handleImportFileChange}
          />
          <button
            type="button"
            className="brain-library-secondary"
            data-testid="brain-library-import-trigger"
            onClick={() => importFileInputRef.current?.click()}
          >
            导入 JSON
          </button>
        </div>

        {errorMessage ? (
          <div className="brain-library-error" data-testid="brain-library-error">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BrainLibraryModal;
