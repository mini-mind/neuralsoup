import type { BodyIR, BodyInputRule, BodyOutputRule } from './agent-ir';

export interface WorldInputBinding {
  source: string;
  worldPort: string;
  cellIndex?: number;
}

export interface WorldOutputBinding {
  target: string;
  worldPort: string;
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
  enumerateInputNodeIds(rule: BodyInputRule, body: BodyIR): string[];
  enumerateOutputNodeIds(rule: BodyOutputRule, body: BodyIR): string[];
}

const BODY_INPUT_SOURCE_PATTERN = /^vision\.([RGB])\.(\d+)$/;
const BODY_OUTPUT_TARGET_PATTERN = /^action\.([a-z0-9-]+)$/;
const INPUT_CHANNEL_VALUES = ['R', 'G', 'B'] as const;

type SupportedGroupKind = 'channel' | 'cell' | 'alternatives';
type PatternSegment =
  | { type: 'literal'; value: string }
  | { type: 'group'; index: number; kind: SupportedGroupKind; values?: string[] };

const appendLiteralSegment = (segments: PatternSegment[], literal: string) => {
  if (literal.length === 0) {
    return;
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment?.type === 'literal') {
    lastSegment.value += literal;
    return;
  }

  segments.push({ type: 'literal', value: literal });
};

const parseSupportedNodeIdPattern = (pattern: string): PatternSegment[] | null => {
  const anchoredPattern =
    pattern.startsWith('^') && pattern.endsWith('$') ? pattern.slice(1, -1) : pattern;
  const segments: PatternSegment[] = [];
  let cursor = 0;
  let groupIndex = 1;

  while (cursor < anchoredPattern.length) {
    const remaining = anchoredPattern.slice(cursor);

    if (remaining.startsWith('([RGB])')) {
      segments.push({ type: 'group', index: groupIndex, kind: 'channel' });
      groupIndex += 1;
      cursor += '([RGB])'.length;
      continue;
    }

    if (remaining.startsWith('(\\\\d+)') || remaining.startsWith('(\\d+)')) {
      segments.push({ type: 'group', index: groupIndex, kind: 'cell' });
      groupIndex += 1;
      cursor += remaining.startsWith('(\\\\d+)') ? '(\\\\d+)'.length : '(\\d+)'.length;
      continue;
    }

    const current = anchoredPattern[cursor];
    if (!current) {
      break;
    }

    if (current === '(') {
      const closingIndex = anchoredPattern.indexOf(')', cursor);
      if (closingIndex < 0) {
        return null;
      }
      const groupBody = anchoredPattern.slice(cursor + 1, closingIndex);
      if (groupBody.length === 0) {
        return null;
      }
      const values = groupBody.split('|');
      if (values.some((value) => value.length === 0 || value.includes('\\'))) {
        return null;
      }
      segments.push({ type: 'group', index: groupIndex, kind: 'alternatives', values });
      groupIndex += 1;
      cursor = closingIndex + 1;
      continue;
    }

    if (current === '\\') {
      const escaped = anchoredPattern[cursor + 1];
      if (!escaped) {
        return null;
      }

      appendLiteralSegment(segments, escaped);
      cursor += 2;
      continue;
    }

    if ('[]{}+*?|()'.includes(current)) {
      return null;
    }

    appendLiteralSegment(segments, current);
    cursor += 1;
  }

  return segments;
};

const buildNodeIdFromSegments = (
  segments: PatternSegment[],
  valuesByGroupIndex: Map<number, string>
): string | null => {
  let nodeId = '';

  for (const segment of segments) {
    if (segment.type === 'literal') {
      nodeId += segment.value;
      continue;
    }

    const value = valuesByGroupIndex.get(segment.index);
    if (value == null) {
      return null;
    }

    nodeId += value;
  }

  return nodeId;
};

