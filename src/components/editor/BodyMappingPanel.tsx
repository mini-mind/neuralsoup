import React, { useEffect, useMemo, useState } from 'react';
import type {
  AgentIR,
  BodyIR,
  BodyInputEndpointIR,
  BodyInputMappingIR,
  BodyOutputEndpointIR,
  BodyOutputMappingIR,
  WorldRegistry,
} from '../../domain/brain';
import BodyTopologyCanvas from './graph/body/BodyTopologyCanvas';
import { buildBodyCanvasModel } from './graph/body/bodySceneAdapter';
import type {
  BodyIRDraftStatus,
  BodyIRPreviewData,
  BodyIRValidationMessage,
} from './types';

interface BodyMappingPanelProps {
  agent: AgentIR;
  worldRegistry: WorldRegistry;
  bodyDraftStatus: BodyIRDraftStatus;
  preview?: BodyIRPreviewData;
  validation?: BodyIRValidationMessage[];
  onBodyChange: (updater: (current: BodyIR) => BodyIR) => void;
  onApply: () => void;
  onReset: () => void;
}

type SelectedEndpoint =
  | { kind: 'input'; endpointId: string }
  | { kind: 'output'; endpointId: string }
  | null;

type BodySelection =
  | { kind: 'node'; direction: 'input' | 'output'; endpointId: string; nodeId: string }
  | { kind: 'link'; direction: 'input' | 'output'; endpointId: string; mappingId: string; nodeId: string; linkId: string }
  | null;

const createEndpointId = (prefix: 'input' | 'output') =>
  `${prefix}-endpoint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createMappingId = (prefix: 'input' | 'output') =>
  `${prefix}-mapping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultInputEndpoint = (body: BodyIR): BodyInputEndpointIR => {
  const fallback = body.inputEndpoints.at(-1);
  return {
    id: createEndpointId('input'),
    source: fallback?.source ?? 'vision.retina.0',
    worldPort: fallback?.worldPort ?? '',
    scale: fallback?.scale ?? 1,
  };
};

const createDefaultOutputEndpoint = (body: BodyIR): BodyOutputEndpointIR => {
  const fallback = body.outputEndpoints.at(-1);
  return {
    id: createEndpointId('output'),
    target: fallback?.target ?? 'action.move',
    worldPort: fallback?.worldPort ?? '',
    decayPerSecond: fallback?.decayPerSecond ?? 4,
  };
};

const createInputMapping = (endpointId: string): BodyInputMappingIR => ({
  id: createMappingId('input'),
  kind: 'input',
  endpointId,
  nodeId: '',
});

const createOutputMapping = (endpointId: string): BodyOutputMappingIR => ({
  id: createMappingId('output'),
  kind: 'output',
  endpointId,
  nodeId: '',
});

const getDefaultSelectedEndpoint = (body: BodyIR): SelectedEndpoint => {
  const inputEndpoint = body.inputEndpoints[0];
  if (inputEndpoint) {
    return { kind: 'input', endpointId: inputEndpoint.id };
  }
  const outputEndpoint = body.outputEndpoints[0];
  if (outputEndpoint) {
    return { kind: 'output', endpointId: outputEndpoint.id };
  }
  return null;
};

const updateInputEndpointById = (
  body: BodyIR,
  endpointId: string,
  updater: (endpoint: BodyInputEndpointIR) => BodyInputEndpointIR
): BodyIR => ({
  ...body,
  inputEndpoints: body.inputEndpoints.map((endpoint) =>
    endpoint.id === endpointId ? updater(endpoint) : endpoint
  ),
});

const updateOutputEndpointById = (
  body: BodyIR,
  endpointId: string,
  updater: (endpoint: BodyOutputEndpointIR) => BodyOutputEndpointIR
): BodyIR => ({
  ...body,
  outputEndpoints: body.outputEndpoints.map((endpoint) =>
    endpoint.id === endpointId ? updater(endpoint) : endpoint
  ),
});

