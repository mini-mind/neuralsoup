import React, { useState } from 'react';
import './TabPanel.css';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabPanelProps {
  tabs: Tab[];
  defaultActiveTab?: string;
  showSettingsButton?: boolean;
  onSettingsClick?: () => void;
  isMobile?: boolean;
  mobileFullscreenTab?: string | null;
  onMobileTabClick?: (tabId: string) => void;
  onMobileCollapseClick?: () => void;
  showContentInMobileNormalMode?: boolean;
  collapseText?: string;
}

const TabPanel: React.FC<TabPanelProps> = ({ 
  tabs, 
  defaultActiveTab, 
  showSettingsButton = false, 
  onSettingsClick,
  isMobile = false,
  mobileFullscreenTab,
  onMobileTabClick,
  onMobileCollapseClick,
  showContentInMobileNormalMode = true,
  collapseText = "↓"
}) => {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || tabs[0]?.id);

  const handleTabClick = (tabId: string) => {
    if (isMobile && !mobileFullscreenTab) {
      // 移动端正常模式：点击标签页进入全屏模式
      onMobileTabClick?.(tabId);
    } else {
      // 桌面端或移动端全屏模式：正常切换标签页
      setActiveTab(tabId);
    }
  };

  return (
    <div className="tab-panel">
      <div className="tab-header">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        {/* 根据移动端状态决定显示设置按钮还是收起按钮 */}
        {isMobile && mobileFullscreenTab ? (
          <button
            className="tab-button collapse-button"
            onClick={onMobileCollapseClick}
            title="Collapse"
          >
            {collapseText}
          </button>
        ) : (
          showSettingsButton && (
            <button
              className="tab-button settings-button"
              onClick={onSettingsClick}
              title="Settings"
            >
              ⚙️
            </button>
          )
        )}
      </div>
      <div className="tab-content">
        {/* 移动端：只在全屏模式或允许正常模式显示内容时显示 */}
        {isMobile ? (
          mobileFullscreenTab ? 
            tabs.find((tab) => tab.id === activeTab)?.content :
            (showContentInMobileNormalMode ? tabs.find((tab) => tab.id === activeTab)?.content : null)
        ) : (
          /* 桌面端：正常显示内容 */
          tabs.find((tab) => tab.id === activeTab)?.content
        )}
      </div>
    </div>
  );
};

export default TabPanel; 