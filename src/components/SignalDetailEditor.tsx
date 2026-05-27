import React, { useEffect, useState } from 'react';

interface SignalDetail {
  id: string;
  label: string;
  direction: 'input' | 'output';
  source?: string;
  target?: string;
  scale?: number;
  decayPerSecond?: number;
}

interface SignalDetailEditorProps {
  signal: SignalDetail;
  onUpdate: (nextSignal: SignalDetail) => void;
}

const SignalDetailEditor: React.FC<SignalDetailEditorProps> = ({ signal, onUpdate }) => {
  const [label, setLabel] = useState(signal.label);
  const [source, setSource] = useState(signal.source ?? '');
  const [target, setTarget] = useState(signal.target ?? '');
  const [scale, setScale] = useState(String(signal.scale ?? 1));
  const [decayPerSecond, setDecayPerSecond] = useState(String(signal.decayPerSecond ?? 4));

  useEffect(() => {
    setLabel(signal.label);
    setSource(signal.source ?? '');
    setTarget(signal.target ?? '');
    setScale(String(signal.scale ?? 1));
    setDecayPerSecond(String(signal.decayPerSecond ?? 4));
  }, [signal]);

  const emit = (patch: Partial<SignalDetail>) => {
    const next = {
      ...signal,
      label,
      source,
      target,
      scale: Number(scale),
      decayPerSecond: Number(decayPerSecond),
      ...patch,
    };
    onUpdate(next);
  };

  return (
    <div className="topology-detail-editor">
      <div className="topology-detail-section">
        <label className="topology-detail-label" htmlFor="signal-label-input">
          节点标签
        </label>
        <input
          id="signal-label-input"
          data-testid="signal-label-input"
          className="topology-detail-input"
          type="text"
          value={label}
          onChange={(event) => {
            const next = event.target.value;
            setLabel(next);
            emit({ label: next });
          }}
        />
      </div>

      {signal.direction === 'input' ? (
        <>
          <div className="topology-detail-section">
            <label className="topology-detail-label" htmlFor="signal-source-input">
              source 规则
            </label>
            <input
              id="signal-source-input"
              data-testid="signal-source-input"
              className="topology-detail-input"
              type="text"
              value={source}
              onChange={(event) => {
                const next = event.target.value;
                setSource(next);
                emit({ source: next });
              }}
            />
          </div>
          <div className="topology-detail-section">
            <label className="topology-detail-label" htmlFor="signal-scale-input">
              scale
            </label>
            <input
              id="signal-scale-input"
              data-testid="signal-scale-input"
              className="topology-detail-input"
              type="number"
              step="0.1"
              value={scale}
              onChange={(event) => {
                const next = event.target.value;
                setScale(next);
                emit({ scale: Number(next) });
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="topology-detail-section">
            <label className="topology-detail-label" htmlFor="signal-target-input">
              target 规则
            </label>
            <input
              id="signal-target-input"
              data-testid="signal-target-input"
              className="topology-detail-input"
              type="text"
              value={target}
              onChange={(event) => {
                const next = event.target.value;
                setTarget(next);
                emit({ target: next });
              }}
            />
          </div>
          <div className="topology-detail-section">
            <label className="topology-detail-label" htmlFor="signal-decay-input">
              decayPerSecond
            </label>
            <input
              id="signal-decay-input"
              data-testid="signal-decay-input"
              className="topology-detail-input"
              type="number"
              step="0.1"
              value={decayPerSecond}
              onChange={(event) => {
                const next = event.target.value;
                setDecayPerSecond(next);
                emit({ decayPerSecond: Number(next) });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default SignalDetailEditor;
