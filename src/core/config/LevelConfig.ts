/**
 * 关卡配置系统
 * 定义游戏的关卡结构和世界配置
 */

export interface LevelConfig {
  id: string;
  level: number;
  nameKey: string;
  descriptionKey: string;
  worldType: string;
  icon: string;
  color: string;
  features: string[];
  unlockConditions?: {
    previousLevel?: number;
    // 可以添加其他解锁条件
  };
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // 预计完成时间（分钟）
}

/**
 * 游戏关卡配置
 * 只包含"追光者"和"光影花园"两个关卡
 */
export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: 'light-seeker',
    level: 1,
    nameKey: 'level.light-seeker.name',
    descriptionKey: 'level.light-seeker.description',
    worldType: 'light-seeker',
    icon: '💡',
    color: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)',
    features: [
      'level.light-seeker.feature1',
      'level.light-seeker.feature2', 
      'level.light-seeker.feature3'
    ],
    difficulty: 'easy',
    estimatedTime: 10
  },
  {
    id: 'luminous-garden',
    level: 2,
    nameKey: 'level.luminous-garden.name',
    descriptionKey: 'level.luminous-garden.description',
    worldType: 'luminous-garden',
    icon: '🌟',
    color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    features: [
      'level.luminous-garden.feature1',
      'level.luminous-garden.feature2',
      'level.luminous-garden.feature3'
    ],
    unlockConditions: {
      previousLevel: 1
    },
    difficulty: 'medium',
    estimatedTime: 15
  }
];

/**
 * 获取所有关卡配置
 */
export function getAllLevels(): LevelConfig[] {
  return LEVEL_CONFIGS;
}

/**
 * 根据关卡ID获取配置
 */
export function getLevelById(levelId: string): LevelConfig | undefined {
  return LEVEL_CONFIGS.find(level => level.id === levelId);
}

/**
 * 根据关卡编号获取配置
 */
export function getLevelByNumber(levelNumber: number): LevelConfig | undefined {
  return LEVEL_CONFIGS.find(level => level.level === levelNumber);
}

/**
 * 获取下一个关卡
 */
export function getNextLevel(currentLevelId: string): LevelConfig | undefined {
  const currentLevel = getLevelById(currentLevelId);
  if (!currentLevel) return undefined;
  
  return getLevelByNumber(currentLevel.level + 1);
}

/**
 * 检查关卡是否已解锁
 */
export function isLevelUnlocked(levelId: string, completedLevels: string[]): boolean {
  const level = getLevelById(levelId);
  if (!level) return false;
  
  // 第一关总是解锁的
  if (level.level === 1) return true;
  
  // 检查前置关卡是否完成
  if (level.unlockConditions?.previousLevel) {
    const previousLevel = getLevelByNumber(level.unlockConditions.previousLevel);
    if (previousLevel && !completedLevels.includes(previousLevel.id)) {
      return false;
    }
  }
  
  return true;
}

/**
 * 获取关卡进度信息
 */
export function getLevelProgress(completedLevels: string[]): {
  totalLevels: number;
  completedCount: number;
  currentLevel: LevelConfig | undefined;
  nextLevel: LevelConfig | undefined;
} {
  const totalLevels = LEVEL_CONFIGS.length;
  const completedCount = completedLevels.length;
  
  // 找到当前应该进行的关卡（第一个未完成的关卡）
  const currentLevel = LEVEL_CONFIGS.find(level => 
    !completedLevels.includes(level.id) && isLevelUnlocked(level.id, completedLevels)
  );
  
  // 找到下一个关卡
  const nextLevel = currentLevel ? getNextLevel(currentLevel.id) : undefined;
  
  return {
    totalLevels,
    completedCount,
    currentLevel,
    nextLevel
  };
}
