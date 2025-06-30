/**
 * 回声洞穴世界实现
 * 完全黑暗的迷宫世界，智能体必须通过声纳回声定位来探索和觅食
 */

import { BaseWorld } from '../BaseWorld';
import { Wall, Food, MufflingZone, SoundWave } from './EchoChamberEntities';
import type { IAgent } from '../../entities/types';
import type { IWall, IFood, IMufflingZone } from '../types';

export class EchoChamberWorld extends BaseWorld {
  private walls: Map<string, IWall> = new Map();
  private foods: Map<string, IFood> = new Map();
  private mufflingZones: Map<string, IMufflingZone> = new Map();
  private soundWaves: Map<string, SoundWave> = new Map();
  
  private lastFoodSpawn: number = 0;
  private foodSpawnInterval: number = 15000; // 15秒生成一个食物
  private maxFoods: number = 8;
  
  private agentSonarCooldowns: Map<string, number> = new Map();
  private sonarCooldownTime: number = 500; // 声纳冷却时间500ms

  constructor(width: number, height: number) {
    super(width, height, 'echo-chamber');
    this.initializeWorld();
  }

  initializeWorld(): void {
    // 创建迷宫墙壁
    this.createMazeWalls();
    
    // 创建消音区域
    this.createMufflingZones();
    
    // 创建初始食物
    this.createInitialFoods();
  }

  private createMazeWalls(): void {
    const { width, height } = this.getDimensions();
    
    // 外围墙壁
    this.createWall(0, 0, width, 20); // 顶部
    this.createWall(0, height - 20, width, 20); // 底部
    this.createWall(0, 0, 20, height); // 左侧
    this.createWall(width - 20, 0, 20, height); // 右侧
    
    // 内部迷宫墙壁
    this.createWall(width * 0.2, height * 0.2, 20, height * 0.3);
    this.createWall(width * 0.4, height * 0.1, 20, height * 0.4);
    this.createWall(width * 0.6, height * 0.3, 20, height * 0.4);
    this.createWall(width * 0.8, height * 0.1, 20, height * 0.5);
    
    // 水平墙壁
    this.createWall(width * 0.1, height * 0.5, width * 0.3, 20);
    this.createWall(width * 0.5, height * 0.7, width * 0.4, 20);
    this.createWall(width * 0.2, height * 0.8, width * 0.3, 20);
  }

  private createWall(x: number, y: number, width: number, height: number): void {
    const wall = new Wall(
      this.generateId(),
      x,
      y,
      width,
      height,
      0.7 + Math.random() * 0.2 // 反射率 0.7-0.9
    );
    
    this.walls.set(wall.id, wall);
    this.addEntity(wall);
  }

  private createMufflingZones(): void {
    const numZones = 2 + Math.floor(Math.random() * 2); // 2-3个消音区域
    
    for (let i = 0; i < numZones; i++) {
      const position = this.getRandomPosition();
      const mufflingZone = new MufflingZone(
        this.generateId(),
        position.x,
        position.y,
        30 + Math.random() * 20, // 半径 30-50
        0.6 + Math.random() * 0.3 // 吸收率 0.6-0.9
      );
      
      this.mufflingZones.set(mufflingZone.id, mufflingZone);
      this.addEntity(mufflingZone);
    }
  }

  private createInitialFoods(): void {
    const numFoods = 4 + Math.floor(Math.random() * 3); // 4-6个初始食物
    
    for (let i = 0; i < numFoods; i++) {
      this.spawnFood();
    }
  }

  private spawnFood(): void {
    if (this.foods.size >= this.maxFoods) {
      return;
    }
    
    let position;
    let attempts = 0;
    
    // 尝试找到不与墙壁重叠的位置
    do {
      position = this.getRandomPosition();
      attempts++;
    } while (this.isPositionBlocked(position.x, position.y) && attempts < 20);
    
    if (attempts >= 20) return; // 找不到合适位置
    
    const food = new Food(
      this.generateId(),
      position.x,
      position.y,
      25 + Math.random() * 15, // 营养值 25-40
      10 + Math.random() * 6,  // 半径 10-16
      'food'
    );
    
    this.foods.set(food.id, food);
    this.addEntity(food);
  }

  private isPositionBlocked(x: number, y: number): boolean {
    for (const wall of this.walls.values()) {
      if (x >= wall.x && x <= wall.x + wall.width &&
          y >= wall.y && y <= wall.y + wall.height) {
        return true;
      }
    }
    return false;
  }

  updateWorldLogic(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 定期生成新食物
    if (currentTime - this.lastFoodSpawn > this.foodSpawnInterval) {
      this.spawnFood();
      this.lastFoodSpawn = currentTime;
    }
    
    // 清理已消耗的食物
    this.cleanupConsumedFoods();
    
    // 清理过期的声波
    this.cleanupSoundWaves();
    
    // 更新声纳冷却时间
    this.updateSonarCooldowns(currentTime);
  }

