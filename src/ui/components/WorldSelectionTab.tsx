import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAllLevels, type LevelConfig } from '../../core/config/LevelConfig';
import LevelSelectionModal from './LevelSelectionModal';

export type WorldType = 'luminous-garden' | 'light-seeker';

/**
 * 世界选择标签页组件
 * 现在使用关卡系统，只显示可用的关卡
 */
const WorldSelectionTab: React.FC = () => {
  const { t } = useLanguage();
  const [showLevelModal, setShowLevelModal] = useState(false);

  const levels = getAllLevels();
  const currentLevel = levels.find(level => level.worldType === 'light-seeker') || levels[0];

  const handleOpenLevelSelection = () => {
    setShowLevelModal(true);
  };

  const handleCloseLevelSelection = () => {
    setShowLevelModal(false);
  };

  return (
    <div className="world-selection-tab">
      <div className="world-selection-header">
        <h3>{t('world.selection.title')}</h3>
        <p>{t('world.selection.subtitle')}</p>
      </div>

      <div className="current-level-info">
        <div className="current-level-card">
          <div className="level-icon">{currentLevel.icon}</div>
          <div className="level-details">
            <h4>{t(currentLevel.nameKey)}</h4>
            <p>{t(currentLevel.descriptionKey)}</p>
            <div className="level-meta">
              <span className="difficulty">{t(`world.selection.difficulty.${currentLevel.difficulty}`)}</span>
              <span className="time">{t('world.selection.estimatedTime').replace('{time}', currentLevel.estimatedTime.toString())}</span>
            </div>
          </div>
        </div>

        <button
          className="select-level-button"
          onClick={handleOpenLevelSelection}
        >
          {t('world.selection.title')}
        </button>
      </div>

      <LevelSelectionModal
        isOpen={showLevelModal}
        onClose={handleCloseLevelSelection}
      />
    </div>
  );
};

export default WorldSelectionTab;
