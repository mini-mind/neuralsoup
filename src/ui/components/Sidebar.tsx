import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface SidebarItem {
  id: string;
  label: string;
  icon?: string;
}

interface SidebarGroup {
  id: string;
  label: string;
  icon: string;
  items: SidebarItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeItem: string;
  onItemSelect: (itemId: string, groupId: string) => void;
}

/**
 * 侧边栏导航组件
 * 包含可折叠的导航分组和菜单项，顶部有品牌标识，底部有操作按钮
 */
const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  activeItem,
  onItemSelect,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['brain']) // 默认展开brain分组
  );
  const { language, setLanguage, t } = useLanguage();

  const sidebarGroups: SidebarGroup[] = [
    {
      id: 'world',
      label: t('sidebar.world'),
      icon: '🌍',
      items: [
        { id: 'freemode', label: t('sidebar.freemode') },
        { id: 'ranked', label: t('sidebar.ranked') },
      ],
    },
    {
      id: 'agent',
      label: t('sidebar.agent'),
      icon: '🤖',
      items: [
        { id: 'sensors', label: t('sidebar.sensors') },
        { id: 'effectors', label: t('sidebar.effectors') },
      ],
    },
    {
      id: 'brain',
      label: t('sidebar.brain'),
      icon: '🧠',
      items: [
        { id: 'script', label: t('sidebar.script') },
        { id: 'snn', label: t('sidebar.snn') },
      ],
    },
  ];

  const toggleGroup = (groupId: string) => {
    if (collapsed) return;
    
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleItemClick = (itemId: string, groupId: string) => {
    onItemSelect(itemId, groupId);
  };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-logo">NeuralSoup</div>
        )}
        <button
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>
      
      <div className="sidebar-content">
        {sidebarGroups.map((group) => (
          <div key={group.id} className="sidebar-group">
            <div
              className={`sidebar-group-header ${
                expandedGroups.has(group.id) ? 'active' : ''
              }`}
              onClick={() => toggleGroup(group.id)}
            >
              <span className="sidebar-group-icon">{group.icon}</span>
              <span>{group.label}</span>
              <span
                className={`sidebar-group-arrow ${
                  expandedGroups.has(group.id) ? 'expanded' : ''
                }`}
              >
                ▶
              </span>
            </div>
            
            <div
              className={`sidebar-group-items ${
                expandedGroups.has(group.id) ? 'expanded' : ''
              }`}
            >
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={`sidebar-item ${
                    activeItem === item.id ? 'active' : ''
                  }`}
                  onClick={() => handleItemClick(item.id, group.id)}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-buttons">
            <button 
              className="sidebar-nav-button language-toggle" 
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              title={language === 'zh' ? t('sidebar.lang-switch-en') : t('sidebar.lang-switch-zh')}
            >
              {language === 'zh' ? '🌐 EN' : '🌐 中文'}
            </button>
            <button className="sidebar-nav-button" disabled title={t('sidebar.feature-dev')}>
              {t('sidebar.leaderboard')}
            </button>
            <button className="sidebar-nav-button" disabled title={t('sidebar.feature-dev')}>
              {t('sidebar.share')}
            </button>
          </div>
        )}
        <div className="sidebar-avatar" title={t('sidebar.user')}>
          <span>👤</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 