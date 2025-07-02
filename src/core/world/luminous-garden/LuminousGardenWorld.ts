/**
 * 光影花园世界实现
 * 简化版：只有亮区和暗区，智能体有健康系统
 */

import { BaseWorld } from '../BaseWorld';
import { LightPatch, DarkMatter } from './LuminousGardenEntities';
import type { IAgent } from '../../entities/types';
import type { ILightPatch, IDarkMatter } from '../types';

export class LuminousGardenWorld extends BaseWorld {
  private lightPatches: Map<string, ILightPatch> = new Map();
  private darkMatterZones: Map<string, IDarkMatter> = new Map();
  
  // 游戏速度控制
  private gameSpeedMultiplier: number = 0.2; // 大幅降低游戏速度到20%

  constructor(width: number, height: number) {
    super(width, height, 'luminous-garden');
    this.initializeWorld();
  }

  initializeWorld(): void {
    // 创建光斑（亮区）
    this.createLightPatches();
    
    // 创建暗物质区域（暗区）
    this.createDarkMatterZones();
    
    // 创建agents
    this.createAgents();
  }

  private createLightPatches(): void {
    const numPatches = 2 + Math.floor(Math.random() * 2); // 2-3个光斑
    
    for (let i = 0; i < numPatches; i++) {
      const position = this.getRandomPosition();
      const lightPatch = new LightPatch(
        this.generateId(),
        position.x,
        position.y,
        0.8 + Math.random() * 0.2, // 强度 0.8-1.0
        50 + Math.random() * 30,   // 半径 50-80
        12 + Math.random() * 8,    // 健康恢复率 12-20
        0.8 + Math.random() * 0.7, // 移动速度 0.8-1.5（极慢）
        this.worldWidth,
        this.worldHeight
      );
      
      this.lightPatches.set(lightPatch.id, lightPatch);
      this.addEntity(lightPatch);
    }
  }

  private createDarkMatterZones(): void {
    const numZones = 2 + Math.floor(Math.random() * 2); // 2-3个暗物质区域
    
    for (let i = 0; i < numZones; i++) {
      const position = this.getRandomPosition();
      const darkMatter = new DarkMatter(
        this.generateId(),
        position.x,
        position.y,
        40 + Math.random() * 25,   // 半径 40-65
        6 + Math.random() * 4,     // 健康消耗率 6-10
        0,                         // 不使用扩张
        0.5 + Math.random() * 0.5, // 移动速度 0.5-1.0（超慢）
        this.worldWidth,
        this.worldHeight
      );
      
      this.darkMatterZones.set(darkMatter.id, darkMatter);
      this.addEntity(darkMatter);
    }
  }

  updateWorldLogic(deltaTime: number): void {
    // 应用游戏速度倍数
    const adjustedDeltaTime = deltaTime * this.gameSpeedMultiplier;
    
    // 更新野生agent的随机游走（速度也要调整）
    this.updateWildAgentsBehavior(adjustedDeltaTime);
    
    // 更新主agent的视觉感受器输入
    this.updateMainAgentVision(adjustedDeltaTime);
    
    // 更新所有实体的健康影响
    this.updateHealthEffects(adjustedDeltaTime);
  }

  private updateHealthEffects(deltaTime: number): void {
    for (const agent of this.agents.values()) {
      this.handleAgentHealthInteractions(agent, deltaTime);
    }
  }

  private handleAgentHealthInteractions(agent: IAgent, deltaTime: number): void {
    const agentAny = agent as any;
    
    // 初始化健康值（如果没有）
    if (agentAny.health === undefined) {
      agentAny.health = 100; // 满健康
      agentAny.maxHealth = 100;
    }
    
    let healthChange = 0;
    let inLightArea = false;
    // let _inDarkArea = false;
    
    // 检查与光斑的交互（亮区补充健康）
    for (const lightPatch of this.lightPatches.values()) {
      const dx = agent.x - lightPatch.x;
      const dy = agent.y - lightPatch.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < lightPatch.radius) {
        inLightArea = true;
        // 在光斑中，持续恢复健康到最大值
        const healRate = lightPatch.energyRate * lightPatch.intensity;
        healthChange = Math.max(healthChange, healRate * deltaTime);
        break; // 一次只能在一个光斑中获益
      }
    }
    
