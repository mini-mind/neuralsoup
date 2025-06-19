/**
 * 相机控制器 - 处理镜头跟随和移动
 */

import * as PIXI from 'pixi.js';
import { Agent } from '../../types/simulation';

export class CameraController {
  private cameraTarget: Agent | null = null;
  private cameraLerpFactor = 1.0; // 立即跟随，用于调试

  constructor(
    private worldContainer: PIXI.Container,
    private app: PIXI.Application
  ) {}

  /**
   * 设置相机跟随目标
   */
  setCameraTarget(agent: Agent | null): void {
    this.cameraTarget = agent;
    
    // 如果设置了新目标，立即定位镜头到目标位置
    if (agent) {
      const screenWidth = this.app.screen.width;
      const screenHeight = this.app.screen.height;
      
      // 将世界容器的中心（pivot）设置到智能体的位置
      this.worldContainer.pivot.set(agent.x, agent.y);
      
      // 将世界容器的左上角设置到屏幕中心，这样pivot点（智能体）就显示在屏幕中心
      this.worldContainer.x = screenWidth / 2;
      this.worldContainer.y = screenHeight / 2;
      
      // 立即设置旋转，使智能体朝向屏幕上方
      this.worldContainer.rotation = -agent.angle - Math.PI / 2; 
    }
  }

  /**
   * 更新相机位置
   */
  updateCamera(): void {
    if (!this.cameraTarget) return;

    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // 目标pivot点 (智能体的世界坐标)
    const targetPivotX = this.cameraTarget.x;
    const targetPivotY = this.cameraTarget.y;

    // 平滑插值pivot点
    this.worldContainer.pivot.x += (targetPivotX - this.worldContainer.pivot.x) * this.cameraLerpFactor;
    this.worldContainer.pivot.y += (targetPivotY - this.worldContainer.pivot.y) * this.cameraLerpFactor;

    // 目标旋转角度，使智能体朝向屏幕上方
    // PixiJS 0度是右，顺时针为正。智能体角度0度是右，逆时针为正。
    // 因此，需要将智能体角度取反，并加上90度（Math.PI/2）的偏移量。
    let targetRotation = -this.cameraTarget.angle - Math.PI / 2;

    // 平滑插值旋转 (处理角度的周期性)
    let shortestAngle = (targetRotation - this.worldContainer.rotation + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    this.worldContainer.rotation += shortestAngle * this.cameraLerpFactor;

    // 将世界容器固定在屏幕中心。其pivot点（即智能体）将显示在屏幕中心。
    this.worldContainer.x = screenWidth / 2;
    this.worldContainer.y = screenHeight / 2;

    // 调试日志（每秒一次）
    if (this.app.ticker.count % 60 === 0) {
      console.log('Camera Update Debug:', {
        targetAgentPos: { x: this.cameraTarget.x, y: this.cameraTarget.y },
        worldContainerPivot: { x: this.worldContainer.pivot.x, y: this.worldContainer.pivot.y },
        worldContainerPos: { x: this.worldContainer.x, y: this.worldContainer.y },
        worldContainerRotation: this.worldContainer.rotation,
        targetRotation: targetRotation,
        screenWidth: screenWidth,
        screenHeight: screenHeight
      });
    }
  }

  /**
   * 设置相机跟随速度
   */
  setCameraLerpFactor(factor: number): void {
    this.cameraLerpFactor = Math.max(0, Math.min(1, factor));
  }
} 