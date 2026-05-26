import React, { useEffect, useId, useState } from 'react';
import type {
  BodyIR,
  BodyInputEndpointIR,
  BodyInputMappingIR,
  BodyOutputEndpointIR,
  BodyOutputMappingIR,
} from '../../domain/brain';
import type { BodyIRPreviewData, BodyIRValidationMessage } from './types';

interface BodyIRSettingsSectionProps {
  body?: BodyIR;
  projectedVisionCellCount?: number;
  hasBodyDraftChanges?: boolean;
  onBodyChange?: (updater: (current: BodyIR) => BodyIR) => void;
  validation?: BodyIRValidationMessage[];
  preview?: BodyIRPreviewData;
  onApply?: () => void;
  onReset?: () => void;
}

const createEmptyBodyIR = (): BodyIR => ({
  inputEndpoints: [],
  outputEndpoints: [],
  mappings: [],
});

const createEndpointId = (prefix: 'input' | 'output') =>
  `${prefix}-endpoint-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const createMappingId = (prefix: 'input' | 'output') =>
  `${prefix}-mapping-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const createEmptyInputEndpoint = (): BodyInputEndpointIR => ({
  id: createEndpointId('input'),
  source: '',
  worldPort: '',
  scale: 1,
});

const createEmptyOutputEndpoint = (): BodyOutputEndpointIR => ({
  id: createEndpointId('output'),
  target: '',
  worldPort: '',
  decayPerSecond: 1,
});

const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const renderValidationBadge = (level: BodyIRValidationMessage['level']) => {
  if (level === 'error') {
    return '错误';
  }

  if (level === 'warning') {
    return '警告';
  }

  return '提示';
};

const isInputEndpointValidationMessage = (
  message: BodyIRValidationMessage,
  endpointId: string,
  endpointIndex: number
): boolean =>
  message.scope === 'input-endpoint' &&
  (message.endpointId === endpointId || message.endpointIndex === endpointIndex);

const isOutputEndpointValidationMessage = (
  message: BodyIRValidationMessage,
  endpointId: string,
  endpointIndex: number
): boolean =>
  message.scope === 'output-endpoint' &&
  (message.endpointId === endpointId || message.endpointIndex === endpointIndex);

const updateInputEndpointAt = (
  endpoints: BodyInputEndpointIR[],
  index: number,
  updater: (endpoint: BodyInputEndpointIR) => BodyInputEndpointIR
): BodyInputEndpointIR[] =>
  endpoints.map((endpoint, endpointIndex) => (endpointIndex === index ? updater(endpoint) : endpoint));

const updateOutputEndpointAt = (
  endpoints: BodyOutputEndpointIR[],
  index: number,
  updater: (endpoint: BodyOutputEndpointIR) => BodyOutputEndpointIR
): BodyOutputEndpointIR[] =>
  endpoints.map((endpoint, endpointIndex) => (endpointIndex === index ? updater(endpoint) : endpoint));

const createEmptyInputMapping = (endpointId: string): BodyInputMappingIR => ({
  id: createMappingId('input'),
  kind: 'input',
  endpointId,
  nodeId: '',
});

const createEmptyOutputMapping = (endpointId: string): BodyOutputMappingIR => ({
  id: createMappingId('output'),
  kind: 'output',
  endpointId,
  nodeId: '',
});

