import type { BrainGraph, BrainGraphValidationIssue } from '../domain/brain';

export type BrainGraphRuntimeStatus =
  | {
      state: 'applied';
      appliedGraph: BrainGraph;
      issues: [];
      message: null;
    }
  | {
      state: 'invalid';
      appliedGraph: BrainGraph;
      issues: BrainGraphValidationIssue[];
      message: string;
    };
