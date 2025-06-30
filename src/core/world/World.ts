/**
 * World 类负责管理世界中的所有实体（智能体、物体等）和规则。
 * 它是仿真环境的核心。
 *
 * 这个类现在作为世界工厂，根据世界类型创建相应的世界实例。
 */

import type { IWorld } from './types';
import type { IAgent } from '../entities/types';
import { BaseWorld } from './BaseWorld';
import { LuminousGardenWorld } from './luminous-garden/LuminousGardenWorld';
import { EchoChamberWorld } from './echo-chamber/EchoChamberWorld';
import { SentientSwarmWorld } from './sentient-swarm/SentientSwarmWorld';
import { ChromaticComposerWorld } from './chromatic-composer/ChromaticComposerWorld';
import { LightSeekerWorld } from './light-seeker/LightSeekerWorld';

export class World extends BaseWorld {
  constructor(width: number, height: number, worldType: string = 'luminous-garden') {
    super(width, height, worldType);
    this.initializeWorld();
  }

  /**
   * 创建指定类型的世界实例
   */
  static createWorld(width: number, height: number, worldType: string): IWorld {
    switch (worldType) {
      case 'luminous-garden':
        return new LuminousGardenWorld(width, height);
      case 'echo-chamber':
        return new EchoChamberWorld(width, height);
      case 'sentient-swarm':
        return new SentientSwarmWorld(width, height);
      case 'chromatic-composer':
        return new ChromaticComposerWorld(width, height);
      case 'light-seeker':
        return new LightSeekerWorld(width, height);
      default:
        return new LightSeekerWorld(width, height);
    }
  }

  initializeWorld(): void {
    // 默认实现为空，子类可以重写
  }

  updateWorldLogic(deltaTime: number): void {
    // 默认实现为空，子类可以重写
  }

  handleAgentInteractions(agent: IAgent): void {
    // 默认实现为空，子类可以重写
  }

  // --- 兼容性方法 ---

  public getWidth(): number {
    return this.worldWidth;
  }

  public getHeight(): number {
    return this.worldHeight;
  }
}
