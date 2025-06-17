/**
 * 仿真引擎核心类
 * 基于PixiJS的浮游生物智能体仿真系统
 */

import * as PIXI from 'pixi.js';
import { Agent, Food, Obstacle, VisionCell, SimulationState } from '../types/simulation';
import { CorticalColumn } from './CorticalColumn';
import { WorldRenderer } from './WorldRenderer';

export class SimulationEngine {
  private app: PIXI.Application;
  private renderer: WorldRenderer;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private fps: number = 0;
  private simulationTime: number = 0;
  private frameCount: number = 0;
  
  // 智能体和环境
  private agents: Agent[] = [];
  private foods: Food[] = [];
  private obstacles: Obstacle[] = [];
  private corticalColumns: Map<number, CorticalColumn> = new Map();
  
  // 主控智能体（SNN控制）
  private mainAgentId: number = 0;
  
  // 键盘输入状态
  private keyStates: { [key: string]: boolean } = {};
  
  // 世界参数
  private worldWidth: number = 1600;
  private worldHeight: number = 1200;
  
  // 视野参数
  private readonly VISION_RANGE = 250; // 视野距离 - 扩大十倍，用于显示大范围虚线
  private readonly VISION_ANGLE = Math.PI * 2 / 3; // 120度视野
  private readonly VISION_CELLS = 36; // 36个视野格子
  
  // 统计数据
  private stats = {
    totalRewards: 0,
    totalCollisions: 0,
    averageEmotionState: { pleasure: 0, arousal: 0 }
  };

  // 回调函数
  public onStatsUpdate?: (stats: any) => void;

  constructor(app: PIXI.Application, initialWidth: number = 1600, initialHeight: number = 1200) {
    this.app = app;
    this.worldWidth = initialWidth;
    this.worldHeight = initialHeight;
    this.renderer = new WorldRenderer(app);
    this.setupKeyboardControls();
  }

  private setupKeyboardControls(): void {
    window.addEventListener('keydown', (e) => {
      this.keyStates[e.key.toLowerCase()] = true;
    });
    
    window.addEventListener('keyup', (e) => {
      this.keyStates[e.key.toLowerCase()] = false;
    });
  }

  public updateWorldDimensions(newWidth: number, newHeight: number): void {
    this.worldWidth = newWidth;
    this.worldHeight = newHeight;
  }

  initialize(): void {
    console.log('初始化仿真系统...');
    
    this.createAgents();
    this.generateFood();
    this.generateObstacles();
    
    // 设置镜头跟随主智能体
    const mainAgent = this.getMainAgent();
    if (mainAgent) {
      this.setCameraTarget(mainAgent);
    }
    
    this.renderer.renderWorld({
      width: this.worldWidth,
      height: this.worldHeight,
      wallThickness: 0,
      agents: this.agents,
      foods: this.foods,
      obstacles: this.obstacles,
      visionRange: this.VISION_RANGE,
      visionAngle: this.VISION_ANGLE
    });
    
    console.log(`仿真系统初始化完成: ${this.agents.length}个智能体`);
  }

  private createAgents(): void {
    const agentCount = 5;
    
    for (let i = 0; i < agentCount; i++) {
      let x, y;
      
      if (i === 0) {
        // 主智能体放在世界中心附近
        x = this.worldWidth / 2 + (Math.random() - 0.5) * 200;
        y = this.worldHeight / 2 + (Math.random() - 0.5) * 200;
      } else {
        // 其他智能体随机位置
        x = Math.random() * this.worldWidth;
        y = Math.random() * this.worldHeight;
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
        visualInput: new Array(108).fill(0), // 36个格子 × 3个颜色通道 = 108
        controlType: i === 0 ? 'snn' : 'random', // 第一个智能体用SNN控制
        pleasure: 0,
        arousal: 0.5,
        totalReward: 0,
        collisionCount: 0
      };
      
      // 初始化视野格子
      this.initializeVisionCells(agent);
      
      this.agents.push(agent);
      
      // 为SNN控制的智能体创建神经网络
      if (agent.controlType === 'snn') {
        this.corticalColumns.set(agent.id, new CorticalColumn({
          inputSize: 108, // 36个格子 × 3个颜色通道 = 108
          hiddenSizes: [128, 64, 32],
          outputSize: 3,
          dt: 0.01
        }));
        console.log('Created SNN agent:', agent.id, 'at position:', agent.x, agent.y);
        console.log('Vision cells created:', agent.visionCells.length);
      }
    }
    
    console.log('Total agents created:', this.agents.length);
    console.log('Main agent (SNN):', this.getMainAgent());
  }

