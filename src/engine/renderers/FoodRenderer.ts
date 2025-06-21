/**
 * 食物渲染器 - 负责渲染食物
 */

import * as PIXI from 'pixi.js';
import { Food } from '../../types/simulation';

export class FoodRenderer {
  private foodContainer: PIXI.Container;
  private foodSprites: Map<number, PIXI.Graphics> = new Map();

  constructor(foodContainer: PIXI.Container) {
    this.foodContainer = foodContainer;
  }

  /**
   * 渲染所有食物
   */
  public render(foods: Food[]): void {
    // 清理不存在的食物精灵
    for (const [id, sprite] of this.foodSprites) {
      if (!foods.find(food => food.id === id)) {
        this.foodContainer.removeChild(sprite);
        this.foodSprites.delete(id);
      }
    }

    // 渲染每个食物
    for (const food of foods) {
      let sprite = this.foodSprites.get(food.id);
      
      if (!sprite) {
        sprite = new PIXI.Graphics();
        this.foodContainer.addChild(sprite);
        this.foodSprites.set(food.id, sprite);
      }
      
      this.drawFood(sprite, food);
    }
  }

  /**
   * 绘制单个食物
   */
  private drawFood(graphics: PIXI.Graphics, food: Food): void {
    graphics.clear();
    
    // 食物颜色（绿色系）
    const foodColor = 0x2ECC71; // 基础绿色
    
    // 绘制食物（圆形）
    graphics.beginFill(foodColor, 0.8);
    graphics.drawCircle(food.x, food.y, food.radius);
    graphics.endFill();
    
    // 绘制内部高光
    graphics.beginFill(0xFFFFFF, 0.3);
    graphics.drawCircle(food.x - food.radius * 0.3, food.y - food.radius * 0.3, food.radius * 0.4);
    graphics.endFill();
    
    // 设置精灵位置
    graphics.x = 0;
    graphics.y = 0;
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    for (const sprite of this.foodSprites.values()) {
      sprite.destroy();
    }
    this.foodSprites.clear();
  }
} 