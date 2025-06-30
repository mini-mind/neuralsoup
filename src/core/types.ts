/**
 * 核心类型统一导出
 * 这是核心层的主要类型导出文件，提供给其他层使用
 */

// === 世界和智能体相关类型 ===
export type { IWorld, ICollidable } from './world/types';
export type { IAgent, IBrain, ISensor, IEffector } from './entities/types';

// === 神经网络核心类型 ===
export type { INeuron, NeuronState, IzhikevichParams, LIFParams } from './entities/neuron';
export type { ISynapse, SynapseState, STDPParams } from './entities/synapse';
export type { NetworkStats } from './entities/topology';

// === 插件系统类型 ===
export type { IPlugin, PluginConfig, IPluginFactory } from './entities/plugins';
export { AbstractPlugin, AbstractSensor, AbstractEffector } from './entities/plugins';

// === 具体实现类 ===
export { IzhikevichNeuron, LIFNeuron } from './entities/neuron';
export { STDPSynapse, BasicSynapse } from './entities/synapse';
export { NetworkNode, NetworkEdge, NetworkTopology } from './entities/topology';

// === 特殊节点类型 ===
export { VoltageInputNode, VoltageAccumulatorNode } from './entities/types';