  private initializeVisionCells(agent: Agent): void {
    agent.visionCells = [];
    const angleStep = this.VISION_ANGLE / this.VISION_CELLS;
    const startAngle = -this.VISION_ANGLE / 2;
    
    // 视野格子渲染时与智能体中心的偏移量，与WorldRenderer中的visionCellOffset保持一致
    const renderingOffset = 13; 

    for (let i = 0; i < this.VISION_CELLS; i++) {
      const cellAngle = startAngle + i * angleStep + angleStep / 2; // 视野格子相对于智能体前方的角度
      const worldAngleForRendering = agent.angle + cellAngle; // 用于计算渲染位置的世界角度
      
      const visionCell: VisionCell = {
        angle: cellAngle, // 保存相对角度
        x: agent.x + Math.cos(worldAngleForRendering) * renderingOffset, // 初始化渲染位置
        y: agent.y + Math.sin(worldAngleForRendering) * renderingOffset, // 初始化渲染位置
        color: { r: 0, g: 0, b: 0 },
        closestDistance: Infinity // 初始化为无限远
      };
      
      agent.visionCells.push(visionCell);
    }
  }

  private updateVisionCells(agent: Agent): void {
    if (!agent.visionCells || agent.visionCells.length === 0) {
      console.warn('Agent has no vision cells:', agent.id);
      return;
    }

    const angleStep = this.VISION_ANGLE / this.VISION_CELLS;
    const startAngleOfVisionCone = -this.VISION_ANGLE / 2;
    const renderingOffset = 22; // 与WorldRenderer中的visionRingRadius保持一致

    // 1. 初始化所有视野格子
    for (let i = 0; i < this.VISION_CELLS; i++) {
      const cell = agent.visionCells[i];
      const cellCenterAngle = startAngleOfVisionCone + i * angleStep + angleStep / 2;
      
      // 更新视野格子的渲染位置
      const sampleWorldAngle = agent.angle + cellCenterAngle;
      cell.x = agent.x + Math.cos(sampleWorldAngle) * renderingOffset;
      cell.y = agent.y + Math.sin(sampleWorldAngle) * renderingOffset;

      // 重置颜色和最近距离
      cell.color = { r: 0.5, g: 0.8, b: 1.0 }; // 背景色
      cell.closestDistance = Infinity;
    }

    // 2. 收集视野范围内的所有元素
    const visibleElements = this.getVisibleElements(agent);

    // 3. 遍历可见元素，更新受影响的视野格子
    for (const element of visibleElements) {
      // 计算元素相对于智能体的世界坐标和距离
      const dx = element.x - agent.x;
      const dy = element.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 获取元素的半径（智能体为15，食物/障碍物从自身属性获取）
      const elementRadius = element.type === 'agent' ? 15 : element.radius;

      // 计算元素在智能体视野中的角度范围（考虑半径）
      const angularRange = this.getAngularRangeOfElement(agent.angle, agent.x, agent.y, element.x, element.y, elementRadius);

      // 遍历所有视野格子，检查是否与元素的角范围重叠
      for (let i = 0; i < this.VISION_CELLS; i++) {
        const cell = agent.visionCells[i];
        const cellStartAngle = this.normalizeAngle(startAngleOfVisionCone + i * angleStep);
        const cellEndAngle = this.normalizeAngle(startAngleOfVisionCone + (i + 1) * angleStep);
        
        // 检查元素是否在当前视野格子的角范围和距离范围内
        if (this.anglesOverlap(angularRange.start, angularRange.end, cellStartAngle, cellEndAngle) &&
            distance - elementRadius <= this.VISION_RANGE) { // 确保元素在视野距离内

          // 如果当前元素比该视野格子目前检测到的元素更近
          if (distance < cell.closestDistance!) { // ! 用于告诉TypeScript closestDistance已被初始化
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
    
    // 应用模糊效果（邻域加权平均）
    this.applyVisionBlur(agent);
    
    // 更新视觉输入
    this.updateVisualInput(agent);
    
    // 仅对主智能体添加调试信息
    if (agent.controlType === 'snn' && this.frameCount % 60 === 0) {
      const allElementsInRange: Array<{type: string, id: number, distance: string}> = [];
      const elementsInVision: Array<{type: string, id: number, distance: string, angle: string}> = [];
      
      // 统计距离范围内的食物
      this.foods.forEach(food => {
        const dx = food.x - agent.x;
        const dy = food.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= this.VISION_RANGE + food.radius) {
          allElementsInRange.push({
            type: 'food',
            id: food.id,
            distance: distance.toFixed(1)
          });
          
          // 检查是否在视野角度内
          const angleToElement = Math.atan2(dy, dx);
          const relativeAngle = this.normalizeAngle(angleToElement - agent.angle);
          if (Math.abs(relativeAngle) <= this.VISION_ANGLE / 2) {
            elementsInVision.push({
              type: 'food',
              id: food.id,
              distance: distance.toFixed(1),
              angle: (relativeAngle * 180 / Math.PI).toFixed(1)
            });
          }
        }
      });
      
      // 统计距离范围内的障碍物
      this.obstacles.forEach(obstacle => {
        const dx = obstacle.x - agent.x;
        const dy = obstacle.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= this.VISION_RANGE + obstacle.radius) {
          allElementsInRange.push({
            type: 'obstacle',
            id: obstacle.id,
            distance: distance.toFixed(1)
          });
          
          // 检查是否在视野角度内
          const angleToElement = Math.atan2(dy, dx);
          const relativeAngle = this.normalizeAngle(angleToElement - agent.angle);
          if (Math.abs(relativeAngle) <= this.VISION_ANGLE / 2) {
            elementsInVision.push({
              type: 'obstacle',
              id: obstacle.id,
              distance: distance.toFixed(1),
              angle: (relativeAngle * 180 / Math.PI).toFixed(1)
            });
          }
        }
      });
      
      // 统计距离范围内的其他智能体
      this.agents.filter(a => a.id !== agent.id).forEach(otherAgent => {
        const dx = otherAgent.x - agent.x;
        const dy = otherAgent.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= this.VISION_RANGE + 15) {
          allElementsInRange.push({
            type: 'agent',
            id: otherAgent.id,
            distance: distance.toFixed(1)
          });
          
          // 检查是否在视野角度内
          const angleToElement = Math.atan2(dy, dx);
          const relativeAngle = this.normalizeAngle(angleToElement - agent.angle);
          if (Math.abs(relativeAngle) <= this.VISION_ANGLE / 2) {
            elementsInVision.push({
              type: 'agent',
              id: otherAgent.id,
              distance: distance.toFixed(1),
              angle: (relativeAngle * 180 / Math.PI).toFixed(1)
            });
          }
        }
      });
      
      console.log('Vision Debug:', {
        position: { x: agent.x.toFixed(1), y: agent.y.toFixed(1) },
        angle: (agent.angle * 180 / Math.PI).toFixed(1),
        visionAngle: (this.VISION_ANGLE * 180 / Math.PI).toFixed(1),
        elementsInRange: allElementsInRange.length,
        elementsInVision: elementsInVision.length,
        visibleElements: visibleElements.length,
        detailsInRange: allElementsInRange,
        detailsInVision: elementsInVision,
        visionCells: agent.visionCells.map((cell, idx) => ({
          index: idx,
          angle: (((startAngleOfVisionCone) + (idx + 0.5) * (this.VISION_ANGLE / this.VISION_CELLS)) * 180 / Math.PI).toFixed(1),
          color: {
            r: cell.color.r.toFixed(2),
            g: cell.color.g.toFixed(2),
            b: cell.color.b.toFixed(2)
          },
          dist: cell.closestDistance?.toFixed(1) || 'N/A'
        }))
      });
    }
  }

  // 辅助函数：计算元素相对于智能体的角度范围
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

    if (distance <= elementRadius) {
      // 元素在智能体内部或完全覆盖智能体，则覆盖整个视野
      return { start: -Math.PI, end: Math.PI };
    }

    const angleToCenter = Math.atan2(dy, dx); // 元素中心的世界角度

    // 计算切线角度
    const tangentAngleOffset = Math.asin(elementRadius / distance);

    let startAngle = this.normalizeAngle(angleToCenter - tangentAngleOffset - agentAngle);
    let endAngle = this.normalizeAngle(angleToCenter + tangentAngleOffset - agentAngle);

    // 如果结束角度小于开始角度（跨越-PI/PI边界），则交换
    if (endAngle < startAngle) {
      [startAngle, endAngle] = [endAngle, startAngle];
    }
    
    return { start: startAngle, end: endAngle };
  }

