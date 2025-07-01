/**
 * 插件管理器
 * 负责管理插件的启用/禁用状态和可见性
 */

import { IPlugin } from '../entities/plugins';
import { getWorldPluginConfig, isPluginEnabledInWorld } from '../config/WorldPluginConfig';
import { globalEventBus } from './EventBus';
import { globalState } from './GlobalState';

export class PluginManager {
  private static instance: PluginManager;
  private currentWorldType: string = 'light-seeker';
  private plugins: Map<string, IPlugin> = new Map();

  private constructor() {
    // 监听世界切换事件
    globalEventBus.on('world:changed', (event: any) => {
      this.setCurrentWorld(event.worldType);
    });

    // 从全局状态获取当前世界
    const state = globalState.getState();
    if (state.selectedWorld) {
      this.currentWorldType = state.selectedWorld;
    }
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * 设置当前世界类型
   */
  public setCurrentWorld(worldType: string): void {
    this.currentWorldType = worldType;
    this.updatePluginStates();
    
    // 发出插件状态更新事件
    globalEventBus.emit('plugins:state-updated', {
      worldType,
      config: getWorldPluginConfig(worldType)
    });
  }

  /**
   * 注册插件
   */
  public registerPlugin(plugin: IPlugin): void {
    this.plugins.set(plugin.id, plugin);
    this.updatePluginStates();
  }

  /**
   * 注销插件
   */
  public unregisterPlugin(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  /**
   * 检查插件是否在当前世界中启用
   */
  public isPluginEnabled(plugin: IPlugin): boolean {
    return isPluginEnabledInWorld(this.currentWorldType, plugin.pluginType, plugin.pluginSubtype);
  }

  /**
   * 检查插件是否应该可见
   */
  public isPluginVisible(plugin: IPlugin): boolean {
    return this.isPluginEnabled(plugin);
  }

  /**
   * 检查插件是否应该参与计算
   */
  public shouldPluginCompute(plugin: IPlugin): boolean {
    return this.isPluginEnabled(plugin);
  }

  /**
   * 获取当前世界中启用的所有插件
   */
  public getEnabledPlugins(): IPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => this.isPluginEnabled(plugin));
  }

  /**
   * 获取当前世界中可见的所有插件
   */
  public getVisiblePlugins(): IPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => this.isPluginVisible(plugin));
  }

  /**
   * 获取当前世界中应该参与计算的所有插件
   */
  public getComputingPlugins(): IPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => this.shouldPluginCompute(plugin));
  }

  /**
   * 获取当前世界类型
   */
  public getCurrentWorldType(): string {
    return this.currentWorldType;
  }

  /**
   * 获取当前世界的插件配置
   */
  public getCurrentWorldConfig() {
    return getWorldPluginConfig(this.currentWorldType);
  }

  /**
   * 更新所有插件的状态
   */
  private updatePluginStates(): void {
    // 这里可以添加更多的插件状态更新逻辑
    // 比如通知渲染系统更新插件可见性
  }

  /**
   * 获取所有注册的插件
   */
  public getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 根据ID获取插件
   */
  public getPlugin(pluginId: string): IPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * 获取指定类型的插件
   */
  public getPluginsByType(pluginType: 'sensor' | 'effector'): IPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.pluginType === pluginType);
  }

  /**
   * 获取指定子类型的插件
   */
  public getPluginsBySubtype(pluginSubtype: string): IPlugin[] {
    return Array.from(this.plugins.values()).filter(plugin => plugin.pluginSubtype === pluginSubtype);
  }
}

// 导出全局插件管理器实例
export const globalPluginManager = PluginManager.getInstance();
