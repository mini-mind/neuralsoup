import React, { useEffect, useState } from 'react';
import { World } from '../core/world/World';
import { SimulationLoop } from '../core/simulation/SimulationLoop';
import { globalEventBus } from '../core/services/EventBus';
import { globalState } from '../core/services/GlobalState';

// 导入新的布局组件
import Sidebar from '../ui/components/Sidebar';
import TabSystem from '../ui/components/TabSystem';
import ResizableSplitter from '../ui/components/ResizableSplitter';
import SimulationArea from '../ui/components/SimulationArea';

// 导入样式
import '../ui/styles/layout.css';

// 导入模块
import { createDefaultWorld } from '../modules/worlds/DefaultWorld';
import { registerAllModules } from './registerModules';
import { createDefaultTopology } from '../modules/brains/snn/defaultSNN';

// 临时的类型定义
type Vector2D = { x: number; y: number; };
type SNNNode = { id: string; type: string; x: number; y: number; };

// 在应用启动时立即注册所有模块
registerAllModules();

const App: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('script');
  const [middleWidth, setMiddleWidth] = useState(600);

  useEffect(() => {
    // --- 1. 初始化核心模块 ---
    console.log('Initializing core modules...');
    const world = new World(1600, 1200);
    const simulation = new SimulationLoop(world);

    // 使用一个工厂函数来填充世界
    createDefaultWorld(world);

    // 初始化SNN编辑器状态
    globalState.setState({ snnTopology: createDefaultTopology() });

    // --- 2. 设置事件监听 ---
    // 监听UI事件来控制仿真
    const unsubscribeStart = globalEventBus.on('ui:start', () => {
      simulation.start(
        (updatedWorld) => {
          // 每个tick，用最新状态更新全局状态
          globalState.setState({ worldState: updatedWorld.getAgents() });
        }
      );
      globalState.setState({ simulationRunning: true });
    });

    const unsubscribeStop = globalEventBus.on('ui:stop', () => {
      simulation.stop();
      globalState.setState({ simulationRunning: false });
    });

    // SNN编辑器相关的事件处理
    let isPanning = false;
    let isDraggingNode = false;
    let draggedNodeId: string | null = null;
    let lastMousePos: Vector2D = { x: 0, y: 0 };

    const worldToCanvas = (pos: Vector2D, offset: Vector2D, scale: number): Vector2D => 
      ({ x: pos.x * scale + offset.x, y: pos.y * scale + offset.y });
    const canvasToWorld = (pos: Vector2D, offset: Vector2D, scale: number): Vector2D => 
      ({ x: (pos.x - offset.x) / scale, y: (pos.y - offset.y) / scale });

    const unsubscribeMouseDown = globalEventBus.on('ui:snn:canvas-mousedown', (data) => {
      lastMousePos = { x: data.x, y: data.y };
      const { snnTopology } = globalState.getState();
      if (!snnTopology) return;

      const worldPos = canvasToWorld({x: data.x, y: data.y}, snnTopology.canvasOffset, snnTopology.canvasScale);
      
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
        const worldPos = canvasToWorld({x: data.x, y: data.y}, snnTopology.canvasOffset, snnTopology.canvasScale);
        const newNodes = snnTopology.nodes.map((n: SNNNode) => 
          n.id === draggedNodeId ? { ...n, x: worldPos.x, y: worldPos.y } : n
        );
        globalState.setState({ snnTopology: { ...snnTopology, nodes: newNodes } });
      }
      lastMousePos = { x: data.x, y: data.y };
    });

    const unsubscribeMouseUp = globalEventBus.on('ui:snn:canvas-mouseup', (data) => {
      isPanning = false;
      isDraggingNode = false;
      draggedNodeId = null;
    });

    const unsubscribeDblClick = globalEventBus.on('ui:snn:canvas-doubleclick', (data) => {
        const { snnTopology } = globalState.getState();
        if (snnTopology) {
          const worldPos = canvasToWorld({x: data.x, y: data.y}, snnTopology.canvasOffset, snnTopology.canvasScale);
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

    // --- 3. 清理函数 ---
    return () => {
      console.log('Cleaning up core modules...');
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

  const handleSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const handleItemSelect = (itemId: string, groupId: string) => {
    setActiveItem(itemId);
  };

  const handleResize = (deltaX: number) => {
    const newWidth = Math.max(300, Math.min(800, middleWidth + deltaX));
    setMiddleWidth(newWidth);
  };

  return (
    <div className="app-container">
      <div className="main-content">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleSidebarToggle}
          activeItem={activeItem}
          onItemSelect={handleItemSelect}
        />
        
        <div className="middle-content" style={{ width: middleWidth }}>
          <TabSystem
            activeTab={activeItem}
            onTabChange={setActiveItem}
          />
        </div>
        
        <ResizableSplitter onResize={handleResize} />
        
        <SimulationArea />
      </div>
    </div>
  );
};

export default App; 