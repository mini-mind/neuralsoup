import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import ShareModal from './ShareModal';
import WorldSelectionModal from './WorldSelectionModal';

/**
 * 应用头部组件
 * 包含应用标题和一些控件
 */
const AppHeader: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [showShareModal, setShowShareModal] = useState(false);
  const [showWorldModal, setShowWorldModal] = useState(false);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const handleShareClick = () => {
    setShowShareModal(true);
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
  };

  const handleWorldClick = () => {
    setShowWorldModal(true);
  };

  const handleCloseWorldModal = () => {
    setShowWorldModal(false);
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
              onClick={handleWorldClick}
              style={{cursor: 'pointer'}}
              title={t('header.world-tooltip')}
            >
              🌍 {t('header.world')}
            </span>
            <span className="control-separator">|</span>
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

      {/* World Selection Modal */}
      <WorldSelectionModal
        isOpen={showWorldModal}
        onClose={handleCloseWorldModal}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={handleCloseShareModal}
      />
    </>
  );
};

export default AppHeader;
