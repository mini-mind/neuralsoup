import React, { useState } from 'react';

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
 * 包含可折叠的导航分组和菜单项
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

  const sidebarGroups: SidebarGroup[] = [
    {
      id: 'world',
      label: 'World',
      icon: '🌍',
      items: [
        { id: 'freemode', label: '自由模式' },
        { id: 'ranked', label: '排位' },
      ],
    },
    {
      id: 'agent',
      label: 'Agent',
      icon: '🤖',
      items: [
        { id: 'sensors', label: '感受器' },
        { id: 'effectors', label: '效应器' },
      ],
    },
    {
      id: 'brain',
      label: 'Brain',
      icon: '🧠',
      items: [
        { id: 'script', label: '脚本' },
        { id: 'snn', label: 'SNN模型' },
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
        <button
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
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
    </div>
  );
};

export default Sidebar; 