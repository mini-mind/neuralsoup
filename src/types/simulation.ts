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

// SNN网络中的节点
export interface SNNNode {
  id: string;
  x: number;
  y: number;
  type: 'input' | 'neuron' | 'output';
  label: string;
  params?: IZNeuronParams; // 神经元参数（仅神经元类型有）
  state?: IZNeuronState;   // 神经元状态（仅神经元类型有）
  inputVoltage?: number;   // 输入电压（输入类型专用）
  outputSignal?: number;   // 输出信号强度（输出类型专用）
}

// 突触连接
export interface SNNSynapse {
  id: string;
  from: string; // 源节点ID
  to: string;   // 目标节点ID
  weight: number; // 连接权重
  delay: number;  // 传导延迟 (ms)
}

// 感受器模态类型
export type ModalityType = 'vision' | 'audio' | 'touch';

// 感受器（输入连接点组）
export interface Receptor {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  modalities: ReceptorModality[];
  activeModality: ModalityType; // 当前激活的模态
}

// 感受器模态
export interface ReceptorModality {
  type: ModalityType;
  label: string;
  inputs: ReceptorInput[];
  isExpanded: boolean; // 是否展开显示
}

// 感受器中的单个输入点
export interface ReceptorInput {
  id: string;
  x: number; // 相对于感受器的位置
  y: number;
  label: string;
  voltage: number; // 施加的电压
  colorType?: 'R' | 'G' | 'B'; // RGB颜色类型，用于视觉输入
}

// 效应器（输出连接点组）
export interface Effector {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  outputs: EffectorOutput[];
}

// 效应器中的单个输出点
export interface EffectorOutput {
  id: string;
  x: number; // 相对于效应器的位置
  y: number;
  label: string;
  signal: number; // 接收到的脉冲信号强度
  pulseAccumulation: number; // 脉冲累积值
  decayRate: number; // 衰减速率
  lastUpdateTime: number; // 最后更新时间
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