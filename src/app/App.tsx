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
import { registerAllModules } from './registerModules';
import { demoSNNTopology, createDemoNetworkTopology } from './demoData';
import { useLanguage } from '../contexts/LanguageContext';
import HelpTooltipIcon from '../ui/components/HelpTooltipIcon';

type Vector2D = { x: number; y: number };
type SNNNode = { id: string; type: string; x: number; y: number };

registerAllModules();

const App: React.FC = () => {
  const [rightPanelWidth, setRightPanelWidth] = useState(500);
  const editorPanelRef = useRef<HTMLDivElement>(null);
  const [editorSize, setEditorSize] = useState({ width: 0, height: 0 });
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    const world = new World(1600, 1200);
    const simulation = new SimulationLoop(world);
    
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

    return () => {
      simulation.stop();
      unsubscribeStart();
      unsubscribeStop();
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