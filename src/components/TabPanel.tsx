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
}

const TabPanel: React.FC<TabPanelProps> = ({ tabs, defaultActiveTab }) => {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || tabs[0]?.id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
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
      </div>
      <div className="tab-content">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
};

export default TabPanel; 