export interface AgentParameters {
  visionCells: number;
  visionRange: number;
  visionAngle: number;
}

export interface BodyIRInputRule {
  nodeIdPattern: string;
  sourceTemplate: string;
  scale: number;
}

export interface BodyIROutputRule {
  nodeIdPattern: string;
  targetTemplate: string;
  decayPerSecond: number;
}

export interface BodyIRSettingsValue {
  visionCellCount: number;
  inputRules: BodyIRInputRule[];
  outputRules: BodyIROutputRule[];
}

export interface BodyIRValidationMessage {
  level: 'error' | 'warning' | 'info';
  message: string;
  scope?: 'body' | 'input-rule' | 'output-rule';
  ruleIndex?: number;
}

export interface BodyIRInputPreviewItem {
  nodeId: string;
  resolvedSource: string;
  scale?: number;
  ruleIndex?: number;
}

export interface BodyIROutputPreviewItem {
  nodeId: string;
  resolvedTarget: string;
  decayPerSecond?: number;
  ruleIndex?: number;
}

export interface BodyIRPreviewData {
  summary?: string;
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

export type EditorTab = 'settings' | 'graph';

export type SettingsSection = 'agent-parameters' | 'body-ir' | 'keyboard-inputs';
