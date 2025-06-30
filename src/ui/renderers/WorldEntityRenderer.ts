/**
 * 世界实体渲染器 - 负责渲染不同世界中的实体
 */

import * as PIXI from "pixi.js";
import type {
  IWorldEntity, ILightPatch, IDarkMatter, ICrystalShard, IWall, IFood, IMufflingZone,
  IResourcePatch, ISignalBeacon, IThreat, IColorPool, IRhythmNode, ICanvasTrace, ILightOrb
} from "../../core/world/types";

export class WorldEntityRenderer {
  private entityContainer: PIXI.Container;
  private entitySprites: Map<string, PIXI.Graphics> = new Map();

  constructor(entityContainer: PIXI.Container) {
    this.entityContainer = entityContainer;
  }

  /**
   * 渲染所有世界实体
   */
  public render(entities: IWorldEntity[]): void {
    // 清理不存在的实体精灵
    for (const [id, sprite] of this.entitySprites) {
      if (!entities.find((entity) => entity.id === id)) {
        this.entityContainer.removeChild(sprite);
        this.entitySprites.delete(id);
      }
    }

    // 渲染每个实体
    for (const entity of entities) {
      if (!entity.isActive) continue;

      let sprite = this.entitySprites.get(entity.id);

      if (!sprite) {
        sprite = new PIXI.Graphics();
        this.entityContainer.addChild(sprite);
        this.entitySprites.set(entity.id, sprite);
      }

      this.drawEntity(sprite, entity);
    }
  }

  /**
   * 绘制单个实体
   */
  private drawEntity(graphics: PIXI.Graphics, entity: IWorldEntity): void {
    graphics.clear();

    switch (entity.entityType) {
      case 'light-patch':
        this.drawLightPatch(graphics, entity as ILightPatch);
        break;
      case 'dark-matter':
        this.drawDarkMatter(graphics, entity as IDarkMatter);
        break;
      case 'wall':
        this.drawWall(graphics, entity as IWall);
        break;
      case 'food':
        this.drawFood(graphics, entity as IFood);
        break;
      case 'muffling-zone':
        this.drawMufflingZone(graphics, entity as IMufflingZone);
        break;
      case 'sound-wave':
        this.drawSoundWave(graphics, entity);
        break;
      case 'resource-patch':
        this.drawResourcePatch(graphics, entity as IResourcePatch);
        break;
      case 'signal-beacon':
        this.drawSignalBeacon(graphics, entity as ISignalBeacon);
        break;
      case 'threat':
        this.drawThreat(graphics, entity as IThreat);
        break;
      case 'swarm-agent':
        this.drawSwarmAgent(graphics, entity);
        break;
      case 'color-pool':
        this.drawColorPool(graphics, entity as IColorPool);
        break;
      case 'rhythm-node':
        this.drawRhythmNode(graphics, entity as IRhythmNode);
        break;
      case 'canvas-trace':
        this.drawCanvasTrace(graphics, entity as ICanvasTrace);
        break;
      case 'artistic-agent':
        this.drawArtisticAgent(graphics, entity);
        break;
      case 'light-orb':
        this.drawLightOrb(graphics, entity as ILightOrb);
        break;
      default:
        this.drawGenericEntity(graphics, entity);
        break;
    }
  }

  /**
   * 绘制光斑
   */
  private drawLightPatch(graphics: PIXI.Graphics, lightPatch: ILightPatch): void {
    const { x, y, radius } = lightPatch;
    
    // 简单的渐变圆形 - 外层到内层
    graphics.beginFill(0xffeb3b, 0.3); // 黄色外层
    graphics.drawCircle(x, y, radius);
    graphics.endFill();
    
    graphics.beginFill(0xffffff, 0.6); // 白色内层
    graphics.drawCircle(x, y, radius * 0.6);
    graphics.endFill();
  }

