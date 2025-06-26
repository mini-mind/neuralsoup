import { NetworkTopology, IzhikevichNeuron, STDPSynapse } from '../core/types';

/**
 * 创建演示用的神经网络拓扑
 */
export function createDemoNetworkTopology(): NetworkTopology {
  const topology = new NetworkTopology();
  
  // 创建输入层神经元
  const input1 = new IzhikevichNeuron('input-1', 'input', 100, 150);
  const input2 = new IzhikevichNeuron('input-2', 'input', 100, 250);
  const input3 = new IzhikevichNeuron('input-3', 'input', 100, 350);
  
  // 创建隐藏层神经元
  const hidden1 = new IzhikevichNeuron('hidden-1', 'hidden', 300, 150);
  const hidden2 = new IzhikevichNeuron('hidden-2', 'hidden', 300, 250);
  const hidden3 = new IzhikevichNeuron('hidden-3', 'hidden', 300, 350);
  const hidden4 = new IzhikevichNeuron('hidden-4', 'hidden', 450, 200);
  
  // 创建输出层神经元
  const output1 = new IzhikevichNeuron('output-1', 'output', 600, 200);
  const output2 = new IzhikevichNeuron('output-2', 'output', 600, 300);
  
  // 添加节点到拓扑
  topology.addNode(input1);
  topology.addNode(input2);
  topology.addNode(input3);
  topology.addNode(hidden1);
  topology.addNode(hidden2);
  topology.addNode(hidden3);
  topology.addNode(hidden4);
  topology.addNode(output1);
  topology.addNode(output2);
  
  // 创建突触连接
  const synapses = [
    // 输入层到隐藏层
    new STDPSynapse('syn-1', 'input-1', 'hidden-1', 0.8),
    new STDPSynapse('syn-2', 'input-1', 'hidden-2', 0.6),
    new STDPSynapse('syn-3', 'input-2', 'hidden-2', 0.7),
    new STDPSynapse('syn-4', 'input-2', 'hidden-3', 0.5),
    new STDPSynapse('syn-5', 'input-3', 'hidden-3', 0.9),
    new STDPSynapse('syn-6', 'input-3', 'hidden-1', 0.4),
    
    // 隐藏层内部连接
    new STDPSynapse('syn-7', 'hidden-1', 'hidden-4', 0.6),
    new STDPSynapse('syn-8', 'hidden-2', 'hidden-4', 0.7),
    new STDPSynapse('syn-9', 'hidden-3', 'hidden-4', 0.5),
    
    // 隐藏层到输出层
    new STDPSynapse('syn-10', 'hidden-1', 'output-1', 0.8),
    new STDPSynapse('syn-11', 'hidden-2', 'output-1', 0.6),
    new STDPSynapse('syn-12', 'hidden-3', 'output-2', 0.7),
    new STDPSynapse('syn-13', 'hidden-4', 'output-1', 0.9),
    new STDPSynapse('syn-14', 'hidden-4', 'output-2', 0.8),
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