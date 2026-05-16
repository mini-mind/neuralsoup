export interface AgentParameters {
  visionCells: number;
  visionRange: number;
  visionAngle: number;
}

export type EditorTab = 'settings' | 'graph';

export type SettingsSection = 'agent-parameters' | 'keyboard-inputs';
