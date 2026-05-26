export interface AgentParameters {
  visionCells: number;
  visionRange: number;
  visionAngle: number;
}

export interface BodyIRValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
  scope?: 'body' | 'input-endpoint' | 'output-endpoint';
  endpointId?: string;
  endpointIndex?: number;
}

export interface BodyIRInputPreviewItem {
  endpointId?: string;
  nodeId: string;
  resolvedSource: string;
  scale?: number;
  endpointIndex?: number;
}

export interface BodyIROutputPreviewItem {
  endpointId?: string;
  nodeId: string;
  resolvedTarget: string;
  decayPerSecond?: number;
  endpointIndex?: number;
}

export interface BodyIRPreviewData {
  canonicalSummary?: string;
  compiledSummary?: string;
  inputMatches?: BodyIRInputPreviewItem[];
  outputMatches?: BodyIROutputPreviewItem[];
}

export interface BodyIRDraftStatus {
  hasChanges: boolean;
}

export interface GraphPathItem {
  id: string;
  label: string;
}

export type EditorTab = 'settings' | 'graph' | 'body';

export type SettingsSection = 'agent-parameters' | 'keyboard-inputs';