  /**
   * 绘制暗物质
   */
  private drawDarkMatter(graphics: PIXI.Graphics, darkMatter: IDarkMatter): void {
    const { x, y, radius } = darkMatter;
    
    // 简单的暗色圆形
    graphics.beginFill(0x424242, 0.8); // 深灰色
    graphics.drawCircle(x, y, radius);
    graphics.endFill();
    
    graphics.beginFill(0x212121, 0.9); // 更深的内核
    graphics.drawCircle(x, y, radius * 0.6);
    graphics.endFill();
  }

  /**
   * 绘制墙壁
   */
  private drawWall(graphics: PIXI.Graphics, wall: IWall): void {
    const { x, y, width, height } = wall;

    // 墙壁主体
    graphics.beginFill(0x444444, 0.8);
    graphics.drawRect(x, y, width, height);
    graphics.endFill();

    // 墙壁边框
    graphics.lineStyle(2, 0x666666, 1.0);
    graphics.drawRect(x, y, width, height);
    graphics.lineStyle(0);

    // 添加纹理效果
    graphics.lineStyle(1, 0x555555, 0.5);
    for (let i = 0; i < width; i += 10) {
      graphics.moveTo(x + i, y);
      graphics.lineTo(x + i, y + height);
    }
    for (let i = 0; i < height; i += 10) {
      graphics.moveTo(x, y + i);
      graphics.lineTo(x + width, y + i);
    }
    graphics.lineStyle(0);
  }

  /**
   * 绘制食物
   */
  private drawFood(graphics: PIXI.Graphics, food: IFood): void {
    if (food.isConsumed) return;

    const { x, y, radius } = food;

    // 食物主体 - 橙色圆形
    graphics.beginFill(0xff6600, 0.7);
    graphics.drawCircle(x, y, radius);
    graphics.endFill();

    // 食物边框
    graphics.lineStyle(2, 0xff8833, 0.9);
    graphics.drawCircle(x, y, radius);
    graphics.lineStyle(0);

    // 内部高光
    graphics.beginFill(0xffaa55, 0.6);
    graphics.drawCircle(x - radius * 0.3, y - radius * 0.3, radius * 0.4);
    graphics.endFill();

    // 脉动效果
    const pulseRadius = radius * (0.9 + 0.1 * Math.sin(Date.now() * 0.004));
    graphics.lineStyle(1, 0xffcc77, 0.4);
    graphics.drawCircle(x, y, pulseRadius);
    graphics.lineStyle(0);
  }

  /**
   * 绘制消音区域
   */
  private drawMufflingZone(graphics: PIXI.Graphics, zone: IMufflingZone): void {
    const { x, y, radius } = zone;

    // 外层消音效果
    graphics.beginFill(0x330033, 0.3);
    graphics.drawCircle(x, y, radius * 1.2);
    graphics.endFill();

    // 中层消音区域
    graphics.beginFill(0x440044, 0.4);
    graphics.drawCircle(x, y, radius);
    graphics.endFill();

    // 核心消音区域
    graphics.beginFill(0x220022, 0.6);
    graphics.drawCircle(x, y, radius * 0.6);
    graphics.endFill();

    // 波纹效果
    const time = Date.now() * 0.002;
    for (let i = 0; i < 3; i++) {
      const waveRadius = radius * (0.3 + 0.3 * i + 0.1 * Math.sin(time + i));
      graphics.lineStyle(1, 0x660066, 0.3 - i * 0.1);
      graphics.drawCircle(x, y, waveRadius);
    }
    graphics.lineStyle(0);
  }

  /**
   * 绘制声波
   */
  private drawSoundWave(graphics: PIXI.Graphics, soundWave: any): void {
    const { x, y, radius, intensity } = soundWave;

    // 声波圆环
    const alpha = intensity * 0.5;
    graphics.lineStyle(3, 0x00ffff, alpha);
    graphics.drawCircle(x, y, radius);
    graphics.lineStyle(0);

    // 内部填充
    graphics.beginFill(0x00ffff, alpha * 0.2);
    graphics.drawCircle(x, y, radius);
    graphics.endFill();
  }

