import React, { useEffect, useId, useState } from 'react';
import type { BodyIR, BodyInputRule, BodyOutputRule } from '../../domain/brain';
import type { BodyIRPreviewData, BodyIRValidationMessage } from './types';

interface BodyIRSettingsSectionProps {
  body?: BodyIR;
  hasBodyDraftChanges?: boolean;
  onBodyChange?: (updater: (current: BodyIR) => BodyIR) => void;
  validation?: BodyIRValidationMessage[];
  preview?: BodyIRPreviewData;
  onApply?: () => void;
  onReset?: () => void;
}

const DEFAULT_BODY_IR_VALUE: BodyIR = {
  version: 1,
  visionCellCount: 36,
  inputRules: [
    {
      id: 'input-rule-1',
      nodeIdPattern: '^vision-([RGB])-(\\d+)$',
      sourceTemplate: 'vision.$1.$2',
      scale: 1
    }
  ],
  outputRules: [
    {
      id: 'output-rule-1',
      nodeIdPattern: '^output-(turn-left|move-forward|turn-right)$',
      targetTemplate: 'action.$1',
      decayPerSecond: 4
    }
  ]
};

const createRuleId = (prefix: 'input' | 'output') =>
  `${prefix}-rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const createEmptyInputRule = (): BodyInputRule => ({
  id: createRuleId('input'),
  nodeIdPattern: '',
  sourceTemplate: '',
  scale: 1
});

const createEmptyOutputRule = (): BodyOutputRule => ({
  id: createRuleId('output'),
  nodeIdPattern: '',
  targetTemplate: '',
  decayPerSecond: 1
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

const updateInputRuleAt = (
  rules: BodyInputRule[],
  index: number,
  updater: (rule: BodyInputRule) => BodyInputRule
): BodyInputRule[] => rules.map((rule, ruleIndex) => (ruleIndex === index ? updater(rule) : rule));

const updateOutputRuleAt = (
  rules: BodyOutputRule[],
  index: number,
  updater: (rule: BodyOutputRule) => BodyOutputRule
): BodyOutputRule[] => rules.map((rule, ruleIndex) => (ruleIndex === index ? updater(rule) : rule));

const BodyIRSettingsSection: React.FC<BodyIRSettingsSectionProps> = ({
  body,
  hasBodyDraftChanges = false,
  onBodyChange,
  validation,
  preview,
  onApply,
  onReset,
}) => {
  const [localBody, setLocalBody] = useState<BodyIR>(() => body ?? DEFAULT_BODY_IR_VALUE);
  const inputRulesHeaderId = useId();
  const outputRulesHeaderId = useId();

  useEffect(() => {
    if (body) {
      setLocalBody(body);
    }
  }, [body]);

  const currentBody = body ?? localBody;

  const commitBodyChange = (updater: (current: BodyIR) => BodyIR) => {
    if (onBodyChange) {
      onBodyChange(updater);
      return;
    }

    setLocalBody((current) => updater(current));
  };

  const bodyMessages = validation?.filter((message) => message.scope === 'body' || message.scope === undefined) ?? [];

  const renderInputRuleEditor = (rule: BodyInputRule, index: number) => {
    const ruleValidation = validation?.filter(
      (message) => message.scope === 'input-rule' && message.ruleIndex === index
    ) ?? [];

    return (
      <article className="body-ir-rule-card" key={rule.id} data-testid={`body-ir-input-rule-${index}`}>
        <div className="body-ir-rule-card-header">
          <div>
            <h5>输入规则 {index + 1}</h5>
            <p>ID: {rule.id}</p>
          </div>
          <button
            type="button"
            className="settings-action-button secondary"
            data-testid={`body-ir-input-rule-remove-${index}`}
            onClick={() =>
              commitBodyChange((current) => ({
                ...current,
                inputRules: current.inputRules.filter((_, ruleIndex) => ruleIndex !== index)
              }))
            }
          >
            删除
          </button>
        </div>

        <div className="body-ir-rule-grid">
          <label className="settings-param-item">
            <span className="settings-param-label">nodeIdPattern</span>
            <input
              type="text"
              value={rule.nodeIdPattern}
              className="settings-param-input body-ir-text-input"
              data-testid={`body-ir-input-rule-pattern-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  inputRules: updateInputRuleAt(current.inputRules, index, (currentRule) => ({
                    ...currentRule,
                    nodeIdPattern: event.target.value
                  }))
                }))
              }
            />
          </label>

          <label className="settings-param-item">
            <span className="settings-param-label">sourceTemplate</span>
            <input
              type="text"
              value={rule.sourceTemplate}
              className="settings-param-input body-ir-text-input"
              data-testid={`body-ir-input-rule-source-template-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  inputRules: updateInputRuleAt(current.inputRules, index, (currentRule) => ({
                    ...currentRule,
                    sourceTemplate: event.target.value
                  }))
                }))
              }
            />
          </label>

          <label className="settings-param-item">
            <span className="settings-param-label">scale</span>
            <input
              type="number"
              step="0.1"
              value={rule.scale}
              className="settings-param-input body-ir-number-input"
              data-testid={`body-ir-input-rule-scale-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  inputRules: updateInputRuleAt(current.inputRules, index, (currentRule) => ({
                    ...currentRule,
                    scale: parseNumber(event.target.value, currentRule.scale)
                  }))
                }))
              }
            />
          </label>
        </div>

        {ruleValidation.length > 0 ? (
          <div className="body-ir-inline-messages">
            {ruleValidation.map((message, messageIndex) => (
              <div
                key={`${rule.id}-message-${messageIndex}`}
                className={`body-ir-message ${message.level}`}
                data-testid={`body-ir-input-rule-message-${index}-${messageIndex}`}
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

  const renderOutputRuleEditor = (rule: BodyOutputRule, index: number) => {
    const ruleValidation = validation?.filter(
      (message) => message.scope === 'output-rule' && message.ruleIndex === index
    ) ?? [];

    return (
      <article className="body-ir-rule-card" key={rule.id} data-testid={`body-ir-output-rule-${index}`}>
        <div className="body-ir-rule-card-header">
          <div>
            <h5>输出规则 {index + 1}</h5>
            <p>ID: {rule.id}</p>
          </div>
          <button
            type="button"
            className="settings-action-button secondary"
            data-testid={`body-ir-output-rule-remove-${index}`}
            onClick={() =>
              commitBodyChange((current) => ({
                ...current,
                outputRules: current.outputRules.filter((_, ruleIndex) => ruleIndex !== index)
              }))
            }
          >
            删除
          </button>
        </div>

        <div className="body-ir-rule-grid">
          <label className="settings-param-item">
            <span className="settings-param-label">nodeIdPattern</span>
            <input
              type="text"
              value={rule.nodeIdPattern}
              className="settings-param-input body-ir-text-input"
              data-testid={`body-ir-output-rule-pattern-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  outputRules: updateOutputRuleAt(current.outputRules, index, (currentRule) => ({
                    ...currentRule,
                    nodeIdPattern: event.target.value
                  }))
                }))
              }
            />
          </label>

          <label className="settings-param-item">
            <span className="settings-param-label">targetTemplate</span>
            <input
              type="text"
              value={rule.targetTemplate}
              className="settings-param-input body-ir-text-input"
              data-testid={`body-ir-output-rule-target-template-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  outputRules: updateOutputRuleAt(current.outputRules, index, (currentRule) => ({
                    ...currentRule,
                    targetTemplate: event.target.value
                  }))
                }))
              }
            />
          </label>

          <label className="settings-param-item">
            <span className="settings-param-label">decayPerSecond</span>
            <input
              type="number"
              step="0.1"
              value={rule.decayPerSecond}
              className="settings-param-input body-ir-number-input"
              data-testid={`body-ir-output-rule-decay-${index}`}
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  outputRules: updateOutputRuleAt(current.outputRules, index, (currentRule) => ({
                    ...currentRule,
                    decayPerSecond: parseNumber(event.target.value, currentRule.decayPerSecond)
                  }))
                }))
              }
            />
          </label>
        </div>

        {ruleValidation.length > 0 ? (
          <div className="body-ir-inline-messages">
            {ruleValidation.map((message, messageIndex) => (
              <div
                key={`${rule.id}-message-${messageIndex}`}
                className={`body-ir-message ${message.level}`}
                data-testid={`body-ir-output-rule-message-${index}-${messageIndex}`}
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
        <h4>BodyIR 映射规则</h4>
        <p>维护 body endpoint 到 world 信号的映射规则、视觉 coverage，并实时查看投影预览与校验结果。</p>
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

      <section className="body-ir-rule-section" data-testid="body-ir-coverage-section">
        <div className="body-ir-section-header">
          <div>
            <h5>visionCoverage</h5>
            <p>定义 canonical BodyIR 的视觉输入覆盖范围，GraphView 预览和 runtime 输入维度都以此为准。</p>
          </div>
        </div>

        <div className="body-ir-rule-grid">
          <label className="settings-param-item">
            <span className="settings-param-label">visionCellCount</span>
            <input
              type="number"
              min="0"
              step="1"
              value={currentBody.visionCellCount}
              className="settings-param-input body-ir-number-input"
              data-testid="body-ir-vision-cell-count"
              onChange={(event) =>
                commitBodyChange((current) => ({
                  ...current,
                  visionCellCount: Math.max(0, Number.parseInt(event.target.value || '0', 10) || 0),
                }))
              }
            />
          </label>
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
        <section className="body-ir-rule-section" aria-labelledby={inputRulesHeaderId}>
          <div className="body-ir-section-header">
            <div>
              <h5 id={inputRulesHeaderId}>inputRules</h5>
              <p>节点输入到感知源模板的规则。</p>
            </div>
            <button
              type="button"
              className="settings-action-button"
              data-testid="body-ir-input-rule-add"
              onClick={() =>
                commitBodyChange((current) => ({
                  ...current,
                  inputRules: [...current.inputRules, createEmptyInputRule()]
                }))
              }
            >
              新增输入规则
            </button>
          </div>

          <div className="body-ir-rule-list">
            {currentBody.inputRules.length > 0 ? (
              currentBody.inputRules.map(renderInputRuleEditor)
            ) : (
              <div className="body-ir-empty-state" data-testid="body-ir-input-empty">
                当前没有输入规则。
              </div>
            )}
          </div>
        </section>

        <section className="body-ir-rule-section" aria-labelledby={outputRulesHeaderId}>
          <div className="body-ir-section-header">
            <div>
              <h5 id={outputRulesHeaderId}>outputRules</h5>
              <p>节点输出到动作目标模板的规则。</p>
            </div>
            <button
              type="button"
              className="settings-action-button"
              data-testid="body-ir-output-rule-add"
              onClick={() =>
                commitBodyChange((current) => ({
                  ...current,
                  outputRules: [...current.outputRules, createEmptyOutputRule()]
                }))
              }
            >
              新增输出规则
            </button>
          </div>

          <div className="body-ir-rule-list">
            {currentBody.outputRules.length > 0 ? (
              currentBody.outputRules.map(renderOutputRuleEditor)
            ) : (
              <div className="body-ir-empty-state" data-testid="body-ir-output-empty">
                当前没有输出规则。
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="body-ir-preview" data-testid="body-ir-preview-panel">
        <div className="body-ir-section-header">
          <div>
            <h5>Preview / Validation</h5>
            <p>展示当前规则对 body endpoint 的投影结果，便于核对 nodeId 与 world 映射。</p>
          </div>
        </div>

        {preview?.summary ? <p className="body-ir-preview-summary">{preview.summary}</p> : null}

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
