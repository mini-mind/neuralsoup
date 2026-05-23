/**
 * 世界管理器类
 * 负责生成和管理游戏世界中的智能体、食物和障碍物
 */

import { Agent, Food, Obstacle } from '../types/simulation';

const WALL_MARGIN = 100;
const WALL_THICKNESS = 20;
const AGENT_RADIUS = 15;

export class WorldManager {
  private worldWidth: number;
  private worldHeight: number;

  constructor(worldWidth: number, worldHeight: number) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  /**
   * 创建智能体
   */
  public createAgents(mainAgentId: number): Agent[] {
    const agents: Agent[] = [];
    const agentCount = 5;
    const bounds = this.getInnerBounds();
    
    for (let i = 0; i < agentCount; i++) {
      let x, y;
      
      if (i === mainAgentId) {
        // 主智能体放在世界中心附近
        x = this.clampToInnerBounds(this.worldWidth / 2 + (Math.random() - 0.5) * 200, bounds.left, bounds.right);
        y = this.clampToInnerBounds(this.worldHeight / 2 + (Math.random() - 0.5) * 200, bounds.top, bounds.bottom);
      } else {
        // 野生智能体在墙内随机位置
        x = bounds.left + Math.random() * (bounds.right - bounds.left);
        y = bounds.top + Math.random() * (bounds.bottom - bounds.top);
      }
      
      const agent: Agent = {
        id: i,
        x: x,
        y: y,
        angle: Math.random() * Math.PI * 2,
        velocity: { x: 0, y: 0 },
        health: 100,
        energy: 100,
        visionCells: [],
        motivation: 0,
        stress: 0,
        homeostasis: 0.5,
        totalReward: 0,
        collisionCount: 0
      };
      
      agents.push(agent);
    }
    
    return agents;
  }

  /**
   * 生成食物
   */
  public generateFood(_agents: Agent[]): Food[] {
    const foods: Food[] = [];
    const foodCount = 15;
    const bounds = this.getInnerBounds();
    
    for (let i = 0; i < foodCount; i++) {
      const x = bounds.left + Math.random() * (bounds.right - bounds.left);
      const y = bounds.top + Math.random() * (bounds.bottom - bounds.top);

      foods.push({
        id: i,
        x: x,
        y: y,
        radius: 8,
        nutritionValue: 10
      });
    }
    
    return foods;
  }

  /**
   * 生成障碍物（围墙）
   */
  public generateObstacles(): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const innerWidth = this.worldWidth - WALL_MARGIN * 2;
    const innerHeight = this.worldHeight - WALL_MARGIN * 2;
    const obstacleSize = WALL_THICKNESS;

    // 计算沿边界放置障碍物的数量
    const numHorizontal = Math.floor(innerWidth / obstacleSize);
    const numVertical = Math.floor(innerHeight / obstacleSize);

    let idCounter = 0;

    // 顶部和底部墙
    for (let i = 0; i < numHorizontal; i++) {
      // 顶部墙
      obstacles.push({
        id: idCounter++,
        x: WALL_MARGIN + i * obstacleSize + obstacleSize / 2,
        y: WALL_MARGIN + obstacleSize / 2,
        radius: obstacleSize / 2
      });
      // 底部墙
      obstacles.push({
        id: idCounter++,
        x: WALL_MARGIN + i * obstacleSize + obstacleSize / 2,
        y: WALL_MARGIN + innerHeight - obstacleSize / 2,
        radius: obstacleSize / 2
      });
    }

    // 左侧和右侧墙
    for (let i = 0; i < numVertical; i++) {
      // 左侧墙
      obstacles.push({
        id: idCounter++,
        x: WALL_MARGIN + obstacleSize / 2,
        y: WALL_MARGIN + i * obstacleSize + obstacleSize / 2,
        radius: obstacleSize / 2
      });
      // 右侧墙
      obstacles.push({
        id: idCounter++,
        x: WALL_MARGIN + innerWidth - obstacleSize / 2,
        y: WALL_MARGIN + i * obstacleSize + obstacleSize / 2,
        radius: obstacleSize / 2
      });
    }

    return obstacles;
  }

  /**
   * 处理智能体的边界碰撞（有界世界）
   */
  public handleBoundaryCollision(agent: Agent): void {
    const bounds = this.getInnerBounds();
    const clampedX = this.clampToInnerBounds(agent.x, bounds.left, bounds.right);
    const clampedY = this.clampToInnerBounds(agent.y, bounds.top, bounds.bottom);

    if (clampedX !== agent.x) {
      agent.x = clampedX;
      agent.velocity.x = 0;
    }

    if (clampedY !== agent.y) {
      agent.y = clampedY;
      agent.velocity.y = 0;
    }
  }

  // Getters
  public get width(): number {
    return this.worldWidth;
  }

  public get height(): number {
    return this.worldHeight;
  }

  public getWorldBounds() {
    return {
      x: WALL_MARGIN + WALL_THICKNESS + AGENT_RADIUS,
      y: WALL_MARGIN + WALL_THICKNESS + AGENT_RADIUS,
      width: this.worldWidth - (WALL_MARGIN + WALL_THICKNESS + AGENT_RADIUS) * 2,
      height: this.worldHeight - (WALL_MARGIN + WALL_THICKNESS + AGENT_RADIUS) * 2
    };
  }

  private getInnerBounds() {
    const bounds = this.getWorldBounds();
    return {
      left: bounds.x,
      right: bounds.x + bounds.width,
      top: bounds.y,
      bottom: bounds.y + bounds.height
    };
  }

  private clampToInnerBounds(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
} 
