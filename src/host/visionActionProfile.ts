import type {
  AgentConnection,
  AgentIR,
  AgentLayoutIR,
  AgentMetadata,
  BodyIR,
  BrainIR,
  WorldRegistry,
} from '../domain/brain';
import {
  createDefaultWorldActionOutputAdapter,
  createMovementWorldControlCommandApplier,
  createVisionCellWorldInputSignalProvider,
  type MovementWorldControlBindings,
} from '../domain/world';

const INPUT_CHANNELS = ['R', 'G', 'B'] as const;
export const HOST_ROOT_CONTAINER_ID = 'root-container';
export const VISION_ACTION_MOVEMENT_BINDINGS: MovementWorldControlBindings = {
  turnLeft: 'turn-left',
  moveForward: 'move-forward',
  turnRight: 'turn-right',
};

const DEFAULT_AGENT_LAYOUT_VERSION = 1 as const;
const DEFAULT_AGENT_VERSION = 1 as const;
const DEFAULT_BODY_VERSION = 1 as const;
const DEFAULT_BRAIN_VERSION = 1 as const;
const DEFAULT_VISION_INPUT_RULE_ID = 'vision-inputs';
const DEFAULT_MOTOR_OUTPUT_RULE_ID = 'motor-outputs';

export const createVisionActionWorldRegistry = (): WorldRegistry => {
  const bodyInputSourcePattern = /^vision\.([RGB])\.(\d+)$/;
  const bodyOutputTargetPattern = /^action\.([a-z0-9-]+)$/;

  return {
    version: 1,
    inputs: [{ id: 'vision', direction: 'input', kind: 'vision-array', enumerable: true }],
    outputs: [{ id: 'action', direction: 'output', kind: 'action-map', enumerable: true }],
    resolveInputBinding: (source) => {
      const match = source.match(bodyInputSourcePattern);
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
      const match = target.match(bodyOutputTargetPattern);
      if (!match) {
        return null;
      }

      return {
        target: `action.${match[1]}`,
        worldPort: 'action',
      };
    },
    enumerateInputNodeIds: (rule, body) => {
      const templateMatch = rule.sourceTemplate.match(/^vision\.\$(\d+)\.\$(\d+)$/);
      if (!templateMatch) {
        return [];
      }

      const channelGroupIndex = Number.parseInt(templateMatch[1], 10);
      const cellGroupIndex = Number.parseInt(templateMatch[2], 10);
      const anchoredPattern =
        rule.nodeIdPattern.startsWith('^') && rule.nodeIdPattern.endsWith('$')
          ? rule.nodeIdPattern.slice(1, -1)
          : rule.nodeIdPattern;

      const isSupportedPattern =
        anchoredPattern.includes('([RGB])') &&
        (anchoredPattern.includes('(\\d+)') || anchoredPattern.includes('(\\\\d+)'));
      if (!isSupportedPattern || channelGroupIndex === cellGroupIndex) {
        return [];
      }

      const nodeIds = new Set<string>();
      for (let cellIndex = 0; cellIndex < body.visionCellCount; cellIndex += 1) {
        for (const channel of INPUT_CHANNELS) {
          const nodeId = anchoredPattern
            .replace('([RGB])', channel)
            .replace('(\\\\d+)', String(cellIndex))
            .replace('(\\d+)', String(cellIndex));
          nodeIds.add(nodeId);
        }
      }

      return [...nodeIds];
    },
    enumerateOutputNodeIds: (rule) => {
      const templateMatch = rule.targetTemplate.match(/^action\.\$(\d+)$/);
      const alternationMatch = rule.nodeIdPattern.match(/\(([^)]+)\)/);
      if (!templateMatch || !alternationMatch) {
        return [];
      }

      return alternationMatch[1]
        .split('|')
        .filter((value) => value.length > 0)
        .map((value) =>
          rule.nodeIdPattern
            .replace(/^\^/, '')
            .replace(/\$$/, '')
            .replace(alternationMatch[0], value)
        );
    },
  };
};

const createAgentMetadata = (
  name: string,
  timestamp: string,
  idSource: string
): AgentMetadata => ({
  id: idSource,
  name: name.trim() || '未命名 Agent',
  createdAt: timestamp,
  updatedAt: timestamp,
});

const createDefaultBodyIR = (): BodyIR => ({
  version: DEFAULT_BODY_VERSION,
  visionCellCount: 36,
  inputRules: [
    {
      id: DEFAULT_VISION_INPUT_RULE_ID,
      nodeIdPattern: '^vision-([RGB])-(\\d+)$',
      sourceTemplate: 'vision.$1.$2',
      scale: 1,
    },
  ],
  outputRules: [
    {
      id: DEFAULT_MOTOR_OUTPUT_RULE_ID,
      nodeIdPattern: '^output-(turn-left|move-forward|turn-right)$',
      targetTemplate: 'action.$1',
      decayPerSecond: 4,
    },
  ],
});