  // 辅助函数：标准化角度到 [-PI, PI] 范围
  private normalizeAngle(angle: number): number {
    let normalized = angle;
    while (normalized <= -Math.PI) normalized += 2 * Math.PI;
    while (normalized > Math.PI) normalized -= 2 * Math.PI;
    return normalized;
  }

  // 辅助函数：检查两个角度范围是否重叠
  private anglesOverlap(
    range1Start: number,
    range1End: number,
    range2Start: number,
    range2End: number
  ): boolean {
    // 确保角度在 [-PI, PI] 范围内
    range1Start = this.normalizeAngle(range1Start);
    range1End = this.normalizeAngle(range1End);
    range2Start = this.normalizeAngle(range2Start);
    range2End = this.normalizeAngle(range2End);

    // 处理范围跨越 -PI/PI 边界的情况
    const isRange1Wrapped = range1Start > range1End;
    const isRange2Wrapped = range2Start > range2End;

    if (isRange1Wrapped && isRange2Wrapped) {
      // 两个范围都跨越边界，检查它们各自的两个部分是否有重叠
      return this.anglesOverlap(range1Start, Math.PI, range2Start, Math.PI) ||
             this.anglesOverlap(-Math.PI, range1End, -Math.PI, range2End) ||
             this.anglesOverlap(range1Start, Math.PI, -Math.PI, range2End) ||
             this.anglesOverlap(-Math.PI, range1End, range2Start, Math.PI);
    } else if (isRange1Wrapped) {
      // 范围1跨越边界，检查范围2是否与范围1的任意部分重叠
      return (range2Start <= range1End || range2End >= range1Start) ||
             (range2Start >= range1Start && range2End <= Math.PI) ||
             (range2Start >= -Math.PI && range2End <= range1End);
    } else if (isRange2Wrapped) {
      // 范围2跨越边界，检查范围1是否与范围2的任意部分重叠
      return (range1Start <= range2End || range1End >= range2Start) ||
             (range1Start >= range2Start && range1End <= Math.PI) ||
             (range1Start >= -Math.PI && range1End <= range2End);
    } else {
      // 都不跨越边界，标准重叠检查
      return Math.max(range1Start, range2Start) <= Math.min(range1End, range2End);
    }
  }

