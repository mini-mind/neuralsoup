import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { globalState } from '../../core/services/GlobalState';
import { globalEventBus } from '../../core/services/EventBus';
import './WorldSelectionModal.css';

interface WorldSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type WorldType = 'luminous-garden' | 'echo-chamber' | 'sentient-swarm' | 'chromatic-composer';

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
    id: 'luminous-garden',
    nameKey: 'world.luminous-garden.name',
    descriptionKey: 'world.luminous-garden.description',
    icon: '🌟',
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    features: ['world.luminous-garden.feature1', 'world.luminous-garden.feature2', 'world.luminous-garden.feature3']
  },
  {
    id: 'echo-chamber',
    nameKey: 'world.echo-chamber.name',
    descriptionKey: 'world.echo-chamber.description',
    icon: '🔊',
    color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    features: ['world.echo-chamber.feature1', 'world.echo-chamber.feature2', 'world.echo-chamber.feature3']
  },
  {
    id: 'sentient-swarm',
    nameKey: 'world.sentient-swarm.name',
    descriptionKey: 'world.sentient-swarm.description',
    icon: '🐝',
    color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    features: ['world.sentient-swarm.feature1', 'world.sentient-swarm.feature2', 'world.sentient-swarm.feature3']
  },
  {
    id: 'chromatic-composer',
    nameKey: 'world.chromatic-composer.name',
    descriptionKey: 'world.chromatic-composer.description',
    icon: '🎨',
    color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    features: ['world.chromatic-composer.feature1', 'world.chromatic-composer.feature2', 'world.chromatic-composer.feature3']
  }
];

/**
 * World Selection Modal Component
 * Allows users to choose between different world environments
 */
const WorldSelectionModal: React.FC<WorldSelectionModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleWorldSelect = (worldType: WorldType) => {
    // Update global state with selected world
    globalState.setState({ selectedWorld: worldType });
    
    // Emit event to notify other components
    globalEventBus.emit('world:changed', { worldType });
    
    // Close modal
    onClose();
    
    console.log(`Selected world: ${worldType}`);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content world-selection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('modal.world-selection-title')}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p className="world-selection-description">{t('modal.world-selection-description')}</p>
          
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
                
                <div className="world-card-footer">
                  <button className="btn btn-primary world-select-btn">
                    {t('modal.world-select')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose}>
            {t('modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorldSelectionModal;
