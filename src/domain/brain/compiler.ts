import {
  collectLeafNodes,
  GraphIRValidationError,
  validateGraphIRDocument,
} from './ir';
import type { GraphIRDocument, LeafLink, LiteralValue, ModelDefinition, NeuronNode, SignalNode } from './ir';
import type {
  BrainProgram,
  BrainProgramConnection,
  BrainProgramInputBinding,
  BrainProgramNeuronNode,
  BrainProgramOutputBinding,
  BrainProgramSignalNode,
  ProgramInputPort,
  ProgramOutputPort,
} from './program';
import type { BrainInputChannel, BrainOutputChannel } from './shared';

const INPUT_CHANNEL_BY_ID = {
  'vision-r': 'R',
  'vision-g': 'G',
  'vision-b': 'B',
} as const satisfies Record<string, BrainInputChannel>;

const OUTPUT_CHANNEL_BY_SIGNAL = {
  'turn-left': 'turn-left',
  'move-forward': 'move-forward',
  'turn-right': 'turn-right',
} as const satisfies Record<string, BrainOutputChannel>;

const INPUT_CHANNEL_OFFSET = {
  R: 0,
  G: 1,
  B: 2,
} as const satisfies Record<BrainInputChannel, number>;

const DEFAULT_IZHIKEVICH_PARAMETERS = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
} as const;

const isRecord = (value: LiteralValue | undefined): value is Record<string, LiteralValue> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const resolveInputChannel = (node: SignalNode): BrainInputChannel => {
  if (Object.prototype.hasOwnProperty.call(INPUT_CHANNEL_BY_ID, node.signal.id)) {
    return INPUT_CHANNEL_BY_ID[node.signal.id as keyof typeof INPUT_CHANNEL_BY_ID];
  }

  throw new Error(
    `Input signal node "${node.id}" uses unsupported world observation signal "${node.signal.id}".`
  );
};

const resolveOutputChannel = (node: SignalNode): BrainOutputChannel => {
  if (Object.prototype.hasOwnProperty.call(OUTPUT_CHANNEL_BY_SIGNAL, node.signal.id)) {
    return OUTPUT_CHANNEL_BY_SIGNAL[node.signal.id as keyof typeof OUTPUT_CHANNEL_BY_SIGNAL];
  }

  throw new Error(
    `Output signal node "${node.id}" uses unsupported world action signal "${node.signal.id}".`
  );
};

const resolveSignalPortId = (
  model: ModelDefinition,
  direction: 'input' | 'output',
  nodeId: string
): string => {
  const ports = direction === 'output' ? model.outputs : model.inputs;
  if (ports.length !== 1) {
    throw new Error(
      `Signal node "${nodeId}" must expose exactly one ${direction} port for runtime binding, got ${ports.length}.`
    );
  }

  return ports[0].id;
};

const createInputPortFromSignalNode = (node: SignalNode, index: number): ProgramInputPort => {
  return {
    id: node.id,
    label: node.label,
    modality: 'vision',
    channel: resolveInputChannel(node),
    index,
  };
};

const createOutputPortFromSignalNode = (node: SignalNode, index: number): ProgramOutputPort => ({
  id: node.id,
  label: node.label,
  channel: resolveOutputChannel(node),
  index,
});

