import type { AgentIRSummary, AgentValidationIssue } from '../domain/brain';

export interface AgentRuntimeActivitySnapshot {
  activeNodeIds: string[];
}

export interface AgentDraftStatus {
  state: 'structurally-valid' | 'invalid';
  summary: AgentIRSummary;
  issues: AgentValidationIssue[];
  message: string | null;
}

export type AgentRuntimeStatus =
  | {
      state: 'applied';
      appliedSummary: AgentIRSummary;
      issues: [];
      message: null;
    }
  | {
      state: 'invalid';
      appliedSummary: AgentIRSummary;
      issues: AgentValidationIssue[];
      message: string;
    };

export type GraphIRRuntimeStatus = AgentRuntimeStatus;
export type GraphIRDraftStatus = AgentDraftStatus;
export type GraphIRRuntimeActivitySnapshot = AgentRuntimeActivitySnapshot;
