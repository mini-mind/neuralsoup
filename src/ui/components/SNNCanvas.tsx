import React, { useRef, useEffect, useCallback } from "react";
import { globalState } from "../../core/services/GlobalState";
import { IzhikevichNeuron } from "../../core/entities/neuron";
import { InteractionState, NeuronGroup, SelectionBox } from "../views/SNNTopologyEditor";
import { useLanguage } from "../../contexts/LanguageContext";

interface SNNCanvasProps {
  width: number;
  height: number;
  networkTopology: any;
  snnTopology: any;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  interactionState: InteractionState;
  selectionBox: SelectionBox;
  neuronGroups: NeuronGroup[];
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onWheel: (e: WheelEvent) => void;
}

export const SNNCanvas: React.FC<SNNCanvasProps> = ({
  width,
  height,
  networkTopology,
  snnTopology,
  selectedNodeId,
  selectedEdgeId,
  interactionState,
  selectionBox,
  neuronGroups,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick,
  onWheel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useLanguage();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    if (networkTopology) {
      drawNetworkTopology(ctx, networkTopology, snnTopology, selectedNodeId, selectedEdgeId);
    }
    
    drawNeuronGroups(ctx);
    
    if (selectionBox.visible) {
      drawSelectionBox(ctx);
    }
    
    if (interactionState.isCreatingEdge && interactionState.edgeStartNodeId) {
      drawCreatingEdge(ctx);
    }
  }, [networkTopology, snnTopology, selectedNodeId, selectedEdgeId, width, height, selectionBox, interactionState, neuronGroups]);

  const drawNeuronGroups = (ctx: CanvasRenderingContext2D) => {
    if (!snnTopology) return;

    neuronGroups.forEach(group => {
      const isSelected = interactionState.selectedGroups.includes(group.id);
      const screenPos = {
        x: (group.x - snnTopology.canvasOffset.x) * snnTopology.canvasScale,
        y: (group.y - snnTopology.canvasOffset.y) * snnTopology.canvasScale
      };
      const screenSize = {
        width: group.width * snnTopology.canvasScale,
        height: group.height * snnTopology.canvasScale
      };

      ctx.fillStyle = isSelected ? 'rgba(255, 0, 0, 0.1)' : 'rgba(100, 100, 100, 0.2)';
      ctx.fillRect(screenPos.x, screenPos.y, screenSize.width, screenSize.height);
      
      ctx.strokeStyle = isSelected ? '#ff0000' : '#888';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(screenPos.x, screenPos.y, screenSize.width, screenSize.height);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'left';
      const title = group.type === 'visual_receptor_group' ? t('snn.group.visualReceptor') : t('snn.group.rotationController');
      ctx.fillText(title, screenPos.x + 3, screenPos.y + 12);

      if (group.collapsed) {
        ctx.fillStyle = '#999';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('...', screenPos.x + screenSize.width / 2, screenPos.y + screenSize.height / 2);
      }
    });
  };

  const drawNetworkTopology = (ctx: CanvasRenderingContext2D, topology: any, legacyTopology: any, selectedNode: string | null, selectedEdge: string | null) => {
    const offset = legacyTopology?.canvasOffset || { x: 0, y: 0 };
    const scale = legacyTopology?.canvasScale || 1;
    
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    
    topology.getAllEdges().forEach((edge: any) => {
      const fromNode = topology.getNode(edge.fromNodeId);
      const toNode = topology.getNode(edge.toNodeId);
      if (fromNode && toNode) {
        drawEdge(ctx, fromNode, toNode, edge, selectedEdge === edge.id);
      }
    });
    
    topology.getAllNodes().forEach((node: any) => {
      drawNode(ctx, node, selectedNode === node.id);
    });
    
    ctx.restore();
  };
  
  const drawNode = (ctx: CanvasRenderingContext2D, node: any, isSelected: boolean) => {
    const isInCollapsedGroup = neuronGroups.some(g => g.collapsed && g.neurons.includes(node.id));
    if (isInCollapsedGroup) return;

    const isMultiSelected = interactionState.selectedNodes.includes(node.id);
    const shouldHighlight = isSelected || isMultiSelected;
    const radius = 15;
    const state = node.getState ? node.getState() : { voltage: 0, isSpiking: false };
    
    let color = '#888888';
    if (state.isSpiking) color = '#ff6b6b';
    
    ctx.fillStyle = color;
    
    const neuronType = node.neuron?.type || node.type;
    switch (neuronType) {
      case 'sensor':
        ctx.fillRect(node.x - radius, node.y - radius, radius * 2, radius * 2);
        if (shouldHighlight) {
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 3;
          ctx.strokeRect(node.x - radius, node.y - radius, radius * 2, radius * 2);
        }
        break;
      case 'effector':
        ctx.beginPath();
        ctx.moveTo(node.x, node.y - radius);
        ctx.lineTo(node.x - radius * 0.866, node.y + radius * 0.5);
        ctx.lineTo(node.x + radius * 0.866, node.y + radius * 0.5);
        ctx.closePath();
        ctx.fill();
        if (shouldHighlight) {
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        break;
      default:
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        if (shouldHighlight) {
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        break;
    }

    if (!shouldHighlight) {
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      // ... (rest of the non-highlighted stroke logic)
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let typeLabel = 'B';
    if (neuronType === 'sensor') typeLabel = 'S';
    if (neuronType === 'effector') typeLabel = 'E';
    ctx.fillText(typeLabel, node.x, node.y);
  };
  
  const drawEdge = (ctx: CanvasRenderingContext2D, fromNode: any, toNode: any, edge: any, isSelected: boolean) => {
    const isMultiSelected = interactionState.selectedEdges.includes(edge.id);
    const shouldHighlight = isSelected || isMultiSelected;
    const state = edge.getState();
    
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const nodeRadius = 15;
    
    const startX = fromNode.x + (dx / distance) * nodeRadius;
    const startY = fromNode.y + (dy / distance) * nodeRadius;
    const endX = toNode.x - (dx / distance) * nodeRadius;
    const endY = toNode.y - (dy / distance) * nodeRadius;
    
    const weight = state.weight;
    const lineWidth = Math.max(1, weight * 5);
    let color = `rgba(100, 100, 100, ${Math.max(0.3, weight)})`;
    if (state.recentActivity > 0.1) color = `rgba(255, 100, 100, ${Math.max(0.3, weight)})`;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = shouldHighlight ? '#ff0000' : color;
    ctx.lineWidth = shouldHighlight ? lineWidth + 2 : lineWidth;
    ctx.stroke();
    
    drawArrow(ctx, startX, startY, endX, endY, shouldHighlight ? '#ff0000' : color);
  };
  
  const drawArrow = (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number, color: string) => {
    const headLength = 8;
    const angle = Math.atan2(endY - startY, endX - startX);
    
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawSelectionBox = (ctx: CanvasRenderingContext2D) => {
    const { startX, startY, endX, endY } = selectionBox;
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.fillStyle = 'rgba(74, 144, 226, 0.1)';
    const width = endX - startX;
    const height = endY - startY;
    ctx.fillRect(startX, startY, width, height);
    ctx.strokeRect(startX, startY, width, height);
    ctx.setLineDash([]);
  };

  const drawCreatingEdge = (ctx: CanvasRenderingContext2D) => {
    if (!interactionState.edgeStartNodeId || !networkTopology) return;
    const startNode = networkTopology.getNode(interactionState.edgeStartNodeId);
    if (!startNode || !snnTopology) return;

    const { canvasOffset, canvasScale } = snnTopology;
    const startX = startNode.x * canvasScale + canvasOffset.x;
    const startY = startNode.y * canvasScale + canvasOffset.y;
    const endX = interactionState.lastMousePos.x;
    const endY = interactionState.lastMousePos.y;
    
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  
  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', onWheel);
      };
    }
  }, [onWheel]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={onDoubleClick}
    />
  );
}; 