import type { UINode, NetworkNode } from "../../types";

/**
 * 神经元适配器
 * 将核心层NetworkNode转换为UI层所需的格式
 */
export class NeuronAdapter {
  /**
   * 将NetworkNode转换为UINode格式
   */
  static toUINode(networkNode: NetworkNode): UINode {
    const state = networkNode.getState();
    const neuron = networkNode.neuron;
    
    return {
      id: networkNode.id,
      label: networkNode.id,
      type: neuron.type,
      x: networkNode.x,
      y: networkNode.y,
      neuron: neuron, // 保持对核心神经元的引用
      params: {
        a: (neuron as any).a || 0.02,
        b: (neuron as any).b || 0.2,
        c: (neuron as any).c || -65,
        d: (neuron as any).d || 8,
        threshold: (neuron as any).threshold || 30
      },
      state: {
        v: state.voltage,
        u: (neuron as any).u || 0, // 恢复变量
        spike: state.isSpiking,
        lastSpikeTime: state.lastSpikeTime
      }
    };
  }

  /**
   * 从SNNNode更新NetworkNode
   */
  static updateFromSNNNode(networkNode: any, snnNode: UINode): void {
    // 更新神经元参数
    if (snnNode.params) {
      networkNode.neuron.a = snnNode.params.a;
      networkNode.neuron.b = snnNode.params.b;
      networkNode.neuron.c = snnNode.params.c;
      networkNode.neuron.d = snnNode.params.d;
      networkNode.neuron.threshold = snnNode.params.threshold;
    }
    
    // 更新位置
    if (snnNode.x !== undefined && snnNode.y !== undefined) {
      networkNode.setPosition(snnNode.x, snnNode.y);
    }
  }

  /**
   * 向后兼容方法：将NetworkNode转换为SNNNode格式
   * @deprecated 使用 toUINode 替代
   */
  static toSNNNode(networkNode: NetworkNode) {
    return this.toUINode(networkNode);
  }
}