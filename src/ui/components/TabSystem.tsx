import React, { useState } from 'react';
import ScriptEditArea from './ScriptEditArea';
import SNNTopologyEditor from '../views/SNNTopologyEditor';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabSystemProps {
  activeTab: string;
  onTabChange?: (tabId: string) => void;
}

/**
 * 标签页系统组件
 * 管理和显示不同的内容标签页
 */
const TabSystem: React.FC<TabSystemProps> = ({
  activeTab,
  onTabChange,
}) => {
  // 临时的脚本代码用于演示
  const dummyScript = `// 工具库
// 移动相关工具
function moveForward(speed = 1.0) {
  return [speed, 0, 0, 0];
}

function turnLeft(speed = 0.5) {
  return [0, -speed, 0, 0];
}

function turnRight(speed = 0.5) {
  return [0, speed, 0, 0];
}

// 感知相关工具
function getVisionData(agent) {
  // 获取视觉感知数据
  return agent.vision || [];
}

function detectFood(visionData) {
  // 检测食物
  return visionData.filter(item => item.type === 'food');
}

function detectObstacles(visionData) {
  // 检测障碍物
  return visionData.filter(item => item.type === 'obstacle');
}

// 主要逻辑
function onFrame(agent) {
  const vision = getVisionData(agent);
  const food = detectFood(vision);
  const obstacles = detectObstacles(vision);
  
  if (food.length > 0) {
    // 朝食物方向移动
    const target = food[0];
    if (target.angle > 0.1) {
      agent.move(turnRight());
    } else if (target.angle < -0.1) {
      agent.move(turnLeft());
    } else {
      agent.move(moveForward());
    }
  } else {
    // 随机移动
    agent.move([0.3, Math.random() * 0.4 - 0.2, 0, 0]);
  }
}`;

  const tabs: Tab[] = [
    {
      id: 'script',
      label: '脚本',
      content: (
        <ScriptEditArea
          currentScriptName="default"
          savedScripts={{ default: dummyScript }}
          onFrameCode={dummyScript}
          isScriptApplied={true}
          onScriptChange={() => {}}
          onCodeChange={() => {}}
          onScriptApply={() => {}}
        />
      ),
    },
    {
      id: 'snn',
      label: 'SNN模型',
      content: <SNNTopologyEditor width={600} height={400} />,
    },
    {
      id: 'sensors',
      label: '感受器',
      content: (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
          感受器配置功能开发中...
        </div>
      ),
    },
    {
      id: 'effectors',
      label: '效应器',
      content: (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
          效应器配置功能开发中...
        </div>
      ),
    },
    {
      id: 'freemode',
      label: '自由模式',
      content: (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
          自由模式配置功能开发中...
        </div>
      ),
    },
    {
      id: 'ranked',
      label: '排位',
      content: (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
          排位模式配置功能开发中...
        </div>
      ),
    },
  ];

  // 找到当前活动的标签
  const currentTab = tabs.find(tab => tab.id === activeTab) || tabs[0];

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        {tabs
          .filter(tab => tab.id === activeTab) // 只显示当前活动的标签
          .map(tab => (
            <div
              key={tab.id}
              className={`tab-item ${tab.id === activeTab ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.label}
            </div>
          ))}
      </div>
      
      <div className="tab-content">
        {currentTab?.content}
      </div>
    </div>
  );
};

export default TabSystem; 