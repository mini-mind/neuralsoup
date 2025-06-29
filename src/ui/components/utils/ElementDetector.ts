// 基础类型定义
export interface SNNNode {
  id: string;
  label?: string;
  type: string;
  x: number;
  y: number;
  params?: {
    a: number;
    b: number;
    c: number;
    d: number;
    threshold: number;
  };
  state?: {
    v: number;
    u: number;
    spike: boolean;
    lastSpikeTime: number;
  };
}

interface Receptor {
  height: number;
  activeModality: string;
  modalities: Array<{
    type: string;
    isExpanded?: boolean;
    inputs: Array<{ id: string; x: number; y: number }>;
  }>;
}

interface Effector {
  outputs: Array<{ id: string; x: number; y: number }>;
}

export interface ClickedElement {
  type:
    | "neuron"
    | "synapse"
    | "receptor"
    | "receptor-tab"
    | "receptor-area"
    | "effector";
  element: any;
  modalityIndex?: number;
}

export interface DetectionProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  nodes: SNNNode[];
  receptors: Receptor[];
  effectors: Effector[];
  canvasOffset: { x: number; y: number };
  canvasScale?: number;
}

/**
 * 元素检测工具类
 * 专门处理画布上元素的点击检测
 */
export class ElementDetector {
  /**
   * 检测感受器点击
   */
  static detectReceptorClick(
    x: number,
    y: number,
    receptors: Receptor[],
    canvas: HTMLCanvasElement,
  ): ClickedElement | null {
    const receptorX = 20;
    const receptorY = 20;
    const receptorWidth = canvas.width - 40;

    for (const receptor of receptors) {
      if (
        x >= receptorX &&
        x <= receptorX + receptorWidth &&
        y >= receptorY &&
        y <= receptorY + receptor.height
      ) {
        // 检测模态标签点击
        const tabHeight = 30;
        const tabWidth = receptorWidth / receptor.modalities.length;

        if (y >= receptorY && y <= receptorY + tabHeight) {
          const tabIndex = Math.floor((x - receptorX) / tabWidth);
          if (tabIndex >= 0 && tabIndex < receptor.modalities.length) {
            return {
              type: "receptor-tab" as const,
              element: receptor,
              modalityIndex: tabIndex,
            };
          }
        }

        // 检测输入点击（仅在激活的模态中）
        const activeModality = receptor.modalities.find(
          (m: any) => m.type === receptor.activeModality,
        );
        if (activeModality && activeModality.isExpanded) {
          for (const input of activeModality.inputs) {
            const inputX = receptorX + input.x;
            const inputY = receptorY + tabHeight + input.y;
            const distance = Math.sqrt((x - inputX) ** 2 + (y - inputY) ** 2);

            if (distance <= 5) {
              return {
                type: "receptor" as const,
                element: input,
              };
            }
          }
        }

        return {
          type: "receptor-area" as const,
          element: receptor,
        };
      }
    }

    return null;
  }

  /**
   * 检测效应器点击
   */
  static detectEffectorClick(
    x: number,
    y: number,
    effectors: Effector[],
    canvas: HTMLCanvasElement,
  ): ClickedElement | null {
    const effectorX = 20;
    const effectorY = canvas.height - 120;
    const effectorWidth = canvas.width - 40;

    for (const effector of effectors) {
      for (let index = 0; index < effector.outputs.length; index++) {
        const output = effector.outputs[index];
        const spacing = effectorWidth / (effector.outputs.length + 1);
        const outputX = effectorX + spacing * (index + 1);
        const outputY = effectorY + output.y;
        const distance = Math.sqrt((x - outputX) ** 2 + (y - outputY) ** 2);

        if (distance <= 10) {
          return {
            type: "effector" as const,
            element: output,
          };
        }
      }
    }

    return null;
  }

  /**
   * 检测神经元点击
   */
  static detectNeuronClick(
    x: number,
    y: number,
    nodes: SNNNode[],
    canvasOffset: { x: number; y: number },
    canvasScale: number = 1.0,
  ): ClickedElement | null {
    for (const node of nodes) {
      if (node.type === "neuron") {
        const nodeX = (node.x + canvasOffset.x) * canvasScale;
        const nodeY = (node.y + canvasOffset.y) * canvasScale;
        const distance = Math.sqrt(
          (x - nodeX - 25) ** 2 + (y - nodeY - 25) ** 2,
        );

        if (distance <= 25) {
          return {
            type: "neuron" as const,
            element: node,
          };
        }
      }
    }

    return null;
  }

  /**
   * 综合检测点击的元素
   */
  static detectClickedElement(
    x: number,
    y: number,
    {
      canvasRef,
      nodes,
      receptors,
      effectors,
      canvasOffset,
      canvasScale = 1.0,
    }: DetectionProps,
  ): ClickedElement | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // 按优先级检测：感受器 -> 效应器 -> 神经元
    return (
      this.detectReceptorClick(x, y, receptors, canvas) ||
      this.detectEffectorClick(x, y, effectors, canvas) ||
      this.detectNeuronClick(x, y, nodes, canvasOffset, canvasScale)
    );
  }
} 