import React, { useEffect, useState, useRef } from 'react';
import { World } from '../core/world/World';
import { SimulationLoop } from '../core/simulation/SimulationLoop';
import { globalEventBus } from '../core/services/EventBus';
import { globalState } from '../core/services/GlobalState';
import { globalPluginManager } from '../core/services/PluginManager';
import AppHeader from '../ui/components/AppHeader';
import ResizableSplitter from '../ui/components/ResizableSplitter';
import SimulationArea from '../ui/components/SimulationArea';
import GraphEditor from '../ui/views/SNNTopologyEditor';
import TabContainer, { TabItem } from '../ui/components/TabContainer';
import WorldSelectionTab from '../ui/components/WorldSelectionTab';
import '../ui/styles/layout.css';
import { demoSNNTopology, createDemoNetworkTopology } from './demoData';
import { useLanguage } from '../contexts/LanguageContext';
import { SensorDataManager } from '../ui/services/SensorDataManager';



const App: React.FC = () => {
  const [rightPanelWidth, setRightPanelWidth] = useState(window.innerWidth / 2); // 初始50/50分屏
  const editorPanelRef = useRef<HTMLDivElement>(null);
  const brainTabRef = useRef<HTMLDivElement>(null);
  const [editorSize, setEditorSize] = useState({ width: 0, height: 0 });
  const { t } = useLanguage();

  useEffect(() => {
    // 初始化传感器数据管理器
    const sensorDataManager = SensorDataManager.getInstance();
    sensorDataManager.initialize();

    // 从全局状态获取选中的世界类型
    const selectedWorld = globalState.getState().selectedWorld || 'light-seeker';
    let world = World.createWorld(1600, 1200, selectedWorld);
    let simulation = new SimulationLoop(world);

    // 初始化插件管理器的当前世界
    globalPluginManager.setCurrentWorld(selectedWorld);

    // Initialize topology data
    const networkTopology = createDemoNetworkTopology();
    globalState.setState({
      snnTopology: demoSNNTopology,
      networkTopology: networkTopology
    });

    const unsubscribeStart = globalEventBus.on('ui:start', () => {
      simulation.start((updatedWorld) => {
        globalState.setState({ worldState: updatedWorld.getAgents() });

        // 更新网络拓扑（实时计算）
        const currentNetworkTopology = globalState.getState().networkTopology;
        if (currentNetworkTopology) {
          // 只有启用的插件参与计算
          const enabledPlugins = globalPluginManager.getComputingPlugins();
          const externalInputs = new Map<string, number>();

          // 从启用的感受器插件收集输入
          enabledPlugins.forEach(plugin => {
            if (plugin.pluginType === 'sensor') {
              const nodes = plugin.getNodes();
              nodes.forEach(node => {
                if (node.getOutput) {
                  externalInputs.set(node.id, node.getOutput());
                }
              });
            }
          });

          // 更新网络拓扑
          currentNetworkTopology.update(0.016, externalInputs); // ~60fps
        }
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
    const brainTabElement = brainTabRef.current;
    if (!brainTabElement) return;

    const updateSize = () => {
      if (brainTabElement) {
        setEditorSize({
          width: brainTabElement.clientWidth,
          height: brainTabElement.clientHeight,
        });
      }
    };

    // 初始尺寸设置
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(brainTabElement);

    return () => resizeObserver.disconnect();
  }, []);

  // 标签页切换时重新计算尺寸
  const handleTabChange = (tabId: string) => {
    if (tabId === 'brain') {
      // 延迟一帧来确保DOM已更新
      requestAnimationFrame(() => {
        const brainTabElement = brainTabRef.current;
        if (brainTabElement) {
          setEditorSize({
            width: brainTabElement.clientWidth,
            height: brainTabElement.clientHeight,
          });
        }
      });
    }
  };

  const handleHorizontalResize = (deltaX: number) => {
    const newWidth = rightPanelWidth - deltaX;
    const splitterWidth = 8; // 分割器宽度
    const minPanelWidth = 300; // 面板最小宽度
    const maxRightPanelWidth = window.innerWidth - minPanelWidth - splitterWidth; // 右侧面板最大宽度
    const minRightPanelWidth = minPanelWidth; // 右侧面板最小宽度

    // 确保新宽度在合理范围内，并且分割器始终可见
    if (newWidth >= minRightPanelWidth && newWidth <= maxRightPanelWidth) {
      setRightPanelWidth(newWidth);
    }
  };

  // 创建标签页数据
  const tabs: TabItem[] = [
    {
      id: 'world',
      label: t('tabs.world'),
      content: <WorldSelectionTab />
    },
    {
      id: 'brain',
      label: t('tabs.brain'),
      content: (
        <div className="brain-tab-content" ref={brainTabRef}>
          <GraphEditor
            width={editorSize.width}
            height={editorSize.height}
          />
          {/* 画布内操作提示 */}
          <div className="canvas-help-tooltip">
            <div className="help-icon" title={t('snn.editor.helpTooltip')} style={{maxWidth: '280px'}}>
              ?
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="app-container">
      <div className="main-layout">
        <div className="left-panel">
          <div className="app-header-container">
            <AppHeader />
          </div>
          <div className="simulation-container">
            <SimulationArea />
          </div>
        </div>
        <ResizableSplitter onResize={handleHorizontalResize} direction="vertical" />
        <div className="right-panel" style={{ width: rightPanelWidth }}>
          <div className="workspace-container" ref={editorPanelRef}>
            <TabContainer tabs={tabs} defaultActiveTab="brain" onTabChange={handleTabChange} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;