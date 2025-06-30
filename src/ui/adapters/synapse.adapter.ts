import type { UIEdge, NetworkEdge } from "../../types";

/**
 * 突触适配器
 * 将核心层NetworkEdge转换为UI层所需的格式
 */
export class SynapseAdapter {
  /**
   * 将NetworkEdge转换为UIEdge格式
   */
  static toUIEdge(networkEdge: NetworkEdge): UIEdge {
    const state = networkEdge.getState();

    return {
      id: networkEdge.id,
      fromNodeId: networkEdge.fromNodeId,
      toNodeId: networkEdge.toNodeId,
      weight: state.weight,
      delay: networkEdge.synapse.delay,
      synapse: networkEdge.synapse // 保持对核心突触的引用
    };
  }

  /**
   * 将NetworkEdge转换为编辑器所需格式
   * @deprecated 使用 toUIEdge 替代
   */
  static toSynapseEditFormat(networkEdge: NetworkEdge): any {
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