import { NetworkTopology, IzhikevichNeuron, LIFNeuron, STDPSynapse } from '../core/types';
import { VoltageInputNode, VoltageAccumulatorNode } from '../core/entities/types';

/**
 * 创建演示用的神经网络拓扑，包含感受器输入和效应器输出
 */
export function createDemoNetworkTopology(): NetworkTopology {
  const topology = new NetworkTopology();

  // 创建视觉感受器节点（输入层）
  const sensor1 = new VoltageInputNode('sensor-1', 50, 100);
  const sensor2 = new VoltageInputNode('sensor-2', 50, 150);
  const sensor3 = new VoltageInputNode('sensor-3', 50, 200);
  const sensor4 = new VoltageInputNode('sensor-4', 50, 250);

  // 创建中间层神经元（混合IZ和LIF）
  const neuron1 = new IzhikevichNeuron('neuron-1', 200, 100);
  const neuron2 = new LIFNeuron('neuron-2', 200, 150);
  const neuron3 = new IzhikevichNeuron('neuron-3', 200, 200);
  const neuron4 = new LIFNeuron('neuron-4', 200, 250);

  // 创建处理层神经元
  const neuron5 = new IzhikevichNeuron('neuron-5', 350, 125);
  const neuron6 = new LIFNeuron('neuron-6', 350, 175);
  const neuron7 = new IzhikevichNeuron('neuron-7', 350, 225);

  // 创建效应器节点（输出层）
  const effector1 = new VoltageAccumulatorNode('effector-1', 500, 150);
  const effector2 = new VoltageAccumulatorNode('effector-2', 500, 200);

  // 添加所有节点到拓扑
  // 感受器节点
  topology.addNode(sensor1);
  topology.addNode(sensor2);
  topology.addNode(sensor3);
  topology.addNode(sensor4);

  // 中间层神经元
  topology.addNode(neuron1);
  topology.addNode(neuron2);
  topology.addNode(neuron3);
  topology.addNode(neuron4);

  // 处理层神经元
  topology.addNode(neuron5);
  topology.addNode(neuron6);
  topology.addNode(neuron7);

  // 效应器节点
  topology.addNode(effector1);
  topology.addNode(effector2);
  
  // 创建突触连接 - 从感受器到神经元到效应器
  const synapses = [
    // 感受器到中间层神经元
    new STDPSynapse('syn-1', 'sensor-1', 'neuron-1', 0.8),
    new STDPSynapse('syn-2', 'sensor-1', 'neuron-2', 0.6),
    new STDPSynapse('syn-3', 'sensor-2', 'neuron-2', 0.7),
    new STDPSynapse('syn-4', 'sensor-2', 'neuron-3', 0.5),
    new STDPSynapse('syn-5', 'sensor-3', 'neuron-3', 0.9),
    new STDPSynapse('syn-6', 'sensor-3', 'neuron-4', 0.4),
    new STDPSynapse('syn-7', 'sensor-4', 'neuron-4', 0.6),
    new STDPSynapse('syn-8', 'sensor-4', 'neuron-1', 0.3),

    // 中间层到处理层
    new STDPSynapse('syn-9', 'neuron-1', 'neuron-5', 0.7),
    new STDPSynapse('syn-10', 'neuron-2', 'neuron-5', 0.5),
    new STDPSynapse('syn-11', 'neuron-2', 'neuron-6', 0.6),
    new STDPSynapse('syn-12', 'neuron-3', 'neuron-6', 0.8),
    new STDPSynapse('syn-13', 'neuron-3', 'neuron-7', 0.4),
    new STDPSynapse('syn-14', 'neuron-4', 'neuron-7', 0.7),

    // 处理层到效应器
    new STDPSynapse('syn-15', 'neuron-5', 'effector-1', 0.9),
    new STDPSynapse('syn-16', 'neuron-6', 'effector-1', 0.6),
    new STDPSynapse('syn-17', 'neuron-6', 'effector-2', 0.8),
    new STDPSynapse('syn-18', 'neuron-7', 'effector-2', 0.7),

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

/**
 * 创建演示用的SNN拓扑数据，用于可视化编辑器
 */
export function createDemoSNNTopology() {
  return {
    nodes: [
      // 感受器节点
      { id: 'sensor-1', type: 'voltage_input', x: 50, y: 100 },
      { id: 'sensor-2', type: 'voltage_input', x: 50, y: 150 },
      { id: 'sensor-3', type: 'voltage_input', x: 50, y: 200 },
      { id: 'sensor-4', type: 'voltage_input', x: 50, y: 250 },

      // 中间层神经元
      { id: 'neuron-1', type: 'izhikevich', x: 200, y: 100 },
      { id: 'neuron-2', type: 'lif', x: 200, y: 150 },
      { id: 'neuron-3', type: 'izhikevich', x: 200, y: 200 },
      { id: 'neuron-4', type: 'lif', x: 200, y: 250 },

      // 处理层神经元
      { id: 'neuron-5', type: 'izhikevich', x: 350, y: 125 },
      { id: 'neuron-6', type: 'lif', x: 350, y: 175 },
      { id: 'neuron-7', type: 'izhikevich', x: 350, y: 225 },

      // 效应器节点
      { id: 'effector-1', type: 'voltage_accumulator', x: 500, y: 150 },
      { id: 'effector-2', type: 'voltage_accumulator', x: 500, y: 200 },
    ],
    edges: [
      // 感受器到中间层
      { id: 'syn-1', fromNodeId: 'sensor-1', toNodeId: 'neuron-1', weight: 0.8 },
      { id: 'syn-2', fromNodeId: 'sensor-1', toNodeId: 'neuron-2', weight: 0.6 },
      { id: 'syn-3', fromNodeId: 'sensor-2', toNodeId: 'neuron-2', weight: 0.7 },
      { id: 'syn-4', fromNodeId: 'sensor-2', toNodeId: 'neuron-3', weight: 0.5 },
      { id: 'syn-5', fromNodeId: 'sensor-3', toNodeId: 'neuron-3', weight: 0.9 },
      { id: 'syn-6', fromNodeId: 'sensor-3', toNodeId: 'neuron-4', weight: 0.4 },
      { id: 'syn-7', fromNodeId: 'sensor-4', toNodeId: 'neuron-4', weight: 0.6 },
      { id: 'syn-8', fromNodeId: 'sensor-4', toNodeId: 'neuron-1', weight: 0.3 },

      // 中间层到处理层
      { id: 'syn-9', fromNodeId: 'neuron-1', toNodeId: 'neuron-5', weight: 0.7 },
      { id: 'syn-10', fromNodeId: 'neuron-2', toNodeId: 'neuron-5', weight: 0.5 },
      { id: 'syn-11', fromNodeId: 'neuron-2', toNodeId: 'neuron-6', weight: 0.6 },
      { id: 'syn-12', fromNodeId: 'neuron-3', toNodeId: 'neuron-6', weight: 0.8 },
      { id: 'syn-13', fromNodeId: 'neuron-3', toNodeId: 'neuron-7', weight: 0.4 },
      { id: 'syn-14', fromNodeId: 'neuron-4', toNodeId: 'neuron-7', weight: 0.7 },

      // 处理层到效应器
      { id: 'syn-15', fromNodeId: 'neuron-5', toNodeId: 'effector-1', weight: 0.9 },
      { id: 'syn-16', fromNodeId: 'neuron-6', toNodeId: 'effector-1', weight: 0.6 },
      { id: 'syn-17', fromNodeId: 'neuron-6', toNodeId: 'effector-2', weight: 0.8 },
      { id: 'syn-18', fromNodeId: 'neuron-7', toNodeId: 'effector-2', weight: 0.7 },

      // 交叉连接
      { id: 'syn-19', fromNodeId: 'neuron-1', toNodeId: 'neuron-7', weight: 0.3 },
      { id: 'syn-20', fromNodeId: 'neuron-4', toNodeId: 'neuron-5', weight: 0.4 },
    ],
    canvasOffset: { x: 0, y: 0 },
    canvasScale: 1.0
  };
}



/**
 * 创建测试输入数据，用于验证视觉感受器功能
 */
export function createTestInputData() {
  return {
    'sensor-1': 10,  // 强输入
    'sensor-2': 5,   // 中等输入
    'sensor-3': 15,  // 很强输入
    'sensor-4': 2    // 弱输入
  };
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