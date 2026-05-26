import {
  reconcileAgentIRVisionCells,
  type WorldRegistry,
} from '../domain/brain';
import type {
  AgentConnection,
  AgentIR,
  AgentLayoutIR,
  AgentMetadata,
  BodyIR,
  BrainIR,
} from '../domain/brain';
import {
  createDefaultWorldActionOutputAdapter,
  createMovementWorldControlCommandApplier,
  createVisionCellWorldInputSignalProvider,
  type MovementWorldControlBindings,
  type WorldActionOutputAdapter,
  type WorldControlCommandApplier,
  type WorldInputSignalProvider,
} from '../domain/world';

const INPUT_CHANNELS = ['R', 'G', 'B'] as const;
export const HOST_ROOT_CONTAINER_ID = 'root-container';
export const VISION_ACTION_MOVEMENT_BINDINGS: MovementWorldControlBindings = {
  turnLeft: 'turn-left',
  moveForward: 'move-forward',
  turnRight: 'turn-right',
};

export interface HostRuntimeProfile {
  worldRegistry: WorldRegistry;
  movementBindings: MovementWorldControlBindings;
  createSeedAgentIR: (visionCells: number, name?: string) => AgentIR;
  reconcileAgentIR: (agent: AgentIR, visionCells: number) => AgentIR;
  createInputSignalProvider: () => WorldInputSignalProvider;
  createOutputAdapter: () => WorldActionOutputAdapter;
  createCommandApplier: () => WorldControlCommandApplier;
}

const DEFAULT_VISION_INPUT_ENDPOINT_ID = 'vision-inputs';
const DEFAULT_MOTOR_OUTPUT_ENDPOINT_ID = 'motor-outputs';
const DEFAULT_NEURON_MODEL_ID = 'seed.neuron.izhikevich.v1';
const DEFAULT_SYNAPSE_MODEL_ID = 'seed.synapse.static-current.v1';

const toSupportedActionTargets = (bindings: MovementWorldControlBindings): Set<string> =>
  new Set(Object.values(bindings).map((binding) => `action.${binding}`));

