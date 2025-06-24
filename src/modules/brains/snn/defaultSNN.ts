// src/modules/brains/snn/defaultSNN.ts

// 这些是临时的类型定义，理想情况下应从 shared/interfaces 导入
interface SNNNode {
  id: string;
  x: number;
  y: number;
  type: 'neuron' | 'receptor' | 'effector';
  [key: string]: any;
}

interface SNNSynapse {
  id: string;
  from: string;
  to: string;
  weight: number;
}

export const createDefaultNodes = (): SNNNode[] => {
  return [
    { id: 'neuron-1', type: 'neuron', x: 200, y: 150 },
    { id: 'neuron-2', type: 'neuron', x: 200, y: 250 },
  ];
};

export const createDefaultReceptors = (): SNNNode[] => {
  return [
    { id: 'receptor-1', type: 'receptor', x: 50, y: 200 },
  ];
};

export const createDefaultEffectors = (): SNNNode[] => {
  return [
    { id: 'effector-1', type: 'effector', x: 350, y: 150 },
    { id: 'effector-2', type: 'effector', x: 350, y: 250 },
  ];
};

export const createDefaultTopology = () => {
  const nodes = createDefaultNodes();
  const receptors = createDefaultReceptors();
  const effectors = createDefaultEffectors();

  return {
    nodes: [...receptors, ...nodes, ...effectors],
    synapses: [] as SNNSynapse[],
    canvasOffset: { x: 0, y: 0 },
    canvasScale: 1,
  };
}; 