    // 检查与暗物质的交互（暗区扣除健康）
    if (!inLightArea) { // 只有不在光区时才检查暗区
      for (const darkMatter of this.darkMatterZones.values()) {
        const dx = agent.x - darkMatter.x;
        const dy = agent.y - darkMatter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < darkMatter.radius) {
          // _inDarkArea = true;
          // 在暗物质中，持续失去健康直到0
          const drainRate = darkMatter.drainRate;
          healthChange = Math.min(healthChange, -drainRate * deltaTime);
          break; // 一次只能在一个暗区中受损
        }
      }
    }
    
    // 应用健康变化
    if (healthChange !== 0) {
      agentAny.health = Math.max(0, Math.min(agentAny.maxHealth, agentAny.health + healthChange));
      
      // 显示健康变化（用于调试）
      if (healthChange > 0) {
        console.log(`Agent ${agent.id} 在亮区恢复健康: ${agentAny.health.toFixed(1)}/${agentAny.maxHealth}`);
      } else {
        console.log(`Agent ${agent.id} 在暗区失去健康: ${agentAny.health.toFixed(1)}/${agentAny.maxHealth}`);
      }
      
      // 健康归零时的处理
      if (agentAny.health <= 0) {
        console.log(`Agent ${agent.id} 健康归零！`);
        // 可以在这里添加复活逻辑或其他处理
      }
    }
  }

  handleAgentInteractions(_agent: IAgent): void {
    // 健康交互已在 updateHealthEffects 中处理
    // 这里可以添加其他类型的交互
  }

  // 获取世界状态用于渲染
  getLightPatches(): ILightPatch[] {
    return Array.from(this.lightPatches.values());
  }

  getDarkMatterZones(): IDarkMatter[] {
    return Array.from(this.darkMatterZones.values());
  }

  /**
   * 创建agents（主agent + 野生agents）
   */
  private createAgents(): void {
    // 创建主agent - ID为'0'，位于世界中心附近
    const mainAgent = this.createSimpleAgent('0', 
      this.worldWidth / 2 + (Math.random() - 0.5) * 100,
      this.worldHeight / 2 + (Math.random() - 0.5) * 100
    );
    this.addAgent(mainAgent);

    // 创建2-4个野生agents（减少数量）
    const numWildAgents = 2 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= numWildAgents; i++) {
      const wildAgent = this.createSimpleAgent(
        i.toString(),
        Math.random() * this.worldWidth,
        Math.random() * this.worldHeight
      );
      this.addAgent(wildAgent);
    }
  }

  /**
   * 创建简单的agent实现
   */
  private createSimpleAgent(id: string, x: number, y: number): IAgent {
    return {
      id,
      x,
      y,
      angle: Math.random() * Math.PI * 2,
      radius: 12,
      entityType: 'agent',
      brain: {} as any, // 简化实现
      sensors: [],
      effectors: [],
      update: (_world: any) => {
        // 简单的更新逻辑已在世界中处理
      }
    };
  }

  /**
   * 更新主agent的视觉感受器输入
   * 8个方向，每个方向统计亮区数量
   */
  private updateMainAgentVision(_deltaTime: number): void {
    const mainAgent = this.agents.get('0');
    if (!mainAgent) return;

    // 计算8个方向的视觉输入
    const visionInputs = this.calculateVisionInputs(mainAgent);
    
    // 这里应该将输入发送给视觉感受器
    // 暂时用console输出来验证功能
    if (visionInputs.some(input => input > 0)) {
      console.log(`主agent视觉输入: [${visionInputs.map(v => v.toFixed(0)).join(', ')}]`);
    }
    
    // TODO: 将visionInputs发送给VisualReceptor实例
    // 这需要在全局状态中访问视觉感受器实例
  }

  /**
   * 计算主agent的8方向视觉输入
   * 每个方向45度范围内的亮区数量
   */
  private calculateVisionInputs(agent: IAgent): number[] {
    const visionRange = 120; // 视觉范围距离
    const inputs = new Array(8).fill(0);
    
    // 8个方向，每个方向45度范围
    // const _directions = [
    //   0,           // 0度（右）
    //   Math.PI / 4, // 45度
    //   Math.PI / 2, // 90度（上）
    //   3 * Math.PI / 4, // 135度
    //   Math.PI,     // 180度（左）
    //   5 * Math.PI / 4, // 225度
    //   3 * Math.PI / 2, // 270度（下）
    //   7 * Math.PI / 4  // 315度
    // ];

    // 检查每个亮区在哪个方向范围内
    for (const lightPatch of this.lightPatches.values()) {
      const dx = lightPatch.x - agent.x;
      const dy = lightPatch.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 只统计视觉范围内的亮区
      if (distance <= visionRange) {
        const angle = Math.atan2(dy, dx);
        const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
        
        // 找到对应的方向索引
        const directionIndex = this.getDirectionIndex(normalizedAngle);
        inputs[directionIndex]++;
      }
    }

    return inputs;
  }

  /**
   * 根据角度获取对应的方向索引（0-7）
   */
  private getDirectionIndex(angle: number): number {
    // 每个方向45度，角度范围为 [方向角度-22.5度, 方向角度+22.5度]
    const segmentSize = Math.PI / 4; // 45度
    const adjustedAngle = angle + segmentSize / 2; // 调整角度使0度方向居中
    
    let index = Math.floor(adjustedAngle / segmentSize);
    return index % 8; // 确保在0-7范围内
  }

  /**
   * 更新野生agent的随机游走行为（包括趋光行为和静止概率）
   */
  private updateWildAgentsBehavior(deltaTime: number): void {
    for (const agent of this.agents.values()) {
      // 跳过主agent
      if (agent.id === '0' || agent.id === 'main') continue;
      
      const agentAny = agent as any;
      
      // 初始化随机游走参数
      if (!agentAny.wanderAngle) {
        agentAny.wanderAngle = Math.random() * Math.PI * 2;
        agentAny.wanderChangeTime = 0;
        agentAny.moveSpeed = 3 + Math.random() * 3; // 降低到3-6的移动速度
        agentAny.isStationary = false;
        agentAny.stationaryDuration = 0;
      }
      
      // 处理静止状态
      if (agentAny.isStationary) {
        agentAny.stationaryDuration -= deltaTime;
        if (agentAny.stationaryDuration <= 0) {
          agentAny.isStationary = false;
        } else {
          continue; // 静止时不移动
        }
      }
      
      // 每4-8秒改变一次方向或决定是否静止
      agentAny.wanderChangeTime += deltaTime;
      if (agentAny.wanderChangeTime > 4 + Math.random() * 4) {
        // 20%概率选择静止
        if (Math.random() < 0.2) {
          agentAny.isStationary = true;
          agentAny.stationaryDuration = 3 + Math.random() * 7; // 静止3-10秒
          agentAny.wanderChangeTime = 0;
          continue;
        } else {
          // 80%概率改变方向
          agentAny.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.4; // 更小的角度变化
          agentAny.wanderChangeTime = 0;
        }
      }
      
      // 检查附近是否有亮区，实现趋光行为
      const targetDirection = this.findNearbyLightDirection(agent);
      if (targetDirection !== null) {
        // 保存目标方向，供渲染器使用
        agentAny.targetDirection = targetDirection;
        
        // 有亮区时，逐渐调整方向朝向亮区
        const angleDiff = targetDirection - agentAny.wanderAngle;
        
        // 处理角度环绕问题
        let adjustedAngleDiff = angleDiff;
        if (adjustedAngleDiff > Math.PI) {
          adjustedAngleDiff -= 2 * Math.PI;
        } else if (adjustedAngleDiff < -Math.PI) {
          adjustedAngleDiff += 2 * Math.PI;
        }
        
        // 缓慢调整角度朝向亮区
        const turnSpeed = 1.5 * deltaTime; // 转向速度
        if (Math.abs(adjustedAngleDiff) > turnSpeed) {
          agentAny.wanderAngle += Math.sign(adjustedAngleDiff) * turnSpeed;
        } else {
          agentAny.wanderAngle = targetDirection;
        }
      } else {
        // 没有检测到亮区，清除目标方向
        agentAny.targetDirection = undefined;
      }
      
      // 应用移动
      const moveX = Math.cos(agentAny.wanderAngle) * agentAny.moveSpeed * deltaTime;
      const moveY = Math.sin(agentAny.wanderAngle) * agentAny.moveSpeed * deltaTime;
      
      agent.x += moveX;
      agent.y += moveY;
      agentAny.angle = agentAny.wanderAngle;
    }
  }

  /**
   * 查找野生agent附近的亮区方向
   * @param agent 野生agent
   * @returns 最近亮区的方向角度，如果没有返回null
   */
  private findNearbyLightDirection(agent: IAgent): number | null {
    const detectionRange = 80; // 检测范围
    let closestDistance = Infinity;
    let closestDirection: number | null = null;
    
    for (const lightPatch of this.lightPatches.values()) {
      const dx = lightPatch.x - agent.x;
      const dy = lightPatch.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 检测范围内且是最近的亮区
      if (distance <= detectionRange && distance < closestDistance) {
        closestDistance = distance;
        closestDirection = Math.atan2(dy, dx);
      }
    }
    
    return closestDirection;
  }
}
