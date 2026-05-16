import type {
  BrainGraph,
  BrainInputChannel,
  BrainInputPort,
  BrainNeuronNode,
  BrainOutputPort,
  BrainOutputChannel,
  IzhikevichNeuronParameters,
} from './types';

const DEFAULT_NEURON_PARAMS: IzhikevichNeuronParameters = {
  a: 0.02,
  b: 0.2,
  c: -65,
  d: 8,
  threshold: 30,
};

const OUTPUT_CHANNELS: Array<{ channel: BrainOutputChannel; label: string }> = [
  { channel: 'turn-left', label: '左转' },
  { channel: 'move-forward', label: '前进' },
  { channel: 'turn-right', label: '右转' },
];

const INPUT_CHANNELS: BrainInputChannel[] = ['R', 'G', 'B'];

const createVisionInputPorts = (visionCells: number): BrainInputPort[] => {
  const ports: BrainInputPort[] = [];
  let index = 0;

  for (const channel of INPUT_CHANNELS) {
    for (let cellIndex = 0; cellIndex < visionCells; cellIndex += 1) {
      ports.push({
        id: `vision-${channel}-${cellIndex}`,
        label: `${channel}${cellIndex}`,
        modality: 'vision',
        channel,
        index,
      });
      index += 1;
    }
  }

  return ports;
};

const createDefaultNeurons = (): BrainNeuronNode[] => [
  {
    id: 'neuron-1',
    label: '神经元1',
    position: { x: 50, y: 150 },
    params: { ...DEFAULT_NEURON_PARAMS },
  },
  {
    id: 'neuron-2',
    label: '神经元2',
    position: { x: 50, y: 250 },
    params: { ...DEFAULT_NEURON_PARAMS },
  },
];

const createDefaultOutputPorts = (): BrainOutputPort[] =>
  OUTPUT_CHANNELS.map(({ channel, label }, index) => ({
    id: `output-${channel}`,
    label,
    channel,
    index,
  }));

export const createDefaultBrainGraph = (visionCells: number = 36): BrainGraph => ({
  inputs: createVisionInputPorts(visionCells),
  neurons: createDefaultNeurons(),
  outputs: createDefaultOutputPorts(),
  synapses: [],
});

export const reconcileBrainGraphVisionCells = (
  graph: BrainGraph,
  visionCells: number
): BrainGraph => {
  const nextDefault = createDefaultBrainGraph(visionCells);
  const validNodeIds = new Set<string>([
    ...nextDefault.inputs.map((input) => input.id),
    ...graph.neurons.map((neuron) => neuron.id),
    ...nextDefault.outputs.map((output) => output.id)
  ]);

  return {
    ...graph,
    inputs: nextDefault.inputs,
    outputs: nextDefault.outputs,
    synapses: graph.synapses.filter((synapse) => (
      validNodeIds.has(synapse.from) && validNodeIds.has(synapse.to)
    ))
  };
};
