import React from 'react';
import type { SimulationLifecycleState } from '../../engine/SimulationEngine';
import type { EditorTab, GraphPathItem } from './types';
import './EditorPanels.css';

interface EditorToolbarProps {
  editorTab: EditorTab;
  graphPath: GraphPathItem[];
  runState: SimulationLifecycleState;
  onEditorTabChange: (nextTab: EditorTab) => void;
  onGraphPathNavigate: (pathId: string) => void;
  onStartPause: () => void;
  onReset: () => void;
}

const MAX_VISIBLE_PATH_ITEMS = 3;

const getVisibleGraphPath = (graphPath: GraphPathItem[]): Array<GraphPathItem | { id: '__ellipsis__'; label: string }> => {
  if (graphPath.length <= MAX_VISIBLE_PATH_ITEMS) {
    return graphPath;
  }

  return [
    { id: '__ellipsis__', label: '…' },
    ...graphPath.slice(-(MAX_VISIBLE_PATH_ITEMS - 1)),
  ];
};

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editorTab,
  graphPath,
  runState,
  onEditorTabChange,
  onGraphPathNavigate,
  onStartPause,
  onReset
}) => {
  const startPauseLabel =
    runState === 'idle' ? '开始（Space）' : runState === 'paused' ? '继续（Space）' : '暂停（Space）';
  const visibleGraphPath = getVisibleGraphPath(graphPath);

  return (
    <div className="tab-strip">
      <div className="tab-strip-left">
        <button
          type="button"
          className={`tab-strip-tab tab-strip-icon-tab ${editorTab === 'settings' ? 'active' : ''}`}
          data-testid="editor-tab-settings"
          title="设置"
          aria-label="设置"
          aria-pressed={editorTab === 'settings'}
          onClick={() => onEditorTabChange('settings')}
        >
          ⚙
        </button>
        <div
          className={`tab-strip-path-tab ${editorTab === 'graph' ? 'active' : ''}`}
          data-testid="editor-tab-graph"
          role="tab"
          aria-selected={editorTab === 'graph'}
        >
          {visibleGraphPath.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <span className="tab-strip-path-separator">/</span>}
              {'id' in item && item.id === '__ellipsis__' ? (
                <span className="tab-strip-path-ellipsis">{item.label}</span>
              ) : (
                <button
                  type="button"
                  className={`tab-strip-path-segment ${
                    index === visibleGraphPath.length - 1 ? 'is-current' : ''
                  }`}
                  data-testid={
                    item.id === 'root' ? 'topology-breadcrumb-root' : `topology-breadcrumb-${item.id}`
                  }
                  aria-current={index === visibleGraphPath.length - 1 ? 'page' : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditorTabChange('graph');
                    if (index !== visibleGraphPath.length - 1) {
                      onGraphPathNavigate(item.id);
                    }
                  }}
                >
                  {item.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
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
