import React, { useState, ReactNode } from 'react';
import '../styles/layout.css';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabContainerProps {
  tabs: TabItem[];
  defaultActiveTab?: string;
  className?: string;
  onTabChange?: (tabId: string) => void;
}

/**
 * 通用标签页容器组件
 * 支持多个标签页的切换和内容显示
 */
const TabContainer: React.FC<TabContainerProps> = ({
  tabs,
  defaultActiveTab,
  className = '',
  onTabChange
}) => {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || tabs[0]?.id || '');

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={`tab-container ${className}`}>
      <div className="tab-header">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>
      <div className="tab-content">
        {activeTabContent}
      </div>
    </div>
  );
};

export default TabContainer;
