import { SNNNode } from "../components/utils/ElementDetector";

/**
 * 神经元适配器
 * 将NetworkNode转换为编辑器组件所需的格式
 */
export class NeuronAdapter {
  /**
   * 将NetworkNode转换为SNNNode格式
   */
  static toSNNNode(networkNode: any): SNNNode {
    const state = networkNode.getState();
    const neuron = networkNode.neuron;
    
    return {
      id: networkNode.id,
      label: networkNode.id,
      type: neuron.type,
      x: networkNode.x,
      y: networkNode.y,
      params: {
        a: neuron.a || 0.02,
        b: neuron.b || 0.2,
        c: neuron.c || -65,
        d: neuron.d || 8,
        threshold: neuron.threshold || 30
      },
      state: {
        v: state.voltage,
        u: neuron.u || 0, // 恢复变量
        spike: state.isSpiking,
        lastSpikeTime: state.lastSpikeTime
      }
    };
  }

  /**
   * 从SNNNode更新NetworkNode
   */
  static updateFromSNNNode(networkNode: any, snnNode: SNNNode): void {
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
} 