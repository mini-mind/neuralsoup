import type { GraphIRDocumentSummary, GraphIRValidationIssue } from '../domain/brain';

export interface GraphIRRuntimeActivitySnapshot {
  activeNodeIds: string[];
}

export interface GraphIRDraftStatus {
  state: 'structurally-valid' | 'invalid';
  summary: GraphIRDocumentSummary;
  issues: GraphIRValidationIssue[];
  message: string | null;
}

export type GraphIRRuntimeStatus =
  | {
      state: 'applied';
      appliedSummary: GraphIRDocumentSummary;
      issues: [];
      message: null;
    }
  | {
      state: 'invalid';
      appliedSummary: GraphIRDocumentSummary;
      issues: GraphIRValidationIssue[];
      message: string;
    };
