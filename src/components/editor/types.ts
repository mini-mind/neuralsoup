export interface AgentParameters {
  visionCells: number;
  visionRange: number;
  visionAngle: number;
}

export interface BodyIRValidationMessage {
  code:
    | 'body-input-node-unmapped'
    | 'body-input-node-multi-mapped'
    | 'body-input-mapping-endpoint-missing'
    | 'body-input-endpoint-source-unsupported'
    | 'body-output-node-unmapped'
    | 'body-output-node-multi-mapped'
    | 'body-output-mapping-endpoint-missing'
    | 'body-output-endpoint-target-unsupported'
    | 'body-output-target-conflict';
  level: 'error' | 'warning' | 'info';
  message: string;
  scope?: 'body' | 'input-endpoint' | 'output-endpoint';
  endpointId?: string;
  endpointIndex?: number;
  nodeId?: string;
  relatedMappingIds?: string[];
  resolved?: string;
  target?: string;
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

export type EditorTab = 'settings' | 'graph';

export type SettingsSection = 'agent-parameters' | 'keyboard-inputs';
