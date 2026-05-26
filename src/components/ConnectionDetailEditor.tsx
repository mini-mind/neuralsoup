import React, { useEffect, useState } from 'react';

interface InspectorConnection {
  id: string;
  from: string;
  to: string;
  synapseModelId: string;
  parameterOverrides: {
    weight?: number;
    delayMs?: number;
  };
  resolvedParameters: {
    weight: number;
    delayMs: number;
  };
  defaultParameters: {
    weight: number | null;
    delayMs: number | null;
  };
}

interface ConnectionDetailEditorProps {
  connection: InspectorConnection;
  onUpdate: (updatedConnection: InspectorConnection) => void;
}

const COMPLETE_NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

const parseCommittedNumber = (rawValue: string): number | null => {
  const normalized = rawValue.trim();
  if (!normalized) {
    return null;
  }
  if (!COMPLETE_NUMBER_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveConnectionOverridePayload = ({
  defaultParameters,
  nextWeightValue,
  nextDelayMsValue,
}: {
  defaultParameters: InspectorConnection['defaultParameters'];
  nextWeightValue: number;
  nextDelayMsValue: number;
}) => {
  const normalizedWeightValue = Number.isFinite(nextWeightValue) ? nextWeightValue : 0;
  const normalizedDelayMsValue = Number.isFinite(nextDelayMsValue) ? nextDelayMsValue : 0;
  const nextWeightOverride =
    defaultParameters.weight != null && normalizedWeightValue === defaultParameters.weight ? undefined : normalizedWeightValue;
  const nextDelayMsOverride =
    defaultParameters.delayMs != null && normalizedDelayMsValue === defaultParameters.delayMs ? undefined : normalizedDelayMsValue;

  return {
    resolvedParameters: {
      weight: normalizedWeightValue,
      delayMs: normalizedDelayMsValue,
    },
    parameterOverrides: {
      ...(nextWeightOverride == null ? {} : { weight: nextWeightOverride }),
      ...(nextDelayMsOverride == null ? {} : { delayMs: nextDelayMsOverride }),
    },
  };
};

const ConnectionDetailEditor: React.FC<ConnectionDetailEditorProps> = ({ connection, onUpdate }) => {
  const [synapseModelId, setSynapseModelId] = useState(connection.synapseModelId);
  const [weightValue, setWeightValue] = useState(connection.resolvedParameters.weight);
  const [delayMsValue, setDelayMsValue] = useState(connection.resolvedParameters.delayMs);
  const [weightInput, setWeightInput] = useState(String(connection.resolvedParameters.weight));
  const [delayMsInput, setDelayMsInput] = useState(String(connection.resolvedParameters.delayMs));
  const [weightInvalid, setWeightInvalid] = useState(false);
  const [delayMsInvalid, setDelayMsInvalid] = useState(false);

  useEffect(() => {
    setSynapseModelId(connection.synapseModelId);
    setWeightValue(connection.resolvedParameters.weight);
    setDelayMsValue(connection.resolvedParameters.delayMs);
    setWeightInput(String(connection.resolvedParameters.weight));
    setDelayMsInput(String(connection.resolvedParameters.delayMs));
    setWeightInvalid(false);
    setDelayMsInvalid(false);
  }, [connection.id, connection.resolvedParameters.delayMs, connection.resolvedParameters.weight, connection.synapseModelId]);

  const emitUpdate = ({
    nextSynapseModelId = synapseModelId,
    nextWeightValue = weightValue,
    nextDelayMsValue = delayMsValue,
  }: {
    nextSynapseModelId?: string;
    nextWeightValue?: number;
    nextDelayMsValue?: number;
  }) => {
    const payload = resolveConnectionOverridePayload({
      defaultParameters: connection.defaultParameters,
      nextWeightValue,
      nextDelayMsValue,
    });

    onUpdate({
      ...connection,
      synapseModelId: nextSynapseModelId,
      resolvedParameters: payload.resolvedParameters,
      parameterOverrides: payload.parameterOverrides,
    });
  };

  const handleSynapseModelIdChange = (nextSynapseModelId: string) => {
    setSynapseModelId(nextSynapseModelId);
    emitUpdate({ nextSynapseModelId });
  };

  const handleWeightChange = (rawValue: string) => {
    setWeightInput(rawValue);
    const nextWeightValue = parseCommittedNumber(rawValue);
    if (nextWeightValue == null) {
      setWeightInvalid(rawValue.trim() !== '');
      return;
    }

    setWeightInvalid(false);
    setWeightValue(nextWeightValue);
    emitUpdate({ nextWeightValue });
  };

  const handleDelayMsChange = (rawValue: string) => {
    setDelayMsInput(rawValue);
    const nextDelayMsValue = parseCommittedNumber(rawValue);
    if (nextDelayMsValue == null) {
      setDelayMsInvalid(rawValue.trim() !== '');
      return;
    }

    setDelayMsInvalid(false);
    setDelayMsValue(nextDelayMsValue);
    emitUpdate({ nextDelayMsValue });
  };

  const handleWeightBlur = () => {
    if (!weightInvalid) {
      return;
    }

    setWeightInput(String(weightValue));
    setWeightInvalid(false);
  };

  const handleDelayMsBlur = () => {
    if (!delayMsInvalid) {
      return;
    }

    setDelayMsInput(String(delayMsValue));
    setDelayMsInvalid(false);
  };

  return (
    <div className="topology-detail-editor">
      <div className="topology-detail-copy">
        当前修改的是该 connection 实例的 synapse model reference 与 parameter overrides，不会修改 synapse model 模板。
      </div>
      {(weightInvalid || delayMsInvalid) && (
        <div className="topology-detail-copy">无效数值不会写回 AgentIR；失焦后会恢复到上次有效值。</div>
      )}

      <div className="topology-detail-section">
        <div className="topology-detail-label">连接</div>
        <div className="topology-detail-copy">
          {connection.from} -&gt; {connection.to}
        </div>
      </div>

      <div className="topology-detail-section">
        <label className="topology-detail-label" htmlFor="connection-synapse-model-id-input">
          synapseModelId（实例 model reference）
        </label>
        <input
          id="connection-synapse-model-id-input"
          data-testid="connection-synapse-model-id-input"
          className="topology-detail-input"
          type="text"
          value={synapseModelId}
          onChange={(event) => handleSynapseModelIdChange(event.target.value)}
        />
      </div>

      <div className="topology-detail-section">
        <label className="topology-detail-label" htmlFor="connection-weight-input">
          override.weight
        </label>
        <input
          id="connection-weight-input"
          data-testid="connection-weight-input"
          className="topology-detail-input"
          type="number"
          step="0.01"
          value={weightInput}
          aria-invalid={weightInvalid}
          onChange={(event) => handleWeightChange(event.target.value)}
          onBlur={handleWeightBlur}
        />
      </div>

      <div className="topology-detail-section">
        <label className="topology-detail-label" htmlFor="connection-delayms-input">
          override.delayMs
        </label>
        <input
          id="connection-delayms-input"
          data-testid="connection-delayms-input"
          className="topology-detail-input"
          type="number"
          step="1"
          value={delayMsInput}
          aria-invalid={delayMsInvalid}
          onChange={(event) => handleDelayMsChange(event.target.value)}
          onBlur={handleDelayMsBlur}
        />
      </div>
    </div>
  );
};

export default ConnectionDetailEditor;
