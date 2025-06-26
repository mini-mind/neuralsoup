import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import './HelpTooltipIcon.css';

interface HelpTooltipIconProps {
  tooltipText: string;
}

const HelpTooltipIcon: React.FC<HelpTooltipIconProps> = ({ tooltipText }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 8, // 在图标下方显示，并留出8px间隙
        left: rect.left + window.scrollX + rect.width / 2, // 水平居中对齐
      });
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const tooltipContent = (
    <div className="tooltip-portal" style={{ top: position.top, left: position.left }}>
      <div className="tooltip-arrow" />
      <div className="tooltip-content">
        {tooltipText}
      </div>
    </div>
  );

  return (
    <>
      <div 
        className="help-icon" 
        ref={iconRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        ?
      </div>
      {isVisible && ReactDOM.createPortal(tooltipContent, document.body)}
    </>
  );
};

export default HelpTooltipIcon; 