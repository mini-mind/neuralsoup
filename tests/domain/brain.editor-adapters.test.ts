import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultBrainGraph } from '../../src/domain/brain';
import {
  createEffectorFromGraph,
  createNodesFromGraph,
  createReceptorFromGraph,
  createSynapsesFromGraph,
  reconcileBrainGraphVisionCells,
  updateGraphNeuronsFromNodes,
  updateGraphSynapsesFromEditorSynapses,
} from '../../src/components/utils/defaultSNNData';

test('editor adapters derive topology view models directly from BrainGraph', () => {
  const graph = createDefaultBrainGraph(4);
  graph.synapses.push({
    id: 'synapse-1',
    from: 'vision-R-0',
    to: 'neuron-1',
    weight: 0.8,
  });

  const nodes = createNodesFromGraph(graph);
  const synapses = createSynapsesFromGraph(graph);
  const receptor = createReceptorFromGraph(graph);
  const effector = createEffectorFromGraph(graph);

  assert.equal(nodes.length, graph.neurons.length);
  assert.equal(synapses.length, graph.synapses.length);
  assert.equal(receptor.modalities[0]?.inputs.length, graph.inputs.length);
  assert.deepEqual(
    effector.outputs.map((output) => output.id),
    graph.outputs.map((output) => output.id)
  );
});

test('editor adapters write node and synapse edits back into BrainGraph', () => {
  const graph = createDefaultBrainGraph(2);
  const editedNodes = createNodesFromGraph(graph).map((node) =>
    node.id === 'neuron-1'
      ? {
          ...node,
          label: 'Renamed neuron',
          x: 123,
          y: 234,
          params: {
            ...node.params!,
            threshold: 42,
          },
        }
      : node
  );

  const graphWithEditedNodes = updateGraphNeuronsFromNodes(graph, editedNodes);
  assert.equal(graphWithEditedNodes.neurons[0]?.label, 'Renamed neuron');
  assert.deepEqual(graphWithEditedNodes.neurons[0]?.position, { x: 123, y: 234 });
  assert.equal(graphWithEditedNodes.neurons[0]?.params.threshold, 42);

  const graphWithEditedSynapses = updateGraphSynapsesFromEditorSynapses(graphWithEditedNodes, [
    {
      id: 'synapse-editor-1',
      from: 'vision-R-0',
      to: 'neuron-1',
      weight: -1.2,
    },
  ]);

  assert.deepEqual(graphWithEditedSynapses.synapses, [
    {
      id: 'synapse-editor-1',
      from: 'vision-R-0',
      to: 'neuron-1',
      weight: -1.2,
    },
  ]);
});

test('vision cell reconciliation preserves neurons and removes now-invalid port synapses', () => {
  const graph = createDefaultBrainGraph(3);
  graph.synapses.push(
    {
      id: 'keep-synapse',
      from: 'vision-R-0',
      to: 'neuron-1',
      weight: 0.5,
    },
    {
      id: 'drop-synapse',
      from: 'vision-B-2',
      to: 'neuron-2',
      weight: 0.9,
    }
  );

  const reconciled = reconcileBrainGraphVisionCells(graph, 2);

  assert.equal(reconciled.inputs.length, 6);
  assert.equal(reconciled.outputs.length, 3);
  assert.deepEqual(
    reconciled.neurons.map((neuron) => neuron.id),
    graph.neurons.map((neuron) => neuron.id)
  );
  assert.deepEqual(
    reconciled.synapses.map((synapse) => synapse.id),
    ['keep-synapse']
  );
});
