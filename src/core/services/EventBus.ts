/**
 * 一个简单的发布-订阅事件总线。
 */
type Listener<T> = (payload: T) => void;

export class EventBus<T extends Record<string, any>> {
  private events: { [K in keyof T]?: Listener<T[K]>[] } = {};

  /**
   * 订阅一个事件。
   * @param eventName - 事件名称。
   * @param listener - 事件监听器。
   * @returns 一个用于取消订阅的函数。
   */
  on<K extends keyof T>(eventName: K, listener: Listener<T[K]>): () => void {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName]!.push(listener);

    return () => {
      if (this.events[eventName]) {
        this.events[eventName] = this.events[eventName]!.filter(
          (l) => l !== listener
        );
      }
    };
  }

  /**
   * 发布一个事件。
   * @param eventName - 事件名称。
   * @param payload - 传递给监听器的数据。
   */
  emit<K extends keyof T>(eventName: K, payload: T[K]) {
    if (this.events[eventName]) {
      this.events[eventName]!.forEach((listener) => listener(payload));
    }
  }
}

// 在这里定义所有应用的事件类型
export interface AppEventMap {
  'ui:start': {};
  'ui:stop': {};
  'ui:snn:canvas-doubleclick': { x: number; y: number };
  'ui:snn:canvas-mousedown': { x: number; y: number; button: number; ctrlKey: boolean; shiftKey: boolean };
  'ui:snn:canvas-mousemove': { x: number; y: number; button: number; ctrlKey: boolean; shiftKey: boolean };
  'ui:snn:canvas-mouseup': { x: number; y: number; button: number; ctrlKey: boolean; shiftKey: boolean };
  'ui:snn:canvas-wheel': { deltaY: number };
}

// 创建一个单例供整个应用使用
export const globalEventBus = new EventBus<AppEventMap>(); 