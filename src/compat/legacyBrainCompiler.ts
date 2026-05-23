import {
  collectLeafNodes,
  GraphIRValidationError,
  validateGraphIRDocument,
} from '../domain/brain/ir';
import { compileAgentIR } from '../domain/brain/agent-compiler';
import { createAgentIRFromLegacyGraph } from '../domain/brain/legacy-graph-bridge';
import type {
  LeafLink,
  LiteralValue,
  ModelDefinition,
  NeuronNode,
  SignalNode,
  TopologyNode,
} from '../domain/brain/ir';
import type {
  LegacyBodyDefinition,
  LegacyBodyInputSignal,
  LegacyBodyOutputSignal,
  LegacyBrainDefinition,
} from '../compat/legacyBrainPackage';
import type {
  BrainProgramConnection,
  BrainProgramInputBinding,
  BrainProgramNeuronNode,
  BrainProgramOutputBinding,
  BrainProgramSignalNode,
  LegacyGraphProgram,
  ProgramInputPort,
  ProgramOutputPort,
} from '../compat/legacyBrainProgram';
import type { BrainInputChannel } from '../domain/brain/shared';

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

const createInputPortFromBinding = (
  node: SignalNode,
  bodySignal: LegacyBodyInputSignal,
  index: number
): ProgramInputPort => {
  return {
    id: node.id,
    label: node.label,
    modality: 'vision',
    channel: bodySignal.source.channel,
    index,
  };
};

