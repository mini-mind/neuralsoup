import type { IzhikevichNeuronRuntimeState } from './shared';
import type { AgentProgram } from './agent-program';

export type AgentWorldInputSignalMap = Record<string, number>;

export interface AgentProgramRuntimeState {
  neurons: Map<string, IzhikevichNeuronRuntimeState>;
  bodyOutputs: Map<string, number>;
  activeLeafNodeIds: string[];
}

export interface AgentProgramStepResult {
  runtimeState: AgentProgramRuntimeState;
  outputSignals: Array<{
    id: string;
    target: string;
    normalizedTarget: string;
    worldPort: string;
    commandKind: string;
    value: number;
  }>;
  outputsByTarget: Record<string, number>;
}

const ACTIVE_SIGNAL_EPSILON = 1e-6;
const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));

export const createAgentProgramRuntimeState = (program: AgentProgram): AgentProgramRuntimeState => ({
  neurons: new Map(
    program.neuronNodes.map((neuron) => [
      neuron.id,
      {
        v: neuron.initialState.v,
        u: neuron.initialState.u,
        spike: false,
        lastSpikeTime: 0,
      },
    ])
  ),
  bodyOutputs: new Map(program.outputPorts.map((port) => [port.id, 0])),
  activeLeafNodeIds: [],
});

export const stepAgentProgram = (
  program: AgentProgram,
  sensoryInputs: AgentWorldInputSignalMap,
  previousState: AgentProgramRuntimeState,
  deltaTime: number,
  timestamp: number
): AgentProgramStepResult => {
  const nextNeurons = new Map<string, IzhikevichNeuronRuntimeState>();
  const activeLeafNodeIds = new Set<string>();
  const neuronSpikes = new Map<string, number>();

  const resolveBodyInput = (nodeId: string): number => {
    const inputNode = program.bodyInputsById.get(nodeId);
    if (!inputNode) {
      return 0;
    }

    const rawValue = sensoryInputs[inputNode.source] ?? sensoryInputs[inputNode.id] ?? 0;
    const scaledValue = rawValue * inputNode.scale;
    if (Math.abs(scaledValue) > ACTIVE_SIGNAL_EPSILON) {
      activeLeafNodeIds.add(nodeId);
    }
    return scaledValue;
  };

  const resolveConnectionSignal = (sourceNodeId: string): number => {
    const inputValue = resolveBodyInput(sourceNodeId);
    if (Math.abs(inputValue) > ACTIVE_SIGNAL_EPSILON) {
      return inputValue;
    }

    if (neuronSpikes.has(sourceNodeId)) {
      return neuronSpikes.get(sourceNodeId) ?? 0;
    }

    const previousNeuron = previousState.neurons.get(sourceNodeId);
    return previousNeuron?.spike ? 1 : 0;
  };

  for (const neuron of program.neuronNodes) {
    const currentState = previousState.neurons.get(neuron.id) ?? {
      v: neuron.initialState.v,
      u: neuron.initialState.u,
      spike: false,
      lastSpikeTime: 0,
    };
    const totalInput = neuron.inputConnections.reduce(
      (sum, connection) => sum + resolveConnectionSignal(connection.sourceNodeId) * connection.weight * 20,
      0
    );

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
      neuronSpikes.set(neuron.id, 1);
      activeLeafNodeIds.add(neuron.id);
      continue;
    }

    nextNeurons.set(neuron.id, {
      v: nextV,
      u: nextU,
      spike: false,
      lastSpikeTime: currentState.lastSpikeTime,
    });
    neuronSpikes.set(neuron.id, 0);
  }

  const nextBodyOutputs = new Map<string, number>();
  for (const port of program.outputPorts) {
    const incomingSignal = program.connections.reduce((sum, connection) => {
      if (connection.targetNodeId !== port.id) {
        return sum;
      }
      return sum + resolveConnectionSignal(connection.sourceNodeId) * connection.weight;
    }, 0);

    const previousValue = previousState.bodyOutputs.get(port.id) ?? 0;
    const nextValue = incomingSignal > ACTIVE_SIGNAL_EPSILON ? 1 : Math.max(0, previousValue - port.decayPerSecond * deltaTime);
    nextBodyOutputs.set(port.id, nextValue);
    if (nextValue > ACTIVE_SIGNAL_EPSILON) {
      activeLeafNodeIds.add(port.id);
    }
  }

  const outputSignals = program.outputPorts.map((port) => ({
    id: port.id,
    target: port.target,
    normalizedTarget: port.normalizedTarget,
    worldPort: port.worldPort,
    commandKind: port.commandKind,
    value: clampUnit(nextBodyOutputs.get(port.id) ?? 0),
  }));
  const outputsByTarget: Record<string, number> = {};
  for (const signal of outputSignals) {
    outputsByTarget[signal.target] = signal.value;
  }

  return {
    runtimeState: {
      neurons: nextNeurons,
      bodyOutputs: nextBodyOutputs,
      activeLeafNodeIds: [...activeLeafNodeIds],
    },
    outputSignals,
    outputsByTarget,
  };
};
