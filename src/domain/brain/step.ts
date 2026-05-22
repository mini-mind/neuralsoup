import type { BrainOutputChannel, IzhikevichNeuronRuntimeState } from './shared';
import type { BrainProgram } from './program';
import { createAgentProgramRuntimeState, stepAgentProgram, type AgentProgramRuntimeState } from './agent-step';

export interface BrainProgramRuntimeState {
  neurons: Map<string, IzhikevichNeuronRuntimeState>;
  signals: Map<string, number>;
  agentRuntimeState?: AgentProgramRuntimeState;
  activeLeafNodeIds: string[];
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
const ACTIVE_SIGNAL_EPSILON = 1e-6;

const sigmoid = (value: number): number => 1 / (1 + Math.exp(-value));

const normalizeOutputSignal = (value: number): number =>
  clampUnit((sigmoid(value * 2) - 0.5) * 2);

export const createBrainProgramRuntimeState = (
  program: BrainProgram
): BrainProgramRuntimeState => ({
  neurons: new Map(
    program.neuronNodes.map((neuron) => [neuron.id, DEFAULT_RUNTIME_STATE()])
  ),
  signals: new Map(program.signalNodes.map((signalNode) => [signalNode.id, 0])),
  agentRuntimeState: program.agentProgram ? createAgentProgramRuntimeState(program.agentProgram) : undefined,
  activeLeafNodeIds: [],
});

export const resetBrainProgramRuntimeState = (
  program: BrainProgram
): BrainProgramRuntimeState => createBrainProgramRuntimeState(program);

export const stepBrainProgram = (
  program: BrainProgram,
  sensoryInputs: number[],
  previousState: BrainProgramRuntimeState,
  deltaTimeSeconds: number,
  timestamp: number = Date.now()
): BrainProgramStepResult => {
  if (program.agentProgram) {
    const agentResult = stepAgentProgram(
      program.agentProgram,
      sensoryInputs,
      previousState.agentRuntimeState ?? createAgentProgramRuntimeState(program.agentProgram),
      deltaTimeSeconds,
      timestamp
    );

    return {
      runtimeState: {
        neurons: agentResult.runtimeState.neurons,
        signals: previousState.signals,
        agentRuntimeState: agentResult.runtimeState,
        activeLeafNodeIds: agentResult.runtimeState.activeLeafNodeIds,
      },
      outputs: agentResult.outputs,
    };
  }

  const previousNeurons = previousState.neurons;
  const nextNeurons = new Map<string, IzhikevichNeuronRuntimeState>();
  const nextSignals = new Map<string, number>();
  const nextSpikes = new Map<string, number>();
  const activeLeafNodeIds = new Set<string>();

  for (const binding of program.inputBindings) {
    const signalValue = sensoryInputs[binding.index] ?? 0;
    nextSignals.set(binding.nodeId, signalValue);
    if (Math.abs(signalValue) > ACTIVE_SIGNAL_EPSILON) {
      activeLeafNodeIds.add(binding.nodeId);
    }
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
      activeLeafNodeIds.add(neuron.id);
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

  for (const signalNode of program.signalNodes) {
    if (program.inputBindings.some((binding) => binding.nodeId === signalNode.id)) {
      continue;
    }

    const totalSignal = signalNode.inputConnections.reduce(
      (sum, connection) => sum + resolveConnectionSignal(connection.sourceNodeId) * connection.weight,
      0
    );
    nextSignals.set(signalNode.id, totalSignal);
    if (Math.abs(totalSignal) > ACTIVE_SIGNAL_EPSILON) {
      activeLeafNodeIds.add(signalNode.id);
    }
  }

  const outputs = program.outputBindings.reduce<Record<BrainOutputChannel, number>>(
    (result, binding) => {
      const totalSignal = nextSignals.get(binding.nodeId) ?? 0;
      const outputValue = normalizeOutputSignal(totalSignal);
      result[binding.channel] = outputValue;
      if (outputValue > ACTIVE_SIGNAL_EPSILON) {
        activeLeafNodeIds.add(binding.nodeId);
      }
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
      signals: nextSignals,
      activeLeafNodeIds: [...activeLeafNodeIds],
    },
    outputs,
  };
};