export const createVisionActionWorldRegistry = (
  movementBindings: MovementWorldControlBindings = VISION_ACTION_MOVEMENT_BINDINGS
): WorldRegistry => {
  const bodyInputSourcePattern = /^vision\.([RGB])\.(\d+)$/;
  const bodyOutputTargetPattern = /^action\.([a-z0-9-]+)$/;
  const supportedActionTargets = toSupportedActionTargets(movementBindings);
  const resolveInputBinding = (source: string) => {
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
  };
  const resolveOutputBinding = (target: string) => {
    const match = target.match(bodyOutputTargetPattern);
    const actionKind = match?.[1] ?? null;
    const normalizedTarget = actionKind ? `action.${actionKind}` : null;
    if (!normalizedTarget || !actionKind || !supportedActionTargets.has(normalizedTarget)) {
      return null;
    }

    return {
      target: normalizedTarget,
      worldPort: 'action',
      commandKind: actionKind,
    };
  };

  return {
    version: 1,
    inputs: [{ id: 'vision', direction: 'input', kind: 'vision-array', enumerable: true }],
    outputs: [{ id: 'action', direction: 'output', kind: 'action-map', enumerable: true }],
    resolveInputBinding,
    resolveOutputBinding,
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

const createDefaultBodyIR = (
  visionCells: number,
  movementBindings: MovementWorldControlBindings = VISION_ACTION_MOVEMENT_BINDINGS
): BodyIR => ({
  inputEndpoints: Array.from({ length: Math.max(0, Math.floor(visionCells)) }).flatMap((_, cellIndex) =>
    INPUT_CHANNELS.map((channel) => ({
      id: `${DEFAULT_VISION_INPUT_ENDPOINT_ID}-${channel}-${cellIndex}`,
      source: `vision.${channel}.${cellIndex}`,
      worldPort: 'vision',
      scale: 1,
    }))
  ),
  outputEndpoints: [
    movementBindings.turnLeft,
    movementBindings.moveForward,
    movementBindings.turnRight,
  ].map((action) => ({
    id: `${DEFAULT_MOTOR_OUTPUT_ENDPOINT_ID}-${action}`,
    target: `action.${action}`,
    worldPort: 'action',
    decayPerSecond: 4,
  })),
  mappings: [
    ...Array.from({ length: Math.max(0, Math.floor(visionCells)) }).flatMap((_, cellIndex) =>
      INPUT_CHANNELS.map((channel) => ({
        id: `mapping-input-${channel}-${cellIndex}`,
        kind: 'input' as const,
        endpointId: `${DEFAULT_VISION_INPUT_ENDPOINT_ID}-${channel}-${cellIndex}`,
        nodeId: `vision-${channel}-${cellIndex}`,
      }))
    ),
    ...[movementBindings.turnLeft, movementBindings.moveForward, movementBindings.turnRight].map((action) => ({
      id: `mapping-output-${action}`,
      kind: 'output' as const,
      endpointId: `${DEFAULT_MOTOR_OUTPUT_ENDPOINT_ID}-${action}`,
      nodeId: `output-${action}`,
    })),
  ],
});

const createDefaultBrainIR = (): BrainIR => ({
  neuronModels: [
    {
      id: DEFAULT_NEURON_MODEL_ID,
      family: 'izhikevich',
      label: '默认 Izhikevich 神经元',
      params: {
        a: 0.02,
        b: 0.2,
        c: -65,
        d: 8,
        threshold: 30,
      },
    },
  ],
  synapseModels: [
    {
      id: DEFAULT_SYNAPSE_MODEL_ID,
      label: '默认静态电流突触',
      kind: 'static-current',
      defaults: {
        weight: 1,
        delayMs: 0,
      },
    },
  ],
  rootContainerId: HOST_ROOT_CONTAINER_ID,
  neurons: [
    {
      id: 'neuron-1',
      label: '神经元1',
      neuronModelId: DEFAULT_NEURON_MODEL_ID,
      initialState: {
        v: -65,
      },
    },
    {
      id: 'neuron-2',
      label: '神经元2',
      neuronModelId: DEFAULT_NEURON_MODEL_ID,
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

const createDefaultConnections = (
  visionCells: number,
  movementBindings: MovementWorldControlBindings = VISION_ACTION_MOVEMENT_BINDINGS
): AgentConnection[] => {
  const connections: AgentConnection[] = [];

  for (let cellIndex = 0; cellIndex < visionCells; cellIndex += 1) {
    connections.push(
      {
        id: `link-vision-R-${cellIndex}-neuron-1`,
        from: { scope: 'bodyInput', nodeId: `vision-R-${cellIndex}`, portId: 'out' },
        to: { scope: 'brain', nodeId: 'neuron-1', portId: 'dendrite' },
        synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
      },
      {
        id: `link-vision-G-${cellIndex}-neuron-1`,
        from: { scope: 'bodyInput', nodeId: `vision-G-${cellIndex}`, portId: 'out' },
        to: { scope: 'brain', nodeId: 'neuron-1', portId: 'dendrite' },
        synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
        parameterOverrides: {
          weight: 0.75,
        },
      },
      {
        id: `link-vision-B-${cellIndex}-neuron-2`,
        from: { scope: 'bodyInput', nodeId: `vision-B-${cellIndex}`, portId: 'out' },
        to: { scope: 'brain', nodeId: 'neuron-2', portId: 'dendrite' },
        synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
        parameterOverrides: {
          weight: 0.75,
        },
      }
    );
  }

  connections.push(
    {
      id: 'link-neuron-1-neuron-2',
      from: { scope: 'brain', nodeId: 'neuron-1', portId: 'axon' },
      to: { scope: 'brain', nodeId: 'neuron-2', portId: 'dendrite' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
      parameterOverrides: {
        weight: 0.5,
      },
    },
    {
      id: `link-neuron-1-output-${movementBindings.moveForward}`,
      from: { scope: 'brain', nodeId: 'neuron-1', portId: 'axon' },
      to: { scope: 'bodyOutput', nodeId: `output-${movementBindings.moveForward}`, portId: 'in' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
    {
      id: `link-neuron-2-output-${movementBindings.turnLeft}`,
      from: { scope: 'brain', nodeId: 'neuron-2', portId: 'axon' },
      to: { scope: 'bodyOutput', nodeId: `output-${movementBindings.turnLeft}`, portId: 'in' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    },
    {
      id: `link-neuron-2-output-${movementBindings.turnRight}`,
      from: { scope: 'brain', nodeId: 'neuron-2', portId: 'axon' },
      to: { scope: 'bodyOutput', nodeId: `output-${movementBindings.turnRight}`, portId: 'in' },
      synapseModelId: DEFAULT_SYNAPSE_MODEL_ID,
    }
  );

  return connections;
};

const createDefaultLayout = (
  visionCells: number,
  movementBindings: MovementWorldControlBindings = VISION_ACTION_MOVEMENT_BINDINGS
): AgentLayoutIR => {
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
    [`output-${movementBindings.turnLeft}`]: {
      position: { x: 320, y: 160 },
    },
    [`output-${movementBindings.moveForward}`]: {
      position: { x: 320, y: 230 },
    },
    [`output-${movementBindings.turnRight}`]: {
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
    nodes,
  };
};

export const createVisionActionSeedAgentIR = (
  visionCells: number = 36,
  name: string = '当前 Agent',
  movementBindings: MovementWorldControlBindings = VISION_ACTION_MOVEMENT_BINDINGS
): AgentIR => {
  const normalizedVisionCells = Math.max(0, Math.floor(visionCells));
  const timestamp = new Date().toISOString();
  const idSource =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    metadata: createAgentMetadata(name, timestamp, idSource),
    body: createDefaultBodyIR(normalizedVisionCells, movementBindings),
    brain: createDefaultBrainIR(),
    connections: createDefaultConnections(normalizedVisionCells, movementBindings),
    layout: createDefaultLayout(normalizedVisionCells, movementBindings),
  };
};

export const createVisionActionInputSignalProvider = createVisionCellWorldInputSignalProvider;

export const createVisionActionOutputAdapter = () =>
  createDefaultWorldActionOutputAdapter(VISION_ACTION_MOVEMENT_BINDINGS);

export const createVisionActionCommandApplier = () =>
  createMovementWorldControlCommandApplier(VISION_ACTION_MOVEMENT_BINDINGS);

export const createVisionActionHostProfile = (
  movementBindings: MovementWorldControlBindings = VISION_ACTION_MOVEMENT_BINDINGS
): HostRuntimeProfile => {
  const worldRegistry = createVisionActionWorldRegistry(movementBindings);

  return {
    worldRegistry,
    movementBindings,
    createSeedAgentIR: (visionCells, name = '当前 Agent') =>
      createVisionActionSeedAgentIR(visionCells, name, movementBindings),
    reconcileAgentIR: (agent, visionCells) => reconcileAgentIRVisionCells(agent, visionCells, worldRegistry),
    createInputSignalProvider: createVisionActionInputSignalProvider,
    createOutputAdapter: () => createDefaultWorldActionOutputAdapter(movementBindings),
    createCommandApplier: () => createMovementWorldControlCommandApplier(movementBindings),
  };
};

export const VISION_ACTION_HOST_PROFILE = createVisionActionHostProfile();
