import type { BodyInputRule, BodyOutputRule } from './agent-ir';

export interface WorldInputBinding {
  source: string;
  worldPort: string;
  cellIndex?: number;
}

export interface WorldOutputBinding {
  target: string;
  worldPort: string;
  commandKind: string;
}

export interface WorldInputRuleBindingResolution {
  source: string;
  binding: WorldInputBinding | null;
}

export interface WorldOutputRuleBindingResolution {
  target: string;
  binding: WorldOutputBinding | null;
}

export interface WorldPortDescriptor {
  id: string;
  direction: 'input' | 'output';
  kind: string;
  enumerable: boolean;
}

export interface WorldRegistry {
  version: 1;
  inputs: WorldPortDescriptor[];
  outputs: WorldPortDescriptor[];
  resolveInputBinding(source: string): WorldInputBinding | null;
  resolveOutputBinding(target: string): WorldOutputBinding | null;
  resolveInputRuleBinding(rule: BodyInputRule, match: RegExpExecArray): WorldInputRuleBindingResolution;
  resolveOutputRuleBinding(rule: BodyOutputRule, match: RegExpExecArray): WorldOutputRuleBindingResolution;
  enumerateInputNodeIds(rule: BodyInputRule, projectedVisionCellCount: number): string[];
  enumerateOutputNodeIds(rule: BodyOutputRule): string[];
}
