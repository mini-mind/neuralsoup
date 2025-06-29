import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { globalState } from '../../core/services/GlobalState';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Share Modal Component
 * Allows users to share their current configuration and SNN topology
 */
const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleCopyLink = () => {
    // TODO: Implement actual link generation and copying
    const currentState = globalState.getState();
    const configData = {
      snnTopology: currentState.snnTopology,
      networkTopology: currentState.networkTopology,
      timestamp: Date.now()
    };
    
    // For now, just copy a placeholder URL
    const shareUrl = `${window.location.origin}?config=${btoa(JSON.stringify(configData))}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      console.log('Share link copied to clipboard');
      // TODO: Show success notification
    }).catch(err => {
      console.error('Failed to copy link:', err);
      // TODO: Show error notification
    });
  };

  const handleDownloadConfig = () => {
    // TODO: Implement configuration download
    const currentState = globalState.getState();
    const configData = {
      snnTopology: currentState.snnTopology,
      networkTopology: currentState.networkTopology,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const dataStr = JSON.stringify(configData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `neuralsoup-config-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('modal.share-title')}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p>{t('modal.share-description')}</p>
          
          <div className="share-actions">
            <button 
              className="btn btn-primary" 
              onClick={handleCopyLink}
              title="Copy shareable link to clipboard"
            >
              📋 {t('modal.share-copy-link')}
            </button>
            
            <button 
              className="btn btn-secondary" 
              onClick={handleDownloadConfig}
              title="Download configuration as JSON file"
            >
              💾 {t('modal.share-download')}
            </button>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose}>
            {t('modal.share-close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