  /**
   * 绘制通用实体
   */
  private drawGenericEntity(graphics: PIXI.Graphics, entity: IWorldEntity): void {
    const radius = (entity as any).radius || 10;

    // 默认绘制为灰色圆形
    graphics.beginFill(0x888888, 0.6);
    graphics.drawCircle(entity.x, entity.y, radius);
    graphics.endFill();

    graphics.lineStyle(1, 0xcccccc, 0.8);
    graphics.drawCircle(entity.x, entity.y, radius);
    graphics.lineStyle(0);
  }

  /**
   * 绘制资源点
   */
  private drawResourcePatch(graphics: PIXI.Graphics, resource: IResourcePatch): void {
    const { x, y, radius } = resource;
    const density = resource.getResourceDensity();

    // 资源点主体 - 颜色根据资源密度变化
    const alpha = 0.4 + density * 0.4;
    graphics.beginFill(0x32cd32, alpha);
    graphics.drawCircle(x, y, radius);
    graphics.endFill();

    // 资源点边框
    graphics.lineStyle(2, 0x228b22, 0.8);
    graphics.drawCircle(x, y, radius);
    graphics.lineStyle(0);

    // 内部资源指示器
    const innerRadius = radius * density;
    graphics.beginFill(0x90ee90, 0.6);
    graphics.drawCircle(x, y, innerRadius);
    graphics.endFill();

    // 资源数量文本
    graphics.beginFill(0x000000, 0.8);
    // 注意：PIXI.Graphics 不直接支持文本，这里简化处理
    // 实际项目中应该使用 PIXI.Text 或在上层处理文本渲染
  }

  /**
   * 绘制信标
   */
  private drawSignalBeacon(graphics: PIXI.Graphics, beacon: ISignalBeacon): void {
    const { x, y, range, intensity, signalType } = beacon;

    // 根据信号类型选择颜色
    let color: number;
    switch (signalType) {
      case 'food': color = 0x00ff00; break;
      case 'danger': color = 0xff0000; break;
      default: color = 0x0080ff; break;
    }

    // 信号范围
    graphics.beginFill(color, intensity * 0.1);
    graphics.drawCircle(x, y, range);
    graphics.endFill();

    // 信号核心
    graphics.beginFill(color, intensity * 0.8);
    graphics.drawCircle(x, y, 8);
    graphics.endFill();

    // 脉冲效果
    const pulseRadius = 15 + 10 * Math.sin(Date.now() * 0.005);
    graphics.lineStyle(2, color, intensity * 0.6);
    graphics.drawCircle(x, y, pulseRadius);
    graphics.lineStyle(0);
  }

  /**
   * 绘制威胁
   */
  private drawThreat(graphics: PIXI.Graphics, threat: IThreat): void {
    const { x, y, radius, detectionRange } = threat;

    // 检测范围
    graphics.beginFill(0xff0000, 0.1);
    graphics.drawCircle(x, y, detectionRange);
    graphics.endFill();

    // 威胁主体
    graphics.beginFill(0x8b0000, 0.8);
    graphics.drawCircle(x, y, radius);
    graphics.endFill();

    // 威胁边框
    graphics.lineStyle(3, 0xff0000, 0.9);
    graphics.drawCircle(x, y, radius);
    graphics.lineStyle(0);

    // 危险标识 - 绘制三角形
    const triangleSize = radius * 0.6;
    graphics.beginFill(0xffff00, 0.9);
    graphics.moveTo(x, y - triangleSize);
    graphics.lineTo(x - triangleSize * 0.866, y + triangleSize * 0.5);
    graphics.lineTo(x + triangleSize * 0.866, y + triangleSize * 0.5);
    graphics.closePath();
    graphics.endFill();
  }

