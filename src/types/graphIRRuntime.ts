import type { GraphIRDocument, GraphIRDocumentSummary, GraphIRValidationIssue } from '../domain/brain';

export type GraphIRRuntimeStatus =
  | {
      state: 'applied';
      appliedDocument: GraphIRDocument;
      appliedSummary: GraphIRDocumentSummary;
      issues: [];
      message: null;
    }
  | {
      state: 'invalid';
      appliedDocument: GraphIRDocument;
      appliedSummary: GraphIRDocumentSummary;
      issues: GraphIRValidationIssue[];
      message: string;
    };
