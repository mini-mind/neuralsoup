import React, { useRef, useEffect, useCallback } from 'react';
import { CanvasRenderer } from './CanvasRenderer';
import { useSNNTopologyState } from './hooks/useSNNTopologyState';
import { useSNNTopologyEvents } from './hooks/useSNNTopologyEvents';
import { createDefaultReceptor, createDefaultEffector, createDefaultNodes } from './utils/defaultSNNData';
import NeuronDetailEditor from './NeuronDetailEditor';
import SynapseDetailEditor from './SynapseDetailEditor';
import './SNNTopologyEditor.css';

interface SNNTopologyEditorProps {
  width: number;
  height: number;
  visionCells?: number;
}

const SNNTopologyEditor: React.FC<SNNTopologyEditorProps> = ({ width, height, visionCells = 36 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useSNNTopologyState();
  const events = useSNNTopologyEvents({ canvasRef, state });

  const {
    nodes,
    synapses,
    receptors,
    effectors,
    selectedNode,
    selectedSynapse,
    connecting,
    canvasOffset,
    canvasScale,
    isSelecting,
    selectedNodes,
    hoveredNode,
    showDetailModal,
    enablePlayerControlOverride,
    receptorScrollX,
    setNodes,
    setSynapses,
    setReceptors,
    setEffectors,
    setShowDetailModal,
    setEnablePlayerControlOverride
  } = state;

  // 初始化默认的SNN结构
  useEffect(() => {
    setReceptors([createDefaultReceptor(visionCells)]);
    setEffectors([createDefaultEffector()]);
    setNodes(createDefaultNodes());
    setSynapses([]);
  }, [visionCells, setReceptors, setEffectors, setNodes, setSynapses]);

  // 绘制画布内容
  const draw = useCallback(() => {
    CanvasRenderer.draw({
      canvasRef,
      nodes,
      synapses,
      receptors,
      effectors,
      selectedNode,
      selectedSynapse,
      connecting,
      canvasOffset,
      canvasScale,
      isSelecting,
      selectedNodes,
      hoveredNode,
      receptorScrollX
    });
  }, [nodes, synapses, receptors, effectors, selectedNode, selectedSynapse, connecting, canvasOffset, canvasScale, isSelecting, selectedNodes, hoveredNode, receptorScrollX]);

  // 画布重绘
  useEffect(() => {
    draw();
  }, [draw]);

  // 效应器脉冲累积和衰减
  useEffect(() => {
    const interval = setInterval(() => {
      setEffectors(prevEffectors => 
        prevEffectors.map(effector => ({
          ...effector,
          outputs: effector.outputs.map(output => {
            const now = Date.now();
            const timeDelta = (now - output.lastUpdateTime) / 1000;
            
            const newAccumulation = Math.max(0, output.pulseAccumulation * Math.pow(output.decayRate, timeDelta * 5));
            
            return {
              ...output,
              pulseAccumulation: newAccumulation,
              signal: newAccumulation / 100,
              lastUpdateTime: now
            };
          })
        }))
      );
    }, 50);

    return () => clearInterval(interval);
  }, [setEffectors]);

  // 神经元脉冲发放和突触传播
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      // 更新神经元状态并检测脉冲发放
      setNodes(prevNodes => 
        prevNodes.map(node => {
          if (node.type === 'neuron' && node.state) {
            let v = node.state.v;
            let u = node.state.u;
            
            let input = 0;
            synapses.forEach(synapse => {
              if (synapse.to === node.id) {
                input += Math.random() * 5 - 2.5;
              }
            });
            
            const dt = 0.1;
            v += dt * (0.04 * v * v + 5 * v + 140 - u + input);
            u += dt * (node.params!.a * (node.params!.b * v - u));
            
            let spike = false;
            if (v >= node.params!.threshold) {
              v = node.params!.c;
              u += node.params!.d;
              spike = true;
            }
            
            return {
              ...node,
              state: {
                ...node.state,
                v,
                u,
                spike,
                lastSpikeTime: spike ? now : node.state.lastSpikeTime
              }
            };
          }
          return node;
        })
      );
      
      // 传播脉冲到效应器
      const currentTime = Date.now();
      nodes.forEach(node => {
        if (node.state?.spike) {
          synapses.forEach(synapse => {
            if (synapse.from === node.id) {
              setEffectors(prevEffectors => 
                prevEffectors.map(effector => ({
                  ...effector,
                  outputs: effector.outputs.map(output => 
                    output.id === synapse.to 
                      ? {
                          ...output,
                          pulseAccumulation: Math.min(100, output.pulseAccumulation + Math.abs(synapse.weight) * 10),
                          lastUpdateTime: currentTime
                        }
                      : output
                  )
                }))
              );
            }
          });
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, [nodes, synapses, setNodes, setEffectors]);

  // 添加键盘事件监听
  useEffect(() => {
    window.addEventListener('keydown', events.handleKeyDown);
    return () => {
      window.removeEventListener('keydown', events.handleKeyDown);
    };
  }, [events.handleKeyDown]);

  return (
    <div className="snn-topology-editor">
      {/* 头部 - 标题和控制选项 */}
      <div className="editor-header">
        <div className="header-left">
          <h4>模型编辑器</h4>
          <span style={{fontSize: '11px', color: '#94a3b8'}}>({width}×{height})</span>
          <div 
            className="help-button" 
            data-tooltip="模型编辑器操作指南:
双击空白处 - 添加新神经元
左键拖拽 - 框选多个神经元或拖拽神经元
Ctrl+左键 - 多选神经元
Ctrl+拖拽节点 - 创建连接（hover高亮可连接目标）
右键拖拽 - 平移画布
Delete键 - 删除选中元素
滚轮 - 缩放画布视图（包括网格）"
          >
            <span>?</span>
          </div>
        </div>
        <div className="editor-controls">
          <div className="control-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={enablePlayerControlOverride}
                onChange={(e) => setEnablePlayerControlOverride(e.target.checked)}
              />
              玩家控制覆盖输出
            </label>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={events.handleMouseDown}
        onMouseMove={events.handleMouseMove}
        onMouseUp={events.handleMouseUp}
        onDoubleClick={events.handleDoubleClick}
        onWheel={events.handleWheel}
        onContextMenu={events.handleContextMenu}
        className="topology-canvas"
        tabIndex={0}
        style={{ outline: 'none' }}
      />
      
      {showDetailModal && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            {showDetailModal.type === 'neuron' && (
              <NeuronDetailEditor
                neuron={showDetailModal.data}
                onUpdate={(updatedNeuron) => {
                  setNodes(prev => prev.map(node => 
                    node.id === updatedNeuron.id ? updatedNeuron : node
                  ));
                  setShowDetailModal(null);
                }}
              />
            )}
            {showDetailModal.type === 'synapse' && (
              <SynapseDetailEditor
                synapse={showDetailModal.data}
                onUpdate={(updatedSynapse) => {
                  setSynapses(prev => prev.map(synapse => 
                    synapse.id === updatedSynapse.id ? updatedSynapse : synapse
                  ));
                  setShowDetailModal(null);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SNNTopologyEditor; 