const createDefaultBrainIR = (): BrainIR => ({
  version: DEFAULT_BRAIN_VERSION,
  rootContainerId: HOST_ROOT_CONTAINER_ID,
  neurons: [
    {
      id: 'neuron-1',
      label: '神经元1',
      model: 'izhikevich',
      params: {
        a: 0.02,
        b: 0.2,
        c: -65,
        d: 8,
        threshold: 30,
      },
      initialState: {
        v: -65,
      },
    },
    {
      id: 'neuron-2',
      label: '神经元2',
      model: 'izhikevich',
      params: {
        a: 0.02,
        b: 0.2,
        c: -65,
        d: 8,
        threshold: 30,
      },
      initialState: {
        v: -65,
      },
    },
  ],
  containers: [
    {
      id: HOST_ROOT_CONTAINER_ID,
      label: '默认神经元组',
      children: [
        { scope: 'brain', nodeId: 'neuron-1' },
        { scope: 'brain', nodeId: 'neuron-2' },
      ],
    },
  ],
});

const createDefaultConnections = (visionCells: number): AgentConnection[] => {
  const connections: AgentConnection[] = [];

  for (let cellIndex = 0; cellIndex < visionCells; cellIndex += 1) {
    connections.push(
      {
        id: `link-vision-R-${cellIndex}-neuron-1`,
        from: { scope: 'bodyInput', nodeId: `vision-R-${cellIndex}`, portId: 'out' },
        to: { scope: 'brain', nodeId: 'neuron-1', portId: 'dendrite' },
        weight: 1,
        delayMs: 0,
      },
      {
        id: `link-vision-G-${cellIndex}-neuron-1`,
        from: { scope: 'bodyInput', nodeId: `vision-G-${cellIndex}`, portId: 'out' },
        to: { scope: 'brain', nodeId: 'neuron-1', portId: 'dendrite' },
        weight: 0.75,
        delayMs: 0,
      },
      {
        id: `link-vision-B-${cellIndex}-neuron-2`,
        from: { scope: 'bodyInput', nodeId: `vision-B-${cellIndex}`, portId: 'out' },
        to: { scope: 'brain', nodeId: 'neuron-2', portId: 'dendrite' },
        weight: 0.75,
        delayMs: 0,
      }
    );
  }

  connections.push(
    {
      id: 'link-neuron-1-neuron-2',
      from: { scope: 'brain', nodeId: 'neuron-1', portId: 'axon' },
      to: { scope: 'brain', nodeId: 'neuron-2', portId: 'dendrite' },
      weight: 0.5,
      delayMs: 0,
    },
    {
      id: 'link-neuron-1-output-move-forward',
      from: { scope: 'brain', nodeId: 'neuron-1', portId: 'axon' },
      to: { scope: 'bodyOutput', nodeId: 'output-move-forward', portId: 'in' },
      weight: 1,
      delayMs: 0,
    },
    {
      id: 'link-neuron-2-output-turn-left',
      from: { scope: 'brain', nodeId: 'neuron-2', portId: 'axon' },
      to: { scope: 'bodyOutput', nodeId: 'output-turn-left', portId: 'in' },
      weight: 1,
      delayMs: 0,
    },
    {
      id: 'link-neuron-2-output-turn-right',
      from: { scope: 'brain', nodeId: 'neuron-2', portId: 'axon' },
      to: { scope: 'bodyOutput', nodeId: 'output-turn-right', portId: 'in' },
      weight: 1,
      delayMs: 0,
    }
  );

  return connections;
};

const createDefaultLayout = (visionCells: number): AgentLayoutIR => {
  const nodes: AgentLayoutIR['nodes'] = {
    [HOST_ROOT_CONTAINER_ID]: {
      position: { x: 300, y: 200 },
    },
    'neuron-1': {
      position: { x: 50, y: 150 },
    },
    'neuron-2': {
      position: { x: 50, y: 250 },
    },
    'output-turn-left': {
      position: { x: 320, y: 160 },
    },
    'output-move-forward': {
      position: { x: 320, y: 230 },
    },
    'output-turn-right': {
      position: { x: 320, y: 300 },
    },
  };

  for (const [channelIndex, channel] of INPUT_CHANNELS.entries()) {
    for (let cellIndex = 0; cellIndex < visionCells; cellIndex += 1) {
      nodes[`vision-${channel}-${cellIndex}`] = {
        position: {
          x: -260,
          y: 60 + cellIndex * 18 + channelIndex * Math.max(visionCells, 1) * 22,
        },
      };
    }
  }

  return {
    version: DEFAULT_AGENT_LAYOUT_VERSION,
    nodes,
  };
};

export const createVisionActionSeedAgentIR = (
  visionCells: number = 36,
  name: string = '当前 Agent'
): AgentIR => {
  const normalizedVisionCells = Math.max(0, Math.floor(visionCells));
  const timestamp = new Date().toISOString();
  const idSource =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    version: DEFAULT_AGENT_VERSION,
    metadata: createAgentMetadata(name, timestamp, idSource),
    body: {
      ...createDefaultBodyIR(),
      visionCellCount: normalizedVisionCells,
    },
    brain: createDefaultBrainIR(),
    connections: createDefaultConnections(normalizedVisionCells),
    layout: createDefaultLayout(normalizedVisionCells),
  };
};

export const createVisionActionInputSignalProvider = createVisionCellWorldInputSignalProvider;

export const createVisionActionOutputAdapter = createDefaultWorldActionOutputAdapter;

export const createVisionActionCommandApplier = () =>
  createMovementWorldControlCommandApplier(VISION_ACTION_MOVEMENT_BINDINGS);
