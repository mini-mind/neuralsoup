// 导出所有核心类型接口
export type { IWorld, ICollidable } from './world/types';
export type { IAgent, IBrain, ISensor, IEffector } from './entities/types';

// 导出神经网络相关类型
export type { INeuron, NeuronState, IzhikevichParams } from './entities/neuron';
export type { ISynapse, SynapseState, STDPParams } from './entities/synapse';
export type { NetworkStats } from './entities/topology';

// 导出实现类
export { IzhikevichNeuron } from './entities/neuron';
export { STDPSynapse } from './entities/synapse';
export { NetworkNode, NetworkEdge, NetworkTopology } from './entities/topology'; 