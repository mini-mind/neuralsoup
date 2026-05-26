import type { IzhikevichNeuronRuntimeState } from './shared';
import type { AgentProgram, AgentProgramConnection, AgentProgramDualExpStdpConnection } from './agent-program';

export type AgentWorldInputSignalMap = Record<string, number>;

export interface AgentProgramConductanceRuntimeState {
  singleExpByConnectionId: Map<string, number>;
  dualExpRiseByConnectionId: Map<string, number>;
  dualExpDecayByConnectionId: Map<string, number>;
}

export interface AgentProgramDualExpStdpRuntimeParameters {
  gMax: number;
  reversalPotential: number;
  tauRiseMs: number;
  tauDecayMs: number;
  aPlus: number;
  aMinus: number;
  tauPlusMs: number;
  tauMinusMs: number;
  wMin: number;
  wMax: number;
}

export interface AgentProgramStdpRuntimeState {
  paramsByConnectionId: Map<string, AgentProgramDualExpStdpRuntimeParameters>;
  preTraceByConnectionId: Map<string, number>;
  postTraceByConnectionId: Map<string, number>;
  effectiveWeightByConnectionId: Map<string, number>;
}

export interface AgentProgramDelayedSignalStateEntry {
  signal: number;
  remainingDelayMs: number;
}

export interface AgentProgramDelayRuntimeState {
  pendingSignalsByConnectionId: Map<string, AgentProgramDelayedSignalStateEntry[]>;
}

export interface AgentProgramRuntimeState {
  neurons: Map<string, IzhikevichNeuronRuntimeState>;
  bodyOutputs: Map<string, number>;
  delay: AgentProgramDelayRuntimeState;
  conductance: AgentProgramConductanceRuntimeState;
  stdp: AgentProgramStdpRuntimeState;
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

type AgentProgramConductanceConnection = Extract<
  AgentProgramConnection,
  { synapseKind: 'single-exp-conductance' | 'dual-exp-conductance' | 'dual-exp-stdp' }
>;
type AgentProgramDualExpConnection = Extract<AgentProgramConnection, { synapseKind: 'dual-exp-conductance' | 'dual-exp-stdp' }>;

const ACTIVE_SIGNAL_EPSILON = 1e-6;
const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));
const STATIC_CURRENT_GAIN = 20;
const EMPTY_NUMBER_MAP = new Map<string, number>();
const EMPTY_STDP_PARAMS_MAP = new Map<string, AgentProgramDualExpStdpRuntimeParameters>();
const EMPTY_DELAY_SIGNAL_QUEUE: AgentProgramDelayedSignalStateEntry[] = [];
const EMPTY_DELAY_SIGNAL_MAP = new Map<string, AgentProgramDelayedSignalStateEntry[]>();
const clampValue = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const resolveFiniteNumber = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback);
const resolvePositiveTimeConstantMs = (value: number): number => {
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return 1;
};

const resolveStaticCurrentNeuronDrive = (signal: number, weight: number): number =>
  signal * weight * STATIC_CURRENT_GAIN;

const resolveStaticCurrentOutputDrive = (signal: number, weight: number): number =>
  signal * weight;

const resolveExpDecayFactor = (deltaTimeMs: number, tauMs: number): number => Math.exp(-deltaTimeMs / tauMs);

const resolvePositiveSignal = (value: number): number => (value > ACTIVE_SIGNAL_EPSILON ? value : 0);
const resolveSpikeEvent = (value: number): number => (value > ACTIVE_SIGNAL_EPSILON ? 1 : 0);
const resolveConnectionDelayMs = (delayMs: number): number =>
  Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;

