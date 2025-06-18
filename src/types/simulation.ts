/**
 * 仿真系统类型定义
 */

export interface Position {
  x: number;
  y: number;
}

export interface EmotionState {
  pleasure: number;   // 愉悦度 [0-1]
  arousal: number;    // 唤醒度 [0-1]
}

export interface Agent {
  id: number;
  x: number;
  y: number;
  angle: number; // 朝向角度（弧度）
  velocity: { x: number; y: number };
  health: number;
  energy: number;
  
  // 视觉系统
  visionCells: VisionCell[]; // 8个视野格子
  visualInput: number[]; // 24维视觉输入(8格子 × 3颜色)
  
  // 控制类型
  controlType: 'snn' | 'random' | 'keyboard' | 'script'; // SNN控制、随机游走、键盘控制或脚本控制
  
  // 情绪状态
  pleasure: number; // 愉悦度 [-1, 1]
  arousal: number;  // 唤醒度 [0, 1]
  
  // 统计数据
  totalReward: number;
  collisionCount: number;
  
  // 渲染对象
  sprite?: any;
  visionSprites?: any[]; // 视野格子的渲染对象
}

export interface Food {
  id: number;
  x: number;
  y: number;
  radius: number;
  nutritionValue: number;
}

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  radius: number;
  isMoving: boolean;
  velocity?: { x: number; y: number };
}

export interface World {
  width: number;
  height: number;
  wallThickness: number;
  agents: Agent[];
  foods: Food[];
  obstacles: Obstacle[];
  visionRange: number; // 添加视野范围
  visionAngle: number; // 添加视野角度
}

export interface SimulationStats {
  totalRewards: number;
  totalCollisions: number;
  averageEmotionState: EmotionState;
}

export interface SimulationState {
  agents: Agent[];
  foods: Food[];
  obstacles: Obstacle[];
  worldBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  stats: {
    fps: number;
    totalReward: number;
    collisionCount: number;
    emotionState: {
      pleasure: number;
      arousal: number;
    };
  };
}

export interface SensorInput {
  direction: number;  // 方向（弧度）
  channels: {
    r: number;  // 红色通道 [0-1]
    g: number;  // 绿色通道 [0-1]  
    b: number;  // 蓝色通道 [0-1]
  };
}

export interface ActionOutput {
  turnLeft: number;   // 左转强度 [0-1]
  turnRight: number;  // 右转强度 [0-1]
  moveForward: number; // 前进强度 [0-1]
}

// 视野格子
export interface VisionCell {
  angle: number; // 相对于智能体朝向的角度
  x: number; // 世界坐标系中的渲染位置
  y: number; // 世界坐标系中的渲染位置
  color: { r: number; g: number; b: number };
  closestDistance?: number; // 新增：记录该视野格子检测到的最近元素的距离
} 