import { useState, useEffect } from 'react';
import { EventBus } from './EventBus';
import type { NetworkTopology } from '../types';

/**
 * 一个简单的、类型安全的全局状态管理器。
 * 使用发布-订阅模式通知状态变更。
 */
export class GlobalState<T extends object> {
  private state: T;
  private eventBus = new EventBus();
  private readonly STATE_UPDATE_EVENT = 'state_update';
  private listeners: ((state: T) => void)[] = [];

  constructor(initialState: T) {
    this.state = initialState;
  }

  /**
   * 获取当前状态的快照。
   * @returns 当前状态对象的只读副本。
   */
  getState(): Readonly<T> {
    return { ...this.state };
  }

  /**
   * 更新状态。可以传入部分状态。
   * @param partialState - 要更新的部分状态。
   */
  setState(partialState: Partial<T>): void {
    this.state = { ...this.state, ...partialState };
    this.eventBus.emit(this.STATE_UPDATE_EVENT, this.getState());
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * 订阅状态变更。
   * @param listener - 状态变更时调用的监听器。
   * @returns 一个用于取消订阅的函数。
   */
  subscribe(listener: (state: Readonly<T>) => void): () => void {
    // 立即用当前状态调用一次监听器
    listener(this.getState());
    // 订阅后续更新
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // 自定义的 React Hook，用于在组件中订阅状态
  useStore<U>(selector: (state: T) => U): U {
    const [value, setValue] = useState(() => selector(this.getState()));

    useEffect(() => {
      const unsubscribe = this.subscribe(currentState => {
        const newValue = selector(currentState);
        // 使用JSON.stringify进行深度比较，避免依赖循环
        if (JSON.stringify(newValue) !== JSON.stringify(value)) {
          setValue(newValue);
        }
      });
      return unsubscribe;
    }, [selector]); // 移除value依赖，避免循环

    return value;
  }
}

// 示例：创建一个全局共享的状态实例
// 可以在这里定义你的应用全局状态的类型
interface AppState {
  simulationRunning: boolean;
  activeAgentId: string | null;
  cameraTarget: { x: number; y: number } | null;
  worldState: any[]; // 用于存储来自world的实体状态
  snnTopology: any; // 保持兼容性的简单拓扑数据
  networkTopology: NetworkTopology | null; // 新的网络拓扑实例
  selectedNodeId: string | null; // 当前选中的节点ID
  selectedEdgeId: string | null; // 当前选中的边ID
}

const initialState: AppState = {
  simulationRunning: false,
  activeAgentId: null,
  cameraTarget: null,
  worldState: [], // 初始为空数组
  snnTopology: null, // 初始化snnTopology
  networkTopology: null, // 初始化网络拓扑
  selectedNodeId: null,
  selectedEdgeId: null,
};

export const globalState = new GlobalState<AppState>(initialState); 