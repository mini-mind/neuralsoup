import React from 'react';
import { useLanguage, Language } from '../contexts/LanguageContext';
import './SettingsPanel.css';

const SettingsPanel: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
  };

  return (
    <div className="settings-panel">
      <h2 className="settings-title">{t('settings.title')}</h2>
      
      <div className="settings-section">
        <label className="settings-label">{t('settings.language')}</label>
        <div className="language-options">
          <button 
            className={`language-btn ${language === 'zh' ? 'active' : ''}`}
            onClick={() => handleLanguageChange('zh')}
          >
            {t('settings.language.chinese')}
          </button>
          <button 
            className={`language-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => handleLanguageChange('en')}
          >
            {t('settings.language.english')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel; 