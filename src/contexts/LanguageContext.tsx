import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'zh' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  zh: {
    // 标签页
    'tab.script': '脚本编辑',
    'tab.agent-params': '智能体参数',
    'tab.settings': '设置',
    
    // 按钮
    'btn.start': '开始',
    'btn.pause': '暂停',
    'btn.resume': '继续',
    'btn.apply-script': '✓ 应用脚本',
    'btn.manual-control': '🎮',
    
    // 设置页面
    'settings.title': '设置',
    'settings.language': '语言',
    'settings.language.chinese': '中文',
    'settings.language.english': 'English',
    
    // 状态
    'stats.fps': 'FPS',
    'stats.reward': '奖励',
    
    // 提示
    'tooltip.start': '开始',
    'tooltip.pause': '暂停',
    'tooltip.resume': '继续',
    'tooltip.manual-control-off': '启用手动控制 (WASD/方向键: W↑前进 S↓后退 A←左转 D→右转)',
    'tooltip.manual-control-on': '关闭手动控制',
    'tooltip.apply-script': '应用脚本',
    
    // 占位符
    'placeholder.code-editor': '编写onFrame函数代码...',
    
    // 移动端
    'mobile.collapse': '收起',
  },
  en: {
    // 标签页
    'tab.script': 'Script Editor',
    'tab.agent-params': 'Agent Parameters',
    'tab.settings': 'Settings',
    
    // 按钮
    'btn.start': 'Start',
    'btn.pause': 'Pause',
    'btn.resume': 'Resume',
    'btn.apply-script': '✓ Apply Script',
    'btn.manual-control': '🎮',
    
    // 设置页面
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.language.chinese': '中文',
    'settings.language.english': 'English',
    
    // 状态
    'stats.fps': 'FPS',
    'stats.reward': 'Reward',
    
    // 提示
    'tooltip.start': 'Start',
    'tooltip.pause': 'Pause',
    'tooltip.resume': 'Resume',
    'tooltip.manual-control-off': 'Enable manual control (WASD/Arrow keys: W↑Forward S↓Backward A←Turn Left D→Turn Right)',
    'tooltip.manual-control-on': 'Disable manual control',
    'tooltip.apply-script': 'Apply script',
    
    // 占位符
    'placeholder.code-editor': 'Write onFrame function code...',
    
    // 移动端
    'mobile.collapse': 'Collapse',
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  const t = (key: string): string => {
    return (translations[language] as Record<string, string>)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}; 