  private getVisibleElements(agent: Agent): Array<{x: number, y: number, color: {r: number, g: number, b: number}, type: string, id: number, radius: number}> {
    const visibleElements: Array<{x: number, y: number, color: {r: number, g: number, b: number}, type: string, id: number, radius: number}> = [];
    
    // 视野角度范围
    const halfVisionAngle = this.VISION_ANGLE / 2;
    
    // 添加视野范围内的食物
    for (const food of this.foods) {
      const dx = food.x - agent.x;
      const dy = food.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 首先检查距离
      if (distance <= this.VISION_RANGE + food.radius) {
        // 计算元素相对于智能体的角度
        const angleToElement = Math.atan2(dy, dx);
        const relativeAngle = this.normalizeAngle(angleToElement - agent.angle);
        
        // 检查是否在视野角度范围内
        if (Math.abs(relativeAngle) <= halfVisionAngle) {
          visibleElements.push({
            x: food.x,
            y: food.y,
            color: { r: 0, g: 1, b: 0 }, // 绿色食物
            type: 'food',
            id: food.id,
            radius: food.radius
          });
        }
      }
    }
    
    // 添加视野范围内的障碍物
    for (const obstacle of this.obstacles) {
      const dx = obstacle.x - agent.x;
      const dy = obstacle.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 首先检查距离
      if (distance <= this.VISION_RANGE + obstacle.radius) {
        // 计算元素相对于智能体的角度
        const angleToElement = Math.atan2(dy, dx);
        const relativeAngle = this.normalizeAngle(angleToElement - agent.angle);
        
        // 检查是否在视野角度范围内
        if (Math.abs(relativeAngle) <= halfVisionAngle) {
          visibleElements.push({
            x: obstacle.x,
            y: obstacle.y,
            color: { r: 0, g: 0, b: 0 }, // 黑色障碍物
            type: 'obstacle',
            id: obstacle.id,
            radius: obstacle.radius
          });
        }
      }
    }
    
    // 添加视野范围内的其他智能体（排除自己）
    for (const otherAgent of this.agents) {
      if (otherAgent.id === agent.id) continue; // 跳过自己
      
      const dx = otherAgent.x - agent.x;
      const dy = otherAgent.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 首先检查距离（考虑智能体半径15）
      if (distance <= this.VISION_RANGE + 15) {
        // 计算元素相对于智能体的角度
        const angleToElement = Math.atan2(dy, dx);
        const relativeAngle = this.normalizeAngle(angleToElement - agent.angle);
        
        // 检查是否在视野角度范围内
        if (Math.abs(relativeAngle) <= halfVisionAngle) {
          visibleElements.push({
            x: otherAgent.x,
            y: otherAgent.y,
            color: { r: 0.2, g: 0.6, b: 0.9 }, // 蓝色智能体
            type: 'agent',
            id: otherAgent.id,
            radius: 15
          });
        }
      }
    }
    
    return visibleElements;
  }

