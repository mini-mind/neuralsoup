import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { globalState } from '../../core/services/GlobalState';
import { globalEventBus } from '../../core/services/EventBus';
import { 
  getAllLevels, 
  getLevelProgress, 
  isLevelUnlocked, 
  type LevelConfig 
} from '../../core/config/LevelConfig';
import './LevelSelectionModal.css';

interface LevelSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 关卡选择模态框组件
 * 允许用户在不同的关卡之间选择
 */
const LevelSelectionModal: React.FC<LevelSelectionModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [completedLevels, setCompletedLevels] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  useEffect(() => {
    // 从本地存储或全局状态获取已完成的关卡
    const saved = localStorage.getItem('neuralsoup-completed-levels');
    if (saved) {
      setCompletedLevels(JSON.parse(saved));
    }

    // 获取当前选中的世界
    const currentWorld = globalState.getState().selectedWorld;
    if (currentWorld) {
      setSelectedLevel(currentWorld);
    }
  }, []);

  if (!isOpen) return null;

  const levels = getAllLevels();
  const progress = getLevelProgress(completedLevels);

  const handleLevelSelect = (level: LevelConfig) => {
    if (!isLevelUnlocked(level.id, completedLevels)) {
      return; // 关卡未解锁，不能选择
    }

    // 更新全局状态中的选中世界
    globalState.setState({ selectedWorld: level.worldType });
    
    // 发出事件通知其他组件
    globalEventBus.emit('world:changed', { worldType: level.worldType });
    
    // 关闭模态框
    onClose();
    
    console.log(`Selected level: ${level.id} (world: ${level.worldType})`);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'hard': return '#F44336';
      default: return '#757575';
    }
  };

  const getLevelStatus = (level: LevelConfig) => {
    if (completedLevels.includes(level.id)) {
      return 'completed';
    }
    if (!isLevelUnlocked(level.id, completedLevels)) {
      return 'locked';
    }
    if (level.id === progress.currentLevel?.id) {
      return 'current';
    }
    return 'available';
  };

  return (
    <div className="level-selection-overlay" onClick={handleOverlayClick}>
      <div className="level-selection-modal">
        <div className="level-selection-header">
          <h2>{t('world.selection.title')}</h2>
          <p>{t('world.selection.subtitle')}</p>
          <div className="progress-info">
            {t('world.selection.progress')
              .replace('{completed}', progress.completedCount.toString())
              .replace('{total}', progress.totalLevels.toString())}
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="level-grid">
          {levels.map((level) => {
            const status = getLevelStatus(level);
            const isLocked = status === 'locked';
            const isCompleted = status === 'completed';
            const isCurrent = status === 'current';
            
            return (
              <div
                key={level.id}
                className={`level-card ${status} ${isLocked ? 'disabled' : ''}`}
                onClick={() => !isLocked && handleLevelSelect(level)}
                style={{ 
                  '--level-color': level.color,
                  cursor: isLocked ? 'not-allowed' : 'pointer'
                } as React.CSSProperties}
              >
                <div className="level-card-header">
                  <div className="level-icon">
                    {isLocked ? '🔒' : level.icon}
                  </div>
                  <div className="level-info">
                    <h4 className="level-name">{t(level.nameKey)}</h4>
                    <div className="level-meta">
                      <span 
                        className="difficulty-badge"
                        style={{ backgroundColor: getDifficultyColor(level.difficulty) }}
                      >
                        {t(`world.selection.difficulty.${level.difficulty}`)}
                      </span>
                      <span className="estimated-time">
                        {t('world.selection.estimatedTime')
                          .replace('{time}', level.estimatedTime.toString())}
                      </span>
                    </div>
                  </div>
                  <div className="level-status">
                    {isCompleted && <span className="status-badge completed">✓</span>}
                    {isCurrent && <span className="status-badge current">▶</span>}
                    {isLocked && <span className="status-badge locked">{t('world.selection.locked')}</span>}
                  </div>
                </div>
                
                <div className="level-description">
                  <p>{isLocked ? t('world.selection.locked') : t(level.descriptionKey)}</p>
                </div>
                
                {!isLocked && (
                  <div className="level-features">
                    {level.features.map((featureKey, index) => (
                      <div key={index} className="level-feature">
                        <span className="feature-bullet">•</span>
                        <span>{t(featureKey)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LevelSelectionModal;
