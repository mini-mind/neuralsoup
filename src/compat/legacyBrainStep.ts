import type { BrainOutputChannel, IzhikevichNeuronRuntimeState } from '../domain/brain/shared';
import {
  getLegacyBrainProgramRuntimePayload,
  type LegacyBrainProgram,
} from '../compat/legacyBrainProgram';
import {
  createAgentProgramRuntimeState,
  stepAgentProgram,
  type AgentProgramRuntimeState,
  type AgentWorldInputSignalMap,
} from '../domain/brain/agent-step';

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

export type LegacyBrainProgramRuntimeState = BrainProgramRuntimeState;
export type LegacyBrainProgramStepResult = BrainProgramStepResult;

const DEFAULT_RUNTIME_STATE = (): IzhikevichNeuronRuntimeState => ({
  v: -65,
  u: 0,
  spike: false,
  lastSpikeTime: 0,
});

const toCompatOutputs = (outputsByTarget: Record<string, number>): Record<BrainOutputChannel, number> => ({
  'turn-left': outputsByTarget['action.turn-left'] ?? outputsByTarget['turn-left'] ?? 0,
  'move-forward': outputsByTarget['action.move-forward'] ?? outputsByTarget['move-forward'] ?? 0,
  'turn-right': outputsByTarget['action.turn-right'] ?? outputsByTarget['turn-right'] ?? 0,
});

const toAgentWorldInputs = (program: LegacyBrainProgram, sensoryInputs: number[]): AgentWorldInputSignalMap => {
  const inputsBySource: AgentWorldInputSignalMap = {};

  for (const inputPort of getLegacyBrainProgramRuntimePayload(program).inputPorts) {
    const legacyBinding = program.inputBindings.find((binding) => binding.nodeId === inputPort.id);
    if (!legacyBinding) {
      continue;
    }
    inputsBySource[inputPort.source] = sensoryInputs[legacyBinding.index] ?? 0;
  }

  return inputsBySource;
};

const buildCompatSignalSnapshotFromAgentRuntime = (
  program: LegacyBrainProgram,
  sensoryInputs: number[],
  agentRuntimeState: AgentProgramRuntimeState
): Map<string, number> => {
  const nextSignals = new Map(program.signalNodes.map((signalNode) => [signalNode.id, 0]));

  for (const binding of program.inputBindings) {
    nextSignals.set(binding.nodeId, sensoryInputs[binding.index] ?? 0);
  }

  for (const binding of program.outputBindings) {
    const outputValue = agentRuntimeState.bodyOutputs.get(binding.nodeId) ?? 0;
    nextSignals.set(binding.nodeId, outputValue);
  }

  return nextSignals;
};

const buildCompatActiveLeafNodeIds = (
  program: LegacyBrainProgram,
  sensoryInputs: number[],
  agentRuntimeState: AgentProgramRuntimeState
): string[] => {
  const activeNodeIds = new Set(agentRuntimeState.activeLeafNodeIds);

  for (const binding of program.inputBindings) {
    if ((sensoryInputs[binding.index] ?? 0) !== 0) {
      activeNodeIds.add(binding.nodeId);
    }
  }

  return [...activeNodeIds];
};

export const createLegacyBrainProgramRuntimeState = (
  program: LegacyBrainProgram
): BrainProgramRuntimeState => {
  const compiledAgentProgram = getLegacyBrainProgramRuntimePayload(program);
  const agentRuntimeState = createAgentProgramRuntimeState(compiledAgentProgram);
  return {
    neurons: new Map(
      program.neuronNodes.map((neuron) => [
        neuron.id,
        agentRuntimeState.neurons.get(neuron.id) ?? DEFAULT_RUNTIME_STATE(),
      ])
    ),
    signals: new Map(program.signalNodes.map((signalNode) => [signalNode.id, 0])),
    agentRuntimeState,
    activeLeafNodeIds: [],
  };
};

export const resetLegacyBrainProgramRuntimeState = (
  program: LegacyBrainProgram
): BrainProgramRuntimeState => createLegacyBrainProgramRuntimeState(program);

export const stepLegacyBrainProgram = (
  program: LegacyBrainProgram,
  sensoryInputs: number[],
  previousState: BrainProgramRuntimeState,
  deltaTimeSeconds: number,
  timestamp: number = Date.now()
): BrainProgramStepResult => {
  const compiledAgentProgram = getLegacyBrainProgramRuntimePayload(program);
  const agentResult = stepAgentProgram(
    compiledAgentProgram,
    toAgentWorldInputs(program, sensoryInputs),
    previousState.agentRuntimeState ?? createAgentProgramRuntimeState(compiledAgentProgram),
    deltaTimeSeconds,
    timestamp
  );

  return {
    runtimeState: {
      neurons: agentResult.runtimeState.neurons,
      signals: buildCompatSignalSnapshotFromAgentRuntime(
        program,
        sensoryInputs,
        agentResult.runtimeState
      ),
      agentRuntimeState: agentResult.runtimeState,
      activeLeafNodeIds: buildCompatActiveLeafNodeIds(
        program,
        sensoryInputs,
        agentResult.runtimeState
      ),
    },
    outputs: toCompatOutputs(agentResult.outputsByTarget),
  };
};
