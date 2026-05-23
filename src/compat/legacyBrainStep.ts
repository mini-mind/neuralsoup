import type { BrainOutputChannel, IzhikevichNeuronRuntimeState } from '../domain/brain/shared';
import type { LegacyBrainProgram } from '../compat/legacyBrainProgram';
import { createAgentProgramRuntimeState, stepAgentProgram, type AgentProgramRuntimeState } from '../domain/brain/agent-step';
import type { AgentProgram } from '../domain/brain/agent-program';

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

type AgentBackedLegacyBrainProgram = LegacyBrainProgram & {
  compiledAgentProgram: AgentProgram;
};

const DEFAULT_RUNTIME_STATE = (): IzhikevichNeuronRuntimeState => ({
  v: -65,
  u: 0,
  spike: false,
  lastSpikeTime: 0,
});

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

const getCompiledAgentProgram = (program: LegacyBrainProgram): AgentProgram => {
  const candidate = program as Partial<AgentBackedLegacyBrainProgram>;
  if (!candidate.compiledAgentProgram) {
    throw new Error('LegacyBrainProgram is missing the compiled Agent runtime payload.');
  }
  return candidate.compiledAgentProgram;
};

export const createLegacyBrainProgramRuntimeState = (
  program: LegacyBrainProgram
): BrainProgramRuntimeState => {
  const compiledAgentProgram = getCompiledAgentProgram(program);
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
  const compiledAgentProgram = getCompiledAgentProgram(program);
  const agentResult = stepAgentProgram(
    compiledAgentProgram,
    sensoryInputs,
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
      activeLeafNodeIds: agentResult.runtimeState.activeLeafNodeIds,
    },
    outputs: agentResult.outputs,
  };
};
