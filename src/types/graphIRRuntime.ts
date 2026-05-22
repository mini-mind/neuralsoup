import type { GraphIRDocument, GraphIRDocumentSummary, GraphIRValidationIssue } from '../domain/brain';

export interface GraphIRRuntimeActivitySnapshot {
  activeNodeIds: string[];
}

export type GraphIRRuntimeStatus =
  | {
      state: 'applied';
      appliedDocument: GraphIRDocument;
      appliedSummary: GraphIRDocumentSummary;
      issues: [];
      message: null;
      draftSummary?: GraphIRDocumentSummary;
      draftValidationCount?: number;
    }
  | {
      state: 'invalid';
      appliedDocument: GraphIRDocument;
      appliedSummary: GraphIRDocumentSummary;
      issues: GraphIRValidationIssue[];
      message: string;
      draftSummary?: GraphIRDocumentSummary;
      draftValidationCount?: number;
    };
