import React, { useState } from 'react';

/**
 * 应用头部组件
 * 包含应用标题和一些控件
 */
const AppHeader: React.FC = () => {
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  return (
    <div className="app-header">
      <div className="header-left">
        <h1 className="app-title">NeuralSoup</h1>
      </div>
      <div className="header-right">
        <div className="header-controls">
          <span
            className="control-item"
            style={{cursor: 'pointer'}}
            title="分享"
          >
            分享
          </span>
          <span className="control-separator">|</span>
          <span
            className="control-item"
            onClick={toggleLanguage}
            style={{cursor: 'pointer'}}
            title="切换语言"
          >
            {language === 'en' ? '中' : 'En'}
          </span>
          <span className="control-separator">|</span>
          <div className="user-icon" title="用户"></div>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;
