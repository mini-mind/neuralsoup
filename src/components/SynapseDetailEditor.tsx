import React, { useEffect, useState } from 'react';

interface InspectorSynapse {
  id: string;
  from: string;
  to: string;
  weight: number;
}

interface SynapseDetailEditorProps {
  synapse: InspectorSynapse;
  onUpdate: (updatedSynapse: InspectorSynapse) => void;
}

const SynapseDetailEditor: React.FC<SynapseDetailEditorProps> = ({ synapse, onUpdate }) => {
  const [weight, setWeight] = useState(synapse.weight);

  useEffect(() => {
    setWeight(synapse.weight);
  }, [synapse.id, synapse.weight]);

  const handleWeightChange = (nextWeight: number) => {
    setWeight(nextWeight);
    onUpdate({
      ...synapse,
      weight: nextWeight,
    });
  };

  return (
    <div className="topology-detail-editor">
      <div className="topology-detail-copy">
        当前 inspector 修改的是 GraphIRDocument `LeafLink.weight`。
      </div>

      <div className="topology-detail-section">
        <div className="topology-detail-label">连接</div>
        <div className="topology-detail-copy">
          {synapse.from} -&gt; {synapse.to}
        </div>
      </div>

      <div className="topology-detail-section">
        <label className="topology-detail-label" htmlFor="synapse-weight-input">
          权重
        </label>
        <input
          id="synapse-weight-input"
          data-testid="synapse-weight-input"
          className="topology-detail-input"
          type="number"
          step="0.01"
          value={weight}
          onChange={(event) => handleWeightChange(Number.parseFloat(event.target.value) || 0)}
        />
      </div>
    </div>
  );
};

export default SynapseDetailEditor;