const toFiniteNumber = (value: LiteralValue | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const resolveNeuronParameters = (
  model: ModelDefinition,
  node: NeuronNode
): BrainProgramNeuronNode['params'] => {
  const parameterDefaults = new Map(model.parameters.map((parameter) => [parameter.id, parameter.defaultValue]));
  const overrides = isRecord(node.parameterOverrides) ? node.parameterOverrides : undefined;

  return {
    a: toFiniteNumber(overrides?.a ?? parameterDefaults.get('a'), DEFAULT_IZHIKEVICH_PARAMETERS.a),
    b: toFiniteNumber(overrides?.b ?? parameterDefaults.get('b'), DEFAULT_IZHIKEVICH_PARAMETERS.b),
    c: toFiniteNumber(overrides?.c ?? parameterDefaults.get('c'), DEFAULT_IZHIKEVICH_PARAMETERS.c),
    d: toFiniteNumber(overrides?.d ?? parameterDefaults.get('d'), DEFAULT_IZHIKEVICH_PARAMETERS.d),
    threshold: toFiniteNumber(
      overrides?.threshold ?? parameterDefaults.get('threshold'),
      DEFAULT_IZHIKEVICH_PARAMETERS.threshold
    ),
  };
};

const createSignalRuntimeNode = (node: SignalNode): BrainProgramSignalNode => ({
  id: node.id,
  label: node.label,
  modelId: node.modelId,
  direction: node.direction,
  signalId: node.signal.id,
  inputConnections: [],
  outputConnections: [],
});

const createNeuronRuntimeNode = (
  node: NeuronNode,
  modelsById: Map<string, ModelDefinition>
): BrainProgramNeuronNode => {
  const model = modelsById.get(node.modelId);
  if (!model) {
    throw new Error(`Missing model "${node.modelId}" for neuron node "${node.id}".`);
  }

  return {
    id: node.id,
    label: node.label,
    modelId: node.modelId,
    params: resolveNeuronParameters(model, node),
    inputConnections: [],
    outputConnections: [],
  };
};

const createRuntimeConnection = (link: LeafLink): BrainProgramConnection => ({
  id: link.id,
  sourceNodeId: link.from.nodeId,
  sourcePortId: link.from.portId,
  targetNodeId: link.to.nodeId,
  targetPortId: link.to.portId,
  weight: link.weight,
  delayMs: link.delayMs ?? 0,
});

const resolveVisionCellIndex = (node: SignalNode): number => {
  const match = node.id.match(/(\d+)$/) ?? node.label.match(/(\d+)$/);
  if (!match) {
    throw new Error(
      `Input signal node "${node.id}" must end with a numeric vision cell index for runtime binding.`
    );
  }

  return Number.parseInt(match[1], 10);
};

const resolveInputSignalIndex = (node: SignalNode): number => {
  const channel = resolveInputChannel(node);
  const cellIndex = resolveVisionCellIndex(node);
  return cellIndex * 3 + INPUT_CHANNEL_OFFSET[channel];
};

export const compileGraphIRDocument = (document: GraphIRDocument): BrainProgram => {
  const issues = validateGraphIRDocument(document);
  if (issues.length > 0) {
    throw new GraphIRValidationError(issues);
  }

  const modelsById = new Map<string, ModelDefinition>(document.models.map((model) => [model.id, model]));
  const leafNodes = collectLeafNodes(document.root.children);
  const inputSignalNodes = leafNodes.filter(
    (node): node is SignalNode => node.kind === 'signal' && node.direction === 'input'
  );
  const outputSignalNodes = leafNodes.filter(
    (node): node is SignalNode => node.kind === 'signal' && node.direction === 'output'
  );
  const neuronLeafNodes = leafNodes.filter((node): node is NeuronNode => node.kind === 'neuron');
  const orderedInputSignals = inputSignalNodes
    .map((node) => ({
      node,
      index: resolveInputSignalIndex(node),
    }))
    .sort((left, right) => left.index - right.index || left.node.id.localeCompare(right.node.id));
  const seenInputIndices = new Map<number, string>();
  for (const binding of orderedInputSignals) {
    const existingNodeId = seenInputIndices.get(binding.index);
    if (existingNodeId) {
      throw new Error(
        `Input signal nodes "${existingNodeId}" and "${binding.node.id}" resolve to the same visual input index ${binding.index}.`
      );
    }

    seenInputIndices.set(binding.index, binding.node.id);
  }

  const inputPorts = orderedInputSignals.map(({ node, index }) => createInputPortFromSignalNode(node, index));
  const outputPorts = outputSignalNodes.map(createOutputPortFromSignalNode);
  const neuronNodes = neuronLeafNodes.map((node) => createNeuronRuntimeNode(node, modelsById));
  const signalNodes = [
    ...inputSignalNodes.map(createSignalRuntimeNode),
    ...outputSignalNodes.map(createSignalRuntimeNode),
  ];
  const inputBindings = orderedInputSignals.map<BrainProgramInputBinding>(({ node, index }) => {
    const model = modelsById.get(node.modelId);
    if (!model) {
      throw new Error(`Missing model "${node.modelId}" for input signal node "${node.id}".`);
    }

    return {
      nodeId: node.id,
      portId: resolveSignalPortId(model, 'output', node.id),
      index,
    };
  });

  const neuronNodeIndex = new Map(neuronNodes.map((node) => [node.id, node]));
  const signalNodeIndex = new Map(signalNodes.map((node) => [node.id, node]));

  const links = [...document.root.links];
  for (const link of links) {
    const connection = createRuntimeConnection(link);
    const sourceNode = neuronNodeIndex.get(connection.sourceNodeId) ?? signalNodeIndex.get(connection.sourceNodeId);
    const targetNode = neuronNodeIndex.get(connection.targetNodeId) ?? signalNodeIndex.get(connection.targetNodeId);

    if (!sourceNode || !targetNode) {
      throw new Error(`Failed to lower link "${link.id}" because one endpoint is missing after validation.`);
    }

    sourceNode.outputConnections.push(connection);
    targetNode.inputConnections.push(connection);
  }

  return {
    graphIR: document,
    inputPorts,
    neuronNodes,
    outputPorts,
    signalNodes,
    links,
    inputBindings,
    outputBindings: outputSignalNodes.map<BrainProgramOutputBinding>((node) => {
      const model = modelsById.get(node.modelId);
      if (!model) {
        throw new Error(`Missing model "${node.modelId}" for output signal node "${node.id}".`);
      }

      return {
        nodeId: node.id,
        portId: resolveSignalPortId(model, 'input', node.id),
        channel: resolveOutputChannel(node),
      };
    }),
    modelsById,
    nodeIndex: {
      inputs: new Map(inputPorts.map((port) => [port.id, port])),
      neurons: new Map(neuronNodes.map((node) => [node.id, node])),
      outputs: new Map(signalNodes.filter((node) => node.direction === 'output').map((node) => [node.id, node])),
    },
  };
};
