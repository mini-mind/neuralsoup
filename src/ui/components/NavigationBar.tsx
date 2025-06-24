import React from 'react';

/**
 * 顶部导航栏组件
 * 包含logo、左侧按钮（排行榜、官方示例）、右侧按钮（分享）和用户头像
 */
const NavigationBar: React.FC = () => {
  return (
    <div className="nav-bar">
      <div className="nav-left">
        <div className="nav-logo">NeuralSoup</div>
        <button className="nav-button" disabled title="功能开发中">
          排行榜
        </button>
        <button className="nav-button" disabled title="功能开发中">
          官方示例
        </button>
      </div>
      
      <div className="nav-right">
        <button className="nav-button" disabled title="功能开发中">
          分享
        </button>
        <div className="nav-avatar" title="用户功能开发中">
          <span>👤</span>
        </div>
      </div>
    </div>
  );
};

export default NavigationBar; 