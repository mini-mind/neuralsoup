import type { INeuron, NeuronState } from './neuron';
import type { ISynapse, SynapseState } from './synapse';
import { IzhikevichNeuron } from './neuron';
import { STDPSynapse } from './synapse';

/**
 * 神经网络节点类
 * 封装神经元实例，提供拓扑图管理接口
 */
export class NetworkNode {
  readonly id: string;
  readonly neuron: INeuron;
  
  // UI相关属性
  x: number;
  y: number;
  selected: boolean = false;
  
  constructor(neuron: INeuron) {
    this.id = neuron.id;
    this.neuron = neuron;
    this.x = neuron.x;
    this.y = neuron.y;
  }
  
  /**
   * 更新节点位置
   */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.neuron.x = x;
    this.neuron.y = y;
  }
  
  /**
   * 获取神经元状态
   */
  getState(): NeuronState {
    return this.neuron.getState();
  }
  
  /**
   * 更新神经元
   */
  update(input: number, deltaTime: number): boolean {
    return this.neuron.update(input, deltaTime);
  }
  
  /**
   * 重置神经元状态
   */
  reset(): void {
    this.neuron.reset();
  }
}

/**
 * 神经网络有向边类
 * 封装突触实例，表示神经元之间的连接
 */
export class NetworkEdge {
  readonly id: string;
  readonly synapse: ISynapse;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  
  // UI相关属性
  selected: boolean = false;
  
  constructor(synapse: ISynapse) {
    this.id = synapse.id;
    this.synapse = synapse;
    this.fromNodeId = synapse.preNeuronId;
    this.toNodeId = synapse.postNeuronId;
  }
  
  /**
   * 获取突触状态
   */
  getState(): SynapseState {
    return this.synapse.getState();
  }
  
  /**
   * 处理突触传递
   */
  process(preSpike: boolean, preNeuron: INeuron, postNeuron: INeuron, deltaTime: number): number {
    return this.synapse.process(preSpike, preNeuron, postNeuron, deltaTime);
  }
  
  /**
   * 重置突触状态
   */
  reset(): void {
    this.synapse.reset();
  }
}

/**
 * 神经网络拓扑图类
 * 管理所有节点和边，提供网络构建和仿真接口
 */
export class NetworkTopology {
  private nodes: Map<string, NetworkNode> = new Map();
  private edges: Map<string, NetworkEdge> = new Map();
  private adjacencyList: Map<string, string[]> = new Map(); // 邻接表，用于快速查找连接
  
  /**
   * 添加节点
   */
  addNode(neuron: INeuron): NetworkNode {
    const node = new NetworkNode(neuron);
    this.nodes.set(node.id, node);
    this.adjacencyList.set(node.id, []);
    return node;
  }
  
  /**
   * 移除节点
   */
  removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    
    // 移除所有相关的边
    const edgesToRemove: string[] = [];
    for (const [edgeId, edge] of this.edges) {
      if (edge.fromNodeId === nodeId || edge.toNodeId === nodeId) {
        edgesToRemove.push(edgeId);
      }
    }
    
    edgesToRemove.forEach(edgeId => this.removeEdge(edgeId));
    
    // 移除节点
    this.nodes.delete(nodeId);
    this.adjacencyList.delete(nodeId);
    
