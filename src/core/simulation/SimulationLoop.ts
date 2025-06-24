import type { IWorld } from '../../shared/interfaces/IWorld';

/**
 * 纯粹的仿真循环，负责以固定的时间步长驱动世界状态的更新。
 */
export class SimulationLoop {
  private world: IWorld;
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private simulationTime: number = 0;
  private frameCount: number = 0;

  private onTick?: (world: IWorld) => void;

  constructor(world: IWorld) {
    this.world = world;
  }

  /**
   * 启动仿真循环。
   * @param onTick - 每个时间步后执行的回调，可用于外部系统（如渲染器）获取最新状态。
   */
  start(onTick?: (world: IWorld) => void): void {
    if (this.isRunning) {
      return;
    }
    console.log('启动仿真循环...');
    this.isRunning = true;
    this.lastTime = performance.now();
    this.onTick = onTick;
    requestAnimationFrame(this.loop);
  }

  /**
   * 停止仿真循环。
   */
  stop(): void {
    console.log('停止仿真循环...');
    this.isRunning = false;
  }

  /**
   * 游戏主循环
   */
  private loop = (currentTime: number): void => {
    if (!this.isRunning) {
      return;
    }

    const deltaTime = (currentTime - this.lastTime) / 1000; // 转换为秒
    this.lastTime = currentTime;
    this.simulationTime += deltaTime;
    this.frameCount++;

    // 更新世界状态
    this.world.update();

    // 触发回调
    if (this.onTick) {
      this.onTick(this.world);
    }

    requestAnimationFrame(this.loop);
  };

  public getSimulationTime(): number {
    return this.simulationTime;
  }

  public getFrameCount(): number {
    return this.frameCount;
  }
}
