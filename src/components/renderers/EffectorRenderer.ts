import { Effector } from '../../types/simulation';
import { EditorFrame } from '../utils/editorGeometry';

/**
 * 效应器渲染器
 */
export class EffectorRenderer {
  static draw(
    ctx: CanvasRenderingContext2D,
    effectors: Effector[],
    frame: EditorFrame
  ) {
    effectors.forEach((effector) => {
      effector.outputs.forEach((output) => {
        const outputX = frame.x + output.x;
        const outputY = frame.y + output.y;

        ctx.beginPath();
        ctx.arc(outputX, outputY, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#bfbfbf';
        ctx.fill();
      });
    });
  }
}
