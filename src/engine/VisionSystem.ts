/**
 * 视觉系统类
 * 负责智能体的视觉感知处理
 */

import { Agent, VisionCell, Food, Obstacle } from '../types/simulation';

export class VisionSystem {
  private readonly VISION_RANGE = 250;
  private readonly VISION_ANGLE = Math.PI * 2 / 3; // 120度视野
  private readonly VISION_CELLS = 36; // 36个视野格子

  /**
   * 初始化智能体的视野格子
   */
  public initializeVisionCells(agent: Agent): void {
    agent.visionCells = [];
    const angleStep = this.VISION_ANGLE / this.VISION_CELLS;
    const startAngle = -this.VISION_ANGLE / 2;
    
    // 视野格子渲染时与智能体中心的偏移量
    const renderingOffset = 13; 

    for (let i = 0; i < this.VISION_CELLS; i++) {
      const cellAngle = startAngle + i * angleStep + angleStep / 2;
      const worldAngleForRendering = agent.angle + cellAngle;
      
      const visionCell: VisionCell = {
        angle: cellAngle,
        x: agent.x + Math.cos(worldAngleForRendering) * renderingOffset,
        y: agent.y + Math.sin(worldAngleForRendering) * renderingOffset,
        color: { r: 0, g: 0, b: 0 },
        closestDistance: Infinity
      };
      
      agent.visionCells.push(visionCell);
    }
  }

  /**
   * 更新智能体的视野格子
   */
  public updateVisionCells(agent: Agent, agents: Agent[], foods: Food[], obstacles: Obstacle[]): void {
    if (!agent.visionCells || agent.visionCells.length === 0) {
      console.warn('Agent has no vision cells:', agent.id);
      return;
    }

    const angleStep = this.VISION_ANGLE / this.VISION_CELLS;
    const startAngleOfVisionCone = -this.VISION_ANGLE / 2;
    const renderingOffset = 22;

    // 1. 初始化所有视野格子
    for (let i = 0; i < this.VISION_CELLS; i++) {
      const cell = agent.visionCells[i];
      const cellCenterAngle = startAngleOfVisionCone + i * angleStep + angleStep / 2;
      
      const sampleWorldAngle = agent.angle + cellCenterAngle;
      cell.x = agent.x + Math.cos(sampleWorldAngle) * renderingOffset;
      cell.y = agent.y + Math.sin(sampleWorldAngle) * renderingOffset;

      cell.color = { r: 0.5, g: 0.8, b: 1.0 }; // 背景色
      cell.closestDistance = Infinity;
    }

    // 2. 收集视野范围内的所有元素
    const visibleElements = this.getVisibleElements(agent, agents, foods, obstacles);

    // 3. 遍历可见元素，更新受影响的视野格子
    for (const element of visibleElements) {
      const dx = element.x - agent.x;
      const dy = element.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const elementRadius = element.type === 'agent' ? 15 : element.radius;
      const angularRange = this.getAngularRangeOfElement(agent.angle, agent.x, agent.y, element.x, element.y, elementRadius);

      for (let i = 0; i < this.VISION_CELLS; i++) {
        const cell = agent.visionCells[i];
        const cellStartAngle = this.normalizeAngle(startAngleOfVisionCone + i * angleStep);
        const cellEndAngle = this.normalizeAngle(startAngleOfVisionCone + (i + 1) * angleStep);
        
        if (this.anglesOverlap(angularRange.start, angularRange.end, cellStartAngle, cellEndAngle) &&
            distance - elementRadius <= this.VISION_RANGE) {

          if (distance < cell.closestDistance!) {
            cell.closestDistance = distance;
            cell.color = {
              r: element.color.r,
              g: element.color.g,
              b: element.color.b,
            };
          }
        }
      }
    }
    
    // 应用模糊效果和更新视觉输入
    this.applyVisionBlur(agent);
    this.updateVisualInput(agent);
  }

  /**
   * 获取视野范围内的可见元素
   */
  private getVisibleElements(agent: Agent, agents: Agent[], foods: Food[], obstacles: Obstacle[]): Array<{x: number, y: number, color: {r: number, g: number, b: number}, type: string, id: number, radius: number}> {
    const visibleElements: Array<{x: number, y: number, color: {r: number, g: number, b: number}, type: string, id: number, radius: number}> = [];

    // 检查其他智能体
    for (const otherAgent of agents) {
      if (otherAgent.id === agent.id) continue;
      
      const dx = otherAgent.x - agent.x;
      const dy = otherAgent.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= this.VISION_RANGE + 15) {
        const angleToOther = Math.atan2(dy, dx);
        const relativeAngle = this.normalizeAngle(angleToOther - agent.angle);
        
        if (Math.abs(relativeAngle) <= this.VISION_ANGLE / 2) {
          visibleElements.push({
            x: otherAgent.x,
            y: otherAgent.y,
            color: { r: 0.2, g: 0.4, b: 0.8 },
            type: 'agent',
            id: otherAgent.id,
            radius: 15
          });
        }
      }
    }

