import { NetworkTopology } from '../../core/entities/topology';
import { BasicSynapse } from '../../core/entities/synapse';
import { globalEventBus } from '../../core/services/EventBus';

/**
 * 画布图结构管理器
 * 专注于图的创建、修改、删除等操作
 */
export class CanvasGraphManager {
  private networkTopology: NetworkTopology;

  constructor(networkTopology: NetworkTopology) {
    this.networkTopology = networkTopology;
  }

  /**
   * 创建边连接
   */
  createEdge(fromNodeId: string, toNodeId: string, weight: number = 2.0): boolean {
    // 验证至少有一个节点在网络拓扑中存在，或者是输入节点到神经元的连接
    const startNode = this.networkTopology.getNode(fromNodeId);
    const endNode = this.networkTopology.getNode(toNodeId);

    // 允许输入节点到神经元的连接：如果目标节点是神经元，允许创建连接
    const isInputToNeuronConnection = !startNode && endNode;

    if (!startNode && !endNode && !isInputToNeuronConnection) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('无法创建边：至少需要一个节点在网络拓扑中，或者是输入节点到神经元的连接');
      }
      return false;
    }

    // 检查是否已存在连接
    if (this.edgeExists(fromNodeId, toNodeId)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('连接已存在');
      }
      return false;
    }

    // 自环检测
    if (fromNodeId === toNodeId) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('不允许创建自环');
      }
      return false;
    }

    try {
      // 创建突触，允许连接到组内节点
      const synapseId = this.generateSynapseId();
      const synapse = new BasicSynapse(synapseId, fromNodeId, toNodeId, weight);
      
      // 添加边到网络拓扑
      const newEdge = this.networkTopology.addEdge(synapse);
      if (newEdge) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`成功创建边: ${fromNodeId} -> ${toNodeId}`);
        }

        // 触发连接添加事件
        globalEventBus.emit('topology:connection-added', {
          fromId: fromNodeId,
          toId: toNodeId,
          weight: weight,
          edgeId: newEdge.id
        });

        return true;
      }
      
      return false;
    } catch (error) {
      console.error('创建边失败:', error);
      return false;
    }
  }

  /**
   * 删除边
   */
  deleteEdge(edgeId: string): boolean {
    try {
      // 获取边信息用于事件
      const edge = this.networkTopology.getEdge(edgeId);
      const success = this.networkTopology.removeEdge(edgeId);

      if (success) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`成功删除边: ${edgeId}`);
        }

        // 触发连接删除事件
        if (edge) {
          globalEventBus.emit('topology:connection-removed', {
            fromId: edge.fromNodeId,
            toId: edge.toNodeId,
            edgeId: edgeId
          });
        }
      }

      return success;
    } catch (error) {
      console.error('删除边失败:', error);
      return false;
    }
  }

  /**
   * 删除节点（同时删除相关的边）
   */
  deleteNode(nodeId: string): boolean {
    try {
      // 先删除相关的边
      const edges = this.networkTopology.getAllEdges();
      const relatedEdges = edges.filter(edge => 
        edge.fromNodeId === nodeId || edge.toNodeId === nodeId
      );
      
      relatedEdges.forEach(edge => {
        this.networkTopology.removeEdge(edge.id);
      });

      // 删除节点
      const success = this.networkTopology.removeNode(nodeId);
      if (success && process.env.NODE_ENV === 'development') {
        console.log(`成功删除节点: ${nodeId}`);
      }
      return success;
    } catch (error) {
      console.error('删除节点失败:', error);
      return false;
    }
  }

  /**
   * 更新边权重
   */
  updateEdgeWeight(edgeId: string, weight: number): boolean {
    try {
      const edge = this.networkTopology.getEdge(edgeId);
      if (edge) {
        edge.synapse.weight = weight;
        if (process.env.NODE_ENV === 'development') {
          console.log(`更新边权重: ${edgeId} -> ${weight}`);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新边权重失败:', error);
      return false;
    }
  }

  /**
   * 获取节点的所有连接
   */
  getNodeConnections(nodeId: string): { incoming: any[], outgoing: any[] } {
    const edges = this.networkTopology.getAllEdges();
    
    return {
      incoming: edges.filter(edge => edge.toNodeId === nodeId),
      outgoing: edges.filter(edge => edge.fromNodeId === nodeId)
    };
  }

  /**
   * 检查边是否已存在
   */
  private edgeExists(fromNodeId: string, toNodeId: string): boolean {
    const edges = this.networkTopology.getAllEdges();
    return edges.some(edge => 
      edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId
    );
  }

  /**
   * 生成唯一的突触ID
   */
  private generateSynapseId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `synapse_${timestamp}_${random}`;
  }

  /**
   * 获取图的统计信息
   */
  getGraphStats(): { nodeCount: number, edgeCount: number } {
    return {
      nodeCount: this.networkTopology.getAllNodes().length,
      edgeCount: this.networkTopology.getAllEdges().length
    };
  }
} 