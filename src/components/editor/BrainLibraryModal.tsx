import React, { useEffect, useId, useRef, useState } from 'react';
import type { BrainLibraryRecord } from '../../storage/brainLibraryStorage';

interface BrainLibraryModalProps {
  activeBrainId: string | null;
  brains: BrainLibraryRecord[];
  isOpen: boolean;
  statusMessage: string | null;
  onClose: () => void;
  onCreateFromCurrent: (name: string) => void | Promise<void>;
  onSelectBrain: (brainId: string) => void;
  onRenameBrain: (brainId: string, name: string) => void;
  onDeleteBrain: (brainId: string) => void;
  onDuplicateBrain: (brainId: string) => void;
  onExportBrain: (brainId: string) => void;
  onImportBrain: (name: string, payload: unknown) => void | Promise<void>;
}

const parseImportedBrainPackage = (rawValue: string): unknown => {
  try {
    return JSON.parse(rawValue) as unknown;
  } catch (error) {
    throw new Error(
      `导入失败：文件不是当前支持的 Brain JSON 格式。JSON 解析失败：${error instanceof Error ? error.message : '未知错误'}`
    );
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
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRenamingBrainId(null);
      setRenamingBrainName('');
      setErrorMessage(null);
      setIsImporting(false);
      return;
    }

    setNewBrainName('当前 Brain');
    setImportName('导入 Brain');
    setRenamingBrainId(null);
    setRenamingBrainName('');
    setErrorMessage(null);
    setIsImporting(false);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleCreateFromCurrent = async () => {
    try {
      await onCreateFromCurrent(newBrainName);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const resolvedImportName = importName || file?.name.replace(/\.json$/i, '') || '导入 Brain';
    if (!file || isImporting) {
      return;
    }

    setIsImporting(true);
    input.disabled = true;

    try {
      const text = await file.text();
      await onImportBrain(resolvedImportName, parseImportedBrainPackage(text));
      setErrorMessage(null);
    } catch (error) {
      const fallbackMessage = '导入失败：文件不是当前支持的 Brain JSON 格式。';
      if (!(error instanceof Error)) {
        setErrorMessage(fallbackMessage);
      } else if (error.message.includes('当前支持的 Brain JSON 格式')) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(`${fallbackMessage} ${error.message}`);
      }
    } finally {
      input.value = '';
      input.disabled = false;
      setIsImporting(false);
    }
  };

  const startRenamingBrain = (brain: BrainLibraryRecord) => {
    setRenamingBrainId(brain.agent.metadata.id);
    setRenamingBrainName(brain.agent.metadata.name);
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

  const deleteBrain = (brain: BrainLibraryRecord) => {
    if (!window.confirm(`删除 Brain "${brain.agent.metadata.name}"？此操作不能撤销。`)) {
      return;
    }

    onDeleteBrain(brain.agent.metadata.id);
    if (renamingBrainId === brain.agent.metadata.id) {
      setRenamingBrainId(null);
      setRenamingBrainName('');
    }
  };

  return (
    <div className="brain-library-modal-overlay" data-testid="brain-library-modal-overlay" onClick={onClose}>
      <div
        className="brain-library-modal"
        data-testid="brain-library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={importInputId}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="brain-library-header">
          <div>
            <h3 id={importInputId}>Brain 切换</h3>
            <p>使用 LocalStorage 保存 Agent Brain 文档。</p>
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
                  key={brain.agent.metadata.id}
                  className={`brain-library-item ${brain.agent.metadata.id === activeBrainId ? 'active' : ''}`}
                  data-testid={`brain-library-item-${brain.agent.metadata.id}`}
                >
                  <div className="brain-library-item-main">
                    {renamingBrainId === brain.agent.metadata.id ? (
                      <div className="brain-library-rename-row">
                        <input
                          value={renamingBrainName}
                          data-testid={`brain-library-rename-input-${brain.agent.metadata.id}`}
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
                          data-testid={`brain-library-rename-save-${brain.agent.metadata.id}`}
                          onClick={submitRename}
                        >
                          保存
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="brain-library-item-title"
                        data-testid={`brain-library-select-${brain.agent.metadata.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectBrain(brain.agent.metadata.id);
                        }}
                      >
                        <span>{brain.agent.metadata.name}</span>
                        <small>{new Date(brain.agent.metadata.updatedAt).toLocaleString()}</small>
                      </button>
                    )}
                  </div>
                  <div className="brain-library-item-actions">
                    <button
                      type="button"
                      className="brain-library-small-button"
                      data-testid={`brain-library-rename-${brain.agent.metadata.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        startRenamingBrain(brain);
                      }}
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      className="brain-library-small-button"
                      data-testid={`brain-library-duplicate-${brain.agent.metadata.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicateBrain(brain.agent.metadata.id);
                      }}
                    >
                      复制
                    </button>
                    <button
                      type="button"
                      className="brain-library-small-button"
                      data-testid={`brain-library-export-${brain.agent.metadata.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onExportBrain(brain.agent.metadata.id);
                      }}
                    >
                      导出
                    </button>
                    <button
                      type="button"
                      className="brain-library-small-button danger"
                      data-testid={`brain-library-delete-${brain.agent.metadata.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteBrain(brain);
                      }}
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
            onClick={() => {
              void handleCreateFromCurrent();
            }}
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
            disabled={isImporting}
            onClick={() => importFileInputRef.current?.click()}
          >
            {isImporting ? '导入中...' : '导入 JSON'}
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
