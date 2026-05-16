import type { BrainOutputChannel, IzhikevichNeuronRuntimeState } from './types';
import type { BrainProgram } from './program';

export interface BrainProgramRuntimeState {
  neurons: Map<string, IzhikevichNeuronRuntimeState>;
}

export interface BrainProgramStepResult {
  runtimeState: BrainProgramRuntimeState;
  outputs: Record<BrainOutputChannel, number>;
}

const DEFAULT_RUNTIME_STATE = (): IzhikevichNeuronRuntimeState => ({
  v: -65,
  u: 0,
  spike: false,
  lastSpikeTime: 0
});

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

const sigmoid = (value: number): number => 1 / (1 + Math.exp(-value));

export const createBrainProgramRuntimeState = (
  program: BrainProgram
): BrainProgramRuntimeState => ({
  neurons: new Map(
    program.neuronNodes.map((neuron: BrainProgram['neuronNodes'][number]) => [neuron.id, DEFAULT_RUNTIME_STATE()])
  )
});

export const resetBrainProgramRuntimeState = (
  program: BrainProgram
): BrainProgramRuntimeState => createBrainProgramRuntimeState(program);

export const stepBrainProgram = (
  program: BrainProgram,
  sensoryInputs: number[],
  previousState: BrainProgramRuntimeState,
  timestamp: number
): BrainProgramStepResult => {
  const previousNeurons = previousState.neurons;
  const nextNeurons = new Map<string, IzhikevichNeuronRuntimeState>();
  const nextSpikes = new Map<string, number>();

  const resolveInputSignal = (nodeId: string): number => {
    const inputPort = program.nodeIndex.inputs.get(nodeId);
    if (inputPort) {
      return sensoryInputs[inputPort.index] ?? 0;
    }

    const neuronState = previousNeurons.get(nodeId);
    if (neuronState?.spike) {
      return 1;
    }

    return 0;
  };

  for (const neuron of program.neuronNodes) {
    const currentState = previousNeurons.get(neuron.id) ?? DEFAULT_RUNTIME_STATE();
    const totalInput = program.synapses.reduce((sum: number, synapse: BrainProgram['synapses'][number]) => {
      if (synapse.to !== neuron.id) {
        return sum;
      }

      return sum + resolveInputSignal(synapse.from) * synapse.weight * 20;
    }, 0);

    const nextV =
      currentState.v +
      0.1 * (0.04 * currentState.v * currentState.v + 5 * currentState.v + 140 - currentState.u + totalInput);
    const nextU =
      currentState.u +
      0.1 * (neuron.params.a * (neuron.params.b * nextV - currentState.u));

    if (nextV >= neuron.params.threshold) {
      nextNeurons.set(neuron.id, {
        v: neuron.params.c,
        u: nextU + neuron.params.d,
        spike: true,
        lastSpikeTime: timestamp
      });
      nextSpikes.set(neuron.id, 1);
      continue;
    }

    nextNeurons.set(neuron.id, {
      v: nextV,
      u: nextU,
      spike: false,
      lastSpikeTime: currentState.lastSpikeTime
    });
    nextSpikes.set(neuron.id, 0);
  }

  const outputs = program.outputPorts.reduce<Record<BrainOutputChannel, number>>(
    (result, output: BrainProgram['outputPorts'][number]) => {
      const totalSignal = program.synapses.reduce((sum: number, synapse: BrainProgram['synapses'][number]) => {
        if (synapse.to !== output.id) {
          return sum;
        }

        const inputPort = program.nodeIndex.inputs.get(synapse.from);
        if (inputPort) {
          return sum + (sensoryInputs[inputPort.index] ?? 0) * synapse.weight;
        }

        return sum + (nextSpikes.get(synapse.from) ?? 0) * synapse.weight;
      }, 0);

      result[output.channel] = clampUnit(sigmoid(totalSignal * 2) * 1.2 - 0.1);
      return result;
    },
    {
      'turn-left': 0,
      'move-forward': 0,
      'turn-right': 0
    }
  );

  return {
    runtimeState: {
      neurons: nextNeurons
    },
    outputs
  };
};
