import React, { useState } from 'react';
import { SNNNode } from '../types/simulation';

interface NeuronDetailEditorProps {
  neuron: SNNNode;
  onUpdate: (updatedNeuron: SNNNode) => void;
}

const NeuronDetailEditor: React.FC<NeuronDetailEditorProps> = ({ neuron, onUpdate }) => {
  const [label, setLabel] = useState(neuron.label);
  const [params, setParams] = useState(neuron.params || { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 });

  const handleParamChange = (paramName: keyof typeof params, value: number) => {
    const newParams = { ...params, [paramName]: value };
    setParams(newParams);
    
    const updatedNeuron = {
      ...neuron,
      label,
      params: newParams
    };
    onUpdate(updatedNeuron);
  };

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel);
    const updatedNeuron = {
      ...neuron,
      label: newLabel,
      params
    };
    onUpdate(updatedNeuron);
  };

  return (
    <div style={{ padding: '0' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '4px' }}>
          神经元标签:
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '0.85rem'
          }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h6 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>当前状态:</h6>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
          <div>膜电位: <strong>{neuron.state?.v.toFixed(2) || 'N/A'} mV</strong></div>
          <div>恢复变量: <strong>{neuron.state?.u.toFixed(2) || 'N/A'}</strong></div>
          <div>发放状态: <strong>{neuron.state?.spike ? '发放中' : '静息'}</strong></div>
          <div>最后发放: <strong>{neuron.state?.lastSpikeTime.toFixed(1) || 'N/A'} ms</strong></div>
        </div>
      </div>

      <div>
        <h6 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>IZ神经元参数:</h6>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#6c757d', marginBottom: '4px' }}>
              恢复参数 (a):
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              max="1"
              value={params.a}
              onChange={(e) => handleParamChange('a', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '4px 6px',
                border: '1px solid #ced4da',
                borderRadius: '3px',
                fontSize: '0.8rem'
              }}
            />
          </div>

          <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#6c757d', marginBottom: '4px' }}>
              敏感度参数 (b):
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={params.b}
              onChange={(e) => handleParamChange('b', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '4px 6px',
                border: '1px solid #ced4da',
                borderRadius: '3px',
                fontSize: '0.8rem'
              }}
            />
          </div>

          <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#6c757d', marginBottom: '4px' }}>
              重置电位 (c):
            </label>
            <input
              type="number"
              step="1"
              min="-100"
              max="0"
              value={params.c}
              onChange={(e) => handleParamChange('c', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '4px 6px',
                border: '1px solid #ced4da',
                borderRadius: '3px',
                fontSize: '0.8rem'
              }}
            />
          </div>

          <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#6c757d', marginBottom: '4px' }}>
              重置恢复 (d):
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="20"
              value={params.d}
              onChange={(e) => handleParamChange('d', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '4px 6px',
                border: '1px solid #ced4da',
                borderRadius: '3px',
                fontSize: '0.8rem'
              }}
            />
          </div>

          <div style={{ background: '#f8f9fa', padding: '8px', borderRadius: '4px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#6c757d', marginBottom: '4px' }}>
              发放阈值:
            </label>
            <input
              type="number"
              step="1"
              min="10"
              max="50"
              value={params.threshold}
              onChange={(e) => handleParamChange('threshold', parseFloat(e.target.value) || 30)}
              style={{
                width: '100%',
                padding: '4px 6px',
                border: '1px solid #ced4da',
                borderRadius: '3px',
                fontSize: '0.8rem'
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: '16px', fontSize: '0.75rem', color: '#6c757d', lineHeight: 1.3 }}>
        <strong>参数说明:</strong><br/>
        • a: 恢复速度 (0.02=常规, 0.1=快速)<br/>
        • b: u对v的敏感度 (0.2=常规)<br/>
        • c: 发放后重置的膜电位 (-65=常规)<br/>
        • d: 发放后u的增量 (8=常规, 2=爆发型)
      </div>
    </div>
  );
};

export default NeuronDetailEditor; 