  /**
   * 绘制群体智能体
   */
  private drawSwarmAgent(graphics: PIXI.Graphics, agent: any): void {
    const { x, y, radius, energy, maxEnergy, role } = agent;

    // 根据角色选择颜色
    let color: number;
    switch (role) {
      case 'explorer': color = 0x00bfff; break;
      case 'gatherer': color = 0x32cd32; break;
      case 'guard': color = 0xff4500; break;
      default: color = 0x9370db; break;
    }

    // 能量指示器
    const energyRatio = energy / maxEnergy;
    graphics.beginFill(color, 0.3 + energyRatio * 0.5);
    graphics.drawCircle(x, y, radius);
    graphics.endFill();

    // 智能体边框
    graphics.lineStyle(2, color, 0.8);
    graphics.drawCircle(x, y, radius);
    graphics.lineStyle(0);

    // 方向指示器
    if (agent.velocity) {
      const speed = Math.sqrt(agent.velocity.x ** 2 + agent.velocity.y ** 2);
      if (speed > 1) {
        const angle = Math.atan2(agent.velocity.y, agent.velocity.x);
        const lineLength = radius + 5;
        graphics.lineStyle(2, color, 0.8);
        graphics.moveTo(x, y);
        graphics.lineTo(x + Math.cos(angle) * lineLength, y + Math.sin(angle) * lineLength);
        graphics.lineStyle(0);
      }
    }
  }

  /**
   * 绘制色彩池
   */
  private drawColorPool(graphics: PIXI.Graphics, colorPool: IColorPool): void {
    const { x, y, radius, color, intensity } = colorPool;
    const pulseRadius = (colorPool as any).getPulseRadius ? (colorPool as any).getPulseRadius() : radius;

    // 解析颜色字符串为数字
    const colorNum = parseInt(color.replace('#', ''), 16);

    // 色彩池主体
    graphics.beginFill(colorNum, intensity * 0.6);
    graphics.drawCircle(x, y, pulseRadius);
    graphics.endFill();

    // 色彩池边框
    graphics.lineStyle(3, colorNum, intensity * 0.9);
    graphics.drawCircle(x, y, pulseRadius);
    graphics.lineStyle(0);

    // 内部光芒
    graphics.beginFill(0xffffff, intensity * 0.3);
    graphics.drawCircle(x, y, pulseRadius * 0.5);
    graphics.endFill();
  }

