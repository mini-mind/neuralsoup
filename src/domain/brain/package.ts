import type { BrainInputChannel, BrainOutputChannel, Position } from './shared';
import type { AgentLibraryItem } from './agent-ir';
import type { GraphIRDocument } from './ir';
import { createAgentIRFromLegacyGraph } from './legacy-graph-bridge';

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
  size?: {
    width: number;
    height: number;
  };
}

export interface BrainLayoutDocument {
  version: 1;
  nodes: Record<string, BrainLayoutNodeState>;
  viewportByContainerId?: Record<
    string,
    {
      x: number;
      y: number;
      scale: number;
    }
  >;
}

export interface BodyInputSignal {
  id: string;
  source: {
    kind: 'vision-cell';
    channel: BrainInputChannel;
    cellIndex: number;
  };
  scale?: number;
}

export interface BodyOutputSignal {
  id: string;
  target: {
    kind: 'action-channel';
    channel: BrainOutputChannel;
  };
  decayPerSecond?: number;
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

export type AgentPackage = AgentLibraryItem;

const INPUT_CHANNELS: BrainInputChannel[] = ['R', 'G', 'B'];
const OUTPUT_CHANNELS: BrainOutputChannel[] = ['turn-left', 'move-forward', 'turn-right'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
      scale: 1,
    }))
  ),
  outputSignals: OUTPUT_CHANNELS.map((channel) => ({
    id: `motor-${channel}`,
    target: {
      kind: 'action-channel' as const,
      channel,
    },
    decayPerSecond: 4,
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

export const createAgentPackage = (
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
): AgentPackage => {
  const brainPackage = createBrainPackage(name, definition, options);
  const agent = createAgentIRFromLegacyGraph(
    brainPackage.metadata.name,
    brainPackage.definition,
    brainPackage.body,
    brainPackage.layout,
    brainPackage.metadata
  );

  return {
    packageVersion: 1,
    metadata: brainPackage.metadata,
    agent,
  };
};

export const isBrainPackage = (value: unknown): value is BrainPackage => {
  if (!isObject(value) || value.packageVersion !== 1 || !isObject(value.metadata)) {
    return false;
  }

  const definition = value.definition;
  const layout = value.layout;
  const body = value.body;
  const root = isObject(definition) ? definition.root : null;

  return (
    typeof value.metadata.id === 'string' &&
    typeof value.metadata.name === 'string' &&
    typeof value.metadata.createdAt === 'string' &&
    typeof value.metadata.updatedAt === 'string' &&
    isObject(definition) &&
    definition.version === 1 &&
    Array.isArray(definition.models) &&
    isObject(root) &&
    root.id === 'root' &&
    Array.isArray(root.children) &&
    Array.isArray(root.links) &&
    isObject(layout) &&
    layout.version === 1 &&
    isObject(layout.nodes) &&
    Object.values(layout.nodes).every(
      (node) =>
        isObject(node) &&
        (node.position === undefined ||
          (isObject(node.position) &&
            typeof node.position.x === 'number' &&
            Number.isFinite(node.position.x) &&
            typeof node.position.y === 'number' &&
            Number.isFinite(node.position.y))) &&
        (node.collapsed === undefined || typeof node.collapsed === 'boolean') &&
        (node.size === undefined ||
          (isObject(node.size) &&
            typeof node.size.width === 'number' &&
            Number.isFinite(node.size.width) &&
            typeof node.size.height === 'number' &&
            Number.isFinite(node.size.height)))
    ) &&
    (layout.viewportByContainerId === undefined ||
      (isObject(layout.viewportByContainerId) &&
        Object.values(layout.viewportByContainerId).every(
          (viewport) =>
            isObject(viewport) &&
            typeof viewport.x === 'number' &&
            Number.isFinite(viewport.x) &&
            typeof viewport.y === 'number' &&
            Number.isFinite(viewport.y) &&
            typeof viewport.scale === 'number' &&
            Number.isFinite(viewport.scale)
        ))) &&
    isObject(body) &&
    body.version === 1 &&
    Array.isArray(body.inputSignals) &&
    body.inputSignals.every(
      (signal) =>
        isObject(signal) &&
        typeof signal.id === 'string' &&
        isObject(signal.source) &&
        signal.source.kind === 'vision-cell' &&
        ['R', 'G', 'B'].includes(String(signal.source.channel)) &&
        typeof signal.source.cellIndex === 'number' &&
        Number.isFinite(signal.source.cellIndex) &&
        (signal.scale === undefined || (typeof signal.scale === 'number' && Number.isFinite(signal.scale)))
    ) &&
    Array.isArray(body.outputSignals) &&
    body.outputSignals.every(
      (signal) =>
        isObject(signal) &&
        typeof signal.id === 'string' &&
        isObject(signal.target) &&
        signal.target.kind === 'action-channel' &&
        ['turn-left', 'move-forward', 'turn-right'].includes(String(signal.target.channel)) &&
        (signal.decayPerSecond === undefined ||
          (typeof signal.decayPerSecond === 'number' && Number.isFinite(signal.decayPerSecond)))
    ) &&
    isObject(body.brainBindings) &&
    Array.isArray(body.brainBindings.inputs) &&
    Array.isArray(body.brainBindings.outputs)
  );
};