const BodyIRSettingsSection: React.FC<BodyIRSettingsSectionProps> = ({
  body,
  projectedVisionCellCount,
  hasBodyDraftChanges = false,
  onBodyChange,
  validation,
  preview,
  onApply,
  onReset,
}) => {
  const [localBody, setLocalBody] = useState<BodyIR>(() => body ?? createEmptyBodyIR());
  const inputEndpointsHeaderId = useId();
  const outputEndpointsHeaderId = useId();

  useEffect(() => {
    setLocalBody(body ?? createEmptyBodyIR());
  }, [body]);

  const currentBody = body ?? localBody;
  const effectiveProjectedVisionCellCount = projectedVisionCellCount ?? 0;

  const commitBodyChange = (updater: (current: BodyIR) => BodyIR) => {
    if (onBodyChange) {
      onBodyChange(updater);
      return;
    }

    setLocalBody((current) => updater(current));
  };

  const bodyMessages = validation?.filter((message) => message.scope === 'body') ?? [];

  const renderInputEndpointEditor = (endpoint: BodyInputEndpointIR, index: number) => {
    const endpointValidation =
      validation?.filter((message) => isInputEndpointValidationMessage(message, endpoint.id, index)) ?? [];
    const mappings = currentBody.mappings.filter(
      (mapping): mapping is BodyInputMappingIR => mapping.kind === 'input' && mapping.endpointId === endpoint.id
    );

    return (
      <article className="body-ir-endpoint-card" key={endpoint.id} data-testid={`body-ir-input-endpoint-${index}`}>
        <div className="body-ir-endpoint-card-header">
          <div>
            <h5>输入端点 {index + 1}</h5>
            <p>ID: {endpoint.id}</p>
          </div>
          <button
            type="button"
            className="settings-action-button secondary"
            data-testid={`body-ir-input-endpoint-remove-${index}`}
            onClick={() =>
              commitBodyChange((current) => {
                const target = current.inputEndpoints[index];
                if (!target) {
                  return current;
                }

                return {
                  ...current,
                  inputEndpoints: current.inputEndpoints.filter((_, endpointIndex) => endpointIndex !== index),
                  mappings: current.mappings.filter(
                    (mapping) => !(mapping.kind === 'input' && mapping.endpointId === target.id)
                  ),
                };
              })
            }
          >
            删除
          </button>
        </div>

        <div className="body-ir-endpoint-grid">
          <label className="settings-param-item">
            <span className="settings-param-label">source</span>
            <input
              type="text"
              value={endpoint.source}
              className="settings-param-input body-ir-text-input"
              data-testid={`body-ir-input-endpoint-source-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  inputEndpoints: updateInputEndpointAt(current.inputEndpoints, index, (currentEndpoint) => ({
                    ...currentEndpoint,
                    source: event.target.value,
                  })),
                }))
              }
            />
          </label>

          <label className="settings-param-item">
            <span className="settings-param-label">worldPort (可选)</span>
            <input
              type="text"
              value={endpoint.worldPort ?? ''}
              className="settings-param-input body-ir-text-input"
              data-testid={`body-ir-input-endpoint-world-port-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  inputEndpoints: updateInputEndpointAt(current.inputEndpoints, index, (currentEndpoint) => ({
                    ...currentEndpoint,
                    worldPort: event.target.value,
                  })),
                }))
              }
            />
          </label>

          <label className="settings-param-item">
            <span className="settings-param-label">scale</span>
            <input
              type="number"
              step="0.1"
              value={endpoint.scale}
              className="settings-param-input body-ir-number-input"
              data-testid={`body-ir-input-endpoint-scale-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  inputEndpoints: updateInputEndpointAt(current.inputEndpoints, index, (currentEndpoint) => ({
                    ...currentEndpoint,
                    scale: parseNumber(event.target.value, currentEndpoint.scale),
                  })),
                }))
              }
            />
          </label>
        </div>

        <div className="body-ir-inline-messages">
          {mappings.length > 0 ? (
            mappings.map((mapping, mappingIndex) => (
              <div key={mapping.id} className="body-ir-endpoint-grid">
                <label className="settings-param-item">
                  <span className="settings-param-label">nodeId</span>
                  <input
                    type="text"
                    value={mapping.nodeId}
                    className="settings-param-input body-ir-text-input"
                    data-testid={`body-ir-input-endpoint-node-id-${index}-${mappingIndex}`}
                    onChange={(event) =>
                      commitBodyChange((current) => ({
                        ...current,
                        mappings: current.mappings.map((currentMapping) =>
                          currentMapping.id === mapping.id
                            ? { ...currentMapping, nodeId: event.target.value }
                            : currentMapping
                        ),
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="settings-action-button secondary"
                  data-testid={`body-ir-input-endpoint-remove-mapping-${index}-${mappingIndex}`}
                  onClick={() =>
                    commitBodyChange((current) => ({
                      ...current,
                      mappings: current.mappings.filter((currentMapping) => currentMapping.id !== mapping.id),
                    }))
                  }
                >
                  删除映射
                </button>
              </div>
            ))
          ) : (
            <div className="body-ir-empty-state">当前端点没有映射节点。</div>
          )}
          <button
            type="button"
            className="settings-action-button secondary"
            data-testid={`body-ir-input-endpoint-add-mapping-${index}`}
            onClick={() =>
              commitBodyChange((current) => ({
                ...current,
                mappings: [...current.mappings, createEmptyInputMapping(endpoint.id)],
              }))
            }
          >
            新增映射节点
          </button>
        </div>

        {endpointValidation.length > 0 ? (
          <div className="body-ir-inline-messages">
            {endpointValidation.map((message, messageIndex) => (
              <div
                key={`${endpoint.id}-message-${messageIndex}`}
                className={`body-ir-message ${message.level}`}
                data-testid={`body-ir-input-endpoint-message-${index}-${messageIndex}`}
              >
                <span className="body-ir-message-badge">{renderValidationBadge(message.level)}</span>
                <span>{message.message}</span>
              </div>
            ))}
          </div>
        ) : null}
      </article>
    );
  };

  const renderOutputEndpointEditor = (endpoint: BodyOutputEndpointIR, index: number) => {
    const endpointValidation =
      validation?.filter((message) => isOutputEndpointValidationMessage(message, endpoint.id, index)) ?? [];
    const mappings = currentBody.mappings.filter(
      (mapping): mapping is BodyOutputMappingIR => mapping.kind === 'output' && mapping.endpointId === endpoint.id
    );

    return (
      <article className="body-ir-endpoint-card" key={endpoint.id} data-testid={`body-ir-output-endpoint-${index}`}>
        <div className="body-ir-endpoint-card-header">
          <div>
            <h5>输出端点 {index + 1}</h5>
            <p>ID: {endpoint.id}</p>
          </div>
          <button
            type="button"
            className="settings-action-button secondary"
            data-testid={`body-ir-output-endpoint-remove-${index}`}
            onClick={() =>
              commitBodyChange((current) => {
                const target = current.outputEndpoints[index];
                if (!target) {
                  return current;
                }

                return {
                  ...current,
                  outputEndpoints: current.outputEndpoints.filter((_, endpointIndex) => endpointIndex !== index),
                  mappings: current.mappings.filter(
                    (mapping) => !(mapping.kind === 'output' && mapping.endpointId === target.id)
                  ),
                };
              })
            }
          >
            删除
          </button>
        </div>

        <div className="body-ir-endpoint-grid">
          <label className="settings-param-item">
            <span className="settings-param-label">target</span>
            <input
              type="text"
              value={endpoint.target}
              className="settings-param-input body-ir-text-input"
              data-testid={`body-ir-output-endpoint-target-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  outputEndpoints: updateOutputEndpointAt(current.outputEndpoints, index, (currentEndpoint) => ({
                    ...currentEndpoint,
                    target: event.target.value,
                  })),
                }))
              }
            />
          </label>

          <label className="settings-param-item">
            <span className="settings-param-label">worldPort (可选)</span>
            <input
              type="text"
              value={endpoint.worldPort ?? ''}
              className="settings-param-input body-ir-text-input"
              data-testid={`body-ir-output-endpoint-world-port-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  outputEndpoints: updateOutputEndpointAt(current.outputEndpoints, index, (currentEndpoint) => ({
                    ...currentEndpoint,
                    worldPort: event.target.value,
                  })),
                }))
              }
            />
          </label>

          <label className="settings-param-item">
            <span className="settings-param-label">decayPerSecond</span>
            <input
              type="number"
              step="0.1"
              value={endpoint.decayPerSecond}
              className="settings-param-input body-ir-number-input"
              data-testid={`body-ir-output-endpoint-decay-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  outputEndpoints: updateOutputEndpointAt(current.outputEndpoints, index, (currentEndpoint) => ({
                    ...currentEndpoint,
                    decayPerSecond: parseNumber(event.target.value, currentEndpoint.decayPerSecond),
                  })),
                }))
              }
            />
          </label>
        </div>

        <div className="body-ir-inline-messages">
          {mappings.length > 0 ? (
            mappings.map((mapping, mappingIndex) => (
              <div key={mapping.id} className="body-ir-endpoint-grid">
                <label className="settings-param-item">
                  <span className="settings-param-label">nodeId</span>
                  <input
                    type="text"
                    value={mapping.nodeId}
                    className="settings-param-input body-ir-text-input"
                    data-testid={`body-ir-output-endpoint-node-id-${index}-${mappingIndex}`}
                    onChange={(event) =>
                      commitBodyChange((current) => ({
                        ...current,
                        mappings: current.mappings.map((currentMapping) =>
                          currentMapping.id === mapping.id
                            ? { ...currentMapping, nodeId: event.target.value }
                            : currentMapping
                        ),
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="settings-action-button secondary"
                  data-testid={`body-ir-output-endpoint-remove-mapping-${index}-${mappingIndex}`}
                  onClick={() =>
                    commitBodyChange((current) => ({
                      ...current,
                      mappings: current.mappings.filter((currentMapping) => currentMapping.id !== mapping.id),
                    }))
                  }
                >
                  删除映射
                </button>
              </div>
            ))
          ) : (
            <div className="body-ir-empty-state">当前端点没有映射节点。</div>
          )}
          <button
            type="button"
            className="settings-action-button secondary"
            data-testid={`body-ir-output-endpoint-add-mapping-${index}`}
            onClick={() =>
              commitBodyChange((current) => ({
                ...current,
                mappings: [...current.mappings, createEmptyOutputMapping(endpoint.id)],
              }))
            }
          >
            新增映射节点
          </button>
        </div>

        {endpointValidation.length > 0 ? (
          <div className="body-ir-inline-messages">
            {endpointValidation.map((message, messageIndex) => (
              <div
                key={`${endpoint.id}-message-${messageIndex}`}
                className={`body-ir-message ${message.level}`}
                data-testid={`body-ir-output-endpoint-message-${index}-${messageIndex}`}
              >
                <span className="body-ir-message-badge">{renderValidationBadge(message.level)}</span>
                <span>{message.message}</span>
              </div>
            ))}
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <div className="settings-page-section body-ir-settings" data-testid="body-ir-settings-panel">
      <div className="settings-section-header">
        <h4>BodyIR 端点映射</h4>
        <p>维护 body endpoint 到 world 信号的端点映射、视觉 coverage，并实时查看投影预览与校验结果。</p>
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="settings-action-button secondary"
          data-testid="body-ir-reset"
          onClick={onReset}
          disabled={!hasBodyDraftChanges}
        >
          重置草稿
        </button>
        <button
          type="button"
          className="settings-action-button"
          data-testid="body-ir-apply"
          onClick={onApply}
          disabled={!hasBodyDraftChanges}
        >
          应用 Body IR
        </button>
      </div>

      <section className="body-ir-endpoint-section" data-testid="body-ir-coverage-section">
        <div className="body-ir-section-header">
          <div>
            <h5>visionCoverage</h5>
            <p>视觉 coverage 由 host 配置投影决定，不再由 BodyIR 草稿直接编辑；下方预览展示当前 host coverage 下可投影的 endpoint 集合。</p>
          </div>
        </div>

        <div className="body-ir-endpoint-grid">
          <div className="settings-param-item">
            <span className="settings-param-label">hostProjectedVisionCells</span>
            <div
              className="settings-param-input body-ir-number-input body-ir-readonly-input"
              data-testid="body-ir-projected-vision-cell-count"
            >
              {effectiveProjectedVisionCellCount}
            </div>
            <span className="settings-param-description">修改入口位于“智能体参数”，BodyIR 仅维护输入输出端点与映射。</span>
          </div>
        </div>
      </section>

      {bodyMessages.length > 0 ? (
        <div className="body-ir-message-list" data-testid="body-ir-validation-list">
          {bodyMessages.map((message, index) => (
            <div key={`body-message-${index}`} className={`body-ir-message ${message.level}`}>
              <span className="body-ir-message-badge">{renderValidationBadge(message.level)}</span>
              <span>{message.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="body-ir-columns">
        <section className="body-ir-endpoint-section" aria-labelledby={inputEndpointsHeaderId}>
          <div className="body-ir-section-header">
            <div>
              <h5 id={inputEndpointsHeaderId}>inputEndpoints</h5>
              <p>输入端点及其节点映射。</p>
            </div>
            <button
              type="button"
              className="settings-action-button"
              data-testid="body-ir-input-endpoint-add"
              onClick={() =>
                commitBodyChange((current) => {
                  const endpoint = createEmptyInputEndpoint();
                  return {
                    ...current,
                    inputEndpoints: [...current.inputEndpoints, endpoint],
                    mappings: [...current.mappings, createEmptyInputMapping(endpoint.id)],
                  };
                })
              }
            >
              新增输入端点
            </button>
          </div>

          <div className="body-ir-endpoint-list">
            {currentBody.inputEndpoints.length > 0 ? (
              currentBody.inputEndpoints.map(renderInputEndpointEditor)
            ) : (
              <div className="body-ir-empty-state" data-testid="body-ir-input-empty">
                当前没有输入端点。
              </div>
            )}
          </div>
        </section>

        <section className="body-ir-endpoint-section" aria-labelledby={outputEndpointsHeaderId}>
          <div className="body-ir-section-header">
            <div>
              <h5 id={outputEndpointsHeaderId}>outputEndpoints</h5>
              <p>输出端点及其节点映射。</p>
            </div>
            <button
              type="button"
              className="settings-action-button"
              data-testid="body-ir-output-endpoint-add"
              onClick={() =>
                commitBodyChange((current) => {
                  const endpoint = createEmptyOutputEndpoint();
                  return {
                    ...current,
                    outputEndpoints: [...current.outputEndpoints, endpoint],
                    mappings: [...current.mappings, createEmptyOutputMapping(endpoint.id)],
                  };
                })
              }
            >
              新增输出端点
            </button>
          </div>

          <div className="body-ir-endpoint-list">
            {currentBody.outputEndpoints.length > 0 ? (
              currentBody.outputEndpoints.map(renderOutputEndpointEditor)
            ) : (
              <div className="body-ir-empty-state" data-testid="body-ir-output-empty">
                当前没有输出端点。
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="body-ir-preview" data-testid="body-ir-preview-panel">
        <div className="body-ir-section-header">
          <div>
            <h5>Preview / Validation</h5>
            <p>展示当前端点定义对 canonical body endpoint 的投影结果，便于核对 nodeId 与 world 映射；runtime 实际安装形状以已编译程序为准。</p>
          </div>
        </div>

        {preview?.canonicalSummary ? (
          <p className="body-ir-preview-summary" data-testid="body-ir-preview-canonical-summary">
            {preview.canonicalSummary}
          </p>
        ) : null}
        {preview?.compiledSummary ? (
          <p className="body-ir-preview-summary" data-testid="body-ir-preview-compiled-summary">
            {preview.compiledSummary}
          </p>
        ) : null}

        <div className="body-ir-preview-grid">
          <div className="body-ir-preview-block">
            <h6>输入匹配预览</h6>
            {preview?.inputMatches?.length ? (
              <ul className="body-ir-preview-list">
                {preview.inputMatches.map((item, index) => (
                  <li key={`input-preview-${index}`} data-testid={`body-ir-input-preview-item-${index}`}>
                    <span>{item.nodeId}</span>
                    <span>{item.resolvedSource}</span>
                    <span>{item.scale ?? '-'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="body-ir-empty-state">暂无输入预览数据。</div>
            )}
          </div>

          <div className="body-ir-preview-block">
            <h6>输出匹配预览</h6>
            {preview?.outputMatches?.length ? (
              <ul className="body-ir-preview-list">
                {preview.outputMatches.map((item, index) => (
                  <li key={`output-preview-${index}`} data-testid={`body-ir-output-preview-item-${index}`}>
                    <span>{item.nodeId}</span>
                    <span>{item.resolvedTarget}</span>
                    <span>{item.decayPerSecond ?? '-'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="body-ir-empty-state">暂无输出预览数据。</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default BodyIRSettingsSection;
