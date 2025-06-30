/**
 * 律动色域世界实现
 * 艺术创作的数字画布，智能体通过移动和感知创造独特的视觉和听觉艺术作品
 */

import { BaseWorld } from '../BaseWorld';
import { ColorPool, RhythmNode, CanvasTrace, ArtisticAgent } from './ChromaticComposerEntities';
import type { IAgent } from '../../entities/types';
import type { IColorPool, IRhythmNode, ICanvasTrace } from '../types';

export class ChromaticComposerWorld extends BaseWorld {
  private colorPools: Map<string, IColorPool> = new Map();
  private rhythmNodes: Map<string, IRhythmNode> = new Map();
  private canvasTraces: Map<string, ICanvasTrace> = new Map();
  private artisticAgents: Map<string, ArtisticAgent> = new Map();
  
  private lastColorPoolSpawn: number = 0;
  private colorPoolSpawnInterval: number = 25000; // 25秒生成一个新色彩池
  private maxColorPools: number = 8;
  
  private artworkComplexity: number = 0; // 艺术作品复杂度
  private totalPathLength: number = 0; // 总路径长度

  constructor(width: number, height: number) {
    super(width, height, 'chromatic-composer');
    this.initializeWorld();
  }

  initializeWorld(): void {
    // 创建色彩池
    this.createColorPools();
    
    // 创建节拍源
    this.createRhythmNodes();
    
    // 创建艺术智能体
    this.createArtisticAgents();
  }

  private createColorPools(): void {
    const colors = [
      '#ff4757', // 红色
      '#2ed573', // 绿色
      '#1e90ff', // 蓝色
      '#ffa502', // 橙色
      '#ff6b9d', // 粉色
      '#a55eea', // 紫色
      '#26de81', // 青绿色
      '#fd79a8'  // 玫瑰色
    ];
    
    const numPools = 4 + Math.floor(Math.random() * 3); // 4-6个色彩池
    
    for (let i = 0; i < numPools; i++) {
      const position = this.getRandomPosition();
      const color = colors[i % colors.length];
      
      const colorPool = new ColorPool(
        this.generateId(),
        position.x,
        position.y,
        color,
        25 + Math.random() * 20, // 半径 25-45
        0.8 + Math.random() * 0.2 // 强度 0.8-1.0
      );
      
      this.colorPools.set(colorPool.id, colorPool);
      this.addEntity(colorPool);
    }
  }

  private createRhythmNodes(): void {
    const frequencies = [60, 90, 120, 150]; // 不同的BPM
    const numNodes = 2 + Math.floor(Math.random() * 2); // 2-3个节拍源
    
    for (let i = 0; i < numNodes; i++) {
      const position = this.getRandomPosition();
      const frequency = frequencies[i % frequencies.length];
      
      const rhythmNode = new RhythmNode(
        this.generateId(),
        position.x,
        position.y,
        frequency,
        0.7 + Math.random() * 0.3, // 振幅 0.7-1.0
        80 + Math.random() * 40    // 范围 80-120
      );
      
      this.rhythmNodes.set(rhythmNode.id, rhythmNode);
      this.addEntity(rhythmNode);
    }
  }

  private createArtisticAgents(): void {
    const numAgents = 3 + Math.floor(Math.random() * 3); // 3-5个艺术智能体
    
    for (let i = 0; i < numAgents; i++) {
      const position = this.getRandomPosition();
      
      const artisticAgent = new ArtisticAgent(
        this.generateId(),
        position.x,
        position.y,
        6 + Math.random() * 4,     // 半径 6-10
        0.3 + Math.random() * 0.7  // 创造力 0.3-1.0
      );
      
      this.artisticAgents.set(artisticAgent.id, artisticAgent);
      this.addEntity(artisticAgent);
    }
  }

  updateWorldLogic(deltaTime: number): void {
    const currentTime = Date.now();
    
    // 定期生成新色彩池
    if (currentTime - this.lastColorPoolSpawn > this.colorPoolSpawnInterval) {
      this.spawnNewColorPool();
      this.lastColorPoolSpawn = currentTime;
    }
    
    // 更新艺术智能体的节拍响应
    this.updateRhythmicBehavior();
    
    // 处理艺术智能体的绘画行为
    this.updateArtisticBehavior();
    
    // 清理过期的画布痕迹
    this.cleanupExpiredTraces();
    
    // 计算艺术作品统计
    this.calculateArtworkStatistics();
  }

  private spawnNewColorPool(): void {
    if (this.colorPools.size >= this.maxColorPools) {
      return;
    }
    
    const colors = ['#ff7675', '#74b9ff', '#00b894', '#fdcb6e', '#e17055', '#6c5ce7'];
    const position = this.getRandomPosition();
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    const colorPool = new ColorPool(
      this.generateId(),
      position.x,
      position.y,
      color,
      20 + Math.random() * 25,
      0.7 + Math.random() * 0.3
    );
    
    this.colorPools.set(colorPool.id, colorPool);
    this.addEntity(colorPool);
  }

  private updateRhythmicBehavior(): void {
    for (const agent of this.artisticAgents.values()) {
      if (!agent.isActive) continue;
      
      // 检查附近的节拍源
      for (const rhythmNode of this.rhythmNodes.values()) {
        if (rhythmNode.isInRange(agent.x, agent.y)) {
          const beatStrength = rhythmNode.getBeatStrength(agent.x, agent.y);
          agent.respondToBeat(beatStrength);
        }
      }
    }
  }

