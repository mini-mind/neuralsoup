/**
 * 仿真系统类型定义
 */

export interface Position {
  x: number;
  y: number;
}

export interface NeuralState {
  motivation: number;   // 动机 [0-1] 
  stress: number;       // 压力 [0-1]
  homeostasis: number;  // 稳态 [0-1]
}

// IZ神经元参数
export interface IZNeuronParams {
  a: number;  // 恢复参数 (0.02)
  b: number;  // 敏感度参数 (0.2)
  c: number;  // 重置后的膜电位 (-65)
  d: number;  // 重置后的恢复变量 (8)
  threshold: number; // 发放阈值 (30)
}

// IZ神经元状态
export interface IZNeuronState {
  v: number;  // 膜电位
  u: number;  // 恢复变量
  spike: boolean; // 是否发放脉冲
  lastSpikeTime: number; // 最后发放时间
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
  visionCells: VisionCell[]; // 运行时由 VisionSystem 配置决定数量，默认 36 格
  
  // 神经状态
  motivation: number; // 动机 [0, 1]
  stress: number;     // 压力 [0, 1] 
  homeostasis: number; // 稳态 [0, 1]
  
  // 统计数据
  totalReward: number;
  collisionCount: number;
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
}

export interface World {
  width: number;
  height: number;
  mainAgentId: number;
  agents: Agent[];
  foods: Food[];
  obstacles: Obstacle[];
  visionRange: number; // 添加视野范围
  visionAngle: number; // 添加视野角度
}

export interface SimulationStats {
  totalRewards: number;
  totalCollisions: number;
  averageNeuralState: NeuralState;
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
    neuralState: {
      motivation: number;
      stress: number;
      homeostasis: number;
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
