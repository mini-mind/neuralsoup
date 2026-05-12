import { Effector, EffectorOutput, Receptor, ReceptorInput, SNNNode } from '../../types/simulation';

export const EDITOR_LAYOUT = {
  framePadding: 10,
  nodeRadius: 25,
  receptorInputRadius: 6,
  effectorOutputRadius: 12,
  effectorBottomGap: 40,
  scrollBarInset: 5,
  scrollBarHeight: 6,
  scrollBarBottomGap: 3,
  inputOverflowPadding: 12
} as const;

export interface EditorFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getReceptorFrame = (
  canvas: HTMLCanvasElement,
  receptor?: Receptor
): EditorFrame => ({
  x: EDITOR_LAYOUT.framePadding,
  y: EDITOR_LAYOUT.framePadding,
  width: canvas.width - EDITOR_LAYOUT.framePadding * 2,
  height: receptor?.height ?? 80
});

export const getEffectorFrame = (
  canvas: HTMLCanvasElement,
  effector?: Effector
): EditorFrame => {
  const height = effector?.height ?? 60;
  return {
    x: EDITOR_LAYOUT.framePadding,
    y: canvas.height - height - EDITOR_LAYOUT.effectorBottomGap,
    width: canvas.width - EDITOR_LAYOUT.framePadding * 2,
    height
  };
};

export const getNodeCenter = (
  node: SNNNode,
  canvasOffset: { x: number; y: number },
  canvasScale: number
) => ({
  x: (node.x + canvasOffset.x) * canvasScale + EDITOR_LAYOUT.nodeRadius,
  y: (node.y + canvasOffset.y) * canvasScale + EDITOR_LAYOUT.nodeRadius
});

export const getReceptorInputPosition = (
  frame: EditorFrame,
  input: ReceptorInput,
  scrollX: number = 0
) => ({
  x: frame.x + input.x - scrollX,
  y: frame.y + input.y
});

export const getEffectorOutputPosition = (
  frame: EditorFrame,
  output: EffectorOutput
) => ({
  x: frame.x + output.x,
  y: frame.y + output.y
});

export const getVisionContentWidth = (inputs: ReceptorInput[]): number => {
  if (inputs.length === 0) {
    return 0;
  }

  const maxX = Math.max(...inputs.map((input) => input.x));
  return maxX + EDITOR_LAYOUT.receptorInputRadius + EDITOR_LAYOUT.inputOverflowPadding;
};
