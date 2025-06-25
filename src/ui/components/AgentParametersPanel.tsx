import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { AgentParameters } from "./AgentParametersModal";

interface AgentParametersPanelProps {
  currentParams: AgentParameters;
  onApply: (params: AgentParameters) => void;
}

const AgentParametersPanel: React.FC<AgentParametersPanelProps> = ({
  currentParams,
  onApply,
}) => {
  const { t } = useLanguage();
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
        <h3>{t('agent.title')}</h3>
        <button
          className={`btn ${hasChanges ? "btn-primary" : "btn-secondary"}`}
          onClick={handleApply}
          disabled={!hasChanges}
        >
          {hasChanges ? t('btn.apply') : t('btn.applied')}
        </button>
      </div>

      <div className="panel-body">
        <div className="param-section">
          <h4>{t('agent.vision-system')}</h4>

          <div className="param-item">
            <label>
              <span className="param-label">{t('agent.vision-cells')}</span>
              <div className="param-control">
                <input
                  type="range"
                  min="1"
                  max="72"
                  step="1"
                  value={params.visionCells}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      visionCells: parseInt(e.target.value),
                    })
                  }
                  className="param-slider"
                />
                <input
                  type="number"
                  min="1"
                  max="72"
                  step="1"
                  value={params.visionCells}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      visionCells: parseInt(e.target.value),
                    })
                  }
                  className="param-input"
                />
              </div>
            </label>
            <div className="param-description">
              {t('agent.vision-desc-cells')}: {params.visionCells} × 3 ={" "}
              {params.visionCells * 3}{t('agent.dimension-unit')}
            </div>
          </div>

          <div className="param-item">
            <label>
              <span className="param-label">{t('agent.vision-range')}</span>
              <div className="param-control">
                <input
                  type="range"
                  min="100"
                  max="500"
                  step="25"
                  value={params.visionRange}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      visionRange: parseInt(e.target.value),
                    })
                  }
                  className="param-slider"
                />
                <input
                  type="number"
                  min="100"
                  max="500"
                  step="25"
                  value={params.visionRange}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      visionRange: parseInt(e.target.value),
                    })
                  }
                  className="param-input"
                />
              </div>
            </label>
            <div className="param-description">{t('agent.vision-desc-range')}</div>
          </div>

          <div className="param-item">
            <label>
              <span className="param-label">{t('agent.vision-angle')}</span>
              <div className="param-control">
                <input
                  type="range"
                  min="30"
                  max="180"
                  step="5"
                  value={params.visionAngle}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      visionAngle: parseInt(e.target.value),
                    })
                  }
                  className="param-slider"
                />
                <input
                  type="number"
                  min="30"
                  max="180"
                  step="5"
                  value={params.visionAngle}
                  onChange={(e) =>
                    setParams({
                      ...params,
                      visionAngle: parseInt(e.target.value),
                    })
                  }
                  className="param-input"
                />
              </div>
            </label>
            <div className="param-description">{t('agent.vision-desc-angle')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentParametersPanel;
