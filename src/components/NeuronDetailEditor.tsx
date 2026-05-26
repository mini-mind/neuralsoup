import React, { useEffect, useState } from 'react';
import type { BrainNeuronInitialState } from '../domain/brain';
import type { IzhikevichNeuronParameters } from '../domain/brain/shared';

interface InspectorNeuron {
  id: string;
  label: string;
  neuronModelId?: string;
  parameterOverrides: IzhikevichNeuronParameters;
  initialState?: BrainNeuronInitialState;
  readonly?: boolean;
  description?: string;
}

interface NeuronDetailEditorProps {
  neuron: InspectorNeuron;
  onUpdate: (updatedNeuron: InspectorNeuron) => void;
}

const PARAM_KEYS: Array<keyof IzhikevichNeuronParameters> = ['a', 'b', 'c', 'd', 'threshold'];
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

const NeuronDetailEditor: React.FC<NeuronDetailEditorProps> = ({ neuron, onUpdate }) => {
  const [label, setLabel] = useState(neuron.label);
  const [neuronModelId, setNeuronModelId] = useState(neuron.neuronModelId ?? '');
  const [parameterOverrides, setParameterOverrides] = useState(neuron.parameterOverrides);
  const [parameterOverrideInputs, setParameterOverrideInputs] = useState<Record<keyof IzhikevichNeuronParameters, string>>({
    a: String(neuron.parameterOverrides.a),
    b: String(neuron.parameterOverrides.b),
    c: String(neuron.parameterOverrides.c),
    d: String(neuron.parameterOverrides.d),
    threshold: String(neuron.parameterOverrides.threshold),
  });
  const [parameterOverrideInvalid, setParameterOverrideInvalid] = useState<Record<keyof IzhikevichNeuronParameters, boolean>>({
    a: false,
    b: false,
    c: false,
    d: false,
    threshold: false,
  });
  const [initialState, setInitialState] = useState(neuron.initialState);
  const [initialStateVInput, setInitialStateVInput] = useState(
    neuron.initialState ? String(neuron.initialState.v) : ''
  );
  const [initialStateUInput, setInitialStateUInput] = useState(
    neuron.initialState?.u != null ? String(neuron.initialState.u) : ''
  );
  const [initialStateVInvalid, setInitialStateVInvalid] = useState(false);
  const [initialStateUInvalid, setInitialStateUInvalid] = useState(false);

  useEffect(() => {
    setLabel(neuron.label);
    setNeuronModelId(neuron.neuronModelId ?? '');
    setParameterOverrides(neuron.parameterOverrides);
    setParameterOverrideInputs({
      a: String(neuron.parameterOverrides.a),
      b: String(neuron.parameterOverrides.b),
      c: String(neuron.parameterOverrides.c),
      d: String(neuron.parameterOverrides.d),
      threshold: String(neuron.parameterOverrides.threshold),
    });
    setParameterOverrideInvalid({
      a: false,
      b: false,
      c: false,
      d: false,
      threshold: false,
    });
    setInitialState(neuron.initialState);
    setInitialStateVInput(neuron.initialState ? String(neuron.initialState.v) : '');
    setInitialStateUInput(neuron.initialState?.u != null ? String(neuron.initialState.u) : '');
    setInitialStateVInvalid(false);
    setInitialStateUInvalid(false);
  }, [neuron.id, neuron.initialState, neuron.label, neuron.neuronModelId, neuron.parameterOverrides]);

  const emitUpdate = ({
    nextLabel = label,
    nextNeuronModelId = neuronModelId,
    nextParameterOverrides = parameterOverrides,
    nextInitialState = initialState,
  }: {
    nextLabel?: string;
    nextNeuronModelId?: string;
    nextParameterOverrides?: IzhikevichNeuronParameters;
    nextInitialState?: BrainNeuronInitialState;
  }) => {
    onUpdate({
      ...neuron,
      label: nextLabel,
      neuronModelId: nextNeuronModelId,
      parameterOverrides: nextParameterOverrides,
      initialState: nextInitialState,
    });
  };

  const handleParamChange = (paramName: keyof IzhikevichNeuronParameters, rawValue: string) => {
    setParameterOverrideInputs((current) => ({ ...current, [paramName]: rawValue }));
    const nextValue = parseCommittedNumber(rawValue);
    if (nextValue == null) {
      setParameterOverrideInvalid((current) => ({ ...current, [paramName]: rawValue.trim() !== '' }));
      return;
    }

    setParameterOverrideInvalid((current) => ({ ...current, [paramName]: false }));
    const nextParameterOverrides = { ...parameterOverrides, [paramName]: nextValue };
    setParameterOverrides(nextParameterOverrides);
    emitUpdate({ nextParameterOverrides });
  };

  const handleParamBlur = (paramName: keyof IzhikevichNeuronParameters) => {
    if (!parameterOverrideInvalid[paramName]) {
      return;
    }

    setParameterOverrideInputs((current) => ({
      ...current,
      [paramName]: String(parameterOverrides[paramName]),
    }));
    setParameterOverrideInvalid((current) => ({ ...current, [paramName]: false }));
  };

  const handleLabelChange = (nextLabel: string) => {
    setLabel(nextLabel);
    emitUpdate({ nextLabel });
  };

  const handleNeuronModelIdChange = (nextNeuronModelId: string) => {
    setNeuronModelId(nextNeuronModelId);
    emitUpdate({ nextNeuronModelId });
  };

  const handleInitialStateVChange = (rawValue: string) => {
    setInitialStateVInput(rawValue);
    if (!initialState) {
      return;
    }

    const nextV = parseCommittedNumber(rawValue);
    if (nextV == null) {
      setInitialStateVInvalid(rawValue.trim() !== '');
      return;
    }

    setInitialStateVInvalid(false);
    const nextInitialState = {
      ...initialState,
      v: nextV,
    };
    setInitialState(nextInitialState);
    emitUpdate({ nextInitialState });
  };

  const handleInitialStateUChange = (rawValue: string) => {
    setInitialStateUInput(rawValue);
    if (!initialState) {
      return;
    }

    if (rawValue.trim() === '') {
      setInitialStateUInvalid(false);
      const nextInitialState = { v: initialState.v };
      setInitialState(nextInitialState);
      emitUpdate({ nextInitialState });
      return;
    }

    const nextU = parseCommittedNumber(rawValue);
    if (nextU == null) {
      setInitialStateUInvalid(true);
      return;
    }

    setInitialStateUInvalid(false);
    const nextInitialState = {
      ...initialState,
      u: nextU,
    };
    setInitialState(nextInitialState);
    emitUpdate({ nextInitialState });
  };

  const handleInitialStateVBlur = () => {
    if (!initialState || !initialStateVInvalid) {
      return;
    }

    setInitialStateVInput(String(initialState.v));
    setInitialStateVInvalid(false);
  };

  const handleInitialStateUBlur = () => {
    if (!initialState || !initialStateUInvalid) {
      return;
    }

    setInitialStateUInput(initialState.u != null ? String(initialState.u) : '');
    setInitialStateUInvalid(false);
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
        {neuron.description ?? '当前修改的是该 neuron 实例的 model reference 与 parameter overrides，不会修改 neuron model 模板。'}
      </div>

      {!neuron.readonly && (
        <>
          <div className="topology-detail-section">
            <label className="topology-detail-label" htmlFor="neuron-model-id-input">
              neuronModelId（实例 model reference）
            </label>
            <input
              id="neuron-model-id-input"
              data-testid="neuron-model-id-input"
              className="topology-detail-input"
              type="text"
              value={neuronModelId}
              onChange={(event) => handleNeuronModelIdChange(event.target.value)}
            />
          </div>

          <div className="topology-detail-grid">
            <label className="topology-detail-field">
              <span className="topology-detail-label">override.a</span>
              <input
                data-testid="neuron-override-a-input"
                className="topology-detail-input"
                type="number"
                step="0.001"
                value={parameterOverrideInputs.a}
                aria-invalid={parameterOverrideInvalid.a}
                onChange={(event) => handleParamChange('a', event.target.value)}
                onBlur={() => handleParamBlur('a')}
              />
            </label>
            <label className="topology-detail-field">
              <span className="topology-detail-label">override.b</span>
              <input
                data-testid="neuron-override-b-input"
                className="topology-detail-input"
                type="number"
                step="0.01"
                value={parameterOverrideInputs.b}
                aria-invalid={parameterOverrideInvalid.b}
                onChange={(event) => handleParamChange('b', event.target.value)}
                onBlur={() => handleParamBlur('b')}
              />
            </label>
            <label className="topology-detail-field">
              <span className="topology-detail-label">override.c</span>
              <input
                data-testid="neuron-override-c-input"
                className="topology-detail-input"
                type="number"
                step="1"
                value={parameterOverrideInputs.c}
                aria-invalid={parameterOverrideInvalid.c}
                onChange={(event) => handleParamChange('c', event.target.value)}
                onBlur={() => handleParamBlur('c')}
              />
            </label>
            <label className="topology-detail-field">
              <span className="topology-detail-label">override.d</span>
              <input
                data-testid="neuron-override-d-input"
                className="topology-detail-input"
                type="number"
                step="0.1"
                value={parameterOverrideInputs.d}
                aria-invalid={parameterOverrideInvalid.d}
                onChange={(event) => handleParamChange('d', event.target.value)}
                onBlur={() => handleParamBlur('d')}
              />
            </label>
            <label className="topology-detail-field">
              <span className="topology-detail-label">override.threshold</span>
              <input
                data-testid="neuron-override-threshold-input"
                className="topology-detail-input"
                type="number"
                step="1"
                value={parameterOverrideInputs.threshold}
                aria-invalid={parameterOverrideInvalid.threshold}
                onChange={(event) => handleParamChange('threshold', event.target.value)}
                onBlur={() => handleParamBlur('threshold')}
              />
            </label>
          </div>

          {initialState && (
            <>
              <div className="topology-detail-copy">Initial state 会写入 AgentIR；留空的 u 由 runtime 推导。</div>
              {(initialStateVInvalid || initialStateUInvalid || PARAM_KEYS.some((key) => parameterOverrideInvalid[key])) && (
                <div className="topology-detail-copy">无效数值不会写回 AgentIR；失焦后会恢复到上次有效值。</div>
              )}
              <div className="topology-detail-grid">
                <label className="topology-detail-field">
                  <span className="topology-detail-label">initialState.v</span>
                  <input
                    className="topology-detail-input"
                    data-testid="neuron-initial-state-v-input"
                    type="number"
                    step="0.1"
                    value={initialStateVInput}
                    aria-invalid={initialStateVInvalid}
                    onChange={(event) => handleInitialStateVChange(event.target.value)}
                    onBlur={handleInitialStateVBlur}
                  />
                </label>
                <label className="topology-detail-field">
                  <span className="topology-detail-label">initialState.u</span>
                  <input
                    className="topology-detail-input"
                    data-testid="neuron-initial-state-u-input"
                    type="number"
                    step="0.1"
                    value={initialStateUInput}
                    placeholder="留空时由 runtime 推导"
                    aria-invalid={initialStateUInvalid}
                    onChange={(event) => handleInitialStateUChange(event.target.value)}
                    onBlur={handleInitialStateUBlur}
                  />
                </label>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default NeuronDetailEditor;
