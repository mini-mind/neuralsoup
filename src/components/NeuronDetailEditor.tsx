import React, { useEffect, useState } from 'react';
import type { BrainNeuronInitialState } from '../domain/brain';
import type { IzhikevichNeuronParameters } from '../domain/brain/shared';

interface InspectorNeuron {
  id: string;
  label: string;
  params: IzhikevichNeuronParameters;
  initialState?: BrainNeuronInitialState;
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
    setParams(neuron.params);
    setInitialState(neuron.initialState);
    setInitialStateVInput(neuron.initialState ? String(neuron.initialState.v) : '');
    setInitialStateUInput(neuron.initialState?.u != null ? String(neuron.initialState.u) : '');
    setInitialStateVInvalid(false);
    setInitialStateUInvalid(false);
  }, [neuron.id, neuron.initialState, neuron.label, neuron.params]);

  const emitUpdate = ({
    nextLabel = label,
    nextParams = params,
    nextInitialState = initialState,
  }: {
    nextLabel?: string;
    nextParams?: IzhikevichNeuronParameters;
    nextInitialState?: BrainNeuronInitialState;
  }) => {
    onUpdate({
      ...neuron,
      label: nextLabel,
      params: nextParams,
      initialState: nextInitialState,
    });
  };

  const handleParamChange = (paramName: keyof IzhikevichNeuronParameters, value: number) => {
    const nextParams = { ...params, [paramName]: value };
    setParams(nextParams);
    emitUpdate({ nextParams });
  };

  const handleLabelChange = (nextLabel: string) => {
    setLabel(nextLabel);
    emitUpdate({ nextLabel });
  };

  const handleInitialStateVChange = (rawValue: string) => {
    setInitialStateVInput(rawValue);
    if (!initialState) {
      return;
    }

    const nextV = Number.parseFloat(rawValue);
    if (Number.isNaN(nextV)) {
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

    const nextU = Number.parseFloat(rawValue);
    if (Number.isNaN(nextU)) {
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
        {neuron.description ?? '当前 inspector 修改的是 Brain leaf node 的参数覆盖。'}
      </div>

      {!neuron.readonly && (
        <>
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

          {initialState && (
            <>
              <div className="topology-detail-copy">Initial state 会写入 AgentIR；留空的 u 由 runtime 推导。</div>
              {(initialStateVInvalid || initialStateUInvalid) && (
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
