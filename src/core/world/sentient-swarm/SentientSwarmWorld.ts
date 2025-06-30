/**
 * 意识集群世界实现
 * 群体智能的展示舞台，多个智能体共享同一大脑设计，展现涌现的集体行为
 */

import { BaseWorld } from '../BaseWorld';
import { ResourcePatch, SignalBeacon, Threat, SwarmAgent } from './SentientSwarmEntities';
import type { IAgent } from '../../entities/types';
import type { IResourcePatch, ISignalBeacon, IThreat } from '../types';

export class SentientSwarmWorld extends BaseWorld {
  private resourcePatches: Map<string, IResourcePatch> = new Map();
  private signalBeacons: Map<string, ISignalBeacon> = new Map();
  private threats: Map<string, IThreat> = new Map();
  private swarmAgents: Map<string, SwarmAgent> = new Map();
  
  private lastResourceSpawn: number = 0;
  private resourceSpawnInterval: number = 20000; // 20秒生成一个资源点
  private maxResources: number = 6;
  
  private lastThreatSpawn: number = 0;
  private threatSpawnInterval: number = 30000; // 30秒生成一个威胁
  private maxThreats: number = 3;
  
  private swarmSize: number = 15; // 群体大小

  constructor(width: number, height: number) {
    super(width, height, 'sentient-swarm');
    this.initializeWorld();
  }

  initializeWorld(): void {
    // 创建初始资源点
    this.createInitialResources();
    
    // 创建初始威胁
    this.createInitialThreats();
    
    // 创建群体智能体
    this.createSwarmAgents();
  }

  private createInitialResources(): void {
    const numResources = 3 + Math.floor(Math.random() * 2); // 3-4个初始资源点
    
    for (let i = 0; i < numResources; i++) {
      this.spawnResource();
    }
  }

  private spawnResource(): void {
    if (this.resourcePatches.size >= this.maxResources) {
      return;
    }
    
    const position = this.getRandomPosition();
    const resource = new ResourcePatch(
      this.generateId(),
      position.x,
      position.y,
      80 + Math.random() * 40,  // 最大资源 80-120
      20 + Math.random() * 15,  // 半径 20-35
      1 + Math.random() * 2     // 再生率 1-3
    );
    
    this.resourcePatches.set(resource.id, resource);
    this.addEntity(resource);
  }

  private createInitialThreats(): void {
    const numThreats = 1 + Math.floor(Math.random() * 2); // 1-2个初始威胁
    
    for (let i = 0; i < numThreats; i++) {
      this.spawnThreat();
    }
  }

  private spawnThreat(): void {
    if (this.threats.size >= this.maxThreats) {
      return;
    }
    
    const position = this.getRandomPosition();
    const threat = new Threat(
      this.generateId(),
      position.x,
      position.y,
      20 + Math.random() * 20,  // 移动速度 20-40
      80 + Math.random() * 40,  // 检测范围 80-120
      15 + Math.random() * 10,  // 伤害 15-25
      12 + Math.random() * 8    // 半径 12-20
    );
    
    this.threats.set(threat.id, threat);
    this.addEntity(threat);
  }

  private createSwarmAgents(): void {
    const centerX = this.worldWidth / 2;
    const centerY = this.worldHeight / 2;
    const spawnRadius = 100;
    
    for (let i = 0; i < this.swarmSize; i++) {
      const angle = (i / this.swarmSize) * Math.PI * 2;
      const distance = Math.random() * spawnRadius;
      
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      const swarmAgent = new SwarmAgent(
        this.generateId(),
        x,
        y,
        'main_swarm',
        6 + Math.random() * 4,  // 半径 6-10
        80 + Math.random() * 40 // 最大能量 80-120
      );
      
      this.swarmAgents.set(swarmAgent.id, swarmAgent);
      this.addEntity(swarmAgent);
    }
  }

  updateWorldLogic(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 定期生成新资源
    if (currentTime - this.lastResourceSpawn > this.resourceSpawnInterval) {
      this.spawnResource();
      this.lastResourceSpawn = currentTime;
    }
    
    // 定期生成新威胁
    if (currentTime - this.lastThreatSpawn > this.threatSpawnInterval) {
      this.spawnThreat();
      this.lastThreatSpawn = currentTime;
    }
    
    // 更新群体行为
    this.updateSwarmBehavior();
    
    // 清理过期的信标
    this.cleanupExpiredBeacons();
    
    // 清理失活的群体智能体
    this.cleanupInactiveSwarmAgents();
  }

  private updateSwarmBehavior(): void {
    const swarmAgentsList = Array.from(this.swarmAgents.values());
    
    // 为每个群体智能体计算群体行为
    for (const agent of swarmAgentsList) {
      if (!agent.isActive) continue;
      
      // 获取邻居
      const neighbors = swarmAgentsList.filter(other => 
        other.id !== agent.id && 
        other.isActive &&
        this.getDistance(agent, other) < agent.cohesionRadius
      );
      
      // 应用群体力
      agent.applySwarmForces(neighbors);
    }
  }

