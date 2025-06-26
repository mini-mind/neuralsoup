import React, { useEffect, useState, useRef } from 'react';
import { World } from '../core/world/World';
import { SimulationLoop } from '../core/simulation/SimulationLoop';
import { globalEventBus } from '../core/services/EventBus';
import { globalState } from '../core/services/GlobalState';
import AppHeader from '../ui/components/AppHeader';
import ResizableSplitter from '../ui/components/ResizableSplitter';
import SimulationArea from '../ui/components/SimulationArea';
import ResourceLibrary from '../ui/components/ResourceLibrary';
import SNNTopologyEditor from '../ui/views/SNNTopologyEditor';
import '../ui/styles/layout.css';
import { registerAllModules } from './registerModules';
import { demoSNNTopology } from './demoData';

type Vector2D = { x: number; y: number };
type SNNNode = { id: string; type: string; x: number; y: number };

registerAllModules();

const App: React.FC = () => {
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [resourceLibraryHeight, setResourceLibraryHeight] = useState(200);
  const editorPanelRef = useRef<HTMLDivElement>(null);
  const [editorSize, setEditorSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const world = new World(1600, 1200);
    const simulation = new SimulationLoop(world);
    globalState.setState({ snnTopology: demoSNNTopology });

    const unsubscribeStart = globalEventBus.on('ui:start', () => {
      simulation.start((updatedWorld) => {
        globalState.setState({ worldState: updatedWorld.getAgents() });
      });
      globalState.setState({ simulationRunning: true });
    });

    const unsubscribeStop = globalEventBus.on('ui:stop', () => {
      simulation.stop();
      globalState.setState({ simulationRunning: false });
    });

    let isPanning = false;
    let isDraggingNode = false;
    let draggedNodeId: string | null = null;
    let lastMousePos: Vector2D = { x: 0, y: 0 };

    const canvasToWorld = (pos: Vector2D, offset: Vector2D, scale: number): Vector2D => ({
      x: (pos.x - offset.x) / scale,
      y: (pos.y - offset.y) / scale,
    });

    const unsubscribeMouseDown = globalEventBus.on('ui:snn:canvas-mousedown', (data) => {
      lastMousePos = { x: data.x, y: data.y };
      const { snnTopology } = globalState.getState();
      if (!snnTopology) return;

      const worldPos = canvasToWorld({ x: data.x, y: data.y }, snnTopology.canvasOffset, snnTopology.canvasScale);

      const clickedNode = snnTopology.nodes.find((node: SNNNode) => {
        const dist = Math.sqrt(Math.pow(node.x - worldPos.x, 2) + Math.pow(node.y - worldPos.y, 2));
        return dist < 10;
      });

      if (clickedNode && data.button === 0) {
        isDraggingNode = true;
        draggedNodeId = clickedNode.id;
      } else if (data.button === 2) {
        isPanning = true;
      }
    });

    const unsubscribeMouseMove = globalEventBus.on('ui:snn:canvas-mousemove', (data) => {
      const { snnTopology } = globalState.getState();
      if (!snnTopology) return;

      if (isPanning) {
        const dx = data.x - lastMousePos.x;
        const dy = data.y - lastMousePos.y;
        globalState.setState({
          snnTopology: { ...snnTopology, canvasOffset: { x: snnTopology.canvasOffset.x + dx, y: snnTopology.canvasOffset.y + dy } },
        });
      } else if (isDraggingNode && draggedNodeId) {
        const worldPos = canvasToWorld({ x: data.x, y: data.y }, snnTopology.canvasOffset, snnTopology.canvasScale);
        const newNodes = snnTopology.nodes.map((n: SNNNode) =>
          n.id === draggedNodeId ? { ...n, x: worldPos.x, y: worldPos.y } : n
        );
        globalState.setState({ snnTopology: { ...snnTopology, nodes: newNodes } });
      }
      lastMousePos = { x: data.x, y: data.y };
    });

    const unsubscribeMouseUp = globalEventBus.on('ui:snn:canvas-mouseup', () => {
      isPanning = false;
      isDraggingNode = false;
      draggedNodeId = null;
    });

    const unsubscribeDblClick = globalEventBus.on('ui:snn:canvas-doubleclick', (data) => {
      const { snnTopology } = globalState.getState();
      if (snnTopology) {
        const worldPos = canvasToWorld({ x: data.x, y: data.y }, snnTopology.canvasOffset, snnTopology.canvasScale);
        const newNode = {
          id: `neuron-${Date.now()}`, type: 'neuron', x: worldPos.x, y: worldPos.y,
        };
        globalState.setState({ snnTopology: { ...snnTopology, nodes: [...snnTopology.nodes, newNode] } });
      }
    });

    const unsubscribeWheel = globalEventBus.on('ui:snn:canvas-wheel', (data) => {
      const { snnTopology } = globalState.getState();
      if (snnTopology) {
        const scaleAmount = -data.deltaY * 0.001;
        const newScale = Math.max(0.1, snnTopology.canvasScale + scaleAmount);
        globalState.setState({
          snnTopology: { ...snnTopology, canvasScale: newScale },
        });
      }
    });

    return () => {
      simulation.stop();
      unsubscribeStart();
      unsubscribeStop();
      unsubscribeMouseDown();
      unsubscribeMouseMove();
      unsubscribeMouseUp();
      unsubscribeDblClick();
      unsubscribeWheel();
    };
  }, []);
  
  useEffect(() => {
    const editorElement = editorPanelRef.current;
    if (!editorElement) return;

    const resizeObserver = new ResizeObserver(() => {
      if (editorElement) {
        setEditorSize({
          width: editorElement.clientWidth,
          height: editorElement.clientHeight,
        });
      }
    });

    resizeObserver.observe(editorElement);
    return () => resizeObserver.disconnect();
  }, []);

  const handleHorizontalResize = (deltaX: number) => {
    const newWidth = rightPanelWidth - deltaX;
    if (newWidth > 200 && newWidth < window.innerWidth - 300) {
      setRightPanelWidth(newWidth);
    }
  };

  const handleVerticalResize = (deltaY: number) => {
    const newHeight = resourceLibraryHeight + deltaY;
    if (newHeight > 100 && newHeight < window.innerHeight - 200) {
      setResourceLibraryHeight(newHeight);
    }
  };

  return (
    <div className="app-container">
      <AppHeader />
      <div className="main-layout">
        <div className="left-panel">
          <SimulationArea />
        </div>
        <ResizableSplitter onResize={handleHorizontalResize} direction="vertical" />
        <div className="right-panel" style={{ width: rightPanelWidth }}>
          <div className="resource-library-panel" style={{ height: resourceLibraryHeight }}>
             <ResourceLibrary />
          </div>
          <ResizableSplitter onResize={handleVerticalResize} direction="horizontal" />
          <div className="editor-panel" ref={editorPanelRef} style={{ flexGrow: 1 }}>
            <SNNTopologyEditor width={editorSize.width} height={editorSize.height} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;