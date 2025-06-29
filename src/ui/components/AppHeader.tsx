import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import ShareModal from './ShareModal';

/**
 * 应用头部组件
 * 包含应用标题和一些控件
 */
const AppHeader: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [showShareModal, setShowShareModal] = useState(false);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const handleShareClick = () => {
    setShowShareModal(true);
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
  };

  return (
    <>
      <div className="app-header">
        <div className="header-left">
          <h1 className="app-title">NeuralSoup</h1>
        </div>
        <div className="header-right">
          <div className="header-controls">
            <span
              className="control-item"
              onClick={handleShareClick}
              style={{cursor: 'pointer'}}
              title={t('header.share-tooltip')}
            >
              {t('header.share')}
            </span>
            <span className="control-separator">|</span>
            <span
              className="control-item"
              onClick={toggleLanguage}
              style={{cursor: 'pointer'}}
              title={t('header.language-switch')}
            >
              {language === 'en' ? '中' : 'En'}
            </span>
            <span className="control-separator">|</span>
            <div className="user-icon" title={t('header.user')}></div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={handleCloseShareModal}
      />
    </>
  );
};

export default AppHeader;
