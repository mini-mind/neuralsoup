import { NetworkTopology, IzhikevichNeuron, LIFNeuron, STDPSynapse } from '../core/types';

/**
 * 创建演示用的神经网络拓扑，只包含真正的神经元
 */
export function createDemoNetworkTopology(): NetworkTopology {
  const topology = new NetworkTopology();

  // 创建输入层神经元（模拟感受器输入）
  const input1 = new IzhikevichNeuron('input-1', 50, 100);
  const input2 = new LIFNeuron('input-2', 50, 150);
  const input3 = new IzhikevichNeuron('input-3', 50, 200);
  const input4 = new LIFNeuron('input-4', 50, 250);

  // 创建中间层神经元（混合IZ和LIF）
  const neuron1 = new IzhikevichNeuron('neuron-1', 200, 100);
  const neuron2 = new LIFNeuron('neuron-2', 200, 150);
  const neuron3 = new IzhikevichNeuron('neuron-3', 200, 200);
  const neuron4 = new LIFNeuron('neuron-4', 200, 250);

  // 创建处理层神经元
  const neuron5 = new IzhikevichNeuron('neuron-5', 350, 125);
  const neuron6 = new LIFNeuron('neuron-6', 350, 175);
  const neuron7 = new IzhikevichNeuron('neuron-7', 350, 225);

  // 创建输出层神经元（模拟效应器输出）
  const output1 = new IzhikevichNeuron('output-1', 500, 150);
  const output2 = new LIFNeuron('output-2', 500, 200);

  // 添加所有神经元到拓扑
  // 输入层神经元
  topology.addNode(input1);
  topology.addNode(input2);
  topology.addNode(input3);
  topology.addNode(input4);

  // 中间层神经元
  topology.addNode(neuron1);
  topology.addNode(neuron2);
  topology.addNode(neuron3);
  topology.addNode(neuron4);

  // 处理层神经元
  topology.addNode(neuron5);
  topology.addNode(neuron6);
  topology.addNode(neuron7);

  // 输出层神经元
  topology.addNode(output1);
  topology.addNode(output2);
  
  // 创建突触连接 - 从输入层到中间层到输出层
  const synapses = [
    // 输入层到中间层神经元
    new STDPSynapse('syn-1', 'input-1', 'neuron-1', 0.8),
    new STDPSynapse('syn-2', 'input-1', 'neuron-2', 0.6),
    new STDPSynapse('syn-3', 'input-2', 'neuron-2', 0.7),
    new STDPSynapse('syn-4', 'input-2', 'neuron-3', 0.5),
    new STDPSynapse('syn-5', 'input-3', 'neuron-3', 0.9),
    new STDPSynapse('syn-6', 'input-3', 'neuron-4', 0.4),
    new STDPSynapse('syn-7', 'input-4', 'neuron-4', 0.6),
    new STDPSynapse('syn-8', 'input-4', 'neuron-1', 0.3),

    // 中间层到处理层
    new STDPSynapse('syn-9', 'neuron-1', 'neuron-5', 0.7),
    new STDPSynapse('syn-10', 'neuron-2', 'neuron-5', 0.5),
    new STDPSynapse('syn-11', 'neuron-2', 'neuron-6', 0.6),
    new STDPSynapse('syn-12', 'neuron-3', 'neuron-6', 0.8),
    new STDPSynapse('syn-13', 'neuron-3', 'neuron-7', 0.4),
    new STDPSynapse('syn-14', 'neuron-4', 'neuron-7', 0.7),

    // 处理层到输出层
    new STDPSynapse('syn-15', 'neuron-5', 'output-1', 0.9),
    new STDPSynapse('syn-16', 'neuron-6', 'output-1', 0.6),
    new STDPSynapse('syn-17', 'neuron-6', 'output-2', 0.8),
    new STDPSynapse('syn-18', 'neuron-7', 'output-2', 0.7),

    // 一些交叉连接增加复杂性
    new STDPSynapse('syn-19', 'neuron-1', 'neuron-7', 0.3),
    new STDPSynapse('syn-20', 'neuron-4', 'neuron-5', 0.4),
  ];
  
  // 添加突触到拓扑
  synapses.forEach(synapse => {
    topology.addEdge(synapse);
  });
  
  return topology;
}



// 保持原有的简单数据结构以兼容现有代码
export const demoSNNTopology = {
  nodes: [
    { id: 'input-1', type: 'input', x: 100, y: 150 },
    { id: 'input-2', type: 'input', x: 100, y: 250 },
    { id: 'input-3', type: 'input', x: 100, y: 350 },
    { id: 'hidden-1', type: 'hidden', x: 300, y: 150 },
    { id: 'hidden-2', type: 'hidden', x: 300, y: 250 },
    { id: 'hidden-3', type: 'hidden', x: 300, y: 350 },
    { id: 'hidden-4', type: 'hidden', x: 450, y: 200 },
    { id: 'output-1', type: 'output', x: 600, y: 200 },
    { id: 'output-2', type: 'output', x: 600, y: 300 },
  ],
  synapses: [
    { id: 'syn-1', from: 'input-1', to: 'hidden-1', weight: 0.8 },
    { id: 'syn-2', from: 'input-1', to: 'hidden-2', weight: 0.6 },
    { id: 'syn-3', from: 'input-2', to: 'hidden-2', weight: 0.7 },
    { id: 'syn-4', from: 'input-2', to: 'hidden-3', weight: 0.5 },
    { id: 'syn-5', from: 'input-3', to: 'hidden-3', weight: 0.9 },
    { id: 'syn-6', from: 'input-3', to: 'hidden-1', weight: 0.4 },
    { id: 'syn-7', from: 'hidden-1', to: 'hidden-4', weight: 0.6 },
    { id: 'syn-8', from: 'hidden-2', to: 'hidden-4', weight: 0.7 },
    { id: 'syn-9', from: 'hidden-3', to: 'hidden-4', weight: 0.5 },
    { id: 'syn-10', from: 'hidden-1', to: 'output-1', weight: 0.8 },
    { id: 'syn-11', from: 'hidden-2', to: 'output-1', weight: 0.6 },
    { id: 'syn-12', from: 'hidden-3', to: 'output-2', weight: 0.7 },
    { id: 'syn-13', from: 'hidden-4', to: 'output-1', weight: 0.9 },
    { id: 'syn-14', from: 'hidden-4', to: 'output-2', weight: 0.8 },
  ],
  canvasOffset: { x: 0, y: 0 },
  canvasScale: 1,
}; 