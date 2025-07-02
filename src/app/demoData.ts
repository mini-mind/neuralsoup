import { NetworkTopology, IzhikevichNeuron, STDPSynapse } from '../core/types';

/**
 * 创建简化的演示用神经网络拓扑，仅包含2个IZ神经元通过STDP突触串联
 */
export function createDemoNetworkTopology(): NetworkTopology {
  const topology = new NetworkTopology();

  // 创建2个IZ神经元串联
  const neuron1 = new IzhikevichNeuron('neuron-1', 200, 200);
  const neuron2 = new IzhikevichNeuron('neuron-2', 400, 200);

  // 添加神经元到拓扑
  topology.addNode(neuron1);
  topology.addNode(neuron2);

  // 创建STDP突触连接：neuron-1 -> neuron-2
  const synapse = new STDPSynapse('syn-1', 'neuron-1', 'neuron-2', 0.5);

  // 添加突触到拓扑
  topology.addEdge(synapse);

  return topology;
}



// 简化的SNN拓扑数据结构，与NetworkTopology保持一致
export const demoSNNTopology = {
  nodes: [],  // 空数组，所有节点都在NetworkTopology中管理
  synapses: [], // 空数组，所有突触都在NetworkTopology中管理
  canvasOffset: { x: 0, y: 0 },
  canvasScale: 1,
};