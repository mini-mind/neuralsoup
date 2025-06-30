/**
 * 追光者世界实现
 * 简化的测试环境，包含多个大光球随机缓慢运动
 * 为测试视觉感受器和梯度运动控制器提供光源环境
 */

import { BaseWorld } from '../BaseWorld';
import { LightOrb } from './LightSeekerEntities';
import type { ILightOrb } from '../types';
import type { IAgent } from '../../entities/types';
import { globalEventBus } from '../../services/EventBus';

export class LightSeekerWorld extends BaseWorld {
  private lightOrbs: Map<string, ILightOrb> = new Map();
  
  // 游戏速度控制
  private gameSpeedMultiplier: number = 0.1;

  constructor(width: number, height: number) {
    super(width, height, 'light-seeker');
    this.initializeWorld();
  }

  initializeWorld(): void {
    // 创建光球
    this.createLightOrbs();

    // 创建一个测试agent
    this.createTestAgent();
  }

  private createLightOrbs(): void {
    const numOrbs = 3 + Math.floor(Math.random() * 3); // 3-5个光球
    
    for (let i = 0; i < numOrbs; i++) {
      const position = this.getRandomPosition();
      const lightOrb = new LightOrb(
        this.generateId(),
        position.x,
        position.y,
        60 + Math.random() * 40, // 半径 60-100（更大）
        0.9 + Math.random() * 0.1, // 强度 0.9-1.0（更亮）
        200 + Math.random() * 150 // 影响范围 200-350（更大范围）
      );
      
      this.lightOrbs.set(lightOrb.id, lightOrb);
      this.addEntity(lightOrb);
    }
  }



  updateWorldLogic(deltaTime: number): void {
    const adjustedDeltaTime = deltaTime * this.gameSpeedMultiplier;

    // 更新光球位置
    this.updateLightOrbsMovement(adjustedDeltaTime);

    // 更新agent的视觉感受器输入
    this.updateAgentVision(adjustedDeltaTime);
  }

  private createTestAgent(): void {
    const centerX = this.worldWidth / 2;
    const centerY = this.worldHeight / 2;

    const agent = this.createSimpleAgent('test-agent', centerX, centerY);
    this.agents.set(agent.id, agent);
  }

  /**
   * 创建简单的agent实现
   */
  private createSimpleAgent(id: string, x: number, y: number): IAgent {
    return {
      id,
      x,
      y,
      angle: 0,
      radius: 15,
      entityType: 'agent',
      brain: {} as any,
      sensors: [],
      effectors: [],
      update: (world: any) => {
        // 简单的更新逻辑
      }
    };
  }

  private updateLightOrbsMovement(deltaTime: number): void {
    for (const orb of this.lightOrbs.values()) {
      orb.update(deltaTime);
    }
  }

  /**
   * 更新agent的视觉感受器输入
   * 计算8个方向的光强度并发送给UI中的视觉感受器
   */
  private updateAgentVision(deltaTime: number): void {
    const testAgent = this.agents.get('test-agent');
    if (!testAgent) return;

    // 计算8个方向的光强度
    const visionInputs = this.calculateVisionInputs(testAgent);

    // 发送视觉数据给UI中的视觉感受器
    globalEventBus.emit('sensor:visual-input', {
      agentId: testAgent.id,
      visionInputs: visionInputs,
      timestamp: Date.now()
    });

    // 计算总光强度并发送给光感受器
    const totalIntensity = visionInputs.reduce((sum, intensity) => sum + intensity, 0) / 8;
    globalEventBus.emit('sensor:light-input', {
      agentId: testAgent.id,
      lightIntensity: totalIntensity,
      timestamp: Date.now()
    });

    // 输出调试信息
    if (totalIntensity > 0.001) { // 进一步降低阈值
      console.log(`Agent位置: (${testAgent.x.toFixed(1)}, ${testAgent.y.toFixed(1)})`);
      console.log(`Agent视觉输入: [${visionInputs.map(v => v.toFixed(3)).join(', ')}] 总强度: ${totalIntensity.toFixed(4)}`);

      // 显示光球位置和距离
      for (const orb of this.lightOrbs.values()) {
        const dx = orb.x - testAgent.x;
        const dy = orb.y - testAgent.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const intensity = orb.getLightIntensityAt(testAgent.x, testAgent.y);
        console.log(`  光球 ${orb.id}: 位置(${orb.x.toFixed(1)}, ${orb.y.toFixed(1)}), 距离: ${distance.toFixed(1)}, 影响范围: ${orb.influenceRadius}, 强度: ${intensity.toFixed(4)}`);
      }
    }
  }

  /**
   * 计算agent在8个方向的视觉输入
   */
  private calculateVisionInputs(agent: IAgent): number[] {
    const visionRange = 120; // 视觉范围
    const directions = [
      0,           // 0度（右）
      Math.PI / 4, // 45度
      Math.PI / 2, // 90度（上）
      3 * Math.PI / 4, // 135度
      Math.PI,     // 180度（左）
      5 * Math.PI / 4, // 225度
      3 * Math.PI / 2, // 270度（下）
      7 * Math.PI / 4  // 315度
    ];

    return directions.map(direction => {
      // 在这个方向上采样几个点
      let totalIntensity = 0;
      const sampleCount = 5;

      for (let i = 1; i <= sampleCount; i++) {
        const distance = (visionRange / sampleCount) * i;
        const sampleX = agent.x + Math.cos(direction) * distance;
        const sampleY = agent.y + Math.sin(direction) * distance;

        // 计算这个位置的光强度
        const intensity = this.calculateLightIntensityAt(sampleX, sampleY);
        totalIntensity += intensity;
      }

      return totalIntensity / sampleCount; // 平均强度
    });
  }

  /**
   * 计算指定位置的光强度
   */
  private calculateLightIntensityAt(x: number, y: number): number {
    let totalIntensity = 0;

    for (const orb of this.lightOrbs.values()) {
      totalIntensity += orb.getLightIntensityAt(x, y);
    }

    return Math.min(totalIntensity, 1.0); // 限制最大强度为1.0
  }





  handleAgentInteractions(agent: IAgent): void {
    // 在这个简化的世界中，不需要特殊的交互处理
  }

  // === 获取器方法，供渲染器使用 ===

  getLightOrbs(): Map<string, ILightOrb> {
    return this.lightOrbs;
  }

  getTestAgent(): IAgent | undefined {
    return this.agents.get('test-agent');
  }
}
