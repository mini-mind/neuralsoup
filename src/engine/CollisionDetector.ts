/**
 * 碰撞检测器类
 * 负责处理智能体与环境元素间的碰撞检测和处理
 */

import { Agent, Food, Obstacle } from '../types/simulation';

export class CollisionDetector {
  private static readonly AGENT_RADIUS = 15;
  
  /**
   * 处理所有碰撞
   */
  public handleCollisions(agents: Agent[], foods: Food[], obstacles: Obstacle[]): {
    foodsToRemove: Food[];
    totalRewards: number;
    totalCollisions: number;
  } {
    const foodsToRemove = new Map<number, Food>();
    let totalRewards = 0;
    let totalCollisions = 0;

    for (const agent of agents) {
      // 检查智能体与食物的碰撞
      const foodCollisions = this.checkFoodCollisions(
        agent,
        foods.filter(food => !foodsToRemove.has(food.id))
      );
      for (const food of foodCollisions.foodsToRemove) {
        foodsToRemove.set(food.id, food);
      }
      totalRewards += foodCollisions.reward;

      // 检查智能体与障碍物的碰撞
      const obstacleCollisions = this.checkObstacleCollisions(agent, obstacles);
      totalCollisions += obstacleCollisions;

      // 检查智能体之间的碰撞
      const agentCollisions = this.checkAgentCollisions(agent, agents);
      totalCollisions += agentCollisions;
    }

    return {
      foodsToRemove: [...foodsToRemove.values()],
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
      if (distance < CollisionDetector.AGENT_RADIUS + food.radius) {
        // 碰撞检测成功
        foodsToRemove.push(food);
        
        // 增加奖励和动机
        agent.totalReward += food.nutritionValue;
        agent.motivation = Math.min(1, agent.motivation + 0.3);
        agent.health = Math.min(100, agent.health + food.nutritionValue);
        agent.energy = Math.min(100, agent.energy + food.nutritionValue);
        
        reward += food.nutritionValue;
        
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
      const nearestX = Math.max(obstacle.x - obstacle.radius, Math.min(agent.x, obstacle.x + obstacle.radius));
      const nearestY = Math.max(obstacle.y - obstacle.radius, Math.min(agent.y, obstacle.y + obstacle.radius));
      const dx = agent.x - nearestX;
      const dy = agent.y - nearestY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < CollisionDetector.AGENT_RADIUS) {
        const pushDistance = CollisionDetector.AGENT_RADIUS - distance + 1;

        if (distance > 0) {
          agent.x += (dx / distance) * pushDistance;
          agent.y += (dy / distance) * pushDistance;
        } else {
          const fromCenterX = agent.x - obstacle.x;
          const fromCenterY = agent.y - obstacle.y;
          if (Math.abs(fromCenterX) > Math.abs(fromCenterY)) {
            agent.x += Math.sign(fromCenterX || 1) * pushDistance;
          } else {
            agent.y += Math.sign(fromCenterY || 1) * pushDistance;
          }
        }
        
        // 减少健康值和增加压力
        agent.health = Math.max(0, agent.health - 5);
        agent.stress = Math.min(1, agent.stress + 0.2);
        agent.collisionCount++;
        
        collisions++;
        
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
      if (agent.id >= otherAgent.id) continue;
      
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
        
        // 增加压力
        agent.stress = Math.min(1, agent.stress + 0.1);
        otherAgent.stress = Math.min(1, otherAgent.stress + 0.1);
        
        agent.collisionCount++;
        otherAgent.collisionCount++;
        
        collisions++;
        
      }
    }

    return collisions;
  }

  /**
   * 移除被吃掉的食物
   */
  public removeFoods(foods: Food[], foodsToRemove: Food[]): Food[] {
    return foods.filter(food => !foodsToRemove.some(removeFood => removeFood.id === food.id));
  }
} 