    // 检查食物
    for (const food of foods) {
      const dx = food.x - agent.x;
      const dy = food.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= this.VISION_RANGE + food.radius) {
        const angleToFood = Math.atan2(dy, dx);
        const relativeAngle = this.normalizeAngle(angleToFood - agent.angle);
        
        if (Math.abs(relativeAngle) <= this.VISION_ANGLE / 2) {
          visibleElements.push({
            x: food.x,
            y: food.y,
            color: { r: 0.2, g: 0.8, b: 0.2 },
            type: 'food',
            id: food.id,
            radius: food.radius
          });
        }
      }
    }

    // 检查障碍物
    for (const obstacle of obstacles) {
      const dx = obstacle.x - agent.x;
      const dy = obstacle.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= this.VISION_RANGE + obstacle.radius) {
        const angleToObstacle = Math.atan2(dy, dx);
        const relativeAngle = this.normalizeAngle(angleToObstacle - agent.angle);
        
        if (Math.abs(relativeAngle) <= this.VISION_ANGLE / 2) {
          const color = obstacle.isMoving ? 
            { r: 0.5, g: 0.5, b: 0.5 } : 
            { r: 0.3, g: 0.3, b: 0.3 };
          
          visibleElements.push({
            x: obstacle.x,
            y: obstacle.y,
            color: color,
            type: 'obstacle',
            id: obstacle.id,
            radius: obstacle.radius
          });
        }
      }
    }

    return visibleElements;
  }

  /**
   * 计算元素在智能体视野中的角度范围
   */
  private getAngularRangeOfElement(
    agentAngle: number,
    agentX: number,
    agentY: number,
    elementX: number,
    elementY: number,
    elementRadius: number
  ): { start: number; end: number } {
    const dx = elementX - agentX;
    const dy = elementY - agentY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
      return { start: 0, end: 0 };
    }
    
    const angleToCenter = Math.atan2(dy, dx);
    const relativeAngleToCenter = this.normalizeAngle(angleToCenter - agentAngle);
    
    const angularSize = Math.asin(Math.min(elementRadius / distance, 1));
    
    return {
      start: this.normalizeAngle(relativeAngleToCenter - angularSize),
      end: this.normalizeAngle(relativeAngleToCenter + angularSize)
    };
  }

  /**
   * 标准化角度到 [-π, π] 范围
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * 检查两个角度范围是否重叠
   */
  private anglesOverlap(
    range1Start: number,
    range1End: number,
    range2Start: number,
    range2End: number
  ): boolean {
    const normalizeRange = (start: number, end: number) => {
      if (start > end) {
        return [{ start: start, end: Math.PI }, { start: -Math.PI, end: end }];
      }
      return [{ start: start, end: end }];
    };
    
    const ranges1 = normalizeRange(range1Start, range1End);
    const ranges2 = normalizeRange(range2Start, range2End);
    
    for (const r1 of ranges1) {
      for (const r2 of ranges2) {
        if (r1.start <= r2.end && r2.start <= r1.end) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 应用视觉模糊效果
   */
  private applyVisionBlur(agent: Agent): void {
    if (!agent.visionCells || agent.visionCells.length === 0) return;

    const originalColors = agent.visionCells.map(cell => ({ ...cell.color }));
    const blurRadius = 1;

    for (let i = 0; i < agent.visionCells.length; i++) {
      let totalR = 0, totalG = 0, totalB = 0;
      let count = 0;

      for (let j = Math.max(0, i - blurRadius); j <= Math.min(agent.visionCells.length - 1, i + blurRadius); j++) {
        const weight = 1.0 / (1.0 + Math.abs(i - j));
        totalR += originalColors[j].r * weight;
        totalG += originalColors[j].g * weight;
        totalB += originalColors[j].b * weight;
        count += weight;
      }

      agent.visionCells[i].color = {
        r: totalR / count,
        g: totalG / count,
        b: totalB / count
      };
    }
  }

  /**
   * 更新智能体的视觉输入向量
   */
  private updateVisualInput(agent: Agent): void {
    agent.visualInput = [];
    for (const cell of agent.visionCells) {
      agent.visualInput.push(cell.color.r, cell.color.g, cell.color.b);
    }
  }

  // Getters
  public get visionRange(): number {
    return this.VISION_RANGE;
  }

  public get visionAngle(): number {
    return this.VISION_ANGLE;
  }

  public get visionCells(): number {
    return this.VISION_CELLS;
  }
} 