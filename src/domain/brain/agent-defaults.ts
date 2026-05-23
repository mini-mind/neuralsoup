import {
  withDerivedBodyVisionCellCount,
  withVisionCellLayoutMarkers,
  type AgentConnection,
  type AgentIR,
  type AgentLayoutIR,
  type AgentMetadata,
  type BodyIR,
  type BrainIR,
} from './agent-ir';

const INPUT_CHANNELS = ['R', 'G', 'B'] as const;
const DEFAULT_ROOT_CONTAINER_ID = 'core-neuron-group';

const DEFAULT_AGENT_LAYOUT_VERSION = 1 as const;
const DEFAULT_AGENT_VERSION = 1 as const;
const DEFAULT_BODY_VERSION = 1 as const;
const DEFAULT_BRAIN_VERSION = 1 as const;
const DEFAULT_VISION_INPUT_RULE_ID = 'vision-inputs';
const DEFAULT_MOTOR_OUTPUT_RULE_ID = 'motor-outputs';

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
  rootContainerId: DEFAULT_ROOT_CONTAINER_ID,
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
      id: DEFAULT_ROOT_CONTAINER_ID,
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
    [DEFAULT_ROOT_CONTAINER_ID]: {
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

export const createDefaultAgentIR = (
  visionCells: number = 36,
  name: string = '当前 Agent'
): AgentIR => {
  const normalizedVisionCells = Math.max(0, Math.floor(visionCells));
  const timestamp = new Date().toISOString();
  const idSource =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return withDerivedBodyVisionCellCount(
    withVisionCellLayoutMarkers({
    version: DEFAULT_AGENT_VERSION,
    metadata: createAgentMetadata(name, timestamp, idSource),
    body: createDefaultBodyIR(),
    brain: createDefaultBrainIR(),
    connections: createDefaultConnections(normalizedVisionCells),
    layout: createDefaultLayout(normalizedVisionCells),
    }, normalizedVisionCells)
  );
};