const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const BodyMappingPanel: React.FC<BodyMappingPanelProps> = ({
  agent,
  worldRegistry,
  bodyDraftStatus,
  preview,
  validation = [],
  onBodyChange,
  onApply,
  onReset,
}) => {
  const body = agent.body;
  const [selectedEndpoint, setSelectedEndpoint] = useState<SelectedEndpoint>(() => getDefaultSelectedEndpoint(body));
  const [selection, setSelection] = useState<BodySelection>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!selectedEndpoint) {
      setSelectedEndpoint(getDefaultSelectedEndpoint(body));
      return;
    }

    if (
      selectedEndpoint.kind === 'input' &&
      !body.inputEndpoints.some((endpoint) => endpoint.id === selectedEndpoint.endpointId)
    ) {
      setSelectedEndpoint(getDefaultSelectedEndpoint(body));
      return;
    }

    if (
      selectedEndpoint.kind === 'output' &&
      !body.outputEndpoints.some((endpoint) => endpoint.id === selectedEndpoint.endpointId)
    ) {
      setSelectedEndpoint(getDefaultSelectedEndpoint(body));
    }
  }, [body, selectedEndpoint]);

  useEffect(() => {
    if (!editorOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEditorOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [editorOpen]);

  const inputEndpointIdToIndex = useMemo(
    () => new Map(body.inputEndpoints.map((endpoint, index) => [endpoint.id, index])),
    [body.inputEndpoints]
  );
  const outputEndpointIdToIndex = useMemo(
    () => new Map(body.outputEndpoints.map((endpoint, index) => [endpoint.id, index])),
    [body.outputEndpoints]
  );
  const selectedInputEndpoint = selectedEndpoint?.kind === 'input'
    ? body.inputEndpoints.find((endpoint) => endpoint.id === selectedEndpoint.endpointId) ?? null
    : null;
  const selectedOutputEndpoint = selectedEndpoint?.kind === 'output'
    ? body.outputEndpoints.find((endpoint) => endpoint.id === selectedEndpoint.endpointId) ?? null
    : null;
  const selectedInputEndpointIndex = selectedInputEndpoint ? inputEndpointIdToIndex.get(selectedInputEndpoint.id) ?? -1 : -1;
  const selectedOutputEndpointIndex = selectedOutputEndpoint ? outputEndpointIdToIndex.get(selectedOutputEndpoint.id) ?? -1 : -1;

  const selectedValidation = useMemo(() => {
    if (!selectedEndpoint) {
      return validation;
    }

    return validation.filter(
      (item) =>
        item.scope === 'body' ||
        (selectedEndpoint.kind === 'input' &&
          item.scope === 'input-endpoint' &&
          item.endpointId === selectedEndpoint.endpointId) ||
        (selectedEndpoint.kind === 'output' &&
          item.scope === 'output-endpoint' &&
          item.endpointId === selectedEndpoint.endpointId)
    );
  }, [selectedEndpoint, validation]);

  const canvasModel = useMemo(() => buildBodyCanvasModel(agent, body, worldRegistry), [agent, body, worldRegistry]);

  const handleApplyAndClose = () => {
    onApply();
    setEditorOpen(false);
  };

  const selectedDirection = selectedEndpoint?.kind ?? null;
  const selectedEndpointId = selectedEndpoint?.endpointId ?? null;
  const selectedLinkDetail = selection?.kind === 'link'
    ? canvasModel.links.find((link) => link.id === selection.linkId) ?? null
    : null;
  const selectedNodeDetail = selection?.kind === 'node'
    ? canvasModel.nodes.find((node) => node.id === selection.nodeId) ?? null
    : null;

  const selectedInputMappings =
    selectedInputEndpoint == null
      ? []
      : body.mappings.filter(
          (mapping): mapping is BodyInputMappingIR =>
            mapping.kind === 'input' && mapping.endpointId === selectedInputEndpoint.id
        );
  const selectedOutputMappings =
    selectedOutputEndpoint == null
      ? []
      : body.mappings.filter(
          (mapping): mapping is BodyOutputMappingIR =>
            mapping.kind === 'output' && mapping.endpointId === selectedOutputEndpoint.id
        );

  return (
    <div className="body-mapping-panel" data-testid="body-mapping-panel">
      <div className="body-mapping-summary">
        <span>{preview?.canonicalSummary ?? '暂无 BodyIR 端点预览。'}</span>
        <span>{preview?.compiledSummary ?? ''}</span>
        <span>{bodyDraftStatus.hasChanges ? '存在未应用变更' : '已与当前 Agent 同步'}</span>
      </div>

      <section className="body-mapping-graph-card">
        <BodyTopologyCanvas
          model={canvasModel}
          selectedDirection={selectedDirection}
          selectedEndpointId={selectedEndpointId}
          onSelectionChange={(nextSelection) => {
            setSelection(nextSelection);
            if (nextSelection) {
              setSelectedEndpoint({ kind: nextSelection.direction, endpointId: nextSelection.endpointId });
            }
          }}
          onContextEditSelection={(nextSelection) => {
            setSelection(nextSelection);
            setSelectedEndpoint({ kind: nextSelection.direction, endpointId: nextSelection.endpointId });
            setEditorOpen(true);
          }}
          beforeScene={
            <div className="body-mapping-floating-actions">
              <button
                type="button"
                className="settings-action-button secondary"
                onClick={() => setEditorOpen(true)}
              >
                端点
              </button>
              <button
                type="button"
                className="settings-action-button"
                onClick={onApply}
              >
                应用
              </button>
              <button
                type="button"
                className="settings-action-button secondary"
                onClick={onReset}
              >
                重置
              </button>
            </div>
          }
        />
      </section>

      {validation.length > 0 ? (
        <div className="body-mapping-validation body-mapping-validation-inline">
          {validation.slice(0, 3).map((item, index) => (
            <div key={`${item.level}-${index}`} className={`body-ir-message ${item.level}`}>
              <span className="body-ir-message-badge">{item.level}</span>
              <span>{item.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {editorOpen ? (
        <div
          className="modal-overlay"
          data-testid="body-mapping-editor-modal-overlay"
          onClick={() => setEditorOpen(false)}
        >
          <div
            className="modal-content"
            data-testid="body-mapping-editor-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="topology-detail-header">
              <button
                type="button"
                className="topology-detail-close"
                onClick={() => setEditorOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="topology-detail-editor">
              <div className="body-mapping-modal-summary">
                <h3>BodyIR 端点映射</h3>
                <p>优先从画布选中某条映射连线或端点节点，再在此直接编辑对应端点。</p>
              </div>

              {selectedLinkDetail ? (
                <div className="body-mapping-selection-summary">
                  <span>当前选中映射</span>
                  <strong>{selectedLinkDetail.detail}</strong>
                </div>
              ) : selectedNodeDetail ? (
                <div className="body-mapping-selection-summary">
                  <span>当前选中节点</span>
                  <strong>{selectedNodeDetail.label}</strong>
                </div>
              ) : null}

              <div className="body-mapping-modal-actions">
                <button
                  type="button"
                  className="settings-action-button secondary"
                  onClick={() =>
                    onBodyChange((current) => {
                      const endpoint = createDefaultInputEndpoint(current);
                      return {
                        ...current,
                        inputEndpoints: [...current.inputEndpoints, endpoint],
                        mappings: [...current.mappings, createInputMapping(endpoint.id)],
                      };
                    })
                  }
                >
                  新增输入端点
                </button>
                <button
                  type="button"
                  className="settings-action-button secondary"
                  onClick={() =>
                    onBodyChange((current) => {
                      const endpoint = createDefaultOutputEndpoint(current);
                      return {
                        ...current,
                        outputEndpoints: [...current.outputEndpoints, endpoint],
                        mappings: [...current.mappings, createOutputMapping(endpoint.id)],
                      };
                    })
                  }
                >
                  新增输出端点
                </button>
                <button
                  type="button"
                  className="settings-action-button secondary"
                  onClick={onReset}
                >
                  重置
                </button>
                <button
                  type="button"
                  className="settings-action-button"
                  onClick={handleApplyAndClose}
                >
                  应用
                </button>
              </div>

              <div className="body-mapping-endpoint-browser body-mapping-endpoint-browser-secondary">
                <section className="body-mapping-endpoint-list-card">
                  <div className="body-mapping-card-header">
                    <h4>输入端点</h4>
                    <span>{body.inputEndpoints.length} 项</span>
                  </div>
                  <div className="body-mapping-endpoint-list">
                    {body.inputEndpoints.map((endpoint, index) => {
                      const active = selectedEndpoint?.kind === 'input' && selectedEndpoint.endpointId === endpoint.id;
                      return (
                        <button
                          key={endpoint.id}
                          type="button"
                          className={`body-mapping-endpoint-item ${active ? 'is-active' : ''}`}
                          onClick={() => setSelectedEndpoint({ kind: 'input', endpointId: endpoint.id })}
                        >
                          <span className="body-mapping-endpoint-item-title">E{index + 1}</span>
                          <span className="body-mapping-endpoint-item-copy">{endpoint.source}</span>
                          <span className="body-mapping-endpoint-item-copy">
                            {body.mappings.filter(
                              (mapping) => mapping.kind === 'input' && mapping.endpointId === endpoint.id
                            ).length} 个节点
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="body-mapping-endpoint-list-card">
                  <div className="body-mapping-card-header">
                    <h4>输出端点</h4>
                    <span>{body.outputEndpoints.length} 项</span>
                  </div>
                  <div className="body-mapping-endpoint-list">
                    {body.outputEndpoints.map((endpoint, index) => {
                      const active = selectedEndpoint?.kind === 'output' && selectedEndpoint.endpointId === endpoint.id;
                      return (
                        <button
                          key={endpoint.id}
                          type="button"
                          className={`body-mapping-endpoint-item ${active ? 'is-active' : ''}`}
                          onClick={() => setSelectedEndpoint({ kind: 'output', endpointId: endpoint.id })}
                        >
                          <span className="body-mapping-endpoint-item-title">E{index + 1}</span>
                          <span className="body-mapping-endpoint-item-copy">{endpoint.target}</span>
                          <span className="body-mapping-endpoint-item-copy">
                            {body.mappings.filter(
                              (mapping) => mapping.kind === 'output' && mapping.endpointId === endpoint.id
                            ).length} 个节点
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="body-mapping-editor-card">
                <div className="body-mapping-card-header">
                  <h4>端点编辑</h4>
                  <span>
                    {selectedEndpoint
                      ? selectedEndpoint.kind === 'input'
                        ? selectedInputEndpointIndex >= 0
                          ? `输入端点 ${selectedInputEndpointIndex + 1}`
                          : '输入端点'
                        : selectedOutputEndpointIndex >= 0
                          ? `输出端点 ${selectedOutputEndpointIndex + 1}`
                          : '输出端点'
                      : '未选择端点'}
                  </span>
                </div>

                {selectedInputEndpoint ? (
                  <div className="body-mapping-form-grid">
                    <label className="body-mapping-field">
                      <span>World Source</span>
                      <input
                        value={selectedInputEndpoint.source}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateInputEndpointById(current, selectedInputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              source: event.target.value,
                            }))
                          )
                        }
                      />
                    </label>
                    <label className="body-mapping-field">
                      <span>World Port (可选)</span>
                      <input
                        value={selectedInputEndpoint.worldPort ?? ''}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateInputEndpointById(current, selectedInputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              worldPort: event.target.value,
                            }))
                          )
                        }
                      />
                    </label>
                    <label className="body-mapping-field">
                      <span>缩放系数</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedInputEndpoint.scale}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateInputEndpointById(current, selectedInputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              scale: parseNumber(event.target.value, endpoint.scale),
                            }))
                          )
                        }
                      />
                    </label>
                    {selectedInputMappings.map((mapping, index) => (
                      <label key={mapping.id} className="body-mapping-field">
                        <span>{`映射节点 ${index + 1}`}</span>
                        <input
                          value={mapping.nodeId}
                          onChange={(event) =>
                            onBodyChange((current) => ({
                              ...current,
                              mappings: current.mappings.map((entry) =>
                                entry.id === mapping.id ? { ...entry, nodeId: event.target.value } : entry
                              ),
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="settings-action-button secondary"
                          onClick={() =>
                            onBodyChange((current) => ({
                              ...current,
                              mappings: current.mappings.filter((entry) => entry.id !== mapping.id),
                            }))
                          }
                        >
                          删除映射
                        </button>
                      </label>
                    ))}
                    <button
                      type="button"
                      className="settings-action-button secondary"
                      onClick={() =>
                        onBodyChange((current) => ({
                          ...current,
                          mappings: [...current.mappings, createInputMapping(selectedInputEndpoint.id)],
                        }))
                      }
                    >
                      新增映射节点
                    </button>
                    <button
                      type="button"
                      className="settings-action-button secondary"
                      onClick={() =>
                        onBodyChange((current) => {
                          return {
                            ...current,
                            inputEndpoints: current.inputEndpoints.filter((endpoint) => endpoint.id !== selectedInputEndpoint.id),
                            mappings: current.mappings.filter(
                              (mapping) => !(mapping.kind === 'input' && mapping.endpointId === selectedInputEndpoint.id)
                            ),
                          };
                        })
                      }
                    >
                      删除输入端点
                    </button>
                  </div>
                ) : selectedOutputEndpoint ? (
                  <div className="body-mapping-form-grid">
                    <label className="body-mapping-field">
                      <span>World Target</span>
                      <input
                        value={selectedOutputEndpoint.target}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateOutputEndpointById(current, selectedOutputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              target: event.target.value,
                            }))
                          )
                        }
                      />
                    </label>
                    <label className="body-mapping-field">
                      <span>World Port (可选)</span>
                      <input
                        value={selectedOutputEndpoint.worldPort ?? ''}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateOutputEndpointById(current, selectedOutputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              worldPort: event.target.value,
                            }))
                          )
                        }
                      />
                    </label>
                    <label className="body-mapping-field">
                      <span>衰减 / 秒</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedOutputEndpoint.decayPerSecond}
                        onChange={(event) =>
                          onBodyChange((current) =>
                            updateOutputEndpointById(current, selectedOutputEndpoint.id, (endpoint) => ({
                              ...endpoint,
                              decayPerSecond: parseNumber(event.target.value, endpoint.decayPerSecond),
                            }))
                          )
                        }
                      />
                    </label>
                    {selectedOutputMappings.map((mapping, index) => (
                      <label key={mapping.id} className="body-mapping-field">
                        <span>{`映射节点 ${index + 1}`}</span>
                        <input
                          value={mapping.nodeId}
                          onChange={(event) =>
                            onBodyChange((current) => ({
                              ...current,
                              mappings: current.mappings.map((entry) =>
                                entry.id === mapping.id ? { ...entry, nodeId: event.target.value } : entry
                              ),
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="settings-action-button secondary"
                          onClick={() =>
                            onBodyChange((current) => ({
                              ...current,
                              mappings: current.mappings.filter((entry) => entry.id !== mapping.id),
                            }))
                          }
                        >
                          删除映射
                        </button>
                      </label>
                    ))}
                    <button
                      type="button"
                      className="settings-action-button secondary"
                      onClick={() =>
                        onBodyChange((current) => ({
                          ...current,
                          mappings: [...current.mappings, createOutputMapping(selectedOutputEndpoint.id)],
                        }))
                      }
                    >
                      新增映射节点
                    </button>
                    <button
                      type="button"
                      className="settings-action-button secondary"
                      onClick={() =>
                        onBodyChange((current) => {
                          return {
                            ...current,
                            outputEndpoints: current.outputEndpoints.filter((endpoint) => endpoint.id !== selectedOutputEndpoint.id),
                            mappings: current.mappings.filter(
                              (mapping) => !(mapping.kind === 'output' && mapping.endpointId === selectedOutputEndpoint.id)
                            ),
                          };
                        })
                      }
                    >
                      删除输出端点
                    </button>
                  </div>
                ) : (
                  <div className="body-mapping-empty">先在端点列表中选择一项。</div>
                )}

                {selectedValidation.length > 0 ? (
                  <div className="body-mapping-validation">
                    {selectedValidation.map((item, index) => (
                      <div key={`${item.level}-${index}`} className={`body-ir-message ${item.level}`}>
                        <span className="body-ir-message-badge">{item.level}</span>
                        <span>{item.message}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BodyMappingPanel;
