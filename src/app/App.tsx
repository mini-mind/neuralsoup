import React, { useState, useRef, useEffect } from 'react';
import AppHeader from '../ui/components/AppHeader';
import ResizableSplitter from '../ui/components/ResizableSplitter';
import SimulationArea from '../ui/components/SimulationArea';
import TabContainer, { TabItem } from '../ui/components/TabContainer';
import '../ui/styles/layout.css';

/**
 * 主应用组件
 * 提供基础的布局、导航栏、拖拽调整和标签页功能
 */
const App: React.FC = () => {
  const [rightPanelWidth, setRightPanelWidth] = useState(window.innerWidth / 2); // 初始50/50分屏
  const editorPanelRef = useRef<HTMLDivElement>(null);

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

  // 创建空白标签页数据
  const tabs: TabItem[] = [
    {
      id: 'tab1',
      label: '标签页1',
      content: <div className="tab-empty-content">空白内容区域</div>
    },
    {
      id: 'tab2', 
      label: '标签页2',
      content: <div className="tab-empty-content">空白内容区域</div>
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
            <TabContainer tabs={tabs} defaultActiveTab="tab1" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;