import React from 'react';
import type { SimulationLifecycleState } from '../../engine/SimulationEngine';
import type { EditorTab } from './types';
import './EditorPanels.css';

interface EditorToolbarProps {
  editorTab: EditorTab;
  runState: SimulationLifecycleState;
  onEditorTabChange: (nextTab: EditorTab) => void;
  onStartPause: () => void;
  onReset: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editorTab,
  runState,
  onEditorTabChange,
  onStartPause,
  onReset
}) => {
  const startPauseLabel =
    runState === 'idle' ? '开始（Space）' : runState === 'paused' ? '继续（Space）' : '暂停（Space）';

  return (
    <div className="tab-strip">
      <div className="tab-strip-left">
        <button
          type="button"
          className={`tab-strip-tab ${editorTab === 'settings' ? 'active' : ''}`}
          data-testid="editor-tab-settings"
          aria-pressed={editorTab === 'settings'}
          onClick={() => onEditorTabChange('settings')}
        >
          Settings
        </button>
        <button
          type="button"
          className={`tab-strip-tab ${editorTab === 'graph' ? 'active' : ''}`}
          data-testid="editor-tab-graph"
          aria-pressed={editorTab === 'graph'}
          onClick={() => onEditorTabChange('graph')}
        >
          GraphView
        </button>
      </div>
      <div className="tab-button-group">
        <div className="control-buttons">
          <button
            onClick={onStartPause}
            className="tab-icon-button"
            title={startPauseLabel}
            aria-label={startPauseLabel}
            data-testid="start-pause-button"
          >
            {runState === 'running' ? '⏸' : '▶'}
          </button>

          <button
            onClick={onReset}
            className="tab-icon-button"
            title="重置仿真"
            aria-label="重置仿真"
            data-testid="reset-button"
          >
            ↺
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorToolbar;
