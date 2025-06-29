/**
 * 突触适配器
 * 将NetworkEdge转换为编辑器组件所需的格式
 */
export class SynapseAdapter {
  /**
   * 将NetworkEdge转换为编辑器所需格式
   */
  static toSynapseEditFormat(networkEdge: any): any {
    const state = networkEdge.getState();
    
    return {
      id: networkEdge.id,
      from: networkEdge.fromNodeId,
      to: networkEdge.toNodeId,
      weight: state.weight,
      delay: networkEdge.synapse.delay
    };
  }

  /**
   * 从编辑器格式更新NetworkEdge
   */
  static updateFromEditFormat(networkEdge: any, editData: any): void {
    // 更新突触权重
    if (editData.weight !== undefined) {
      networkEdge.synapse.weight = editData.weight;
    }
    
    // 更新延迟
    if (editData.delay !== undefined) {
      networkEdge.synapse.delay = editData.delay;
    }
  }
} 