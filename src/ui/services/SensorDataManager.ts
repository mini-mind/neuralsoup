/**
 * 传感器数据管理器
 * 负责管理World和UI中的sensor/effector之间的数据传输
 */

import { globalEventBus } from '../../core/services/EventBus';
import { ControllerGroupRegistry } from './ControllerGroupRegistry';

export class SensorDataManager {
  private static instance: SensorDataManager | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): SensorDataManager {
    if (!SensorDataManager.instance) {
      SensorDataManager.instance = new SensorDataManager();
    }
    return SensorDataManager.instance;
  }

  /**
   * 初始化传感器数据管理器
   */
  initialize(): void {
    if (this.isInitialized) {
      console.warn('SensorDataManager already initialized');
      return;
    }

    console.log('Initializing SensorDataManager...');
    this.isInitialized = true;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听来自world的视觉输入数据
    globalEventBus.on('sensor:visual-input', (data: any) => {
      this.handleVisualInput(data);
    });

    // 监听来自world的光感受器输入数据
    globalEventBus.on('sensor:light-input', (data: any) => {
      this.handleLightInput(data);
    });

    // 监听来自world的运动输出数据
    globalEventBus.on('effector:movement-output', (data: any) => {
      this.handleMovementOutput(data);
    });

    // 监听来自world的梯度运动输出数据
    globalEventBus.on('effector:gradient-movement-output', (data: any) => {
      this.handleGradientMovementOutput(data);
    });
  }

  /**
   * 处理视觉输入数据
   */
  private handleVisualInput(data: {
    agentId: string;
    visionInputs?: number[];
    lightIntensity?: number;
    timestamp: number;
  }): void {
    const registry = ControllerGroupRegistry.getInstance();
    const visualReceptorGroup = registry.getVisualReceptorGroup();

    if (visualReceptorGroup && visualReceptorGroup.pluginInstance) {
      const visualReceptor = visualReceptorGroup.pluginInstance;

      // 使用8方向的输入数据，如果没有则使用单一强度
      let visualInputs: number[];
      if (data.visionInputs && data.visionInputs.length === 8) {
        // 放大电压值，确保能够触发神经元
        visualInputs = data.visionInputs.map(intensity => intensity * 200); // 增加放大倍数
      } else {
        // 兼容旧格式：将单一光强度转换为8个方向的输入
        const intensity = data.lightIntensity || 0;
        visualInputs = new Array(8).fill(intensity * 200);
      }

      try {
        // 更新视觉感受器
        const spikeResults = visualReceptor.update(visualInputs, 1.0);

        // 计算总强度用于调试
        const totalIntensity = visualInputs.reduce((sum, v) => sum + v, 0) / 1600; // 归一化（因为放大倍数改为200）

        // 开发环境调试信息
        if (process.env.NODE_ENV === 'development' && totalIntensity > 0.01) {
          console.log(`Visual input processed: inputs=[${visualInputs.map(v => (v/200).toFixed(2)).join(', ')}], spikes=${spikeResults.filter(Boolean).length}/8`);
        }

        // 发送更新事件给UI
        globalEventBus.emit('ui:sensor-updated', {
          sensorType: 'visual',
          agentId: data.agentId,
          intensity: totalIntensity,
          spikeCount: spikeResults.filter(Boolean).length,
          visionInputs: visualInputs.map(v => v/200) // 归一化后的输入
        });

      } catch (error) {
        console.error('Error updating visual receptor:', error);
      }
    }
  }

  /**
   * 处理光感受器输入数据
   */
  private handleLightInput(data: {
    agentId: string;
    lightIntensity: number;
    timestamp: number;
  }): void {
    const registry = ControllerGroupRegistry.getInstance();
    const lightReceptorGroup = registry.getLightReceptorGroup();

    console.log(`Light input received: intensity=${data.lightIntensity.toFixed(4)}, lightReceptorGroup exists: ${!!lightReceptorGroup}, pluginInstance exists: ${!!lightReceptorGroup?.pluginInstance}`);

    if (lightReceptorGroup && lightReceptorGroup.pluginInstance) {
      const lightReceptor = lightReceptorGroup.pluginInstance;

      try {
        // 更新光感受器
        const isActive = lightReceptor.update(data.lightIntensity, 1.0);

        // 开发环境调试信息
        if (process.env.NODE_ENV === 'development' && data.lightIntensity > 0.001) {
          const voltage = lightReceptor.getLightNode().getState().voltage;
          console.log(`Light input processed: intensity=${data.lightIntensity.toFixed(4)}, active=${isActive}, voltage=${voltage.toFixed(2)}`);
        }

        // 发送更新事件给UI
        globalEventBus.emit('ui:sensor-updated', {
          sensorType: 'light',
          agentId: data.agentId,
          intensity: data.lightIntensity,
          isActive: isActive,
          voltage: lightReceptor.getLightNode().getState().voltage
        });

      } catch (error) {
        console.error('Error updating light receptor:', error);
      }
    }
  }

  /**
   * 处理运动输出数据
   */
  private handleMovementOutput(data: {
    agentId: string;
    gradientX: number;
    gradientY: number;
    magnitude: number;
    timestamp: number;
  }): void {
    const registry = ControllerGroupRegistry.getInstance();
    const movementControllerGroup = registry.getMovementControllerGroup();

    if (movementControllerGroup && movementControllerGroup.pluginInstance) {
      const movementController = movementControllerGroup.pluginInstance;
      
      try {
        // 将梯度转换为上下左右的输入
        const upInput = Math.max(0, -data.gradientY) * data.magnitude * 100;
        const downInput = Math.max(0, data.gradientY) * data.magnitude * 100;
        const leftInput = Math.max(0, -data.gradientX) * data.magnitude * 100;
        const rightInput = Math.max(0, data.gradientX) * data.magnitude * 100;
        
        // 更新移动控制器
        const movementResults = movementController.update(upInput, downInput, leftInput, rightInput, 1.0);
        
        // 输出调试信息
        if (data.magnitude > 0.01) {
          console.log(`Movement output processed: gradient=(${data.gradientX.toFixed(2)}, ${data.gradientY.toFixed(2)}), magnitude=${data.magnitude.toFixed(2)}`);
        }
        
        // 发送更新事件给UI
        globalEventBus.emit('ui:effector-updated', {
          effectorType: 'movement',
          agentId: data.agentId,
          gradientX: data.gradientX,
          gradientY: data.gradientY,
          magnitude: data.magnitude,
          activeDirections: Object.keys(movementResults).filter(key => movementResults[key as keyof typeof movementResults])
        });
        
      } catch (error) {
        console.error('Error updating movement controller:', error);
      }
    }
  }

  /**
   * 处理梯度运动输出数据
   */
  private handleGradientMovementOutput(data: {
    agentId: string;
    gradientMagnitude: number;
    timestamp: number;
  }): void {
    const registry = ControllerGroupRegistry.getInstance();
    const gradientControllerGroup = registry.getGradientMovementControllerGroup();

    if (gradientControllerGroup && gradientControllerGroup.pluginInstance) {
      const gradientController = gradientControllerGroup.pluginInstance;
      
      try {
        // 将梯度强度转换为输入信号
        const gradientInput = data.gradientMagnitude * 100; // 转换为电压值
        
        // 更新梯度运动控制器
        const isActive = gradientController.update(gradientInput, 1.0);
        
        // 输出调试信息
        if (data.gradientMagnitude > 0.01) {
          console.log(`Gradient movement processed: magnitude=${data.gradientMagnitude.toFixed(2)}, active=${isActive}`);
        }
        
        // 发送更新事件给UI
        globalEventBus.emit('ui:effector-updated', {
          effectorType: 'gradient_movement',
          agentId: data.agentId,
          magnitude: data.gradientMagnitude,
          isActive: isActive,
          strength: gradientController.getGradientStrength()
        });
        
      } catch (error) {
        console.error('Error updating gradient movement controller:', error);
      }
    }
  }

  /**
   * 获取当前传感器状态
   */
  getCurrentSensorStates(): {
    visual: any;
    movement: any;
    gradientMovement: any;
    light: any;
  } {
    const registry = ControllerGroupRegistry.getInstance();

    const visualGroup = registry.getVisualReceptorGroup();
    const movementGroup = registry.getMovementControllerGroup();
    const gradientGroup = registry.getGradientMovementControllerGroup();
    const lightGroup = registry.getLightReceptorGroup();

    return {
      visual: visualGroup?.pluginInstance ? {
        receptors: visualGroup.pluginInstance.getReceptors().map((r: any) => r.getState()),
        angles: visualGroup.pluginInstance.getReceptorAngles()
      } : null,
      movement: movementGroup?.pluginInstance ? {
        vector: movementGroup.pluginInstance.getMovementVector(),
        nodes: {
          up: movementGroup.pluginInstance.getUpNode().getState(),
          down: movementGroup.pluginInstance.getDownNode().getState(),
          left: movementGroup.pluginInstance.getLeftNode().getState(),
          right: movementGroup.pluginInstance.getRightNode().getState()
        }
      } : null,
      gradientMovement: gradientGroup?.pluginInstance ? {
        strength: gradientGroup.pluginInstance.getGradientStrength(),
        node: gradientGroup.pluginInstance.getGradientNode().getState()
      } : null,
      light: lightGroup?.pluginInstance ? {
        intensity: lightGroup.pluginInstance.getLightIntensity(),
        node: lightGroup.pluginInstance.getLightNode().getState()
      } : null
    };
  }

  /**
   * 重置所有传感器
   */
  resetAllSensors(): void {
    const registry = ControllerGroupRegistry.getInstance();

    const visualGroup = registry.getVisualReceptorGroup();
    const movementGroup = registry.getMovementControllerGroup();
    const gradientGroup = registry.getGradientMovementControllerGroup();
    const lightGroup = registry.getLightReceptorGroup();

    if (visualGroup?.pluginInstance) {
      visualGroup.pluginInstance.reset();
    }

    if (movementGroup?.pluginInstance) {
      movementGroup.pluginInstance.reset();
    }

    if (gradientGroup?.pluginInstance) {
      gradientGroup.pluginInstance.reset();
    }

    if (lightGroup?.pluginInstance) {
      lightGroup.pluginInstance.reset();
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('All sensors reset');
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.isInitialized = false;
    // 移除事件监听器会在globalEventBus中自动处理
  }
}
