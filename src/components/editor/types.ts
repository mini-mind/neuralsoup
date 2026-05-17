export interface AgentParameters {
  visionCells: number;
  visionRange: number;
  visionAngle: number;
}

export interface GraphPathItem {
  id: string;
  label: string;
}

export type EditorTab = 'settings' | 'graph';

export type SettingsSection = 'agent-parameters' | 'keyboard-inputs';
