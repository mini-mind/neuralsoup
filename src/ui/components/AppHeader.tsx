import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * 应用头部组件
 * 包含应用标题和一些控件
 */
const AppHeader: React.FC = () => {
  const { language, setLanguage } = useLanguage();

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
          <span className="control-item">分享 V</span>
          <span className="control-separator">|</span>
          <span className="control-item" onClick={toggleLanguage} style={{cursor: 'pointer'}}>
            {language === 'en' ? '中' : 'En'}
          </span>
           <span className="control-separator">|</span>
          <div className="user-icon"></div>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;
