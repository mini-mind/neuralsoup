import React, { useEffect, useState, useRef } from 'react';
import { World } from '../core/world/World';
import { SimulationLoop } from '../core/simulation/SimulationLoop';
import { globalEventBus } from '../core/services/EventBus';
import { globalState } from '../core/services/GlobalState';
import AppHeader from '../ui/components/AppHeader';
import ResizableSplitter from '../ui/components/ResizableSplitter';
import SimulationArea from '../ui/components/SimulationArea';
import GraphEditor from '../ui/views/SNNTopologyEditor';
import '../ui/styles/layout.css';
import { demoSNNTopology, createDemoNetworkTopology } from './demoData';
import { useLanguage } from '../contexts/LanguageContext';
import HelpTooltipIcon from '../ui/components/HelpTooltipIcon';

const App: React.FC = () => {
  const [rightPanelWidth, setRightPanelWidth] = useState(500);
  const editorPanelRef = useRef<HTMLDivElement>(null);
  const [editorSize, setEditorSize] = useState({ width: 0, height: 0 });
  const { t } = useLanguage();

  useEffect(() => {
    // 从全局状态获取选中的世界类型
    const selectedWorld = globalState.getState().selectedWorld || 'luminous-garden';
    let world = World.createWorld(1600, 1200, selectedWorld);
    let simulation = new SimulationLoop(world);

    // Initialize topology data
    const networkTopology = createDemoNetworkTopology();
    globalState.setState({
      snnTopology: demoSNNTopology,
      networkTopology: networkTopology
    });

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

    // 监听世界切换事件
    const unsubscribeWorldChange = globalEventBus.on('world:changed', (event: any) => {
      console.log('Switching to world:', event.worldType);

      // 停止当前仿真
      simulation.stop();

      // 创建新世界
      world = World.createWorld(1600, 1200, event.worldType);
      simulation = new SimulationLoop(world);

      // 通知渲染系统世界实例已更新
      globalEventBus.emit('world:instance', { world });

      // 更新全局状态
      globalState.setState({
        worldState: world.getAgents(),
        simulationRunning: false
      });
    });

    // 初始化时也要发送世界实例
    globalEventBus.emit('world:instance', { world });

    return () => {
      simulation.stop();
      unsubscribeStart();
      unsubscribeStop();
      unsubscribeWorldChange();
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
    if (newWidth > 300 && newWidth < window.innerWidth - 300) {
      setRightPanelWidth(newWidth);
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
          <div className="snn-editor-header">
            <div className="editor-title">
              <h3>{t('snn.editor.title')}</h3>
              <HelpTooltipIcon tooltipText={t('snn.editor.helpTooltip')} />
            </div>
            <div className="editor-controls">
              <button className="control-button" onClick={() => {
                console.log('Apply current configuration');
                // TODO: Implement SNN configuration application logic
              }}>
                {t('snn.editor.apply')}
              </button>
            </div>
          </div>
          <GraphEditor 
            width={editorSize.width} 
            height={editorSize.height} 
            ref={editorPanelRef}
          />
        </div>
      </div>
    </div>
  );
};

export default App;