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
  'world:changed': { worldType: string };
  'world:instance': { world: any };
  'plugins:state-updated': { worldType: string; config: any };
  'sensor:visual-input': { agentId: string; visionInputs?: number[]; lightIntensity?: number; timestamp: number };
  'sensor:light-input': { agentId: string; lightIntensity: number; timestamp: number };
  'effector:movement-output': { agentId: string; gradientX: number; gradientY: number; magnitude: number; timestamp: number };
  'effector:gradient-movement-output': { agentId: string; gradientMagnitude: number; timestamp: number };
  'ui:sensor-updated': { sensorType: string; agentId: string; [key: string]: any };
  'ui:effector-updated': { effectorType: string; agentId: string; [key: string]: any };
}

// 创建一个单例供整个应用使用
export const globalEventBus = new EventBus<AppEventMap>(); 