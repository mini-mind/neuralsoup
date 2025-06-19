/**
 * 碰撞检测器类
 * 负责处理智能体与环境元素间的碰撞检测和处理
 */

import { Agent, Food, Obstacle } from '../types/simulation';

export class CollisionDetector {
  
  /**
   * 处理所有碰撞
   */
  public handleCollisions(agents: Agent[], foods: Food[], obstacles: Obstacle[]): {
    foodsToRemove: Food[];
    totalRewards: number;
    totalCollisions: number;
  } {
    const foodsToRemove: Food[] = [];
    let totalRewards = 0;
    let totalCollisions = 0;

    for (const agent of agents) {
      // 检查智能体与食物的碰撞
      const foodCollisions = this.checkFoodCollisions(agent, foods);
      foodsToRemove.push(...foodCollisions.foodsToRemove);
      totalRewards += foodCollisions.reward;

      // 检查智能体与障碍物的碰撞
      const obstacleCollisions = this.checkObstacleCollisions(agent, obstacles);
      totalCollisions += obstacleCollisions;

      // 检查智能体之间的碰撞
      const agentCollisions = this.checkAgentCollisions(agent, agents);
      totalCollisions += agentCollisions;
    }

    return {
      foodsToRemove,
      totalRewards,
      totalCollisions
    };
  }

  /**
   * 检查智能体与食物的碰撞
   */
  private checkFoodCollisions(agent: Agent, foods: Food[]): {
    foodsToRemove: Food[];
    reward: number;
  } {
    const foodsToRemove: Food[] = [];
    let reward = 0;

    for (const food of foods) {
      const dx = agent.x - food.x;
      const dy = agent.y - food.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 智能体半径约为15，食物半径为8
      if (distance < 15 + food.radius) {
        // 碰撞检测成功
        foodsToRemove.push(food);
        
        // 增加奖励和愉悦度
        agent.totalReward += food.nutritionValue;
        agent.pleasure = Math.min(1, agent.pleasure + 0.3);
        agent.health = Math.min(100, agent.health + food.nutritionValue);
        agent.energy = Math.min(100, agent.energy + food.nutritionValue);
        
        reward += food.nutritionValue;
        
        console.log(`Agent ${agent.id} ate food ${food.id}, reward: ${food.nutritionValue}`);
      }
    }

    return { foodsToRemove, reward };
  }

  /**
   * 检查智能体与障碍物的碰撞
   */
  private checkObstacleCollisions(agent: Agent, obstacles: Obstacle[]): number {
    let collisions = 0;

    for (const obstacle of obstacles) {
      const dx = agent.x - obstacle.x;
      const dy = agent.y - obstacle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 智能体半径为15
      if (distance < 15 + obstacle.radius) {
        // 碰撞处理：推开智能体
        const pushDistance = (15 + obstacle.radius) - distance + 1;
        const pushAngle = Math.atan2(dy, dx);
        
        agent.x += Math.cos(pushAngle) * pushDistance;
        agent.y += Math.sin(pushAngle) * pushDistance;
        
        // 减少健康值和增加唤醒度
        agent.health = Math.max(0, agent.health - 5);
        agent.arousal = Math.min(1, agent.arousal + 0.2);
        agent.collisionCount++;
        
        collisions++;
        
        console.log(`Agent ${agent.id} collided with obstacle ${obstacle.id}`);
      }
    }

    return collisions;
  }

  /**
   * 检查智能体之间的碰撞
   */
  private checkAgentCollisions(agent: Agent, agents: Agent[]): number {
    let collisions = 0;

    for (const otherAgent of agents) {
      if (agent.id === otherAgent.id) continue;
      
      const dx = agent.x - otherAgent.x;
      const dy = agent.y - otherAgent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 两个智能体的半径都是15
      if (distance < 15 + 15) {
        // 碰撞处理：相互推开
        const pushDistance = (30 - distance) / 2 + 1;
        const pushAngle = Math.atan2(dy, dx);
        
        agent.x += Math.cos(pushAngle) * pushDistance;
        agent.y += Math.sin(pushAngle) * pushDistance;
        otherAgent.x -= Math.cos(pushAngle) * pushDistance;
        otherAgent.y -= Math.sin(pushAngle) * pushDistance;
        
        // 增加唤醒度
        agent.arousal = Math.min(1, agent.arousal + 0.1);
        otherAgent.arousal = Math.min(1, otherAgent.arousal + 0.1);
        
        agent.collisionCount++;
        otherAgent.collisionCount++;
        
        collisions++;
        
        console.log(`Agent ${agent.id} collided with agent ${otherAgent.id}`);
      }
    }

    return collisions;
  }

  /**
   * 检查单个智能体与食物的碰撞（用于实时检测）
   */
  public checkSingleAgentFoodCollision(agent: Agent, food: Food): boolean {
    const dx = agent.x - food.x;
    const dy = agent.y - food.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < 15 + food.radius;
  }

  /**
   * 检查单个智能体与障碍物的碰撞（用于路径规划）
   */
  public checkSingleAgentObstacleCollision(agent: Agent, obstacle: Obstacle): boolean {
    const dx = agent.x - obstacle.x;
    const dy = agent.y - obstacle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < 15 + obstacle.radius;
  }

  /**
   * 移除被吃掉的食物
   */
  public removeFoods(foods: Food[], foodsToRemove: Food[]): Food[] {
    return foods.filter(food => !foodsToRemove.some(removeFood => removeFood.id === food.id));
  }

  /**
   * 获取智能体周围的危险程度（用于AI决策）
   */
  public getDangerLevel(agent: Agent, obstacles: Obstacle[], otherAgents: Agent[]): number {
    let dangerLevel = 0;
    const dangerRadius = 50; // 危险感知半径

    // 检查障碍物威胁
    for (const obstacle of obstacles) {
      const dx = agent.x - obstacle.x;
      const dy = agent.y - obstacle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < dangerRadius) {
        dangerLevel += (dangerRadius - distance) / dangerRadius;
      }
    }

    // 检查其他智能体威胁
    for (const otherAgent of otherAgents) {
      if (agent.id === otherAgent.id) continue;
      
      const dx = agent.x - otherAgent.x;
      const dy = agent.y - otherAgent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < dangerRadius) {
        dangerLevel += 0.5 * (dangerRadius - distance) / dangerRadius;
      }
    }

    return Math.min(1, dangerLevel); // 限制在0-1范围内
  }
} 