  private applyVisionBlur(agent: Agent): void {
    if (!agent.visionCells || agent.visionCells.length === 0) return;
    
    // 创建原始颜色的副本
    const originalColors = agent.visionCells.map(cell => ({
      r: cell.color.r,
      g: cell.color.g,
      b: cell.color.b
    }));
    
    // 对每个视野格子应用模糊
    for (let i = 0; i < agent.visionCells.length; i++) {
      const cell = agent.visionCells[i];
      
      // 获取左邻居和右邻居的索引（环形）
      const leftIndex = (i - 1 + agent.visionCells.length) % agent.visionCells.length;
      const rightIndex = (i + 1) % agent.visionCells.length;
      
      // 加权平均：自身0.6，左邻域0.2，右邻域0.2
      cell.color = {
        r: originalColors[i].r * 0.6 + originalColors[leftIndex].r * 0.2 + originalColors[rightIndex].r * 0.2,
        g: originalColors[i].g * 0.6 + originalColors[leftIndex].g * 0.2 + originalColors[rightIndex].g * 0.2,
        b: originalColors[i].b * 0.6 + originalColors[leftIndex].b * 0.2 + originalColors[rightIndex].b * 0.2
      };
    }
  }

  private getColorAtPosition(x: number, y: number): { r: number; g: number; b: number } {
    // 默认背景色（天空蓝）
    const backgroundColor = { r: 0.5, g: 0.8, b: 1.0 };
    
    // 检查食物（优先级最高）
    for (const food of this.foods) {
      const dx = x - food.x;
      const dy = y - food.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < food.radius) {
        return { r: 0, g: 1, b: 0 }; // 绿色食物
      }
    }
    