const createOutputPortFromBinding = (
  node: SignalNode,
  bodySignal: LegacyBodyOutputSignal,
  index: number
): ProgramOutputPort => ({
  id: node.id,
  label: node.label,
  channel: bodySignal.target.channel,
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

const collectRootAdapterSignals = (nodes: TopologyNode[]): { inputSignals: SignalNode[]; outputSignals: SignalNode[] } => {
  const inputSignals: SignalNode[] = [];
  const outputSignals: SignalNode[] = [];

  for (const node of nodes) {
    if (node.kind !== 'adapter') {
      continue;
    }

    for (const child of node.children) {
      if (child.kind !== 'signal') {
        continue;
      }

      if (child.direction === 'input') {
        inputSignals.push(child);
        continue;
      }

      outputSignals.push(child);
    }
  }

  return { inputSignals, outputSignals };
};

const resolveInputSignalIndex = (bodySignal: LegacyBodyInputSignal): number =>
  bodySignal.source.cellIndex * 3 + INPUT_CHANNEL_OFFSET[bodySignal.source.channel];

const createBodySignalIndex = <Signal extends { id: string }>(signals: Signal[]): Map<string, Signal> =>
  new Map(signals.map((signal) => [signal.id, signal]));

const assertNoDuplicateBodySignalIds = (signals: Array<{ id: string }>, scope: string): void => {
  const seen = new Set<string>();
  for (const signal of signals) {
    if (seen.has(signal.id)) {
      throw new Error(`Duplicate ${scope} body signal "${signal.id}".`);
    }
    seen.add(signal.id);
  }
};

const assertBodyBindingsTargetRootAdapterSignals = (
  body: LegacyBodyDefinition,
  inputSignalsByNodeId: Map<string, SignalNode>,
  outputSignalsByNodeId: Map<string, SignalNode>
): void => {
  const bodyInputById = createBodySignalIndex(body.inputSignals);
  const bodyOutputById = createBodySignalIndex(body.outputSignals);

  assertNoDuplicateBodySignalIds(body.inputSignals, 'input');
  assertNoDuplicateBodySignalIds(body.outputSignals, 'output');

  for (const binding of body.brainBindings.inputs) {
    if (!bodyInputById.has(binding.bodySignalId)) {
      throw new Error(`Body input binding references missing body signal "${binding.bodySignalId}".`);
    }
    if (!inputSignalsByNodeId.has(binding.brainSignalNodeId)) {
      throw new Error(
        `Body input binding references non-root or non-input brain signal "${binding.brainSignalNodeId}".`
      );
    }
  }

  for (const binding of body.brainBindings.outputs) {
    if (!bodyOutputById.has(binding.bodySignalId)) {
      throw new Error(`Body output binding references missing body signal "${binding.bodySignalId}".`);
    }
    if (!outputSignalsByNodeId.has(binding.brainSignalNodeId)) {
      throw new Error(
        `Body output binding references non-root or non-output brain signal "${binding.brainSignalNodeId}".`
      );
    }
  }
};

export const compileLegacyBrainDefinition = (
  document: LegacyBrainDefinition,
  body: LegacyBodyDefinition
): LegacyGraphProgram => {
  const issues = validateGraphIRDocument(document);
  if (issues.length > 0) {
    throw new GraphIRValidationError(issues);
  }

  const modelsById = new Map<string, ModelDefinition>(document.models.map((model) => [model.id, model]));
  const leafNodes = collectLeafNodes(document.root.children);
  const allSignalNodes = leafNodes.filter((node): node is SignalNode => node.kind === 'signal');
  const { inputSignals: inputSignalNodes, outputSignals: outputSignalNodes } =
    collectRootAdapterSignals(document.root.children);
  const inputSignalsByNodeId = new Map(inputSignalNodes.map((node) => [node.id, node]));
  const outputSignalsByNodeId = new Map(outputSignalNodes.map((node) => [node.id, node]));
  const bodyInputById = createBodySignalIndex(body.inputSignals);
  const bodyOutputById = createBodySignalIndex(body.outputSignals);
  const neuronLeafNodes = leafNodes.filter((node): node is NeuronNode => node.kind === 'neuron');
  assertBodyBindingsTargetRootAdapterSignals(body, inputSignalsByNodeId, outputSignalsByNodeId);

  const orderedInputBindings = body.brainBindings.inputs
    .map((binding) => {
      const node = inputSignalsByNodeId.get(binding.brainSignalNodeId);
      const bodySignal = bodyInputById.get(binding.bodySignalId);
      if (!node || !bodySignal) {
        throw new Error(`Body input binding "${binding.bodySignalId}" failed validation.`);
      }
      return {
        node,
        bodySignal,
        index: resolveInputSignalIndex(bodySignal),
      };
    })
    .sort((left, right) => left.index - right.index || left.node.id.localeCompare(right.node.id));
  const seenInputIndices = new Map<number, string>();
  for (const binding of orderedInputBindings) {
    const existingNodeId = seenInputIndices.get(binding.index);
    if (existingNodeId) {
      throw new Error(
        `Body input bindings for "${existingNodeId}" and "${binding.node.id}" resolve to the same visual input index ${binding.index}.`
      );
    }

    seenInputIndices.set(binding.index, binding.node.id);
  }

  const orderedOutputBindings = body.brainBindings.outputs.map((binding, index) => {
    const node = outputSignalsByNodeId.get(binding.brainSignalNodeId);
    const bodySignal = bodyOutputById.get(binding.bodySignalId);
    if (!node || !bodySignal) {
      throw new Error(`Body output binding "${binding.bodySignalId}" failed validation.`);
    }
    return {
      node,
      bodySignal,
      index,
    };
  });

  const inputPorts = orderedInputBindings.map(({ node, bodySignal, index }) =>
    createInputPortFromBinding(node, bodySignal, index)
  );
  const outputPorts = orderedOutputBindings.map(({ node, bodySignal, index }) =>
    createOutputPortFromBinding(node, bodySignal, index)
  );
  const neuronNodes = neuronLeafNodes.map((node) => createNeuronRuntimeNode(node, modelsById));
  const signalNodes = allSignalNodes.map(createSignalRuntimeNode);
  const inputBindings = orderedInputBindings.map<BrainProgramInputBinding>(({ node, index }) => {
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

  const compiledAgentProgram = compileAgentIR(
    createAgentIRFromLegacyGraph('legacy-graph-bridge', document, body)
  );

  return {
    legacyGraphIR: document,
    compiledAgentProgram,
    inputPorts,
    neuronNodes,
    outputPorts,
    signalNodes,
    links,
    inputBindings,
    outputBindings: orderedOutputBindings.map<BrainProgramOutputBinding>(({ node, bodySignal }) => {
      const model = modelsById.get(node.modelId);
      if (!model) {
        throw new Error(`Missing model "${node.modelId}" for output signal node "${node.id}".`);
      }

      return {
        nodeId: node.id,
        portId: resolveSignalPortId(model, 'input', node.id),
        channel: bodySignal.target.channel,
      };
    }),
    modelsById,
    nodeIndex: {
      inputs: new Map(inputPorts.map((port) => [port.id, port])),
      neurons: new Map(neuronNodes.map((node) => [node.id, node])),
      outputs: new Map(signalNodes.filter((node) => node.direction === 'output').map((node) => [node.id, node])),
    },
  } as LegacyGraphProgram;
};
