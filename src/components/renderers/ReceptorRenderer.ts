import { Receptor } from '../../types/simulation';
import { EditorFrame, EDITOR_LAYOUT, getVisionContentWidth } from '../utils/editorGeometry';

/**
 * 感受器渲染器
 */
export class ReceptorRenderer {
  static draw(
    ctx: CanvasRenderingContext2D,
    receptors: Receptor[],
    frame: EditorFrame,
    scrollX: number = 0
  ) {
    receptors.forEach((receptor) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(frame.x, frame.y, frame.width, receptor.height);
      ctx.clip();

      const visionModality = receptor.modalities.find((modality) => modality.type === 'vision');
      if (visionModality) {
        this.drawSimplifiedVisionModality(ctx, visionModality, frame, scrollX);
      }

      ctx.restore();

      if (visionModality) {
        this.drawScrollIndicator(ctx, visionModality, frame, receptor.height, scrollX);
      }
    });
  }

  private static drawSimplifiedVisionModality(
    ctx: CanvasRenderingContext2D,
    visionModality: any,
    frame: EditorFrame,
    scrollX: number
  ) {
    if (visionModality.inputs && visionModality.inputs.length > 0) {
      visionModality.inputs.forEach((input: any) => {
        const inputX = frame.x + input.x - scrollX;
        const inputY = frame.y + input.y;

        if (
          inputX >= frame.x - EDITOR_LAYOUT.inputOverflowPadding &&
          inputX <= frame.x + frame.width + EDITOR_LAYOUT.inputOverflowPadding
        ) {
          let coreColor = '#bdbdbd';
          if (input.colorType === 'R') {
            coreColor = '#d2a959';
          } else if (input.colorType === 'G') {
            coreColor = '#cfcfcf';
          } else if (input.colorType === 'B') {
            coreColor = '#cf6a6a';
          }

          ctx.beginPath();
          ctx.arc(inputX, inputY, 3, 0, 2 * Math.PI);
          ctx.fillStyle = coreColor;
          ctx.fill();
        }
      });
    }
  }

  private static drawScrollIndicator(
    ctx: CanvasRenderingContext2D,
    visionModality: any,
    frame: EditorFrame,
    receptorHeight: number,
    scrollX: number
  ) {
    if (!visionModality.inputs || visionModality.inputs.length === 0) {
      return;
    }

    const contentWidth = getVisionContentWidth(visionModality.inputs);
    if (contentWidth > frame.width) {
      const scrollBarHeight = EDITOR_LAYOUT.scrollBarHeight;
      const scrollBarY = frame.y + receptorHeight - scrollBarHeight - EDITOR_LAYOUT.scrollBarBottomGap;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(frame.x + EDITOR_LAYOUT.scrollBarInset, scrollBarY, frame.width - EDITOR_LAYOUT.scrollBarInset * 2, scrollBarHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(frame.x + EDITOR_LAYOUT.scrollBarInset, scrollBarY, frame.width - EDITOR_LAYOUT.scrollBarInset * 2, scrollBarHeight);

      const scrollableWidth = contentWidth - frame.width;
      const scrollProgress = Math.max(0, Math.min(1, scrollX / scrollableWidth));
      const trackWidth = frame.width - EDITOR_LAYOUT.scrollBarInset * 2;
      const thumbWidth = Math.max(20, (frame.width / contentWidth) * trackWidth);
      const thumbX = frame.x + EDITOR_LAYOUT.scrollBarInset + scrollProgress * (trackWidth - thumbWidth);

      ctx.fillStyle = 'rgba(170, 170, 170, 0.35)';
      ctx.fillRect(thumbX, scrollBarY + 1, thumbWidth, scrollBarHeight - 2);
    }
  }
}
