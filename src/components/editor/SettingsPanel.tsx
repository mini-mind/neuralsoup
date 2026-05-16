import React from 'react';
import type { AgentParameters, SettingsSection } from './types';

interface SettingsPanelProps {
  agentParameters: AgentParameters;
  draftAgentParameters: AgentParameters;
  settingsSection: SettingsSection;
  onSettingsSectionChange: (section: SettingsSection) => void;
  onDraftAgentParametersChange: React.Dispatch<React.SetStateAction<AgentParameters>>;
  onApply: () => void;
  onResetDefaults: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  agentParameters,
  draftAgentParameters,
  settingsSection,
  onSettingsSectionChange,
  onDraftAgentParametersChange,
  onApply,
  onResetDefaults
}) => {
  const renderKeyboardInputGuide = () => (
    <div className="settings-page-section manual-control" data-testid="keyboard-input-panel">
      <h4>键盘覆盖说明</h4>
      <div className="control-instructions">
        <div className="instruction-section">
          <h5>键盘覆盖输入</h5>
          <ul>
            <li>当前主 Agent 默认由脑图程序驱动。</li>
            <li><kbd>W</kbd> 或 <kbd>↑</kbd> - 临时覆盖为前进</li>
            <li><kbd>A</kbd> 或 <kbd>←</kbd> - 临时覆盖为左转</li>
            <li><kbd>D</kbd> 或 <kbd>→</kbd> - 临时覆盖为右转</li>
            <li>按住方向键时会临时覆盖当前动作输出。</li>
            <li>松开方向键后，会恢复为当前智能体自己的控制逻辑。</li>
            <li><kbd>Space</kbd> - 开始、继续或暂停仿真</li>
            <li>支持多键同时按下；A+D 同时按下会抵消转向。</li>
          </ul>
        </div>

        <div className="instruction-section">
          <h5>输入行为</h5>
          <ul>
            <li>键盘覆盖不会切换产品模式，只在按下期间覆盖动作输出。</li>
            <li>脑图仍持续接收视觉输入并更新内部状态。</li>
            <li>适合调试脑图反应、校验避障和奖励反馈。</li>
          </ul>
        </div>

        <div className="instruction-section">
          <h5>视觉输入</h5>
          <ul>
            <li>{agentParameters.visionAngle}度前方视野</li>
            <li>{agentParameters.visionCells}个感受格子</li>
            <li>每格子RGB颜色输入</li>
            <li>共{agentParameters.visionCells * 3}维输入向量</li>
            <li>视野范围：{agentParameters.visionRange}像素</li>
          </ul>
        </div>

        <div className="instruction-section">
          <h5>环境元素</h5>
          <ul>
            <li>🟢 绿色：食物（正奖励）</li>
            <li>⚫ 黑色：移动障碍物</li>
            <li>⚪ 灰色：静止障碍物</li>
            <li>🔵 蓝色：其他智能体</li>
          </ul>
        </div>

        <div className="instruction-section">
          <h5>神经系统</h5>
          <ul>
            <li>动机（多巴胺）：奖励预测误差</li>
            <li>压力（去甲肾上腺素）：环境不确定性</li>
            <li>稳态（血清素）：风险规避阈值</li>
            <li>神经信号调节行为策略</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderAgentParameters = () => (
    <div className="settings-page-section settings-parameters" data-testid="agent-params-panel">
      <div className="settings-section-header">
        <h4>智能体参数</h4>
        <p>调整视觉采样密度和感知范围，修改会立即作用到当前主智能体与脑图输入维度。</p>
      </div>

      <div className="settings-param-group">
        <label className="settings-param-item">
          <span className="settings-param-label">视野单元格数量</span>
          <div className="settings-param-control">
            <input
              data-testid="vision-cells-range"
              type="range"
              min="1"
              max="72"
              step="1"
              value={draftAgentParameters.visionCells}
              onChange={(event) =>
                onDraftAgentParametersChange((current) => ({
                  ...current,
                  visionCells: Number.parseInt(event.target.value, 10)
                }))
              }
              className="settings-param-slider"
            />
            <input
              data-testid="vision-cells-input"
              type="number"
              min="1"
              max="72"
              step="1"
              value={draftAgentParameters.visionCells}
              onChange={(event) =>
                onDraftAgentParametersChange((current) => ({
                  ...current,
                  visionCells: Number.parseInt(event.target.value, 10)
                }))
              }
              className="settings-param-input"
            />
          </div>
          <span className="settings-param-description">
            影响视觉输入维度：{draftAgentParameters.visionCells} × 3 = {draftAgentParameters.visionCells * 3} 维
          </span>
        </label>

        <label className="settings-param-item">
          <span className="settings-param-label">视野范围（像素）</span>
          <div className="settings-param-control">
            <input
              data-testid="vision-range-range"
              type="range"
              min="100"
              max="500"
              step="25"
              value={draftAgentParameters.visionRange}
              onChange={(event) =>
                onDraftAgentParametersChange((current) => ({
                  ...current,
                  visionRange: Number.parseInt(event.target.value, 10)
                }))
              }
              className="settings-param-slider"
            />
            <input
              data-testid="vision-range-input"
              type="number"
              min="100"
              max="500"
              step="25"
              value={draftAgentParameters.visionRange}
              onChange={(event) =>
                onDraftAgentParametersChange((current) => ({
                  ...current,
                  visionRange: Number.parseInt(event.target.value, 10)
                }))
              }
              className="settings-param-input"
            />
          </div>
          <span className="settings-param-description">智能体能够感知到的最大距离。</span>
        </label>

        <label className="settings-param-item">
          <span className="settings-param-label">视野角度（度）</span>
          <div className="settings-param-control">
            <input
              data-testid="vision-angle-range"
              type="range"
              min="30"
              max="180"
              step="5"
              value={draftAgentParameters.visionAngle}
              onChange={(event) =>
                onDraftAgentParametersChange((current) => ({
                  ...current,
                  visionAngle: Number.parseInt(event.target.value, 10)
                }))
              }
              className="settings-param-slider"
            />
            <input
              data-testid="vision-angle-input"
              type="number"
              min="30"
              max="180"
              step="5"
              value={draftAgentParameters.visionAngle}
              onChange={(event) =>
                onDraftAgentParametersChange((current) => ({
                  ...current,
                  visionAngle: Number.parseInt(event.target.value, 10)
                }))
              }
              className="settings-param-input"
            />
          </div>
          <span className="settings-param-description">智能体的视野扇形角度范围。</span>
        </label>
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="settings-action-button secondary"
          data-testid="agent-params-reset-defaults"
          onClick={onResetDefaults}
        >
          重置默认值
        </button>
        <button
          type="button"
          className="settings-action-button"
          data-testid="agent-params-apply"
          onClick={onApply}
        >
          应用设置
        </button>
      </div>
    </div>
  );

  return (
    <div className="settings-layout" data-testid="settings-panel">
      <aside className="settings-sidebar" data-testid="settings-sidebar">
        <button
          type="button"
          className={`settings-sidebar-item ${settingsSection === 'agent-parameters' ? 'active' : ''}`}
          data-testid="settings-nav-agent-parameters"
          aria-pressed={settingsSection === 'agent-parameters'}
          onClick={() => onSettingsSectionChange('agent-parameters')}
        >
          智能体参数
        </button>
        <button
          type="button"
          className={`settings-sidebar-item ${settingsSection === 'keyboard-inputs' ? 'active' : ''}`}
          data-testid="settings-nav-keyboard-inputs"
          aria-pressed={settingsSection === 'keyboard-inputs'}
          onClick={() => onSettingsSectionChange('keyboard-inputs')}
        >
          键盘输入说明
        </button>
      </aside>
      <div className="settings-content">
        {settingsSection === 'agent-parameters' ? renderAgentParameters() : renderKeyboardInputGuide()}
      </div>
    </div>
  );
};

export default SettingsPanel;
