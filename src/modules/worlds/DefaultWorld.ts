import type { IWorld } from '../../shared/interfaces/IWorld';
import type { IAgent } from '../../shared/interfaces/IAgent';
import type { IBrain } from '../../shared/interfaces/IBrain';
import type { ISensor } from '../../shared/interfaces/ISensor';
import { moduleRegistry } from '../../core/services/ModuleRegistry';

class ConcreteAgent implements IAgent {
  readonly id: string;
  readonly brain: IBrain;
  sensors: ISensor[];
  effectors = [];

  // ICollidable 属性
  x: number;
  y: number;
  angle: number;
  radius = 10;
  entityType = 'agent';

  constructor(id: string, brain: IBrain, sensors: ISensor[], initialPos: {x: number, y: number}) {
    this.id = id;
    this.brain = brain;
    this.sensors = sensors;
    this.x = initialPos.x;
    this.y = initialPos.y;
    this.angle = Math.random() * Math.PI * 2;
  }

  update(world: IWorld): void {
    // 1. 从所有传感器收集状态
    const state = this.sensors.reduce((acc, sensor) => {
      // 这里的键应该是传感器的类型或ID
      return { ...acc, vision: sensor.read(world, this) };
    }, {});

    // 2. 大脑根据状态做出决策
    const action = this.brain.decide(state);

    // 3. 执行器根据动作更新自身状态（简化版）
    if (action.type === 'move') {
      this.x += Math.cos(action.direction) * action.speed;
      this.y += Math.sin(action.direction) * action.speed;
      this.angle = action.direction;
    }
  }
}

/**
 * 创建一个包含默认智能体的世界。
 * @param world - 要填充的IWorld实例。
 */
export function createDefaultWorld(world: IWorld): void {
  // 演示用的脚本
  const script = `
    onFrame( ({ vision, move }) => {
      // 一个简单的逻辑：如果看到了什么，就转弯
      if (vision[0] > 0) {
        move(Math.random() * Math.PI * 2, 0.5);
      } else {
        move(0, 1); // 否则前进
      }
    })
  `;
  
  // 使用注册表动态创建模块
  const brain = moduleRegistry.createBrain('JsScriptBrain', script);
  const sensor = moduleRegistry.createSensor('VisionSensor');

  if (brain && sensor) {
    const agent = new ConcreteAgent('agent-0', brain, [sensor], {x: 400, y: 300});
    world.addAgent(agent);
    console.log('Default world created with a dynamic agent.');
  } else {
    console.error('Failed to create modules for the default agent.');
  }
} 