const resolveDualExpStdpRuntimeParameters = (
  connection: AgentProgramDualExpStdpConnection
): AgentProgramDualExpStdpRuntimeParameters => {
  const fallbackWeight = resolveFiniteNumber(connection.weight, 0);
  const rawWMin = resolveFiniteNumber(connection.wMin, fallbackWeight);
  const rawWMax = resolveFiniteNumber(connection.wMax, fallbackWeight);
  const wMin = Math.min(rawWMin, rawWMax);
  const wMax = Math.max(rawWMin, rawWMax);

  return {
    gMax: resolveFiniteNumber(connection.gMax, 0),
    reversalPotential: resolveFiniteNumber(connection.reversalPotential, 0),
    tauRiseMs: resolvePositiveTimeConstantMs(connection.tauRiseMs),
    tauDecayMs: resolvePositiveTimeConstantMs(connection.tauDecayMs),
    aPlus: resolveFiniteNumber(connection.aPlus, 0),
    aMinus: resolveFiniteNumber(connection.aMinus, 0),
    tauPlusMs: resolvePositiveTimeConstantMs(connection.tauPlusMs),
    tauMinusMs: resolvePositiveTimeConstantMs(connection.tauMinusMs),
    wMin,
    wMax,
  };
};

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
  delay: {
    pendingSignalsByConnectionId: new Map(program.connections.map((connection) => [connection.id, []])),
  },
  conductance: {
    singleExpByConnectionId: new Map(
      program.connections
        .filter((connection) => connection.synapseKind === 'single-exp-conductance')
        .map((connection) => [connection.id, 0])
    ),
    dualExpRiseByConnectionId: new Map(
      program.connections
        .filter(
          (connection): connection is AgentProgramDualExpConnection =>
            connection.synapseKind === 'dual-exp-conductance' || connection.synapseKind === 'dual-exp-stdp'
        )
        .map((connection) => [connection.id, 0])
    ),
    dualExpDecayByConnectionId: new Map(
      program.connections
        .filter(
          (connection): connection is AgentProgramDualExpConnection =>
            connection.synapseKind === 'dual-exp-conductance' || connection.synapseKind === 'dual-exp-stdp'
        )
        .map((connection) => [connection.id, 0])
    ),
  },
  stdp: {
    paramsByConnectionId: new Map(
      program.connections
        .filter(
          (connection): connection is AgentProgramDualExpStdpConnection =>
            connection.synapseKind === 'dual-exp-stdp'
        )
        .map((connection) => [connection.id, resolveDualExpStdpRuntimeParameters(connection)])
    ),
    preTraceByConnectionId: new Map(
      program.connections
        .filter((connection) => connection.synapseKind === 'dual-exp-stdp')
        .map((connection) => [connection.id, 0])
    ),
    postTraceByConnectionId: new Map(
      program.connections
        .filter((connection) => connection.synapseKind === 'dual-exp-stdp')
        .map((connection) => [connection.id, 0])
    ),
    effectiveWeightByConnectionId: new Map(
      program.connections
        .filter(
          (connection): connection is AgentProgramDualExpStdpConnection =>
            connection.synapseKind === 'dual-exp-stdp'
        )
        .map((connection) => {
          const params = resolveDualExpStdpRuntimeParameters(connection);
          return [connection.id, clampValue(resolveFiniteNumber(connection.weight, 0), params.wMin, params.wMax)];
        })
    ),
  },
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
  const deltaTimeMs = Math.max(0, deltaTime * 1000);
  const previousSingleExpByConnectionId = previousState.conductance?.singleExpByConnectionId ?? EMPTY_NUMBER_MAP;
  const previousDualExpRiseByConnectionId = previousState.conductance?.dualExpRiseByConnectionId ?? EMPTY_NUMBER_MAP;
  const previousDualExpDecayByConnectionId = previousState.conductance?.dualExpDecayByConnectionId ?? EMPTY_NUMBER_MAP;
  const previousStdpParamsByConnectionId = previousState.stdp?.paramsByConnectionId ?? EMPTY_STDP_PARAMS_MAP;
  const previousStdpPreTraceByConnectionId = previousState.stdp?.preTraceByConnectionId ?? EMPTY_NUMBER_MAP;
  const previousStdpPostTraceByConnectionId = previousState.stdp?.postTraceByConnectionId ?? EMPTY_NUMBER_MAP;
  const previousStdpEffectiveWeightByConnectionId =
    previousState.stdp?.effectiveWeightByConnectionId ?? EMPTY_NUMBER_MAP;
  const previousPendingSignalsByConnectionId =
    previousState.delay?.pendingSignalsByConnectionId ?? EMPTY_DELAY_SIGNAL_MAP;
  const delayedSignalByConnectionId = new Map<string, number>();
  const nextSingleExpByConnectionId = new Map<string, number>();
  const nextDualExpRiseByConnectionId = new Map<string, number>();
  const nextDualExpDecayByConnectionId = new Map<string, number>();
  const nextPendingSignalsByConnectionId = new Map<string, AgentProgramDelayedSignalStateEntry[]>();
  const nextStdpParamsByConnectionId = new Map<string, AgentProgramDualExpStdpRuntimeParameters>();
  const nextStdpPreTraceByConnectionId = new Map<string, number>();
  const nextStdpPostTraceByConnectionId = new Map<string, number>();
  const nextStdpEffectiveWeightByConnectionId = new Map<string, number>();
  const stdpPreSpikeByConnectionId = new Map<string, number>();

  const resolveBodyInput = (nodeId: string): number => {
    const inputNode = program.bodyInputsById.get(nodeId);
    if (!inputNode) {
      return 0;
    }

    const rawValue = sensoryInputs[inputNode.source] ?? 0;
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

  const resolveDelayedConnectionSignal = (connection: AgentProgramConnection): number => {
    const cachedSignal = delayedSignalByConnectionId.get(connection.id);
    if (typeof cachedSignal === 'number') {
      return cachedSignal;
    }

    const rawSignal = resolveConnectionSignal(connection.sourceNodeId);
    const previousQueue = previousPendingSignalsByConnectionId.get(connection.id) ?? EMPTY_DELAY_SIGNAL_QUEUE;
    const nextQueue: AgentProgramDelayedSignalStateEntry[] = [];
    let delayedSignal = 0;

    for (const queuedSignal of previousQueue) {
      const remainingDelayMs = queuedSignal.remainingDelayMs - deltaTimeMs;
      if (remainingDelayMs <= 0) {
        delayedSignal = queuedSignal.signal;
      } else {
        nextQueue.push({
          signal: queuedSignal.signal,
          remainingDelayMs,
        });
      }
    }

    const connectionDelayMs = resolveConnectionDelayMs(connection.delayMs);
    if (connectionDelayMs <= 0) {
      delayedSignal = rawSignal;
    } else {
      nextQueue.push({
        signal: rawSignal,
        remainingDelayMs: connectionDelayMs,
      });
    }

    nextPendingSignalsByConnectionId.set(connection.id, nextQueue);
    delayedSignalByConnectionId.set(connection.id, delayedSignal);
    return delayedSignal;
  };

  const resolveSourceMembranePotential = (sourceNodeId: string): number => {
    const nextNeuron = nextNeurons.get(sourceNodeId);
    if (nextNeuron) {
      return nextNeuron.v;
    }
    const previousNeuron = previousState.neurons.get(sourceNodeId);
    if (previousNeuron) {
      return previousNeuron.v;
    }
    return 0;
  };

  const resolveStdpRuntimeParameters = (connection: AgentProgramDualExpStdpConnection): AgentProgramDualExpStdpRuntimeParameters => {
    const existingParams = nextStdpParamsByConnectionId.get(connection.id) ?? previousStdpParamsByConnectionId.get(connection.id);
    if (existingParams) {
      nextStdpParamsByConnectionId.set(connection.id, existingParams);
      return existingParams;
    }
    const resolved = resolveDualExpStdpRuntimeParameters(connection);
    nextStdpParamsByConnectionId.set(connection.id, resolved);
    return resolved;
  };

  const resolveConnectionReversalPotential = (connection: AgentProgramConductanceConnection): number => {
    if (connection.synapseKind !== 'dual-exp-stdp') {
      return connection.reversalPotential;
    }
    return resolveStdpRuntimeParameters(connection).reversalPotential;
  };

  const resolveConnectionConductance = (connection: AgentProgramConductanceConnection, sourceSignal: number): number => {
    const positiveSignal = resolvePositiveSignal(sourceSignal);
    if (connection.synapseKind === 'single-exp-conductance') {
      const previousStateValue = previousSingleExpByConnectionId.get(connection.id) ?? 0;
      const decayFactor = resolveExpDecayFactor(deltaTimeMs, connection.tauDecayMs);
      const nextStateValue = previousStateValue * decayFactor + positiveSignal;
      nextSingleExpByConnectionId.set(connection.id, nextStateValue);
      return connection.gMax * connection.weight * nextStateValue;
    }

    const isStdpConnection = connection.synapseKind === 'dual-exp-stdp';
    const tauRiseMs = isStdpConnection ? resolveStdpRuntimeParameters(connection).tauRiseMs : connection.tauRiseMs;
    const tauDecayMs = isStdpConnection ? resolveStdpRuntimeParameters(connection).tauDecayMs : connection.tauDecayMs;
    const previousRiseStateValue = previousDualExpRiseByConnectionId.get(connection.id) ?? 0;
    const previousDecayStateValue = previousDualExpDecayByConnectionId.get(connection.id) ?? 0;
    const riseDecayFactor = resolveExpDecayFactor(deltaTimeMs, tauRiseMs);
    const decayDecayFactor = resolveExpDecayFactor(deltaTimeMs, tauDecayMs);
    const nextRiseStateValue = previousRiseStateValue * riseDecayFactor + positiveSignal;
    const nextDecayStateValue = previousDecayStateValue * decayDecayFactor + positiveSignal;
    nextDualExpRiseByConnectionId.set(connection.id, nextRiseStateValue);
    nextDualExpDecayByConnectionId.set(connection.id, nextDecayStateValue);
    const dualExpConductanceState = Math.max(0, nextDecayStateValue - nextRiseStateValue);

    if (!isStdpConnection) {
      return connection.gMax * connection.weight * dualExpConductanceState;
    }

    const dualExpStdpParams = resolveStdpRuntimeParameters(connection);
    const preSpikeEvent = resolveSpikeEvent(sourceSignal);
    stdpPreSpikeByConnectionId.set(connection.id, preSpikeEvent);

    const previousEffectiveWeight = previousStdpEffectiveWeightByConnectionId.get(connection.id);
    const effectiveWeight =
      typeof previousEffectiveWeight === 'number'
        ? previousEffectiveWeight
        : clampValue(resolveFiniteNumber(connection.weight, 0), dualExpStdpParams.wMin, dualExpStdpParams.wMax);

    return dualExpStdpParams.gMax * effectiveWeight * dualExpConductanceState;
  };

  for (const neuron of program.neuronNodes) {
    const currentState = previousState.neurons.get(neuron.id) ?? {
      v: neuron.initialState.v,
      u: neuron.initialState.u,
      spike: false,
      lastSpikeTime: 0,
    };
    const totalInput = neuron.inputConnections.reduce((sum, connection) => {
      const sourceSignal = resolveDelayedConnectionSignal(connection);
      if (connection.synapseKind === 'static-current') {
        return sum + resolveStaticCurrentNeuronDrive(sourceSignal, connection.weight);
      }
      const conductance = resolveConnectionConductance(connection, sourceSignal);
      return sum + conductance * (resolveConnectionReversalPotential(connection) - currentState.v);
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
      const sourceSignal = resolveDelayedConnectionSignal(connection);
      if (connection.synapseKind === 'static-current') {
        return sum + resolveStaticCurrentOutputDrive(sourceSignal, connection.weight);
      }
      const conductance = resolveConnectionConductance(connection, sourceSignal);
      const sourceMembranePotential = resolveSourceMembranePotential(connection.sourceNodeId);
      return sum + conductance * (resolveConnectionReversalPotential(connection) - sourceMembranePotential);
    }, 0);

    const previousValue = previousState.bodyOutputs.get(port.id) ?? 0;
    const nextValue = incomingSignal > ACTIVE_SIGNAL_EPSILON ? 1 : Math.max(0, previousValue - port.decayPerSecond * deltaTime);
    nextBodyOutputs.set(port.id, nextValue);
    if (nextValue > ACTIVE_SIGNAL_EPSILON) {
      activeLeafNodeIds.add(port.id);
    }
  }

  for (const connection of program.connections) {
    if (connection.synapseKind !== 'dual-exp-stdp') {
      continue;
    }

    const params = resolveStdpRuntimeParameters(connection);
    const preTraceDecayFactor = resolveExpDecayFactor(deltaTimeMs, params.tauPlusMs);
    const postTraceDecayFactor = resolveExpDecayFactor(deltaTimeMs, params.tauMinusMs);

    const previousPreTrace = previousStdpPreTraceByConnectionId.get(connection.id) ?? 0;
    const previousPostTrace = previousStdpPostTraceByConnectionId.get(connection.id) ?? 0;
    const decayedPreTrace = previousPreTrace * preTraceDecayFactor;
    const decayedPostTrace = previousPostTrace * postTraceDecayFactor;
    const preSpikeEvent = stdpPreSpikeByConnectionId.get(connection.id) ?? 0;
    const postSpikeEvent = resolveSpikeEvent(neuronSpikes.get(connection.targetNodeId) ?? 0);

    const previousEffectiveWeight = previousStdpEffectiveWeightByConnectionId.get(connection.id);
    const baseEffectiveWeight =
      typeof previousEffectiveWeight === 'number'
        ? previousEffectiveWeight
        : clampValue(resolveFiniteNumber(connection.weight, 0), params.wMin, params.wMax);

    let nextEffectiveWeight = baseEffectiveWeight;
    if (preSpikeEvent > 0) {
      nextEffectiveWeight -= params.aMinus * decayedPostTrace;
    }
    if (postSpikeEvent > 0) {
      nextEffectiveWeight += params.aPlus * (decayedPreTrace + preSpikeEvent);
    }
    nextEffectiveWeight = clampValue(nextEffectiveWeight, params.wMin, params.wMax);

    nextStdpPreTraceByConnectionId.set(connection.id, decayedPreTrace + preSpikeEvent);
    nextStdpPostTraceByConnectionId.set(connection.id, decayedPostTrace + postSpikeEvent);
    nextStdpEffectiveWeightByConnectionId.set(connection.id, nextEffectiveWeight);
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
      delay: {
        pendingSignalsByConnectionId: nextPendingSignalsByConnectionId,
      },
      conductance: {
        singleExpByConnectionId: nextSingleExpByConnectionId,
        dualExpRiseByConnectionId: nextDualExpRiseByConnectionId,
        dualExpDecayByConnectionId: nextDualExpDecayByConnectionId,
      },
      stdp: {
        paramsByConnectionId: nextStdpParamsByConnectionId,
        preTraceByConnectionId: nextStdpPreTraceByConnectionId,
        postTraceByConnectionId: nextStdpPostTraceByConnectionId,
        effectiveWeightByConnectionId: nextStdpEffectiveWeightByConnectionId,
      },
      activeLeafNodeIds: [...activeLeafNodeIds],
    },
    outputSignals,
    outputsByTarget,
  };
};
