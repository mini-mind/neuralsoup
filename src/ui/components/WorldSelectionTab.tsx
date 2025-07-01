import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { globalState } from '../../core/services/GlobalState';
import { globalEventBus } from '../../core/services/EventBus';
import './WorldSelectionModal.css';

export type WorldType = 'luminous-garden' | 'echo-chamber' | 'sentient-swarm' | 'chromatic-composer' | 'light-seeker';

interface WorldOption {
  id: WorldType;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  color: string;
  features: string[];
}

const worldOptions: WorldOption[] = [
  {
    id: 'light-seeker',
    nameKey: 'world.light-seeker.name',
    descriptionKey: 'world.light-seeker.description',
    icon: '🔦',
    color: '#ffd700',
    features: [
      'world.light-seeker.feature1',
      'world.light-seeker.feature2',
      'world.light-seeker.feature3'
    ]
  },
  {
    id: 'luminous-garden',
    nameKey: 'world.luminous-garden.name',
    descriptionKey: 'world.luminous-garden.description',
    icon: '🌸',
    color: '#ff69b4',
    features: [
      'world.luminous-garden.feature1',
      'world.luminous-garden.feature2',
      'world.luminous-garden.feature3'
    ]
  },
  {
    id: 'echo-chamber',
    nameKey: 'world.echo-chamber.name',
    descriptionKey: 'world.echo-chamber.description',
    icon: '🔊',
    color: '#4169e1',
    features: [
      'world.echo-chamber.feature1',
      'world.echo-chamber.feature2',
      'world.echo-chamber.feature3'
    ]
  },
  {
    id: 'sentient-swarm',
    nameKey: 'world.sentient-swarm.name',
    descriptionKey: 'world.sentient-swarm.description',
    icon: '🐝',
    color: '#32cd32',
    features: [
      'world.sentient-swarm.feature1',
      'world.sentient-swarm.feature2',
      'world.sentient-swarm.feature3'
    ]
  },
  {
    id: 'chromatic-composer',
    nameKey: 'world.chromatic-composer.name',
    descriptionKey: 'world.chromatic-composer.description',
    icon: '🎨',
    color: '#ff4500',
    features: [
      'world.chromatic-composer.feature1',
      'world.chromatic-composer.feature2',
      'world.chromatic-composer.feature3'
    ]
  }
];

/**
 * 世界选择标签页组件
 * 允许用户在不同的世界环境之间选择
 */
const WorldSelectionTab: React.FC = () => {
  const { t } = useLanguage();

  const handleWorldSelect = (worldType: WorldType) => {
    // 更新全局状态中的选中世界
    globalState.setState({ selectedWorld: worldType });
    
    // 发出事件通知其他组件
    globalEventBus.emit('world:changed', { worldType });
    
    console.log(`Selected world: ${worldType}`);
  };

  return (
    <div className="world-selection-tab">
      <div className="world-selection-header">
        <h3>{t('modal.world-selection-title')}</h3>
        <p className="world-selection-description">{t('modal.world-selection-description')}</p>
      </div>
      
      <div className="world-grid">
        {worldOptions.map((world) => (
          <div
            key={world.id}
            className="world-card"
            onClick={() => handleWorldSelect(world.id)}
            style={{ '--world-color': world.color } as React.CSSProperties}
          >
            <div className="world-card-header">
              <div className="world-icon">{world.icon}</div>
              <h4 className="world-name">{t(world.nameKey)}</h4>
            </div>
            
            <div className="world-description">
              <p>{t(world.descriptionKey)}</p>
            </div>
            
            <div className="world-features">
              {world.features.map((featureKey, index) => (
                <div key={index} className="world-feature">
                  <span className="feature-bullet">•</span>
                  <span>{t(featureKey)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorldSelectionTab;
