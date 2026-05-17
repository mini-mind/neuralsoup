import type { BrainOutputChannel, IzhikevichNeuronRuntimeState } from './shared';
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
  lastSpikeTime: 0,
});

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

const sigmoid = (value: number): number => 1 / (1 + Math.exp(-value));

const normalizeOutputSignal = (value: number): number =>
  clampUnit((sigmoid(value * 2) - 0.5) * 2);

export const createBrainProgramRuntimeState = (
  program: BrainProgram
): BrainProgramRuntimeState => ({
  neurons: new Map(
    program.neuronNodes.map((neuron) => [neuron.id, DEFAULT_RUNTIME_STATE()])
  ),
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
  const nextSignals = new Map<string, number>();
  const nextSpikes = new Map<string, number>();

  for (const binding of program.inputBindings) {
    nextSignals.set(binding.nodeId, sensoryInputs[binding.index] ?? 0);
  }

  const resolveConnectionSignal = (sourceNodeId: string): number => {
    if (nextSignals.has(sourceNodeId)) {
      return nextSignals.get(sourceNodeId) ?? 0;
    }

    if (nextSpikes.has(sourceNodeId)) {
      return nextSpikes.get(sourceNodeId) ?? 0;
    }

    const sourceState = previousNeurons.get(sourceNodeId);
    if (sourceState?.spike) {
      return 1;
    }

    return 0;
  };

  for (const neuron of program.neuronNodes) {
    const currentState = previousNeurons.get(neuron.id) ?? DEFAULT_RUNTIME_STATE();
    const totalInput = neuron.inputConnections.reduce((sum, connection) => (
      sum + resolveConnectionSignal(connection.sourceNodeId) * connection.weight * 20
    ), 0);

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
        lastSpikeTime: timestamp,
      });
      nextSpikes.set(neuron.id, 1);
      continue;
    }

    nextNeurons.set(neuron.id, {
      v: nextV,
      u: nextU,
      spike: false,
      lastSpikeTime: currentState.lastSpikeTime,
    });
    nextSpikes.set(neuron.id, 0);
  }

  for (const signalNode of program.signalNodes.filter((node) => node.direction === 'output')) {
    const totalSignal = signalNode.inputConnections.reduce((sum, connection) => (
      sum + resolveConnectionSignal(connection.sourceNodeId) * connection.weight
    ), 0);
    nextSignals.set(signalNode.id, totalSignal);
  }

  const outputs = program.outputBindings.reduce<Record<BrainOutputChannel, number>>(
    (result, binding) => {
      const totalSignal = nextSignals.get(binding.nodeId) ?? 0;
      result[binding.channel] = normalizeOutputSignal(totalSignal);
      return result;
    },
    {
      'turn-left': 0,
      'move-forward': 0,
      'turn-right': 0,
    }
  );

  return {
    runtimeState: {
      neurons: nextNeurons,
    },
    outputs,
  };
};