  /**
   * 绘制节拍源
   */
  private drawRhythmNode(graphics: PIXI.Graphics, rhythmNode: IRhythmNode): void {
    const { x, y, range, frequency } = rhythmNode;
    const beatIntensity = (rhythmNode as any).getCurrentBeatIntensity ? (rhythmNode as any).getCurrentBeatIntensity() : 0.5;

    // 节拍影响范围
    graphics.beginFill(0x9932cc, 0.1);
    graphics.drawCircle(x, y, range);
    graphics.endFill();

    // 节拍源主体
    const coreRadius = 15 + beatIntensity * 10;
    graphics.beginFill(0x9932cc, 0.7 + beatIntensity * 0.3);
    graphics.drawCircle(x, y, coreRadius);
    graphics.endFill();

    // 节拍波纹
    for (let i = 0; i < 3; i++) {
      const waveRadius = coreRadius + (i + 1) * 15 + beatIntensity * 20;
      graphics.lineStyle(2, 0x9932cc, (0.5 - i * 0.1) * beatIntensity);
      graphics.drawCircle(x, y, waveRadius);
    }
    graphics.lineStyle(0);

    // 频率指示器（小点）
    const dotCount = Math.min(8, Math.floor(frequency / 20));
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2;
      const dotX = x + Math.cos(angle) * (coreRadius + 5);
      const dotY = y + Math.sin(angle) * (coreRadius + 5);
      graphics.beginFill(0xffffff, 0.8);
      graphics.drawCircle(dotX, dotY, 2);
      graphics.endFill();
    }
  }

  /**
   * 绘制画布痕迹
   */
  private drawCanvasTrace(graphics: PIXI.Graphics, trace: ICanvasTrace): void {
    const { points, color, width, opacity } = trace;

    if (points.length < 2) return;

    // 解析颜色字符串为数字
    const colorNum = parseInt(color.replace('#', ''), 16);

    // 绘制路径
    graphics.lineStyle(width, colorNum, opacity);
    graphics.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }

    graphics.lineStyle(0);

    // 在路径端点绘制小圆点
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      graphics.beginFill(colorNum, opacity * 0.8);
      graphics.drawCircle(lastPoint.x, lastPoint.y, width);
      graphics.endFill();
    }
  }

  /**
   * 绘制艺术智能体
   */
  private drawArtisticAgent(graphics: PIXI.Graphics, agent: any): void {
    const { x, y, radius, currentColor, isDrawing } = agent;

    // 解析颜色字符串为数字
    const colorNum = currentColor ? parseInt(currentColor.replace('#', ''), 16) : 0x888888;

    // 智能体主体
    graphics.beginFill(colorNum, 0.7);
    graphics.drawCircle(x, y, radius);
    graphics.endFill();

    // 智能体边框
    graphics.lineStyle(2, colorNum, 0.9);
    graphics.drawCircle(x, y, radius);
    graphics.lineStyle(0);

    // 绘画状态指示器
    if (isDrawing) {
      graphics.lineStyle(3, 0xffffff, 0.8);
      graphics.drawCircle(x, y, radius + 3);
      graphics.lineStyle(0);

      // 画笔指示器
      graphics.beginFill(0xffffff, 0.9);
      graphics.drawCircle(x, y - radius - 8, 3);
      graphics.endFill();
    }

    // 创造力指示器（小星星）
    const creativity = agent.creativity || 0.5;
    if (creativity > 0.7) {
      const starSize = 4;
      graphics.beginFill(0xffd700, 0.8);
      // 简化的星星形状
      graphics.drawPolygon([
        x, y - radius - starSize,
        x + starSize * 0.3, y - radius - starSize * 0.3,
        x + starSize, y - radius - starSize * 0.3,
        x + starSize * 0.5, y - radius,
        x + starSize * 0.8, y - radius + starSize * 0.5,
        x, y - radius + starSize * 0.2,
        x - starSize * 0.8, y - radius + starSize * 0.5,
        x - starSize * 0.5, y - radius,
        x - starSize, y - radius - starSize * 0.3,
        x - starSize * 0.3, y - radius - starSize * 0.3
      ]);
      graphics.endFill();
    }
  }

  /**
   * 绘制光球实体
   */
  private drawLightOrb(graphics: PIXI.Graphics, lightOrb: ILightOrb): void {
    // 绘制影响范围（半透明圆圈）
    graphics.beginFill(0xffff00, 0.05 * lightOrb.intensity);
    graphics.drawCircle(lightOrb.x, lightOrb.y, lightOrb.influenceRadius);
    graphics.endFill();

    // 绘制影响范围边界
    graphics.lineStyle(1, 0xffff00, 0.2 * lightOrb.intensity);
    graphics.drawCircle(lightOrb.x, lightOrb.y, lightOrb.influenceRadius);
    graphics.lineStyle(0);

    // 绘制多层渐变光晕效果
    const coreRadius = lightOrb.radius;
    const layers = [
      { radius: lightOrb.radius * 3.0, color: 0xffff00, alpha: 0.1 * lightOrb.intensity },
      { radius: lightOrb.radius * 2.5, color: 0xffff00, alpha: 0.2 * lightOrb.intensity },
      { radius: lightOrb.radius * 2.0, color: 0xffff00, alpha: 0.3 * lightOrb.intensity },
      { radius: lightOrb.radius * 1.5, color: 0xffff00, alpha: 0.5 * lightOrb.intensity },
      { radius: lightOrb.radius * 1.2, color: 0xffff88, alpha: 0.7 * lightOrb.intensity },
      { radius: lightOrb.radius * 1.0, color: 0xffffff, alpha: 0.9 * lightOrb.intensity },
      { radius: lightOrb.radius * 0.6, color: 0xffffff, alpha: 1.0 * lightOrb.intensity }
    ];

    // 从外到内绘制各层
    layers.forEach(layer => {
      graphics.beginFill(layer.color, layer.alpha);
      graphics.drawCircle(lightOrb.x, lightOrb.y, layer.radius);
      graphics.endFill();
    });

    // 添加一个亮白色的核心
    graphics.beginFill(0xffffff, 1.0);
    graphics.drawCircle(lightOrb.x, lightOrb.y, coreRadius * 0.3);
    graphics.endFill();
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    for (const sprite of this.entitySprites.values()) {
      sprite.destroy();
    }
    this.entitySprites.clear();
  }
}