  private updateArtisticBehavior(): void {
    for (const agent of this.artisticAgents.values()) {
      if (!agent.isActive) continue;
      
      // 检查与色彩池的交互
      for (const colorPool of this.colorPools.values()) {
        if (this.checkCollision(agent, colorPool)) {
          agent.touchColorPool(colorPool.color);
        }
      }
      
      // 处理绘画痕迹
      if (agent.isDrawing && agent.currentTrace) {
        // 将痕迹添加到世界中
        if (!this.canvasTraces.has(agent.currentTrace.id)) {
          this.canvasTraces.set(agent.currentTrace.id, agent.currentTrace);
          this.addEntity(agent.currentTrace);
        }
      }
      
      // 随机开始或停止绘画
      if (Math.random() < 0.02) { // 2%概率
        if (agent.isDrawing) {
          const trace = agent.stopDrawing();
          if (trace) {
            console.log(`Agent ${agent.id} finished artwork with ${trace.points.length} points`);
          }
        } else {
          const trace = agent.startDrawing();
          this.canvasTraces.set(trace.id, trace);
          this.addEntity(trace);
        }
      }
    }
  }

  private cleanupExpiredTraces(): void {
    for (const [id, trace] of this.canvasTraces.entries()) {
      if (!trace.isActive) {
        this.canvasTraces.delete(id);
        this.removeEntity(id);
      }
    }
  }

  private calculateArtworkStatistics(): void {
    let totalComplexity = 0;
    let totalLength = 0;
    
    for (const trace of this.canvasTraces.values()) {
      totalComplexity += trace.getPathComplexity();
      totalLength += trace.getPathLength();
    }
    
    this.artworkComplexity = totalComplexity;
    this.totalPathLength = totalLength;
  }

  handleAgentInteractions(agent: IAgent): void {
    // 处理与色彩池的交互
    this.handleColorPoolInteractions(agent);
    
    // 处理节拍感知
    this.handleRhythmPerception(agent);
    
    // 处理艺术创作
    this.handleArtisticCreation(agent);
  }

  private handleColorPoolInteractions(agent: IAgent): void {
    for (const colorPool of this.colorPools.values()) {
      const distance = this.getDistance(agent, colorPool);
      
      if (distance < colorPool.radius + (agent as any).radius) {
        // 智能体接触到色彩池
        console.log(`Agent ${agent.id} touched color pool: ${colorPool.color}`);
        
        // 可以在这里改变智能体的状态或行为
        this.applyColorInfluenceToAgent(agent, colorPool.color, colorPool.intensity);
      }
    }
  }

  private handleRhythmPerception(agent: IAgent): void {
    const rhythmData: any[] = [];
    
    for (const rhythmNode of this.rhythmNodes.values()) {
      if (rhythmNode.isInRange(agent.x, agent.y)) {
        const beatStrength = rhythmNode.getBeatStrength(agent.x, agent.y);
        rhythmData.push({
          frequency: rhythmNode.frequency,
          strength: beatStrength,
          phase: rhythmNode.phase
        });
      }
    }
    
    if (rhythmData.length > 0) {
      this.applyRhythmInfluenceToAgent(agent, rhythmData);
    }
  }

  private handleArtisticCreation(agent: IAgent): void {
    // 智能体可以创建艺术痕迹
    if (Math.random() < 0.005) { // 0.5%概率创建新痕迹
      const trace = new CanvasTrace(
        this.generateId(),
        agent.x,
        agent.y,
        this.getRandomArtisticColor(),
        2 + Math.random() * 4,
        0.01 + Math.random() * 0.02
      );
      
      this.canvasTraces.set(trace.id, trace);
      this.addEntity(trace);
      
      console.log(`Agent ${agent.id} created new artwork trace`);
    }
  }

  private getDistance(entity1: any, entity2: any): number {
    const dx = entity1.x - entity2.x;
    const dy = entity1.y - entity2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private applyColorInfluenceToAgent(agent: IAgent, color: string, intensity: number): void {
    // TODO: 实际实现需要在Agent中添加颜色感知能力
    console.log(`Agent ${agent.id} influenced by color ${color} with intensity ${intensity}`);
  }

  private applyRhythmInfluenceToAgent(agent: IAgent, rhythmData: any[]): void {
    // TODO: 实际实现需要在Agent中添加节拍感知能力
    console.log(`Agent ${agent.id} perceives rhythm:`, rhythmData);
  }

  private getRandomArtisticColor(): string {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
      '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // 获取世界状态用于渲染
  getColorPools(): IColorPool[] {
    return Array.from(this.colorPools.values());
  }

  getRhythmNodes(): IRhythmNode[] {
    return Array.from(this.rhythmNodes.values());
  }

  getCanvasTraces(): ICanvasTrace[] {
    return Array.from(this.canvasTraces.values());
  }

  getArtisticAgents(): ArtisticAgent[] {
    return Array.from(this.artisticAgents.values());
  }

  // 获取艺术统计信息
  getArtworkStatistics(): { complexity: number; totalLength: number; traceCount: number } {
    return {
      complexity: this.artworkComplexity,
      totalLength: this.totalPathLength,
      traceCount: this.canvasTraces.size
    };
  }
}
