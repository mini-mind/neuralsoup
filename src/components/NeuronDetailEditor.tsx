import React, { useEffect, useState } from 'react';
import type { IzhikevichNeuronParameters } from '../domain/brain/shared';

interface InspectorNeuron {
  id: string;
  label: string;
  params: IzhikevichNeuronParameters;
  readonly?: boolean;
  description?: string;
}

interface NeuronDetailEditorProps {
  neuron: InspectorNeuron;
  onUpdate: (updatedNeuron: InspectorNeuron) => void;
}

const NeuronDetailEditor: React.FC<NeuronDetailEditorProps> = ({ neuron, onUpdate }) => {
  const [label, setLabel] = useState(neuron.label);
  const [params, setParams] = useState(neuron.params);

  useEffect(() => {
    setLabel(neuron.label);
    setParams(neuron.params);
  }, [neuron.id, neuron.label, neuron.params]);

  const handleParamChange = (paramName: keyof IzhikevichNeuronParameters, value: number) => {
    const nextParams = { ...params, [paramName]: value };
    setParams(nextParams);
    onUpdate({
      ...neuron,
      label,
      params: nextParams,
    });
  };

  const handleLabelChange = (nextLabel: string) => {
    setLabel(nextLabel);
    onUpdate({
      ...neuron,
      label: nextLabel,
      params,
    });
  };

  return (
    <div className="topology-detail-editor">
      <div className="topology-detail-section">
        <label className="topology-detail-label" htmlFor="neuron-label-input">
          节点标签
        </label>
        <input
          id="neuron-label-input"
          data-testid="neuron-label-input"
          className="topology-detail-input"
          type="text"
          value={label}
          onChange={(event) => handleLabelChange(event.target.value)}
        />
      </div>

      <div className="topology-detail-copy">
        {neuron.description ?? '当前 inspector 修改的是 Brain leaf node 的参数覆盖。'}
      </div>

      {!neuron.readonly && (
        <div className="topology-detail-grid">
          <label className="topology-detail-field">
            <span className="topology-detail-label">a</span>
            <input
              className="topology-detail-input"
              type="number"
              step="0.001"
              value={params.a}
              onChange={(event) => handleParamChange('a', Number.parseFloat(event.target.value) || 0)}
            />
          </label>
          <label className="topology-detail-field">
            <span className="topology-detail-label">b</span>
            <input
              className="topology-detail-input"
              type="number"
              step="0.01"
              value={params.b}
              onChange={(event) => handleParamChange('b', Number.parseFloat(event.target.value) || 0)}
            />
          </label>
          <label className="topology-detail-field">
            <span className="topology-detail-label">c</span>
            <input
              className="topology-detail-input"
              type="number"
              step="1"
              value={params.c}
              onChange={(event) => handleParamChange('c', Number.parseFloat(event.target.value) || 0)}
            />
          </label>
          <label className="topology-detail-field">
            <span className="topology-detail-label">d</span>
            <input
              className="topology-detail-input"
              type="number"
              step="0.1"
              value={params.d}
              onChange={(event) => handleParamChange('d', Number.parseFloat(event.target.value) || 0)}
            />
          </label>
          <label className="topology-detail-field">
            <span className="topology-detail-label">threshold</span>
            <input
              className="topology-detail-input"
              type="number"
              step="1"
              value={params.threshold}
              onChange={(event) => handleParamChange('threshold', Number.parseFloat(event.target.value) || 0)}
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default NeuronDetailEditor;
