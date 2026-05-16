import type { BrainGraph } from './types';

export interface BrainGraphValidationIssue {
  code:
    | 'duplicate-input-id'
    | 'duplicate-neuron-id'
    | 'duplicate-output-id'
    | 'duplicate-synapse-id'
    | 'missing-synapse-source'
    | 'missing-synapse-target'
    | 'invalid-synapse-direction';
  message: string;
}

const getNodeKindsById = (graph: BrainGraph): Map<string, 'input' | 'neuron' | 'output'> => {
  const nodeKindsById = new Map<string, 'input' | 'neuron' | 'output'>();

  for (const input of graph.inputs) {
    nodeKindsById.set(input.id, 'input');
  }

  for (const neuron of graph.neurons) {
    nodeKindsById.set(neuron.id, 'neuron');
  }

  for (const output of graph.outputs) {
    nodeKindsById.set(output.id, 'output');
  }

  return nodeKindsById;
};

const collectDuplicateIssues = (
  ids: string[],
  duplicateCode: BrainGraphValidationIssue['code'],
  label: string
): BrainGraphValidationIssue[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
      continue;
    }

    seen.add(id);
  }

  return [...duplicates].map((id) => ({
    code: duplicateCode,
    message: `${label} "${id}" is duplicated.`,
  }));
};

export const validateBrainGraph = (graph: BrainGraph): BrainGraphValidationIssue[] => {
  const issues: BrainGraphValidationIssue[] = [
    ...collectDuplicateIssues(
      graph.inputs.map((input) => input.id),
      'duplicate-input-id',
      'Input port ID'
    ),
    ...collectDuplicateIssues(
      graph.neurons.map((neuron) => neuron.id),
      'duplicate-neuron-id',
      'Neuron ID'
    ),
    ...collectDuplicateIssues(
      graph.outputs.map((output) => output.id),
      'duplicate-output-id',
      'Output port ID'
    ),
    ...collectDuplicateIssues(
      graph.synapses.map((synapse) => synapse.id),
      'duplicate-synapse-id',
      'Synapse ID'
    ),
  ];

  const nodeKindsById = getNodeKindsById(graph);

  for (const synapse of graph.synapses) {
    const sourceKind = nodeKindsById.get(synapse.from);
    const targetKind = nodeKindsById.get(synapse.to);

    if (!sourceKind) {
      issues.push({
        code: 'missing-synapse-source',
        message: `Synapse "${synapse.id}" references missing source "${synapse.from}".`,
      });
      continue;
    }

    if (!targetKind) {
      issues.push({
        code: 'missing-synapse-target',
        message: `Synapse "${synapse.id}" references missing target "${synapse.to}".`,
      });
      continue;
    }

    if (sourceKind === 'output' || targetKind === 'input') {
      issues.push({
        code: 'invalid-synapse-direction',
        message: `Synapse "${synapse.id}" has invalid direction ${sourceKind} -> ${targetKind}.`,
      });
    }
  }

  return issues;
};

