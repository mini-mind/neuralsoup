/**
 * 性能监控工具
 * 用于监控UI更新和插件系统的性能
 */

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private frameCount: number = 0;
  private lastTime: number = 0;
  private fps: number = 0;
  private updateTimes: number[] = [];
  private renderTimes: number[] = [];
  private isMonitoring: boolean = false;

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 开始性能监控
   */
  public startMonitoring(): void {
    this.isMonitoring = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.updateTimes = [];
    this.renderTimes = [];
    
    console.log('性能监控已启动');
  }

  /**
   * 停止性能监控
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('性能监控已停止');
  }

  /**
   * 记录帧更新
   */
  public recordFrame(): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    
    this.frameCount++;
    this.lastTime = currentTime;
    
    // 计算FPS（每秒更新一次）
    if (this.frameCount % 60 === 0) {
      this.fps = Math.round(1000 / (deltaTime / 60));
    }
  }

  /**
   * 记录更新操作的耗时
   */
  public recordUpdateTime(startTime: number): void {
    if (!this.isMonitoring) return;

    const endTime = performance.now();
    const updateTime = endTime - startTime;
    this.updateTimes.push(updateTime);
    
    // 只保留最近100次的记录
    if (this.updateTimes.length > 100) {
      this.updateTimes.shift();
    }
  }

  /**
   * 记录渲染操作的耗时
   */
  public recordRenderTime(startTime: number): void {
    if (!this.isMonitoring) return;

    const endTime = performance.now();
    const renderTime = endTime - startTime;
    this.renderTimes.push(renderTime);
    
    // 只保留最近100次的记录
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }
  }

  /**
   * 获取性能统计信息
   */
  public getStats(): {
    fps: number;
    frameCount: number;
    avgUpdateTime: number;
    avgRenderTime: number;
    maxUpdateTime: number;
    maxRenderTime: number;
  } {
    const avgUpdateTime = this.updateTimes.length > 0 
      ? this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length 
      : 0;
    
    const avgRenderTime = this.renderTimes.length > 0 
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length 
      : 0;
    
    const maxUpdateTime = this.updateTimes.length > 0 
      ? Math.max(...this.updateTimes) 
      : 0;
    
    const maxRenderTime = this.renderTimes.length > 0 
      ? Math.max(...this.renderTimes) 
      : 0;

    return {
      fps: this.fps,
      frameCount: this.frameCount,
      avgUpdateTime: Math.round(avgUpdateTime * 100) / 100,
      avgRenderTime: Math.round(avgRenderTime * 100) / 100,
      maxUpdateTime: Math.round(maxUpdateTime * 100) / 100,
      maxRenderTime: Math.round(maxRenderTime * 100) / 100,
    };
  }

  /**
   * 打印性能报告
   */
  public printReport(): void {
    const stats = this.getStats();
    
    console.log('=== 性能报告 ===');
    console.log(`FPS: ${stats.fps}`);
    console.log(`总帧数: ${stats.frameCount}`);
    console.log(`平均更新时间: ${stats.avgUpdateTime}ms`);
    console.log(`平均渲染时间: ${stats.avgRenderTime}ms`);
    console.log(`最大更新时间: ${stats.maxUpdateTime}ms`);
    console.log(`最大渲染时间: ${stats.maxRenderTime}ms`);
    
    // 性能警告
    if (stats.avgUpdateTime > 16) {
      console.warn('⚠️ 更新时间过长，可能影响60fps目标');
    }
    if (stats.avgRenderTime > 16) {
      console.warn('⚠️ 渲染时间过长，可能影响60fps目标');
    }
    if (stats.fps < 30) {
      console.warn('⚠️ FPS过低，用户体验可能受影响');
    }
  }

  /**
   * 检查是否正在监控
   */
  public isActive(): boolean {
    return this.isMonitoring;
  }
}

// 导出全局实例
export const globalPerformanceMonitor = PerformanceMonitor.getInstance();

// 在开发环境中暴露到全局作用域（仅用于调试）
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).performanceMonitor = globalPerformanceMonitor;
}