    return true;
  }
  
  /**
   * 添加边
   */
  addEdge(synapse: ISynapse): NetworkEdge | null {
    // 检查节点是否存在
    if (!this.nodes.has(synapse.preNeuronId) || !this.nodes.has(synapse.postNeuronId)) {
      console.warn(`Cannot add edge: one or both nodes not found`);
      return null;
    }
    
    const edge = new NetworkEdge(synapse);
    this.edges.set(edge.id, edge);
    
    // 更新邻接表
    const fromConnections = this.adjacencyList.get(edge.fromNodeId) || [];
    fromConnections.push(edge.toNodeId);
    this.adjacencyList.set(edge.fromNodeId, fromConnections);
    
    return edge;
  }
  
  /**
   * 移除边
   */
  removeEdge(edgeId: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;
    
    // 更新邻接表
    const fromConnections = this.adjacencyList.get(edge.fromNodeId) || [];
    const index = fromConnections.indexOf(edge.toNodeId);
    if (index > -1) {
      fromConnections.splice(index, 1);
    }
    
    this.edges.delete(edgeId);
    return true;
  }
  
  /**
   * 获取节点
   */
  getNode(nodeId: string): NetworkNode | undefined {
    return this.nodes.get(nodeId);
  }
  
  /**
   * 获取边
   */
  getEdge(edgeId: string): NetworkEdge | undefined {
    return this.edges.get(edgeId);
  }
  
  /**
   * 获取所有节点
   */
  getAllNodes(): NetworkNode[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * 获取所有边
   */
  getAllEdges(): NetworkEdge[] {
    return Array.from(this.edges.values());
  }
  
  /**
   * 获取节点的输入边
   */
  getInputEdges(nodeId: string): NetworkEdge[] {
    return Array.from(this.edges.values()).filter(edge => edge.toNodeId === nodeId);
  }
  
  /**
   * 获取节点的输出边
   */
  getOutputEdges(nodeId: string): NetworkEdge[] {
    return Array.from(this.edges.values()).filter(edge => edge.fromNodeId === nodeId);
  }
  
  /**
   * 更新网络状态（一个时间步）
   */
  update(deltaTime: number = 1, externalInputs?: Map<string, number>): void {
    // 1. 收集所有神经元的尖峰状态
    const spikes = new Map<string, boolean>();
    
    // 2. 计算每个神经元的输入电流
    const inputs = new Map<string, number>();
    
    for (const node of this.nodes.values()) {
      inputs.set(node.id, externalInputs?.get(node.id) || 0);
    }
    
    // 3. 处理所有突触传递
    for (const edge of this.edges.values()) {
      const preNode = this.nodes.get(edge.fromNodeId);
      const postNode = this.nodes.get(edge.toNodeId);
      
      if (preNode && postNode) {
        const preSpike = spikes.get(edge.fromNodeId) || false;
        const synapticCurrent = edge.process(preSpike, preNode.neuron, postNode.neuron, deltaTime);
        
        // 累加到后突触神经元的输入
        const currentInput = inputs.get(edge.toNodeId) || 0;
        inputs.set(edge.toNodeId, currentInput + synapticCurrent);
      }
    }
    
    // 4. 更新所有神经元状态
    for (const node of this.nodes.values()) {
      const input = inputs.get(node.id) || 0;
      const spiked = node.update(input, deltaTime);
      spikes.set(node.id, spiked);
    }
  }
  
  /**
   * 重置网络状态
   */
  reset(): void {
    for (const node of this.nodes.values()) {
      node.reset();
    }
    for (const edge of this.edges.values()) {
      edge.reset();
    }
  }
  
  /**
   * 获取网络统计信息
   */
  getNetworkStats(): NetworkStats {
    const nodeCount = this.nodes.size;
    const edgeCount = this.edges.size;
    
    const nodesByType = {
      input: 0,
      hidden: 0,
      output: 0
    };
    
    for (const node of this.nodes.values()) {
      nodesByType[node.neuron.type]++;
    }
    
    const avgWeight = edgeCount > 0 
      ? Array.from(this.edges.values()).reduce((sum, edge) => sum + edge.synapse.weight, 0) / edgeCount
      : 0;
    
    return {
      nodeCount,
      edgeCount,
      nodesByType,
      averageWeight: avgWeight
    };
  }
  
  /**
   * 清空网络
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
  }
}

/**
 * 网络统计信息接口
 */
export interface NetworkStats {
  nodeCount: number;
  edgeCount: number;
  nodesByType: {
    input: number;
    hidden: number;
    output: number;
  };
  averageWeight: number;
} 