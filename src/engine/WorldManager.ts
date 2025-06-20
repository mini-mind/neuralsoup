/**
 * 世界管理器类
 * 负责生成和管理游戏世界中的智能体、食物和障碍物
 */

import { Agent, Food, Obstacle } from '../types/simulation';

export class WorldManager {
  private worldWidth: number;
  private worldHeight: number;

  constructor(worldWidth: number, worldHeight: number) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  /**
   * 更新世界尺寸
   */
  public updateDimensions(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  /**
   * 创建智能体
   */
  public createAgents(): Agent[] {
    const agents: Agent[] = [];
    const agentCount = 5;
    
    // 获取墙内区域的范围
    const wallMargin = 100;
    const wallThickness = 20;
    const innerLeftBound = wallMargin + wallThickness;
    const innerRightBound = this.worldWidth - wallMargin - wallThickness;
    const innerTopBound = wallMargin + wallThickness;
    const innerBottomBound = this.worldHeight - wallMargin - wallThickness;
    
    for (let i = 0; i < agentCount; i++) {
      let x, y;
      
      if (i === 0) {
        // 主智能体放在世界中心附近
        x = this.worldWidth / 2 + (Math.random() - 0.5) * 200;
        y = this.worldHeight / 2 + (Math.random() - 0.5) * 200;
      } else {
        // 野生智能体在墙内随机位置
        x = innerLeftBound + Math.random() * (innerRightBound - innerLeftBound);
        y = innerTopBound + Math.random() * (innerBottomBound - innerTopBound);
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
        visualInput: new Array(108).fill(0),
        controlType: i === 0 ? 'snn' : 'random',
              motivation: 0,
      stress: 0,
      homeostasis: 0.5,
        totalReward: 0,
        collisionCount: 0
      };
      
      agents.push(agent);
    }
    
    console.log('Total agents created:', agents.length);
    console.log('Wall inner bounds:', { left: innerLeftBound, right: innerRightBound, top: innerTopBound, bottom: innerBottomBound });
    
    return agents;
  }

  /**
   * 生成食物
   */
  public generateFood(agents: Agent[]): Food[] {
    const foods: Food[] = [];
    const foodCount = 15;
    
    // 获取墙内区域的范围
    const wallMargin = 100;
    const wallThickness = 20;
    const innerLeftBound = wallMargin + wallThickness;
    const innerRightBound = this.worldWidth - wallMargin - wallThickness;
    const innerTopBound = wallMargin + wallThickness;
    const innerBottomBound = this.worldHeight - wallMargin - wallThickness;
    
    // 获取主智能体位置（用于测试）
    const mainAgent = agents.find(agent => agent.controlType === 'snn');
    
    for (let i = 0; i < foodCount; i++) {
      let x, y;
      
      // 前5个食物用于测试视野角度限制（如果主agent在墙内）
      if (i < 5 && mainAgent && 
          mainAgent.x >= innerLeftBound && mainAgent.x <= innerRightBound &&
          mainAgent.y >= innerTopBound && mainAgent.y <= innerBottomBound) {
        
        const testPositions = [
          { angle: 0, distance: 100 }, // 正前方
          { angle: Math.PI, distance: 100 }, // 正后方
          { angle: -Math.PI / 3, distance: 100 }, // 左侧
          { angle: Math.PI / 3, distance: 100 }, // 右侧
          { angle: -Math.PI / 2, distance: 100 } // 左侧外
        ];
        
        const pos = testPositions[i];
        const testAngle = mainAgent.angle + pos.angle;
        x = mainAgent.x + Math.cos(testAngle) * pos.distance;
        y = mainAgent.y + Math.sin(testAngle) * pos.distance;
        
        // 确保在墙内范围内
        x = Math.max(innerLeftBound, Math.min(innerRightBound, x));
        y = Math.max(innerTopBound, Math.min(innerBottomBound, y));
      } else {
        // 其他食物在墙内随机分布
        x = innerLeftBound + Math.random() * (innerRightBound - innerLeftBound);
        y = innerTopBound + Math.random() * (innerBottomBound - innerTopBound);
      }
      
      foods.push({
        id: i,
        x: x,
        y: y,
        radius: 8,
        nutritionValue: 10
      });
    }
    
    console.log('Generated foods:', foods.length);
    console.log('Food spawn area:', { left: innerLeftBound, right: innerRightBound, top: innerTopBound, bottom: innerBottomBound });
    
    return foods;
  }

  /**
   * 生成障碍物（围墙）
   */
  public generateObstacles(): Obstacle[] {
    const obstacles: Obstacle[] = [];
    const wallThickness = 20;
    const wallMargin = 100;
    const innerWidth = this.worldWidth - wallMargin * 2;
    const innerHeight = this.worldHeight - wallMargin * 2;
    const obstacleSize = wallThickness;

    // 计算沿边界放置障碍物的数量
    const numHorizontal = Math.floor(innerWidth / obstacleSize);
    const numVertical = Math.floor(innerHeight / obstacleSize);

    let idCounter = 0;

    // 顶部和底部墙
    for (let i = 0; i < numHorizontal; i++) {
      // 顶部墙
      obstacles.push({
        id: idCounter++,
        x: wallMargin + i * obstacleSize + obstacleSize / 2,
        y: wallMargin + obstacleSize / 2,
        radius: obstacleSize / 2,
        isMoving: false,
      });
      // 底部墙
      obstacles.push({
        id: idCounter++,
        x: wallMargin + i * obstacleSize + obstacleSize / 2,
        y: wallMargin + innerHeight - obstacleSize / 2,
        radius: obstacleSize / 2,
        isMoving: false,
      });
    }

    // 左侧和右侧墙
    for (let i = 0; i < numVertical; i++) {
      // 左侧墙
      obstacles.push({
        id: idCounter++,
        x: wallMargin + obstacleSize / 2,
        y: wallMargin + i * obstacleSize + obstacleSize / 2,
        radius: obstacleSize / 2,
        isMoving: false,
      });
      // 右侧墙
      obstacles.push({
        id: idCounter++,
        x: wallMargin + innerWidth - obstacleSize / 2,
        y: wallMargin + i * obstacleSize + obstacleSize / 2,
        radius: obstacleSize / 2,
        isMoving: false,
      });
    }

    console.log('Generated obstacles (walls):', obstacles.length);
    
    return obstacles;
  }

  /**
   * 处理智能体的边界碰撞（循环世界）
   */
  public handleBoundaryCollision(agent: Agent): void {
    agent.x = ((agent.x % this.worldWidth) + this.worldWidth) % this.worldWidth;
    agent.y = ((agent.y % this.worldHeight) + this.worldHeight) % this.worldHeight;
  }

  /**
   * 更新移动障碍物
   */
  public updateMovingObstacles(obstacles: Obstacle[], deltaTime: number): void {
    for (const obstacle of obstacles) {
      if (obstacle.isMoving && obstacle.velocity) {
        obstacle.x += obstacle.velocity.x * deltaTime;
        obstacle.y += obstacle.velocity.y * deltaTime;
        
        // 简单的边界反弹
        if (obstacle.x < 0 || obstacle.x > this.worldWidth) {
          obstacle.velocity.x = -obstacle.velocity.x;
        }
        if (obstacle.y < 0 || obstacle.y > this.worldHeight) {
          obstacle.velocity.y = -obstacle.velocity.y;
        }
      }
    }
  }

  // Getters
  public get width(): number {
    return this.worldWidth;
  }

  public get height(): number {
    return this.worldHeight;
  }
} 