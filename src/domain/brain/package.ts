import type { BrainInputChannel, BrainOutputChannel, Position } from './shared';
import type { GraphIRDocument } from './ir';

export type BrainDefinition = GraphIRDocument;

export interface BrainMetadata {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrainLayoutNodeState {
  position?: Position;
  collapsed?: boolean;
}

export interface BrainLayoutDocument {
  version: 1;
  nodes: Record<string, BrainLayoutNodeState>;
}

export interface BodyInputSignal {
  id: string;
  source: {
    kind: 'vision-cell';
    channel: BrainInputChannel;
    cellIndex: number;
  };
}

export interface BodyOutputSignal {
  id: string;
  target: {
    kind: 'action-channel';
    channel: BrainOutputChannel;
  };
}

export interface BodyInputBinding {
  bodySignalId: string;
  brainSignalNodeId: string;
}

export interface BodyOutputBinding {
  brainSignalNodeId: string;
  bodySignalId: string;
}

export interface BodyDefinition {
  version: 1;
  inputSignals: BodyInputSignal[];
  outputSignals: BodyOutputSignal[];
  brainBindings: {
    inputs: BodyInputBinding[];
    outputs: BodyOutputBinding[];
  };
}

export interface BrainPackage {
  packageVersion: 1;
  metadata: BrainMetadata;
  definition: BrainDefinition;
  layout: BrainLayoutDocument;
  body: BodyDefinition;
}

const INPUT_CHANNELS: BrainInputChannel[] = ['R', 'G', 'B'];
const OUTPUT_CHANNELS: BrainOutputChannel[] = ['turn-left', 'move-forward', 'turn-right'];

const createBrainPackageId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `brain-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const collectLayoutNodes = (nodes: BrainDefinition['root']['children'], layout: BrainLayoutDocument['nodes']): void => {
  for (const node of nodes) {
    const collapsed = 'collapsed' in node ? node.collapsed : undefined;
    if (node.position || collapsed !== undefined) {
      layout[node.id] = {
        position: node.position ? { ...node.position } : undefined,
        collapsed,
      };
    }

    if ('children' in node) {
      collectLayoutNodes(node.children, layout);
    }
  }
};

const getRootInputAdapterVisionCells = (definition: BrainDefinition): number => {
  const inputAdapter = definition.root.children.find((node) => node.id === 'input-adapter' && node.kind === 'adapter');
  return inputAdapter?.kind === 'adapter'
    ? Math.floor(
        inputAdapter.children.filter((child) => child.kind === 'signal' && child.direction === 'input').length /
          INPUT_CHANNELS.length
      )
    : 0;
};

export const createBrainLayoutFromDefinition = (definition: BrainDefinition): BrainLayoutDocument => {
  const nodes: BrainLayoutDocument['nodes'] = {};
  collectLayoutNodes(definition.root.children, nodes);
  return {
    version: 1,
    nodes,
  };
};

export const createDefaultBodyDefinition = (visionCells: number): BodyDefinition => ({
  version: 1,
  inputSignals: INPUT_CHANNELS.flatMap((channel) =>
    Array.from({ length: visionCells }, (_, cellIndex) => ({
      id: `vision-${channel.toLowerCase()}-${cellIndex}`,
      source: {
        kind: 'vision-cell' as const,
        channel,
        cellIndex,
      },
    }))
  ),
  outputSignals: OUTPUT_CHANNELS.map((channel) => ({
    id: `motor-${channel}`,
    target: {
      kind: 'action-channel' as const,
      channel,
    },
  })),
  brainBindings: {
    inputs: INPUT_CHANNELS.flatMap((channel) =>
      Array.from({ length: visionCells }, (_, cellIndex) => ({
        bodySignalId: `vision-${channel.toLowerCase()}-${cellIndex}`,
        brainSignalNodeId: `vision-${channel}-${cellIndex}`,
      }))
    ),
    outputs: OUTPUT_CHANNELS.map((channel) => ({
      brainSignalNodeId: `output-${channel}`,
      bodySignalId: `motor-${channel}`,
    })),
  },
});

export const getBodyVisionCellCount = (body: BodyDefinition): number =>
  body.inputSignals.reduce(
    (maxCellCount, signal) =>
      signal.source.kind === 'vision-cell' ? Math.max(maxCellCount, signal.source.cellIndex + 1) : maxCellCount,
    0
  );

export const createBrainPackage = (
  name: string,
  definition: BrainDefinition,
  options?: {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
    description?: string;
    tags?: string[];
    body?: BodyDefinition;
    layout?: BrainLayoutDocument;
  }
): BrainPackage => {
  const timestamp = options?.updatedAt ?? new Date().toISOString();
  const createdAt = options?.createdAt ?? timestamp;
  const visionCells = getRootInputAdapterVisionCells(definition);

  return {
    packageVersion: 1,
    metadata: {
      id: options?.id ?? createBrainPackageId(),
      name: name.trim() || '未命名 Brain',
      description: options?.description,
      tags: options?.tags,
      createdAt,
      updatedAt: timestamp,
    },
    definition,
    layout: options?.layout ?? createBrainLayoutFromDefinition(definition),
    body: options?.body ?? createDefaultBodyDefinition(Math.max(1, visionCells)),
  };
};
