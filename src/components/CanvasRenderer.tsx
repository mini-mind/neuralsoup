import React from 'react';
import { SNNNode, SNNSynapse, Receptor, Effector } from '../types/simulation';
import { ReceptorRenderer } from './renderers/ReceptorRenderer';
import { EffectorRenderer } from './renderers/EffectorRenderer';
import { NeuronRenderer } from './renderers/NeuronRenderer';
import { drawArrow } from './utils/renderUtils';
import {
  getEffectorFrame,
  getEffectorOutputPosition,
  getNodeCenter,
  getReceptorFrame,
  getReceptorInputPosition
} from './utils/editorGeometry';

interface CanvasRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  nodes: SNNNode[];
  synapses: SNNSynapse[];
  receptors: Receptor[];
  effectors: Effector[];
  selectedSynapse: string | null;
  connecting: {
    from: string;
    fromType: 'node' | 'receptor' | 'effector';
    mouseX: number;
    mouseY: number;
  } | null;
  canvasOffset: { x: number; y: number };
  canvasScale: number;
  isSelecting: {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null;
  selectedNodes: string[];
  hoveredNode: string | null;
  receptorScrollX: number;
}

/**
 * 绘制画布内容的工具类
 */
export class CanvasRenderer {
  static draw({
    canvasRef,
    nodes,
    synapses,
    receptors,
    effectors,
    selectedSynapse,
    connecting,
    canvasOffset,
    canvasScale,
    isSelecting,
    selectedNodes,
    hoveredNode,
    receptorScrollX
  }: CanvasRendererProps) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.drawBackground(ctx, canvas.width, canvas.height);

    const receptorFrame = getReceptorFrame(canvas, receptors[0]);
    const effectorFrame = getEffectorFrame(canvas, effectors[0]);

    this.drawGrid(ctx, canvas.width, canvas.height, canvasOffset, canvasScale);
    ReceptorRenderer.draw(ctx, receptors, receptorFrame, receptorScrollX);
    EffectorRenderer.draw(ctx, effectors, effectorFrame);
    this.drawSynapses(ctx, synapses, nodes, receptors, effectors, receptorFrame, effectorFrame, canvasOffset, canvasScale, selectedSynapse, receptorScrollX);
    NeuronRenderer.draw(ctx, nodes, canvasOffset, canvasScale, selectedNodes, hoveredNode);

    if (connecting) {
      this.drawConnectingLine(ctx, connecting, nodes, receptors, effectors, receptorFrame, effectorFrame, canvasOffset, canvasScale, receptorScrollX);
    }

