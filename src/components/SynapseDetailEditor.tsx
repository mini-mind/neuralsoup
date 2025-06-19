import React, { useState } from 'react';
import { SNNSynapse } from '../types/simulation';

interface SynapseDetailEditorProps {
  synapse: SNNSynapse;
  onUpdate: (updatedSynapse: SNNSynapse) => void;
}

const SynapseDetailEditor: React.FC<SynapseDetailEditorProps> = ({ synapse, onUpdate }) => {
  const [weight, setWeight] = useState(synapse.weight);
  const [delay, setDelay] = useState(synapse.delay);

  const handleWeightChange = (newWeight: number) => {
    setWeight(newWeight);
    const updatedSynapse = {
      ...synapse,
      weight: newWeight
    };
    onUpdate(updatedSynapse);
  };

  const handleDelayChange = (newDelay: number) => {
    setDelay(newDelay);
    const updatedSynapse = {
      ...synapse,
      delay: newDelay
    };
    onUpdate(updatedSynapse);
  };

  return (
    <div style={{ padding: '0' }}>
      <div style={{ marginBottom: '16px' }}>
        <h6 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>突触连接信息:</h6>
        <div style={{ fontSize: '0.85rem', color: '#495057' }}>
          <p style={{ margin: '4px 0' }}>连接ID: <strong>{synapse.id}</strong></p>
          <p style={{ margin: '4px 0' }}>源节点: <strong>{synapse.from}</strong></p>
          <p style={{ margin: '4px 0' }}>目标节点: <strong>{synapse.to}</strong></p>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px' }}>
          连接权重: {weight.toFixed(3)}
        </label>
        <input
          type="range"
          min="-2"
          max="2"
          step="0.01"
          value={weight}
          onChange={(e) => handleWeightChange(parseFloat(e.target.value))}
          style={{ width: '100%', marginBottom: '8px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6c757d' }}>
          <span>抑制性 (-2)</span>
          <span>无效果 (0)</span>
          <span>兴奋性 (+2)</span>
        </div>
        
        <div style={{ marginTop: '8px' }}>
          <input
            type="number"
            step="0.001"
            min="-5"
            max="5"
            value={weight}
            onChange={(e) => handleWeightChange(parseFloat(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '0.85rem'
            }}
            placeholder="精确数值输入"
          />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px' }}>
          传导延迟: {delay.toFixed(1)} ms
        </label>
        <input
          type="range"
          min="0.1"
          max="10"
          step="0.1"
          value={delay}
          onChange={(e) => handleDelayChange(parseFloat(e.target.value))}
          style={{ width: '100%', marginBottom: '8px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6c757d' }}>
          <span>即时 (0.1ms)</span>
          <span>中等 (5ms)</span>
          <span>缓慢 (10ms)</span>
        </div>
        
        <div style={{ marginTop: '8px' }}>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="50"
            value={delay}
            onChange={(e) => handleDelayChange(parseFloat(e.target.value) || 0.1)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '0.85rem'
            }}
            placeholder="精确延迟输入"
          />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h6 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>突触类型:</h6>
        <div style={{ 
          padding: '8px', 
          borderRadius: '4px', 
          background: weight > 0 ? 'rgba(39, 174, 96, 0.1)' : weight < 0 ? 'rgba(231, 76, 60, 0.1)' : 'rgba(149, 165, 166, 0.1)',
          border: `1px solid ${weight > 0 ? '#27ae60' : weight < 0 ? '#e74c3c' : '#95a5a6'}`,
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: weight > 0 ? '#27ae60' : weight < 0 ? '#e74c3c' : '#95a5a6'
        }}>
          {weight > 0 ? '兴奋性突触' : weight < 0 ? '抑制性突触' : '无效突触'}
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#6c757d', lineHeight: 1.3 }}>
        <strong>突触说明:</strong><br/>
        • 权重 &gt; 0: 兴奋性连接，增强目标神经元活动<br/>
        • 权重 &lt; 0: 抑制性连接，抑制目标神经元活动<br/>
        • 延迟: 脉冲从源神经元传导到目标神经元的时间<br/>
        • 较大的权重值产生更强的影响
      </div>
    </div>
  );
};

export default SynapseDetailEditor; 