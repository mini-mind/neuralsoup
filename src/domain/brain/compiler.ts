import type { BrainGraph } from './types';
import type { BrainProgram } from './program';
import { validateBrainGraph } from './validation';

export class BrainGraphValidationError extends Error {
  public readonly issues: string[];

  constructor(issues: string[]) {
    super(`Brain graph validation failed: ${issues.join(' | ')}`);
    this.name = 'BrainGraphValidationError';
    this.issues = issues;
  }
}

export const compileBrainGraph = (graph: BrainGraph): BrainProgram => {
  const issues = validateBrainGraph(graph);
  if (issues.length > 0) {
    throw new BrainGraphValidationError(issues.map((issue) => issue.message));
  }

  return {
    graph,
    inputPorts: [...graph.inputs].sort((left, right) => left.index - right.index),
    neuronNodes: [...graph.neurons],
    outputPorts: [...graph.outputs].sort((left, right) => left.index - right.index),
    synapses: [...graph.synapses],
    nodeIndex: {
      inputs: new Map(graph.inputs.map((input) => [input.id, input])),
      neurons: new Map(graph.neurons.map((neuron) => [neuron.id, neuron])),
      outputs: new Map(graph.outputs.map((output) => [output.id, output])),
    },
  };
};