  private getDistance(entity1: any, entity2: any): number {
    const dx = entity1.x - entity2.x;
    const dy = entity1.y - entity2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private cleanupExpiredBeacons(): void {
    for (const [id, beacon] of this.signalBeacons.entries()) {
      if (!beacon.isActive) {
        this.signalBeacons.delete(id);
        this.removeEntity(id);
      }
    }
  }

  private cleanupInactiveSwarmAgents(): void {
    for (const [id, agent] of this.swarmAgents.entries()) {
      if (!agent.isActive) {
        this.swarmAgents.delete(id);
        this.removeEntity(id);
        
        // 生成新的群体智能体来维持群体大小
        this.respawnSwarmAgent();
      }
    }
  }

  private respawnSwarmAgent(): void {
    if (this.swarmAgents.size >= this.swarmSize) return;
    
    // 在现有群体附近生成新智能体
    const existingAgents = Array.from(this.swarmAgents.values());
    if (existingAgents.length > 0) {
      const randomAgent = existingAgents[Math.floor(Math.random() * existingAgents.length)];
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 50;
      
      const x = randomAgent.x + Math.cos(angle) * distance;
      const y = randomAgent.y + Math.sin(angle) * distance;
      
      const newAgent = new SwarmAgent(
        this.generateId(),
        x,
        y,
        'main_swarm',
        6 + Math.random() * 4,
        80 + Math.random() * 40
      );
      
      this.swarmAgents.set(newAgent.id, newAgent);
      this.addEntity(newAgent);
    }
  }

  handleAgentInteractions(agent: IAgent): void {
    // 处理与资源点的交互
    this.handleResourceInteractions(agent);
    
    // 处理与威胁的交互
    this.handleThreatInteractions(agent);
    
    // 处理信标创建
    this.handleBeaconCreation(agent);
    
    // 处理信标感知
    this.handleBeaconPerception(agent);
  }

  private handleResourceInteractions(agent: IAgent): void {
    for (const resource of this.resourcePatches.values()) {
      const distance = this.getDistance(agent, resource);
      
      if (distance < resource.radius + (agent as any).radius) {
        // 收集资源
        const collected = resource.consumeResource(5); // 每次收集5单位
        if (collected > 0) {
          this.applyResourceToAgent(agent, collected);
          
          // 创建食物信标
          this.createBeacon(agent.x, agent.y, 'food', 0.8, agent.id);
        }
      }
    }
  }

  private handleThreatInteractions(agent: IAgent): void {
    for (const threat of this.threats.values()) {
      const distance = this.getDistance(agent, threat);
      
      if (threat.canDetect(agent.x, agent.y)) {
        // 威胁检测到智能体
        threat.setHuntingTarget(agent.id, agent.x, agent.y);
        
        // 创建危险信标
        this.createBeacon(agent.x, agent.y, 'danger', 1.0, agent.id);
      }
      
      if (distance < threat.radius + (agent as any).radius) {
        // 威胁攻击智能体
        const damage = threat.attack(agent.id);
        if (damage > 0) {
          this.applyDamageToAgent(agent, damage);
        }
      }
    }
  }

  private handleBeaconCreation(agent: IAgent): void {
    // 智能体可以主动创建中性信标（简化实现）
    if (Math.random() < 0.01) { // 1%概率创建信标
      this.createBeacon(agent.x, agent.y, 'neutral', 0.5, agent.id);
    }
  }

  private handleBeaconPerception(agent: IAgent): void {
    const nearbyBeacons: any[] = [];
    
    for (const beacon of this.signalBeacons.values()) {
      if (beacon.isInRange(agent.x, agent.y)) {
        const strength = beacon.getSignalStrength(agent.x, agent.y);
        nearbyBeacons.push({
          type: beacon.signalType,
          strength: strength,
          direction: Math.atan2(beacon.y - agent.y, beacon.x - agent.x)
        });
      }
    }
    
    if (nearbyBeacons.length > 0) {
      console.log(`Agent ${agent.id} perceives beacons:`, nearbyBeacons);
    }
  }

  private createBeacon(x: number, y: number, type: 'food' | 'danger' | 'neutral', intensity: number, createdBy: string): void {
    const beacon = new SignalBeacon(
      this.generateId(),
      x,
      y,
      type,
      intensity,
      60 + Math.random() * 40, // 范围 60-100
      3000 + Math.random() * 4000, // 持续时间 3-7秒
      createdBy
    );
    
    this.signalBeacons.set(beacon.id, beacon);
    this.addEntity(beacon);
  }

  private applyResourceToAgent(agent: IAgent, resourceGain: number): void {
    console.log(`Agent ${agent.id} collected ${resourceGain} resources`);
    // TODO: 实际实现需要在Agent中添加资源属性
  }

  private applyDamageToAgent(agent: IAgent, damage: number): void {
    console.log(`Agent ${agent.id} took ${damage} damage`);
    // TODO: 实际实现需要在Agent中添加健康属性
  }

  // 获取世界状态用于渲染
  getResourcePatches(): IResourcePatch[] {
    return Array.from(this.resourcePatches.values());
  }

  getSignalBeacons(): ISignalBeacon[] {
    return Array.from(this.signalBeacons.values());
  }

  getThreats(): IThreat[] {
    return Array.from(this.threats.values());
  }

  getSwarmAgents(): SwarmAgent[] {
    return Array.from(this.swarmAgents.values());
  }
}
