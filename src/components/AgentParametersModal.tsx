import React, { useState } from 'react';
import './AgentParametersModal.css';

interface AgentParametersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (params: AgentParameters) => void;
  currentParams: AgentParameters;
}

export interface AgentParameters {
  visionCells: number;
  visionRange: number;
  visionAngle: number;
}

const AgentParametersModal: React.FC<AgentParametersModalProps> = ({
  isOpen,
  onClose,
  onApply,
  currentParams
}) => {
  const [params, setParams] = useState<AgentParameters>(currentParams);

  const handleApply = () => {
    onApply(params);
    onClose();
  };



  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content agent-params-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>智能体参数设置</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
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

        <div className="modal-footer">
          <div className="footer-buttons">
            <button className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button className="btn btn-primary" onClick={handleApply}>
              应用设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentParametersModal; 