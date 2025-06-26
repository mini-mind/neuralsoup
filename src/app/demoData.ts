export const demoSNNTopology = {
  nodes: [
    { id: 'vision-1', type: 'input', x: 50, y: 100 },
    { id: 'vision-2', type: 'input', x: 50, y: 200 },
    { id: 'motor-1', type: 'output', x: 450, y: 100 },
    { id: 'motor-2', type: 'output', x: 450, y: 200 },
    { id: 'neuron-1', type: 'neuron', x: 250, y: 150 },
  ],
  synapses: [
    { from: 'vision-1', to: 'neuron-1', weight: 1 },
    { from: 'vision-2', to: 'neuron-1', weight: 1 },
    { from: 'neuron-1', to: 'motor-1', weight: 1 },
    { from: 'neuron-1', to: 'motor-2', weight: 1 },
  ],
  canvasOffset: { x: 0, y: 0 },
  canvasScale: 1,
}; 