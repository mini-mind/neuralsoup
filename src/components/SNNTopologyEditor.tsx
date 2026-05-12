import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { CanvasRenderer } from './CanvasRenderer';
import { useSNNTopologyState } from './hooks/useSNNTopologyState';
import { useSNNTopologyEvents } from './hooks/useSNNTopologyEvents';
import { createDefaultReceptor, createDefaultEffector, createDefaultNodes } from './utils/defaultSNNData';
import { getNodeCenter } from './utils/editorGeometry';
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
    selectedSynapse,
    connecting,
    canvasOffset,
    canvasScale,
    isSelecting,
    selectedNodes,
    hoveredNode,
    showDetailModal,
    receptorScrollX,
    setNodes,
    setSynapses,
    setReceptors,
    setEffectors,
    setShowDetailModal,
    resetInteractionState
  } = state;

  const activeNeuron = useMemo(
    () => showDetailModal?.type === 'neuron'
      ? nodes.find(node => node.id === showDetailModal.id) ?? null
      : null,
    [nodes, showDetailModal]
  );
  const activeSynapse = useMemo(
    () => showDetailModal?.type === 'synapse'
      ? synapses.find(synapse => synapse.id === showDetailModal.id) ?? null
      : null,
    [showDetailModal, synapses]
  );
  const nodeCentersSummary = useMemo(
    () => nodes.map((node) => {
      const center = getNodeCenter(node, canvasOffset, canvasScale);
      return `${node.id}:${Math.round(center.x)},${Math.round(center.y)}`;
    }).join('|'),
    [canvasOffset, canvasScale, nodes]
  );

  // 初始化默认的SNN结构
  useEffect(() => {
    setReceptors([createDefaultReceptor(visionCells)]);
    setSynapses(prevSynapses => prevSynapses.filter(synapse => {
      if (!synapse.from.startsWith('vision-')) {
        return true;
      }

      const parts = synapse.from.split('-');
      const index = Number(parts[2]);
      return Number.isFinite(index) && index < visionCells;
    }));
    resetInteractionState();
  }, [visionCells, setReceptors, setSynapses, resetInteractionState]);

  useEffect(() => {
    setEffectors([createDefaultEffector()]);
    setNodes(createDefaultNodes());
    setSynapses([]);
  }, [setEffectors, setNodes, setSynapses]);

  useEffect(() => {
    if (!showDetailModal) {
      return;
    }

    if (showDetailModal.type === 'neuron' && !activeNeuron) {
      setShowDetailModal(null);
    }

    if (showDetailModal.type === 'synapse' && !activeSynapse) {
      setShowDetailModal(null);
    }
  }, [activeNeuron, activeSynapse, setShowDetailModal, showDetailModal]);

  // 绘制画布内容
  const draw = useCallback(() => {
    CanvasRenderer.draw({
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
    });
  }, [nodes, synapses, receptors, effectors, selectedSynapse, connecting, canvasOffset, canvasScale, isSelecting, selectedNodes, hoveredNode, receptorScrollX]);

  // 画布重绘
  useEffect(() => {
    draw();
  }, [draw]);

  // 神经元脉冲发放和突触传播
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const latestNodes = nodes;
      const latestSynapses = synapses;
      const activeVisionInputs = receptors[0]?.modalities.find((modality) => modality.type === 'vision')?.inputs ?? [];
      const effectorsById = new Map(
        effectors.flatMap((effector) => effector.outputs.map((output) => [output.id, output]))
      );
      const spikesByNodeId = new Map(
        latestNodes
          .filter((node) => node.state?.spike)
          .map((node) => [node.id, node.state?.lastSpikeTime ?? 0])
      );

      const getSynapseInput = (synapseFrom: string) => {
        if (synapseFrom.startsWith('vision-')) {
          const input = activeVisionInputs.find((candidate) => candidate.id === synapseFrom);
          return input ? input.voltage * 20 : 0;
        }

        const sourceNode = latestNodes.find((candidate) => candidate.id === synapseFrom);
        if (sourceNode?.state?.spike) {
          return 12;
        }

        return 0;
      };
      
      // 更新神经元状态并检测脉冲发放
      setNodes(prevNodes =>
        prevNodes.map(node => {
          if (node.type === 'neuron' && node.state) {
            let v = node.state.v;
            let u = node.state.u;
            
            let input = 0;
            latestSynapses.forEach(synapse => {
              if (synapse.to === node.id) {
                input += getSynapseInput(synapse.from) * synapse.weight;
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

      setEffectors((prevEffectors) =>
        prevEffectors.map((effector) => ({
          ...effector,
          outputs: effector.outputs.map((output) => {
            const previousOutput = effectorsById.get(output.id) ?? output;
            const timeDelta = (now - previousOutput.lastUpdateTime) / 1000;
            const decayedAccumulation = Math.max(
              0,
              previousOutput.pulseAccumulation * Math.pow(previousOutput.decayRate, timeDelta * 5)
            );

            const incomingPulse = latestSynapses.reduce((total, synapse) => {
              if (synapse.to !== output.id) {
                return total;
              }

              const lastSpikeTime = spikesByNodeId.get(synapse.from);
              if (!lastSpikeTime || now - lastSpikeTime > synapse.delay * 100) {
                return total;
              }

              return total + Math.max(0, synapse.weight) * 10;
            }, 0);

            const nextAccumulation = Math.min(100, decayedAccumulation + incomingPulse);

            return {
              ...output,
              pulseAccumulation: nextAccumulation,
              signal: nextAccumulation / 100,
              lastUpdateTime: now
            };
          })
        }))
      );

      setReceptors((prevReceptors) =>
        prevReceptors.map((receptor) => ({
          ...receptor,
          modalities: receptor.modalities.map((modality) => {
            if (modality.type !== 'vision') {
              return modality;
            }

            return {
              ...modality,
              inputs: modality.inputs.map((input, index) => ({
                ...input,
                voltage: (Math.sin(now / 350 + index * 0.35) + 1) / 2
              }))
            };
          })
        }))
      );
    }, 100);

    return () => clearInterval(interval);
  }, [nodes, synapses, receptors, effectors, setNodes, setEffectors, setReceptors]);

  // 添加键盘事件监听
  useEffect(() => {
    window.addEventListener('keydown', events.handleKeyDown);
    window.addEventListener('mouseup', events.stopInteraction);
    return () => {
      window.removeEventListener('keydown', events.handleKeyDown);
      window.removeEventListener('mouseup', events.stopInteraction);
    };
  }, [events.handleKeyDown, events.stopInteraction]);

  return (
    <div className="snn-topology-editor" data-testid="topology-editor">
      {/* 头部 - 标题和控制选项 */}
      <div className="editor-header">
        <div className="header-left">
          <h4>拓扑沙盒</h4>
          <span style={{fontSize: '11px', color: '#94a3b8'}}>({width}×{height})</span>
          <div 
            className="help-button" 
            data-tooltip="拓扑沙盒操作指南:
双击空白处 - 添加新神经元
左键拖拽 - 框选多个神经元或拖拽神经元
Ctrl+左键 - 多选神经元
Ctrl+从感受器或神经元拖拽 - 创建可执行连接
右键拖拽 - 平移画布
Delete键 - 删除选中元素
滚轮 - 缩放画布视图（包括网格）

当前沙盒仅用于独立编辑和观察局部脉冲拓扑，不会驱动左侧运行中的智能体。"
          >
            <span>?</span>
          </div>
        </div>
        <div className="editor-controls">
          <div className="control-options" data-testid="topology-execution-mode">感受器驱动脉冲拓扑</div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        data-testid="topology-canvas"
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
      <div
        className="diagnostic-strip"
        data-testid="topology-state-summary"
      >
        <span data-testid="topology-node-count">{nodes.length}</span>
        <span data-testid="topology-synapse-count">{synapses.length}</span>
        <span data-testid="topology-selected-count">{selectedNodes.length}</span>
        <span data-testid="topology-selected-synapse">{selectedSynapse ?? 'none'}</span>
        <span data-testid="topology-vision-cells">{visionCells}</span>
        <span data-testid="topology-node-centers">{nodeCentersSummary}</span>
      </div>
      
      {showDetailModal && (
        <div className="modal-overlay" data-testid="topology-detail-modal-overlay" onClick={() => setShowDetailModal(null)}>
          <div className="modal-content" data-testid="topology-detail-modal" onClick={e => e.stopPropagation()}>
            {showDetailModal.type === 'neuron' && activeNeuron && (
              <NeuronDetailEditor
                neuron={activeNeuron}
                onUpdate={(updatedNeuron) => {
                  setNodes(prev => prev.map(node => 
                    node.id === updatedNeuron.id ? updatedNeuron : node
                  ));
                }}
              />
            )}
            {showDetailModal.type === 'synapse' && activeSynapse && (
              <SynapseDetailEditor
                synapse={activeSynapse}
                onUpdate={(updatedSynapse) => {
                  setSynapses(prev => prev.map(synapse => 
                    synapse.id === updatedSynapse.id ? updatedSynapse : synapse
                  ));
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
