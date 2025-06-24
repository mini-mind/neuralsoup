import React, { useRef, useEffect, useCallback } from "react";
import { CanvasRenderer } from "../components/CanvasRenderer";
import { globalState } from "../../core/services/GlobalState";
import { globalEventBus } from "../../core/services/EventBus";
import NeuronDetailEditor from "../components/NeuronDetailEditor";
import SynapseDetailEditor from "../components/SynapseDetailEditor";
import "../components/SNNTopologyEditor.css";

interface SNNTopologyEditorProps {
  width: number;
  height: number;
}

const SNNTopologyEditor: React.FC<SNNTopologyEditorProps> = ({
  width,
  height,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 从全局状态订阅SNN拓扑数据
  // 注意：这里我们假设全局状态中会有一个snnTopology对象
  const { snnTopology } = globalState.useStore(s => ({ snnTopology: s.snnTopology }));

  // 绘制画布内容
  const draw = useCallback(() => {
    if (!snnTopology) return; // 如果没有拓扑数据，则不绘制

    CanvasRenderer.draw({
      canvasRef,
      snnTopology,
    });
  }, [snnTopology]);

  // 画布重绘
  useEffect(() => {
    draw();
  }, [draw]);

  // --- 事件处理 ---
  // 将所有的DOM事件都转发到事件总线
  const handleMouseEvent = (
    eventName: 'ui:snn:canvas-mousedown' | 'ui:snn:canvas-mousemove' | 'ui:snn:canvas-mouseup' | 'ui:snn:canvas-doubleclick', 
    e: React.MouseEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    globalEventBus.emit(eventName, {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      button: e.button,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
    });
  };

  const handleWheelEvent = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    globalEventBus.emit('ui:snn:canvas-wheel', { deltaY: e.deltaY });
  };

  return (
    <div className="snn-topology-editor">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={(e) => handleMouseEvent('ui:snn:canvas-mousedown', e)}
        onMouseMove={(e) => handleMouseEvent('ui:snn:canvas-mousemove', e)}
        onMouseUp={(e) => handleMouseEvent('ui:snn:canvas-mouseup', e)}
        onContextMenu={(e) => e.preventDefault()} // 禁用右键菜单
        onDoubleClick={(e) => handleMouseEvent('ui:snn:canvas-doubleclick', e)}
        onWheel={handleWheelEvent}
      />
      {/* 细节编辑器也需要通过全局状态来控制显示和数据 */}
      {/* <NeuronDetailEditor /> */}
      {/* <SynapseDetailEditor /> */}
    </div>
  );
};

export default SNNTopologyEditor;