    // 检查障碍物
    for (const obstacle of this.obstacles) {
      const dx = x - obstacle.x;
      const dy = y - obstacle.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < obstacle.radius) {
        return { r: 0, g: 0, b: 0 }; // 黑色障碍物
      }
    }
    
    // 检查智能体
    for (const otherAgent of this.agents) {
      const dx = x - otherAgent.x;
      const dy = y - otherAgent.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 15) { // 智能体半径（与渲染器中的尺寸匹配）
        return { r: 0.2, g: 0.6, b: 0.9 }; // 蓝色智能体
      }
    }
    
    // 没有检测到任何物体，返回背景颜色
    return backgroundColor;
  }

  private updateVisualInput(agent: Agent): void {
    for (let i = 0; i < this.VISION_CELLS; i++) {
      const cell = agent.visionCells[i];
      agent.visualInput[i * 3] = cell.color.r;
      agent.visualInput[i * 3 + 1] = cell.color.g;
      agent.visualInput[i * 3 + 2] = cell.color.b;
    }
  }

  private generateFood(): void {
    this.foods = [];
    const foodCount = 15;
    
    // 获取主智能体位置（用于测试）
    const mainAgent = this.agents.find(agent => agent.controlType === 'snn');
    
    for (let i = 0; i < foodCount; i++) {
      let x, y;
      
      // 前5个食物用于测试视野角度限制
      if (i < 5 && mainAgent) {
        if (i === 0) {
          // 正前方
          const angle = mainAgent.angle;
          const distance = 100;
          x = mainAgent.x + Math.cos(angle) * distance;
          y = mainAgent.y + Math.sin(angle) * distance;
        } else if (i === 1) {
          // 正后方（应该看不到）
          const angle = mainAgent.angle + Math.PI;
          const distance = 100;
          x = mainAgent.x + Math.cos(angle) * distance;
          y = mainAgent.y + Math.sin(angle) * distance;
        } else if (i === 2) {
          // 左侧（视野边缘内）
          const angle = mainAgent.angle - Math.PI / 3; // 60度左侧
          const distance = 100;
          x = mainAgent.x + Math.cos(angle) * distance;
          y = mainAgent.y + Math.sin(angle) * distance;
        } else if (i === 3) {
          // 右侧（视野边缘内）
          const angle = mainAgent.angle + Math.PI / 3; // 60度右侧
          const distance = 100;
          x = mainAgent.x + Math.cos(angle) * distance;
          y = mainAgent.y + Math.sin(angle) * distance;
        } else {
          // 左侧外（视野边缘外，应该看不到）
          const angle = mainAgent.angle - Math.PI / 2; // 90度左侧
          const distance = 100;
          x = mainAgent.x + Math.cos(angle) * distance;
          y = mainAgent.y + Math.sin(angle) * distance;
        }
        
        // 确保在世界范围内
        x = Math.max(50, Math.min(this.worldWidth - 50, x));
        y = Math.max(50, Math.min(this.worldHeight - 50, y));
      } else {
        // 其他食物随机分布
        x = Math.random() * this.worldWidth;
        y = Math.random() * this.worldHeight;
      }
      
      this.foods.push({
        id: i,
        x: x,
        y: y,
        radius: 8,
        nutritionValue: 10
      });
    }
    
    console.log('Generated foods:', this.foods.length);
    if (mainAgent) {
      console.log('Main agent at:', { x: mainAgent.x.toFixed(1), y: mainAgent.y.toFixed(1), angle: (mainAgent.angle * 180 / Math.PI).toFixed(1) });
      console.log('Test foods positions:', this.foods.slice(0, 5).map(food => ({
        id: food.id,
        x: food.x.toFixed(1),
        y: food.y.toFixed(1),
        distance: Math.sqrt((food.x - mainAgent.x) ** 2 + (food.y - mainAgent.y) ** 2).toFixed(1),
        angle: ((Math.atan2(food.y - mainAgent.y, food.x - mainAgent.x) - mainAgent.angle) * 180 / Math.PI).toFixed(1)
      })));
    }
  }

  private generateObstacles(): void {
    this.obstacles = [];
    // 设置围墙的尺寸和障碍物数量
    const wallThickness = 20; // 围墙的厚度 (单个障碍物的尺寸)
    const wallMargin = 100; // 围墙距离世界边缘的距离
    const innerWidth = this.worldWidth - wallMargin * 2;
    const innerHeight = this.worldHeight - wallMargin * 2;
    const obstacleSize = wallThickness; // 障碍物的尺寸，与厚度一致

    // 计算沿边界放置障碍物的数量
    const numHorizontal = Math.floor(innerWidth / obstacleSize);
    const numVertical = Math.floor(innerHeight / obstacleSize);

    let idCounter = 0;

    // 顶部和底部墙
    for (let i = 0; i < numHorizontal; i++) {
      // 顶部墙
      this.obstacles.push({
        id: idCounter++,
        x: wallMargin + i * obstacleSize + obstacleSize / 2,
        y: wallMargin + obstacleSize / 2,
        radius: obstacleSize / 2, // 半径适用于圆形，但我们绘制方形，这里只是为了碰撞检测
        isMoving: false,
      });
      // 底部墙
      this.obstacles.push({
        id: idCounter++,
        x: wallMargin + i * obstacleSize + obstacleSize / 2,
        y: wallMargin + innerHeight - obstacleSize / 2,
        radius: obstacleSize / 2,
        isMoving: false,
      });
    }

    // 左侧和右侧墙 (避免与顶部/底部墙重复)
    for (let i = 0; i < numVertical; i++) {
      // 左侧墙
      this.obstacles.push({
        id: idCounter++,
        x: wallMargin + obstacleSize / 2,
        y: wallMargin + i * obstacleSize + obstacleSize / 2,
        radius: obstacleSize / 2,
        isMoving: false,
      });
      // 右侧墙
      this.obstacles.push({
        id: idCounter++,
        x: wallMargin + innerWidth - obstacleSize / 2,
        y: wallMargin + i * obstacleSize + obstacleSize / 2,
        radius: obstacleSize / 2,
        isMoving: false,
      });
    }
  }

  start(): void {
    if (this.isRunning) return;
    console.log('启动仿真...');
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  pause(): void {
    this.isPaused = !this.isPaused;
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
  }

  reset(): void {
    this.stop();
    this.simulationTime = 0;
    this.frameCount = 0;
    this.stats = {
      totalRewards: 0,
      totalCollisions: 0,
      averageEmotionState: { pleasure: 0, arousal: 0 }
    };
    
    this.agents = [];
    this.foods = [];
    this.obstacles = [];
    this.corticalColumns.clear();
    this.initialize();
  }

  private gameLoop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.033); // 限制最大deltaTime
    this.lastTime = currentTime;

    if (!this.isPaused) {
      this.updateSimulation(deltaTime);
      this.simulationTime += deltaTime;
      this.frameCount++;
      
      if (this.frameCount % 60 === 0) {
        this.fps = Math.round(1 / deltaTime);
      }
    }

    // 渲染
    this.renderer.renderWorld({
      width: this.worldWidth,
      height: this.worldHeight,
      wallThickness: 0,
      agents: this.agents,
      foods: this.foods,
      obstacles: this.obstacles,
      visionRange: this.VISION_RANGE,
      visionAngle: this.VISION_ANGLE
    });

    requestAnimationFrame(this.gameLoop);
  };

  private updateSimulation(deltaTime: number): void {
    // 更新所有智能体
    for (const agent of this.agents) {
      this.updateAgent(agent, deltaTime);
    }
    
    // 更新移动障碍物 (现在是静态的，此方法为空)
    this.updateMovingObstacles(deltaTime);
    
    // 处理碰撞
    this.handleCollisions();
    
    // 动态生成食物 - 只补充缺少的食物
    const targetFoodCount = 15;
    if (this.foods.length < targetFoodCount) {
      const missingFoodCount = targetFoodCount - this.foods.length;
      for (let i = 0; i < missingFoodCount; i++) {
        const newFood = {
          id: Math.max(...this.foods.map(f => f.id), -1) + 1 + i,
          x: Math.random() * this.worldWidth,
          y: Math.random() * this.worldHeight,
          radius: 8,
          nutritionValue: 10
        };
        this.foods.push(newFood);
      }
    }
    
    // 更新统计数据
    this.updateStats();
  }

  private updateAgent(agent: Agent, deltaTime: number): void {
    // 更新视野
    this.updateVisionCells(agent);
    
    if (agent.controlType === 'snn') {
      this.updateSNNAgent(agent, deltaTime);
    } else {
      this.updateRandomAgent(agent, deltaTime);
    }
    
    // 应用物理运动
    agent.x += agent.velocity.x * deltaTime;
    agent.y += agent.velocity.y * deltaTime;
    
    // 边界处理（循环世界）
    agent.x = ((agent.x % this.worldWidth) + this.worldWidth) % this.worldWidth;
    agent.y = ((agent.y % this.worldHeight) + this.worldHeight) % this.worldHeight;
    
    // 情绪衰减
    agent.pleasure *= 0.99;
    agent.arousal = Math.max(0.1, agent.arousal * 0.995);
  }

  private updateSNNAgent(agent: Agent, deltaTime: number): void {
    const corticalColumn = this.corticalColumns.get(agent.id);
    if (!corticalColumn) return;
    
    // 应用情绪调节到神经网络
    const synapticScaling = 0.8 + agent.pleasure * 0.4; // [0.8, 1.2]
    const thresholdAdjustment = (agent.arousal - 0.5) * 10; // [-5, 5]
    corticalColumn.applyEmotionModulation(synapticScaling, thresholdAdjustment);
    
    // 处理键盘输入
    const keyboardAction = this.getKeyboardAction();
    
    if (keyboardAction.action !== 'none') {
      // 直接设置神经元输出
      const output = [0, 0, 0];
      switch (keyboardAction.action) {
        case 'turnLeft':
          output[0] = 1;
          break;
        case 'turnRight':
          output[1] = 1;
          break;
        case 'moveForward':
          output[2] = 1;
          break;
      }
      this.applyAction(agent, output, deltaTime);
    } else {
      // 使用神经网络决策 - 运行多次迭代获得稳定输出
      let output = [0, 0, 0];
      const iterations = 5; // 运行5次迭代
      
      for (let i = 0; i < iterations; i++) {
        const iterOutput = corticalColumn.forward(agent.visualInput);
        // 累积输出
        for (let j = 0; j < 3; j++) {
          output[j] += iterOutput[j];
        }
      }
      
      // 平均化输出
      output = output.map(val => val / iterations);
      
      // 添加调试信息（每秒一次）
      if (this.frameCount % 60 === 0) {
        console.log('SNN Agent Decision:', {
          visualInput: agent.visualInput.slice(0, 6), // 只显示前两个格子的RGB
          output: output,
          emotion: { pleasure: agent.pleasure, arousal: agent.arousal },
          synapticScaling: 0.8 + agent.pleasure * 0.4,
          thresholdAdjustment: (agent.arousal - 0.5) * 10
        });
      }
      
      this.applyAction(agent, output, deltaTime);
    }
  }

  private getKeyboardAction(): { action: string } {
    if (this.keyStates['arrowup'] || this.keyStates['w']) {
      return { action: 'moveForward' };
    }
    if (this.keyStates['arrowleft'] || this.keyStates['a']) {
      return { action: 'turnLeft' };
    }
    if (this.keyStates['arrowright'] || this.keyStates['d']) {
      return { action: 'turnRight' };
    }
    return { action: 'none' };
  }

  private updateRandomAgent(agent: Agent, deltaTime: number): void {
    // 简单的随机游走
    if (Math.random() < 0.02) { // 2%概率改变方向
      agent.angle += (Math.random() - 0.5) * 0.5;
    }
    
    // 设定前进速度 - 与主智能体保持一致
    const speed = 40;
    agent.velocity.x = Math.cos(agent.angle) * speed;
    agent.velocity.y = Math.sin(agent.angle) * speed;
  }

  private applyAction(agent: Agent, output: number[], deltaTime: number): void {
    const [turnLeft, turnRight, moveForward] = output;
    
    // 转向 - 使用更平滑的控制
    const turnSpeed = 3.0;
    const turnThreshold = 0.3;
    
    if (turnLeft > turnThreshold) {
      agent.angle -= turnSpeed * turnLeft * deltaTime;
    }
    if (turnRight > turnThreshold) {
      agent.angle += turnSpeed * turnRight * deltaTime;
    }
    
    // 前进 - 基于输出强度
    const maxSpeed = 60;
    const moveThreshold = 0.2;
    const speed = moveForward > moveThreshold ? maxSpeed * moveForward : 0;
    
    agent.velocity.x = Math.cos(agent.angle) * speed;
    agent.velocity.y = Math.sin(agent.angle) * speed;
  }

  private updateMovingObstacles(deltaTime: number): void {
    // 障碍物现在是静态的，不需要更新
  }

  private handleCollisions(): void {
    for (const agent of this.agents) {
      // 食物碰撞
      for (let i = this.foods.length - 1; i >= 0; i--) {
        const food = this.foods[i];
        const dx = agent.x - food.x;
        const dy = agent.y - food.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 15 + food.radius) {
          agent.totalReward += food.nutritionValue;
          agent.pleasure = Math.min(1, agent.pleasure + 0.2);
          this.foods.splice(i, 1);
        }
      }
      
      // 障碍物碰撞
      for (const obstacle of this.obstacles) {
        const dx = agent.x - obstacle.x;
        const dy = agent.y - obstacle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 智能体半径15 + 障碍物半径
        if (distance < 15 + obstacle.radius) {
          agent.collisionCount++;
          agent.arousal = Math.min(1, agent.arousal + 0.1);
          
          // 反弹：将智能体推开障碍物
          const angle = Math.atan2(dy, dx);
          agent.x = obstacle.x + Math.cos(angle) * (15 + obstacle.radius + 1); // 额外加1像素避免卡住
          agent.y = obstacle.y + Math.sin(angle) * (15 + obstacle.radius + 1);

          // 减速以模拟碰撞效果
          agent.velocity.x *= -0.5;
          agent.velocity.y *= -0.5;
        }
      }
    }
  }

  private updateStats(): void {
    const mainAgent = this.getMainAgent();
    if (mainAgent) {
      this.stats.totalRewards = mainAgent.totalReward;
      this.stats.totalCollisions = mainAgent.collisionCount;
      this.stats.averageEmotionState = {
        pleasure: mainAgent.pleasure,
        arousal: mainAgent.arousal
      };
    }
    
    if (this.onStatsUpdate) {
      this.onStatsUpdate({
        fps: this.fps,
        totalReward: this.stats.totalRewards,
        collisionCount: this.stats.totalCollisions,
        emotionState: this.stats.averageEmotionState
      });
    }
  }

  // 获取主智能体用于镜头跟随
  getMainAgent(): Agent | null {
    return this.agents.find(agent => agent.id === this.mainAgentId) || null;
  }

  // 设置镜头跟随目标
  setCameraTarget(agent: Agent | null): void {
    this.renderer.setCameraTarget(agent);
  }

  getState(): SimulationState {
    const mainAgent = this.getMainAgent();
    
    return {
      agents: this.agents,
      foods: this.foods,
      obstacles: this.obstacles,
      worldBounds: {
        x: 0,
        y: 0,
        width: this.worldWidth,
        height: this.worldHeight
      },
      stats: {
        fps: this.fps,
        totalReward: mainAgent?.totalReward || 0,
        collisionCount: mainAgent?.collisionCount || 0,
        emotionState: {
          pleasure: mainAgent?.pleasure || 0,
          arousal: mainAgent?.arousal || 0.5
        }
      }
    };
  }

  destroy(): void {
    this.stop();
    this.renderer.destroy();
  }
} 