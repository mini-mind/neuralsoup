import React, { useState, useEffect } from 'react';
import { AgentParameters } from './AgentParametersModal';

interface AgentParametersPanelProps {
  currentParams: AgentParameters;
  onApply: (params: AgentParameters) => void;
}

const AgentParametersPanel: React.FC<AgentParametersPanelProps> = ({
  currentParams,
  onApply
}) => {
  const [params, setParams] = useState<AgentParameters>(currentParams);

  // 当外部参数更新时同步本地状态
  useEffect(() => {
    setParams(currentParams);
  }, [currentParams]);

  const handleApply = () => {
    onApply(params);
  };

  const hasChanges = JSON.stringify(params) !== JSON.stringify(currentParams);

  return (
    <div className="agent-params-panel">
      <div className="panel-header">
        <h3>智能体参数设置</h3>
        <button 
          className={`btn ${hasChanges ? 'btn-primary' : 'btn-secondary'}`}
          onClick={handleApply}
          disabled={!hasChanges}
        >
          {hasChanges ? '应用设置' : '已应用'}
        </button>
      </div>
      
      <div className="panel-body">
        <div className="param-section">
          <h4>视觉系统参数</h4>
          
          <div className="param-item">
            <label>
              <span className="param-label">视野单元格数量</span>
              <div className="param-control">
                <input
                  type="range"
                  min="1"
                  max="72"
                  step="1"
                  value={params.visionCells}
                  onChange={(e) => setParams({...params, visionCells: parseInt(e.target.value)})}
                  className="param-slider"
                />
                <input
                  type="number"
                  min="1"
                  max="72"
                  step="1"
                  value={params.visionCells}
                  onChange={(e) => setParams({...params, visionCells: parseInt(e.target.value)})}
                  className="param-input"
                />
              </div>
            </label>
            <div className="param-description">
              影响视觉输入维度: {params.visionCells} × 3 = {params.visionCells * 3}维
            </div>
          </div>

          <div className="param-item">
            <label>
              <span className="param-label">视野范围 (像素)</span>
              <div className="param-control">
                <input
                  type="range"
                  min="100"
                  max="500"
                  step="25"
                  value={params.visionRange}
                  onChange={(e) => setParams({...params, visionRange: parseInt(e.target.value)})}
                  className="param-slider"
                />
                <input
                  type="number"
                  min="100"
                  max="500"
                  step="25"
                  value={params.visionRange}
                  onChange={(e) => setParams({...params, visionRange: parseInt(e.target.value)})}
                  className="param-input"
                />
              </div>
            </label>
            <div className="param-description">
              智能体能够感知到的最大距离
            </div>
          </div>

          <div className="param-item">
            <label>
              <span className="param-label">视野角度 (度)</span>
              <div className="param-control">
                <input
                  type="range"
                  min="30"
                  max="180"
                  step="5"
                  value={params.visionAngle}
                  onChange={(e) => setParams({...params, visionAngle: parseInt(e.target.value)})}
                  className="param-slider"
                />
                <input
                  type="number"
                  min="30"
                  max="180"
                  step="5" 
                  value={params.visionAngle}
                  onChange={(e) => setParams({...params, visionAngle: parseInt(e.target.value)})}
                  className="param-input"
                />
              </div>
            </label>
            <div className="param-description">
              智能体的视野扇形角度范围
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentParametersPanel; 