  private cleanupConsumedFoods(): void {
    for (const [id, food] of this.foods.entries()) {
      if (food.isConsumed || !food.isActive) {
        this.foods.delete(id);
        this.removeEntity(id);
      }
    }
  }

  private cleanupSoundWaves(): void {
    for (const [id, soundWave] of this.soundWaves.entries()) {
      if (!soundWave.isActive) {
        this.soundWaves.delete(id);
        this.removeEntity(id);
      }
    }
  }

  private updateSonarCooldowns(currentTime: number): void {
    for (const [agentId, cooldownEnd] of this.agentSonarCooldowns.entries()) {
      if (currentTime >= cooldownEnd) {
        this.agentSonarCooldowns.delete(agentId);
      }
    }
  }

  handleAgentInteractions(agent: IAgent): void {
    // 检查与食物的交互
    this.handleFoodInteractions(agent);
    
    // 处理声纳探测
    this.handleSonarDetection(agent);
    
    // 检查与消音区域的交互
    this.handleMufflingZoneInteractions(agent);
  }

  private handleFoodInteractions(agent: IAgent): void {
    for (const food of this.foods.values()) {
      if (food.isConsumed) continue;
      
      const dx = agent.x - food.x;
      const dy = agent.y - food.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < food.radius + (agent as any).radius) {
        // 收集食物
        const nutritionGain = food.consume();
        this.applyNutritionToAgent(agent, nutritionGain);
      }
    }
  }

  private handleSonarDetection(agent: IAgent): void {
    // 检查智能体是否可以发出声纳
    const currentTime = Date.now();
    const cooldownEnd = this.agentSonarCooldowns.get(agent.id) || 0;
    
    if (currentTime < cooldownEnd) return;
    
    // 模拟智能体主动发出声纳（这里简化为定期发出）
    if (Math.random() < 0.1) { // 10%概率发出声纳
      this.emitSonar(agent);
      this.agentSonarCooldowns.set(agent.id, currentTime + this.sonarCooldownTime);
    }
  }

  private emitSonar(agent: IAgent): void {
    // 创建声波可视化
    const soundWave = new SoundWave(
      this.generateId(),
      agent.x,
      agent.y,
      1.0, // 初始强度
      120, // 最大半径
      60,  // 扩散速度
      agent.id
    );
    
    this.soundWaves.set(soundWave.id, soundWave);
    this.addEntity(soundWave);
    
    // 处理回声
    this.processEchoes(agent, agent.x, agent.y, 1.0);
  }

  private processEchoes(agent: IAgent, sourceX: number, sourceY: number, intensity: number): void {
    const echoData: any[] = [];
    
    // 检查墙壁回声
    for (const wall of this.walls.values()) {
      const reflection = wall.reflectSound(sourceX, sourceY, intensity);
      if (reflection) {
        echoData.push({
          type: 'wall',
          x: reflection.x,
          y: reflection.y,
          intensity: reflection.intensity
        });
      }
    }
    
    // 检查食物回声
    for (const food of this.foods.values()) {
      if (food.isConsumed) continue;
      
      const echo = food.generateEcho(sourceX, sourceY, intensity);
      if (echo) {
        echoData.push({
          type: 'food',
          signature: echo.signature,
          intensity: echo.intensity,
          distance: echo.distance
        });
      }
    }
    
    // 应用消音区域的影响
    for (const zone of this.mufflingZones.values()) {
      for (const echo of echoData) {
        echo.intensity = zone.absorbSound(sourceX, sourceY, echo.intensity);
      }
    }
    
    // 将回声信息传递给智能体（这里简化为console输出）
    if (echoData.length > 0) {
      console.log(`Agent ${agent.id} received echoes:`, echoData);
    }
  }

  private handleMufflingZoneInteractions(agent: IAgent): void {
    for (const zone of this.mufflingZones.values()) {
      const dx = agent.x - zone.x;
      const dy = agent.y - zone.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < zone.radius) {
        // 在消音区域中，智能体的声纳效果会减弱
        console.log(`Agent ${agent.id} is in muffling zone, sonar effectiveness reduced`);
      }
    }
  }

  private applyNutritionToAgent(agent: IAgent, nutritionGain: number): void {
    if (nutritionGain > 0) {
      console.log(`Agent ${agent.id} gained ${nutritionGain} nutrition`);
    }
    
    // TODO: 实际实现需要在Agent中添加营养属性和相关方法
    // (agent as any).nutrition = Math.max(0, (agent as any).nutrition + nutritionGain);
  }

  // 获取世界状态用于渲染
  getWalls(): IWall[] {
    return Array.from(this.walls.values());
  }

  getFoods(): IFood[] {
    return Array.from(this.foods.values());
  }

  getMufflingZones(): IMufflingZone[] {
    return Array.from(this.mufflingZones.values());
  }

  getSoundWaves(): SoundWave[] {
    return Array.from(this.soundWaves.values());
  }
}