const enumerateVisionInputNodeIds = (rule: BodyInputRule, body: BodyIR): string[] => {
  const templateMatch = rule.sourceTemplate.match(/^vision\.\$(\d+)\.\$(\d+)$/);
  const segments = parseSupportedNodeIdPattern(rule.nodeIdPattern);
  if (!templateMatch || !segments) {
    return [];
  }

  const channelGroupIndex = Number.parseInt(templateMatch[1], 10);
  const cellGroupIndex = Number.parseInt(templateMatch[2], 10);
  const channelGroup = segments.find(
    (segment): segment is Extract<PatternSegment, { type: 'group' }> =>
      segment.type === 'group' && segment.index === channelGroupIndex
  );
  const cellGroup = segments.find(
    (segment): segment is Extract<PatternSegment, { type: 'group' }> =>
      segment.type === 'group' && segment.index === cellGroupIndex
  );

  if (channelGroup?.kind !== 'channel' || cellGroup?.kind !== 'cell') {
    return [];
  }

  const nodeIds = new Set<string>();
  for (let cellIndex = 0; cellIndex < body.visionCellCount; cellIndex += 1) {
    for (const channel of INPUT_CHANNEL_VALUES) {
      const nodeId = buildNodeIdFromSegments(
        segments,
        new Map([
          [channelGroupIndex, channel],
          [cellGroupIndex, String(cellIndex)],
        ])
      );
      if (nodeId) {
        nodeIds.add(nodeId);
      }
    }
  }

  return [...nodeIds];
};

const enumerateActionOutputNodeIds = (rule: BodyOutputRule): string[] => {
  const templateMatch = rule.targetTemplate.match(/^action\.\$(\d+)$/);
  const segments = parseSupportedNodeIdPattern(rule.nodeIdPattern);
  if (!templateMatch || !segments) {
    return [];
  }

  const actionGroupIndex = Number.parseInt(templateMatch[1], 10);
  const actionGroup = segments.find(
    (segment): segment is Extract<PatternSegment, { type: 'group' }> =>
      segment.type === 'group' && segment.index === actionGroupIndex
  );
  if (actionGroup?.kind !== 'alternatives' || !actionGroup.values?.length) {
    return [];
  }

  const nodeIds = new Set<string>();
  for (const action of actionGroup.values) {
    const nodeId = buildNodeIdFromSegments(segments, new Map([[actionGroupIndex, action]]));
    if (nodeId) {
      nodeIds.add(nodeId);
    }
  }

  return [...nodeIds];
};

export const createDefaultWorldRegistry = (): WorldRegistry => ({
  version: 1,
  inputs: [{ id: 'vision', direction: 'input', kind: 'vision-array', enumerable: true }],
  outputs: [{ id: 'action', direction: 'output', kind: 'action-map', enumerable: true }],
  resolveInputBinding: (source) => {
    const match = source.match(BODY_INPUT_SOURCE_PATTERN);
    if (!match) {
      return null;
    }

    const cellIndex = Number.parseInt(match[2], 10);
    return {
      source: `vision.${match[1]}.${cellIndex}`,
      worldPort: 'vision',
      cellIndex,
    };
  },
  resolveOutputBinding: (target) => {
    const match = target.match(BODY_OUTPUT_TARGET_PATTERN);
    if (!match) {
      return null;
    }

    return {
      target: `action.${match[1]}`,
      worldPort: 'action',
    };
  },
  enumerateInputNodeIds: (rule, body) => enumerateVisionInputNodeIds(rule, body),
  enumerateOutputNodeIds: (rule) => enumerateActionOutputNodeIds(rule),
});

let defaultWorldRegistry: WorldRegistry = createDefaultWorldRegistry();

export const getDefaultWorldRegistry = (): WorldRegistry => defaultWorldRegistry;

export const setDefaultWorldRegistryForTests = (registry: WorldRegistry): void => {
  defaultWorldRegistry = registry;
};

export const resetDefaultWorldRegistryForTests = (): void => {
  defaultWorldRegistry = createDefaultWorldRegistry();
};
