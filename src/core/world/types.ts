import type { IAgent } from '../entities/types';

/**
 * 世界实体的基础接口
 */
export interface IWorldEntity {
  readonly id: string;
  x: number;
  y: number;
  entityType: string;
  isActive: boolean;

  /**
   * 更新实体状态
   */
  update(deltaTime: number): void;

  /**
   * 检查是否与另一个实体发生碰撞
   */
  checkCollision(other: IWorldEntity): boolean;
}

/**
 * 定义了"世界"的契约。
 * 世界是所有智能体和对象存在的环境。
 */
export interface IWorld {
  /**
   * 获取世界中的所有智能体。
   */
  getAgents(): IAgent[];

  /**
   * 获取世界中的所有实体（包括智能体和环境对象）
   */
  getEntities(): IWorldEntity[];

  /**
   * 向世界中添加一个智能体。
   * @param agent - 要添加的智能体。
   */
  addAgent(agent: IAgent): void;

  /**
   * 向世界中添加一个实体。
   * @param entity - 要添加的实体。
   */
  addEntity(entity: IWorldEntity): void;

  /**
   * 从世界中移除一个智能体。
   * @param agentId - 要移除的智能体的ID。
   */
  removeAgent(agentId: string): void;

  /**
   * 从世界中移除一个实体。
   * @param entityId - 要移除的实体的ID。
   */
  removeEntity(entityId: string): void;

  /**
   * 更新世界状态，推进一个时间步。
   */
  update(): void;

  /**
   * 获取世界类型
   */
  getWorldType(): string;

  /**
   * 获取世界尺寸
   */
  getDimensions(): { width: number; height: number };
}

/**
 * 定义了可碰撞实体的契约。
 * 任何需要在物理世界中参与碰撞检测的实体都应实现此接口。
 */
export interface ICollidable {
  readonly id: string;
  x: number;
  y: number;
  angle: number; // 实体的朝向，以弧度表示
  radius: number;
  entityType: string; // 用于区分实体类型，例如 'agent', 'food', 'obstacle'
}

// === 光影花园世界实体 ===

/**
 * 光斑实体 - 提供能量的移动光源
 */
export interface ILightPatch extends IWorldEntity {
  entityType: 'light-patch';
  intensity: number; // 光强度 (0-1)
  radius: number;
  energyRate: number; // 每秒提供的能量
  moveSpeed: number;
  targetX: number;
  targetY: number;
}

/**
 * 暗物质实体 - 消耗能量的区域
 */
export interface IDarkMatter extends IWorldEntity {
  entityType: 'dark-matter';
  radius: number;
  drainRate: number; // 每秒消耗的能量
  expansionRate: number; // 扩张速度
}

/**
 * 水晶碎片 - 高能量奖励
 */
export interface ICrystalShard extends IWorldEntity {
  entityType: 'crystal-shard';
  energyValue: number;
  radius: number;
  isConsumed: boolean;
  
  /**
   * 消耗水晶碎片并返回能量值
   */
  consume(): number;
}

// === 回声洞穴世界实体 ===

/**
 * 墙壁实体 - 反射声波
 */
export interface IWall extends IWorldEntity {
  entityType: 'wall';
  width: number;
  height: number;
  reflectivity: number; // 反射系数 (0-1)

  /**
   * 反射声波
   */
  reflectSound(sourceX: number, sourceY: number, intensity: number): any;
}

/**
 * 食物实体 - 隐藏在黑暗中的目标
 */
export interface IFood extends IWorldEntity {
  entityType: 'food';
  nutritionValue: number;
  radius: number;
  echoSignature: string; // 回声特征
  isConsumed: boolean;

  /**
   * 消耗食物并返回营养值
   */
  consume(): number;

  /**
   * 生成回声
   */
  generateEcho(sourceX: number, sourceY: number, intensity: number): any;
}

/**
 * 消音区域 - 吸收声波
 */
export interface IMufflingZone extends IWorldEntity {
  entityType: 'muffling-zone';
  radius: number;
  absorptionRate: number; // 声波吸收率 (0-1)

  /**
   * 吸收声波
   */
  absorbSound(sourceX: number, sourceY: number, intensity: number): number;
}

// === 意识集群世界实体 ===

/**
 * 资源点 - 群体觅食目标
 */
export interface IResourcePatch extends IWorldEntity {
  entityType: 'resource-patch';
  resourceAmount: number;
  maxResource: number;
  regenerationRate: number;
  radius: number;
  
  /**
   * 获取资源密度 (0-1)
   */
  getResourceDensity(): number;
  
  /**
   * 消耗资源
   */
  consumeResource(amount: number): number;
}

/**
 * 信标 - 群体通讯
 */
export interface ISignalBeacon extends IWorldEntity {
  entityType: 'signal-beacon';
  signalType: 'food' | 'danger' | 'neutral';
  intensity: number;
  range: number;
  duration: number;
  createdBy: string; // 创建者ID

  /**
   * 检查指定位置是否在信号范围内
   */
  isInRange(x: number, y: number): boolean;

  /**
   * 获取指定位置的信号强度
   */
  getSignalStrength(x: number, y: number): number;
}

/**
 * 威胁实体 - 移动的捕食者
 */
export interface IThreat extends IWorldEntity {
  entityType: 'threat';
  moveSpeed: number;
  detectionRange: number;
  damage: number;
  radius: number;
  targetX: number;
  targetY: number;

  /**
   * 检测目标
   */
  canDetect(x: number, y: number): boolean;

  /**
   * 设置狩猎目标
   */
  setHuntingTarget(agentId: string, x: number, y: number): void;

  /**
   * 攻击目标
   */
  attack(agentId: string): number;
}

// === 律动色域世界实体 ===

/**
 * 色彩池 - 提供不同颜色
 */
export interface IColorPool extends IWorldEntity {
  entityType: 'color-pool';
  color: string; // 十六进制颜色值
  radius: number;
  intensity: number;
}

/**
 * 节奏源 - 发出周期性脉冲
 */
export interface IRhythmNode extends IWorldEntity {
  entityType: 'rhythm-node';
  frequency: number; // 节拍频率 (BPM)
  amplitude: number; // 脉冲强度
  phase: number; // 当前相位
  range: number; // 影响范围

  /**
   * 检查指定位置是否在节拍影响范围内
   */
  isInRange(x: number, y: number): boolean;

  /**
   * 获取指定位置的节拍强度
   */
  getBeatStrength(x: number, y: number): number;
}

/**
 * 画布痕迹 - 智能体留下的艺术痕迹
 */
export interface ICanvasTrace extends IWorldEntity {
  entityType: 'canvas-trace';
  color: string;
  opacity: number;
  width: number;
  fadeRate: number; // 淡化速度
  points: Array<{ x: number; y: number; timestamp: number }>;

  /**
   * 获取路径的总长度
   */
  getPathLength(): number;

  /**
   * 获取路径的复杂度（转向次数）
   */
  getPathComplexity(): number;
}

// === 追光者世界实体 ===

/**
 * 光球实体 - 大型移动光源
 */
export interface ILightOrb extends IWorldEntity {
  entityType: 'light-orb';
  radius: number;
  intensity: number; // 光强度 (0-1)
  influenceRadius: number; // 影响范围

  /**
   * 获取在指定位置的光强度
   */
  getLightIntensityAt(x: number, y: number): number;

  /**
   * 检查指定位置是否在光球的影响范围内
   */
  isInInfluenceRange(x: number, y: number): boolean;

  /**
   * 获取光球的当前状态信息
   */
  getState(): any;
}