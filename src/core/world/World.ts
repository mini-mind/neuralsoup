/**
 * World 类负责管理世界中的所有实体（智能体、物体等）和规则。
 * 它是仿真环境的核心。
 */

import type { IWorld } from '../../shared/interfaces/IWorld';
import type { IAgent } from '../../shared/interfaces/IAgent';

export class World implements IWorld {
  private agents: Map<string, IAgent> = new Map();
  // 未来可以添加其他实体，例如：
  // private objects: Map<string, IWorldObject> = new Map();

  private worldWidth: number;
  private worldHeight: number;

  constructor(width: number, height: number) {
    this.worldWidth = width;
    this.worldHeight = height;
  }

  /**
   * 更新世界状态，这会依次更新所有智能体。
   */
  update(): void {
    for (const agent of this.agents.values()) {
      agent.update(this);
      // 在这里可以加入物理更新、边界处理等
      this.handleBoundary(agent);
    }
  }

  addAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  removeAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  getAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 处理智能体的边界（环绕式世界）。
   * @param agent
   */
  private handleBoundary(agent: any): void {
    // 这是一个示例实现，智能体需要有 x, y 属性
    if (typeof agent.x === 'number' && typeof agent.y === 'number') {
        agent.x = ((agent.x % this.worldWidth) + this.worldWidth) % this.worldWidth;
        agent.y = ((agent.y % this.worldHeight) + this.worldHeight) % this.worldHeight;
    }
  }

  // --- Getters and Setters ---

  public getWidth(): number {
    return this.worldWidth;
  }

  public getHeight(): number {
    return this.worldHeight;
  }

  public setDimensions(width: number, height: number): void {
    this.worldWidth = width;
    this.worldHeight = height;
  }
}
