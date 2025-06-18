import React, { useRef, useEffect, useState, useCallback } from 'react';
import './SNNTopologyEditor.css';

interface Node {
  id: string;
  x: number;
  y: number;
  type: 'input' | 'hidden' | 'output';
  label: string;
}

interface Edge {
  id: string;
  from: string;
  to: string;
  weight: number;
}

interface SNNTopologyEditorProps {
  width: number;
  height: number;
}

const SNNTopologyEditor: React.FC<SNNTopologyEditorProps> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  // 初始化默认的SNN拓扑结构
  useEffect(() => {
    const defaultNodes: Node[] = [
      // 输入层 (108个输入)
      { id: 'input-1', x: 50, y: 50, type: 'input', label: '视觉输入' },
      // 隐藏层1 (128个神经元)
      { id: 'hidden-1', x: 200, y: 80, type: 'hidden', label: '皮质柱1' },
      // 隐藏层2 (64个神经元)
      { id: 'hidden-2', x: 350, y: 110, type: 'hidden', label: '皮质柱2' },
      // 隐藏层3 (32个神经元)
      { id: 'hidden-3', x: 500, y: 140, type: 'hidden', label: '皮质柱3' },
      // 输出层 (3个动作)
      { id: 'output-1', x: 650, y: 80, type: 'output', label: '左转' },
      { id: 'output-2', x: 650, y: 120, type: 'output', label: '前进' },
      { id: 'output-3', x: 650, y: 160, type: 'output', label: '右转' },
    ];

    const defaultEdges: Edge[] = [
      { id: 'edge-1', from: 'input-1', to: 'hidden-1', weight: 0.5 },
      { id: 'edge-2', from: 'hidden-1', to: 'hidden-2', weight: 0.3 },
      { id: 'edge-3', from: 'hidden-2', to: 'hidden-3', weight: 0.4 },
      { id: 'edge-4', from: 'hidden-3', to: 'output-1', weight: 0.6 },
      { id: 'edge-5', from: 'hidden-3', to: 'output-2', weight: 0.7 },
      { id: 'edge-6', from: 'hidden-3', to: 'output-3', weight: 0.5 },
    ];

    setNodes(defaultNodes);
    setEdges(defaultEdges);
  }, []);

  // 绘制画布内容
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制边
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);
      
      if (fromNode && toNode) {
        ctx.beginPath();
        ctx.moveTo(fromNode.x + 30, fromNode.y + 15);
        ctx.lineTo(toNode.x, toNode.y + 15);
        
        // 根据权重设置线条粗细和颜色
        const weight = Math.abs(edge.weight);
        ctx.lineWidth = Math.max(1, weight * 4);
        ctx.strokeStyle = edge.weight > 0 ? '#27ae60' : '#e74c3c';
        ctx.stroke();

        // 绘制箭头
        const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
        const arrowLength = 10;
        ctx.beginPath();
        ctx.moveTo(toNode.x, toNode.y + 15);
        ctx.lineTo(
          toNode.x - arrowLength * Math.cos(angle - Math.PI / 6),
          toNode.y + 15 - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(toNode.x, toNode.y + 15);
        ctx.lineTo(
          toNode.x - arrowLength * Math.cos(angle + Math.PI / 6),
          toNode.y + 15 - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
    });

    // 绘制节点
    nodes.forEach(node => {
      // 节点背景
      ctx.fillStyle = node.type === 'input' ? '#3498db' : 
                     node.type === 'output' ? '#e74c3c' : '#f39c12';
      
      if (selectedNode === node.id) {
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
      } else {
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1;
      }

      ctx.fillRect(node.x, node.y, 60, 30);
      ctx.strokeRect(node.x, node.y, 60, 30);

      // 节点文字
      ctx.fillStyle = '#fff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x + 30, node.y + 20);
    });
  }, [nodes, edges, selectedNode]);

  // 画布重绘
  useEffect(() => {
    draw();
  }, [draw]);

  // 鼠标事件处理
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 检查是否点击了节点
    const clickedNode = nodes.find(node => 
      x >= node.x && x <= node.x + 60 && y >= node.y && y <= node.y + 30
    );

    if (clickedNode) {
      if (e.shiftKey) {
        // Shift+点击开始连接
        setConnecting(clickedNode.id);
      } else {
        // 普通点击选择和拖拽
        setSelectedNode(clickedNode.id);
        setDragging({
          nodeId: clickedNode.id,
          offsetX: x - clickedNode.x,
          offsetY: y - clickedNode.y
        });
      }
    } else {
      setSelectedNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNodes(prevNodes => 
      prevNodes.map(node => 
        node.id === dragging.nodeId
          ? { ...node, x: x - dragging.offsetX, y: y - dragging.offsetY }
          : node
      )
    );
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (connecting) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const targetNode = nodes.find(node => 
        x >= node.x && x <= node.x + 60 && y >= node.y && y <= node.y + 30
      );

      if (targetNode && targetNode.id !== connecting) {
        // 创建新连接
        const newEdge: Edge = {
          id: `edge-${Date.now()}`,
          from: connecting,
          to: targetNode.id,
          weight: Math.random() * 0.8 + 0.1 // 随机权重
        };
        setEdges(prevEdges => [...prevEdges, newEdge]);
      }
      setConnecting(null);
    }
    setDragging(null);
  };

  return (
    <div className="snn-topology-editor">
      <div className="editor-header">
        <h4>SNN 拓扑结构编辑器</h4>
        <div className="editor-controls">
          <button className="btn-small" onClick={() => setNodes([])}>清空</button>
          <button className="btn-small" onClick={() => setEdges([])}>清空连接</button>
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="topology-canvas"
      />
      
      <div className="editor-instructions">
        <p>• 拖拽节点移动位置</p>
        <p>• Shift+点击节点开始连接</p>
        <p>• 绿线表示正权重，红线表示负权重</p>
      </div>
    </div>
  );
};

export default SNNTopologyEditor; 