import React, { useEffect, useState } from 'react';

interface InspectorConnection {
  id: string;
  from: string;
  to: string;
  weight: number;
}

interface ConnectionDetailEditorProps {
  connection: InspectorConnection;
  onUpdate: (updatedConnection: InspectorConnection) => void;
}

const ConnectionDetailEditor: React.FC<ConnectionDetailEditorProps> = ({ connection, onUpdate }) => {
  const [weight, setWeight] = useState(connection.weight);

  useEffect(() => {
    setWeight(connection.weight);
  }, [connection.id, connection.weight]);

  const handleWeightChange = (nextWeight: number) => {
    setWeight(nextWeight);
    onUpdate({
      ...connection,
      weight: nextWeight,
    });
  };

  return (
    <div className="topology-detail-editor">
      <div className="topology-detail-copy">
        当前 inspector 修改的是 Brain leaf connection 的权重。
      </div>

      <div className="topology-detail-section">
        <div className="topology-detail-label">连接</div>
        <div className="topology-detail-copy">
          {connection.from} -&gt; {connection.to}
        </div>
      </div>

      <div className="topology-detail-section">
        <label className="topology-detail-label" htmlFor="connection-weight-input">
          权重
        </label>
        <input
          id="connection-weight-input"
          data-testid="connection-weight-input"
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

export default ConnectionDetailEditor;
