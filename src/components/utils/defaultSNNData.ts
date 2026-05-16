import {
  createDefaultBrainGraph,
  reconcileBrainGraphVisionCells as reconcileBrainGraphVisionPorts,
  type BrainGraph,
  type BrainInputPort,
  type BrainNeuronNode,
  type BrainOutputPort,
  type BrainSynapse,
  type IzhikevichNeuronParameters,
} from '../../domain/brain';
import {
  SNNNode,
  Receptor,
  Effector,
  ReceptorInput,
  EffectorOutput,
  ReceptorModality,
  SNNSynapse,
} from '../../types/simulation';

export const DEFAULT_EDITOR_NEURON_PARAMS: IzhikevichNeuronParameters = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
};

const getPortRowY = (channel: BrainInputPort['channel']): number => {
  switch (channel) {
    case 'R':
      return 16;
    case 'G':
      return 36;
    case 'B':
      return 56;
  }
};

const createReceptorInputsFromGraph = (graph: BrainGraph): ReceptorInput[] => {
  const nodeSpacing = 24;
  const startX = 16;

  return graph.inputs.map((input) => ({
    id: input.id,
    x: startX + input.index * nodeSpacing,
    y: getPortRowY(input.channel),
    label: input.label,
    voltage: 0,
    colorType: input.channel,
  }));
};

const getEffectorX = (output: BrainOutputPort): number => 20 + output.index * 70;

const createDefaultGraph = (visionCells: number): BrainGraph => createDefaultBrainGraph(visionCells);

const mapNeuronToEditorNode = (neuron: BrainNeuronNode): SNNNode => ({
  id: neuron.id,
  x: neuron.position.x,
  y: neuron.position.y,
  type: 'neuron',
  label: neuron.label,
  params: { ...neuron.params },
});

const mapSynapseToEditorSynapse = (synapse: BrainSynapse): SNNSynapse => ({
  id: synapse.id,
  from: synapse.from,
  to: synapse.to,
  weight: synapse.weight,
});

const mapEditorNodeToNeuron = (node: SNNNode): BrainNeuronNode => ({
  id: node.id,
  label: node.label,
  position: {
    x: node.x,
    y: node.y,
  },
  params: { ...(node.params ?? DEFAULT_EDITOR_NEURON_PARAMS) },
});

const mapEditorSynapseToBrainSynapse = (synapse: SNNSynapse): BrainSynapse => ({
  id: synapse.id,
  from: synapse.from,
  to: synapse.to,
  weight: synapse.weight,
});

export const createReceptorFromGraph = (graph: BrainGraph): Receptor => {
  const visionInputs = createReceptorInputsFromGraph(graph);
  const firstInputX = visionInputs[0]?.x ?? 16;
  const lastInputX = visionInputs[visionInputs.length - 1]?.x ?? firstInputX;
  const contentWidth = lastInputX + firstInputX;
  const receptorWidth = Math.max(200, contentWidth);

  const modalities: ReceptorModality[] = [
    {
      type: 'vision',
      label: '视觉输入',
      inputs: visionInputs,
      isExpanded: true
    }
  ];

  return {
    id: 'receptor-1',
    x: 0,
    y: 0,
    width: receptorWidth,
    height: 80, // 统一使用新的高度
    modalities,
    activeModality: 'vision'
  };
};

export const createEffectorFromGraph = (graph: BrainGraph): Effector => {
  const outputs: EffectorOutput[] = graph.outputs.map((output) => ({
    id: output.id,
    x: getEffectorX(output),
    y: 25,
    label: output.label,
    signal: 0,
    pulseAccumulation: 0,
    decayRate: 0.85,
    lastUpdateTime: 0,
  }));

  return {
    id: 'effector-1',
    x: 0,
    y: 0,
    width: 60 + outputs.length * 70,
    height: 60,
    outputs
  };
};

export const createNodesFromGraph = (graph: BrainGraph): SNNNode[] =>
  graph.neurons.map(mapNeuronToEditorNode);

export const createSynapsesFromGraph = (graph: BrainGraph): SNNSynapse[] =>
  graph.synapses.map(mapSynapseToEditorSynapse);

export const updateGraphNeuronsFromNodes = (
  graph: BrainGraph,
  nodes: SNNNode[]
): BrainGraph => ({
  ...graph,
  neurons: nodes.map(mapEditorNodeToNeuron),
});

export const updateGraphSynapsesFromEditorSynapses = (
  graph: BrainGraph,
  synapses: SNNSynapse[]
): BrainGraph => ({
  ...graph,
  synapses: synapses.map(mapEditorSynapseToBrainSynapse),
});

export const reconcileBrainGraphVisionCells = (
  graph: BrainGraph,
  visionCells: number
): BrainGraph => reconcileBrainGraphVisionPorts(graph, visionCells);

export const createDefaultEditorGraph = (visionCells: number = 36): BrainGraph =>
  createDefaultGraph(visionCells);

export const createDefaultReceptor = (visionCells: number = 36): Receptor =>
  createReceptorFromGraph(createDefaultGraph(visionCells));

export const createDefaultEffector = (visionCells: number = 36): Effector =>
  createEffectorFromGraph(createDefaultGraph(visionCells));

export const createDefaultNodes = (visionCells: number = 36): SNNNode[] =>
  createNodesFromGraph(createDefaultGraph(visionCells));