    if (isSelecting) {
      this.drawSelectionBox(ctx, isSelecting);
    }
  }

  private static drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);
  }

  private static drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, canvasOffset: { x: number; y: number }, canvasScale: number) {
    const gridSize = 64 * canvasScale;
    const offsetX = (canvasOffset.x * canvasScale) % gridSize;
    const offsetY = (canvasOffset.y * canvasScale) % gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  private static drawSynapses(
    ctx: CanvasRenderingContext2D,
    synapses: SNNSynapse[],
    nodes: SNNNode[],
    receptors: Receptor[],
    effectors: Effector[],
    receptorFrame: { x: number; y: number; width: number; height: number },
    effectorFrame: { x: number; y: number; width: number; height: number },
    canvasOffset: { x: number; y: number },
    canvasScale: number,
    selectedSynapse: string | null,
    receptorScrollX: number
  ) {
    synapses.forEach((synapse) => {
      const { fromX, fromY, toX, toY } = this.getSynapseEndpoints(
        synapse,
        nodes,
        receptors,
        effectors,
        receptorFrame,
        effectorFrame,
        canvasOffset,
        canvasScale,
        receptorScrollX
      );
      const activeStroke = selectedSynapse === synapse.id;
      const strokeColor = activeStroke
        ? 'rgba(255, 255, 255, 0.95)'
        : 'rgba(140, 140, 140, 0.26)';
      const glowColor = activeStroke
        ? 'rgba(255, 255, 255, 0.24)'
        : 'rgba(255, 255, 255, 0)';
      const isSelfConnection = synapse.from === synapse.to;

      if (isSelfConnection) {
        const centerX = fromX;
        const centerY = fromY;
        const loopSize = 40;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 20);
        const cp1X = centerX + loopSize;
        const cp1Y = centerY - loopSize;
        const cp2X = centerX + loopSize;
        const cp2Y = centerY + loopSize;
        const endX = centerX + 20;
        const endY = centerY;

        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);

        const weight = Math.abs(synapse.weight);
        ctx.lineWidth = Math.max(0.8, 0.65 + weight * 0.65);
        ctx.shadowBlur = activeStroke ? 8 : 0;
        ctx.shadowColor = glowColor;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
        ctx.shadowBlur = 0;

        drawArrow(ctx, endX - 5, endY - 5, endX, endY);
      } else {
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);

        const weight = Math.abs(synapse.weight);
        ctx.lineWidth = Math.max(0.8, 0.65 + weight * 0.65);
        ctx.shadowBlur = activeStroke ? 8 : 0;
        ctx.shadowColor = glowColor;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
        ctx.shadowBlur = 0;

        drawArrow(ctx, fromX, fromY, toX, toY);
      }
    });
  }

  private static drawConnectingLine(
    ctx: CanvasRenderingContext2D,
    connecting: { from: string; fromType: 'node' | 'receptor' | 'effector'; mouseX: number; mouseY: number },
    nodes: SNNNode[],
    receptors: Receptor[],
    effectors: Effector[],
    receptorFrame: { x: number; y: number; width: number; height: number },
    effectorFrame: { x: number; y: number; width: number; height: number },
    canvasOffset: { x: number; y: number },
    canvasScale: number,
    receptorScrollX: number
  ) {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();

    let fromX = 0;
    let fromY = 0;
    if (connecting.fromType === 'node') {
      const fromNode = nodes.find((node) => node.id === connecting.from);
      if (fromNode) {
        const center = getNodeCenter(fromNode, canvasOffset, canvasScale);
        fromX = center.x;
        fromY = center.y;
      }
    } else if (connecting.fromType === 'receptor') {
      for (const receptor of receptors) {
        const activeModality = receptor.modalities.find((modality) => modality.type === receptor.activeModality);
        if (activeModality) {
          const input = activeModality.inputs.find((candidate) => candidate.id === connecting.from);
          if (input) {
            const position = getReceptorInputPosition(receptorFrame, input, receptorScrollX);
            fromX = position.x;
            fromY = position.y;
            break;
          }
        }
      }
    } else if (connecting.fromType === 'effector') {
      for (const effector of effectors) {
        const output = effector.outputs.find((candidate) => candidate.id === connecting.from);
        if (output) {
          const position = getEffectorOutputPosition(effectorFrame, output);
          fromX = position.x;
          fromY = position.y;
          break;
        }
      }
    }

    ctx.moveTo(fromX, fromY);
    ctx.lineTo(connecting.mouseX, connecting.mouseY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
  }

  private static getSynapseEndpoints(
    synapse: SNNSynapse,
    nodes: SNNNode[],
    receptors: Receptor[],
    effectors: Effector[],
    receptorFrame: { x: number; y: number; width: number; height: number },
    effectorFrame: { x: number; y: number; width: number; height: number },
    canvasOffset: { x: number; y: number },
    canvasScale: number,
    receptorScrollX: number
  ) {
    const fromNode = nodes.find((node) => node.id === synapse.from);
    let fromReceptor = null;
    let fromInput = null;
    let fromEffector = null;
    let fromOutput = null;

    for (const receptor of receptors) {
      const activeModality = receptor.modalities.find((modality) => modality.type === receptor.activeModality);
      if (activeModality) {
        const input = activeModality.inputs.find((candidate) => candidate.id === synapse.from);
        if (input) {
          fromReceptor = receptor;
          fromInput = input;
          break;
        }
      }
    }

    if (!fromReceptor && !fromInput) {
      for (const effector of effectors) {
        const output = effector.outputs.find((candidate) => candidate.id === synapse.from);
        if (output) {
          fromEffector = effector;
          fromOutput = output;
          break;
        }
      }
    }

    const toNode = nodes.find((node) => node.id === synapse.to);
    const toEffector = effectors.find((effector) =>
      effector.outputs.some((output) => output.id === synapse.to)
    );

    let fromX = 0;
    let fromY = 0;
    let toX = 0;
    let toY = 0;
    let fromCenterX = 0;
    let fromCenterY = 0;
    let toCenterX = 0;
    let toCenterY = 0;

    if (fromNode) {
      const center = getNodeCenter(fromNode, canvasOffset, canvasScale);
      fromCenterX = center.x;
      fromCenterY = center.y;
    } else if (fromReceptor && fromInput) {
      const position = getReceptorInputPosition(receptorFrame, fromInput, receptorScrollX);
      fromCenterX = position.x;
      fromCenterY = position.y;
    } else if (fromEffector && fromOutput) {
      const position = getEffectorOutputPosition(effectorFrame, fromOutput);
      fromCenterX = position.x;
      fromCenterY = position.y;
    }

    if (toNode) {
      const center = getNodeCenter(toNode, canvasOffset, canvasScale);
      toCenterX = center.x;
      toCenterY = center.y;
    } else if (toEffector) {
      const output = toEffector.outputs.find((candidate) => candidate.id === synapse.to);
      if (output) {
        const position = getEffectorOutputPosition(effectorFrame, output);
        toCenterX = position.x;
        toCenterY = position.y;
      }
    }

    if (fromNode && toNode) {
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const nodeRadius = 20;
        fromX = fromCenterX + (dx / distance) * nodeRadius;
        fromY = fromCenterY + (dy / distance) * nodeRadius;
        toX = toCenterX - (dx / distance) * nodeRadius;
        toY = toCenterY - (dy / distance) * nodeRadius;
      } else {
        fromX = fromCenterX;
        fromY = fromCenterY;
        toX = toCenterX;
        toY = toCenterY;
      }
    } else if (fromReceptor && fromInput && toNode) {
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const inputRadius = 6;
        const nodeRadius = 20;
        fromX = fromCenterX + (dx / distance) * inputRadius;
        fromY = fromCenterY + (dy / distance) * inputRadius;
        toX = toCenterX - (dx / distance) * nodeRadius;
        toY = toCenterY - (dy / distance) * nodeRadius;
      } else {
        fromX = fromCenterX;
        fromY = fromCenterY;
        toX = toCenterX;
        toY = toCenterY;
      }
    } else if (fromNode && toEffector) {
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const nodeRadius = 20;
        const outputRadius = 12;
        fromX = fromCenterX + (dx / distance) * nodeRadius;
        fromY = fromCenterY + (dy / distance) * nodeRadius;
        toX = toCenterX - (dx / distance) * outputRadius;
        toY = toCenterY - (dy / distance) * outputRadius;
      } else {
        fromX = fromCenterX;
        fromY = fromCenterY;
        toX = toCenterX;
        toY = toCenterY;
      }
    } else if (fromEffector && fromOutput && toNode) {
      const dx = toCenterX - fromCenterX;
      const dy = toCenterY - fromCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const outputRadius = 12;
        const nodeRadius = 20;
        fromX = fromCenterX + (dx / distance) * outputRadius;
        fromY = fromCenterY + (dy / distance) * outputRadius;
        toX = toCenterX - (dx / distance) * nodeRadius;
        toY = toCenterY - (dy / distance) * nodeRadius;
      } else {
        fromX = fromCenterX;
        fromY = fromCenterY;
        toX = toCenterX;
        toY = toCenterY;
      }
    } else {
      fromX = fromCenterX;
      fromY = fromCenterY;
      toX = toCenterX;
      toY = toCenterY;
    }

    return { fromX, fromY, toX, toY };
  }

  private static drawSelectionBox(ctx: CanvasRenderingContext2D, isSelecting: { startX: number; startY: number; currentX: number; currentY: number }) {
    const { startX, startY, currentX, currentY } = isSelecting;
    const minX = Math.min(startX, currentX);
    const minY = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);

    ctx.strokeRect(minX, minY, width, height);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.fillRect(minX, minY, width, height);

    ctx.setLineDash([]);
  }
}
