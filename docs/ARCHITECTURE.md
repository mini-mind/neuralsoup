# NeuralSoup 架构设计文档

## 概述

NeuralSoup 是一个模块化的具身智能体仿真平台，采用**分层、解耦、事件驱动**的架构设计。本文档详细描述了系统的架构决策、组件设计和数据流。

## 设计原则

### 1. 分层架构 (Layered Architecture)
- **核心层 (Core)**: 纯TypeScript业务逻辑，无UI依赖
- **模块层 (Modules)**: 可插拔的功能单元
- **UI层 (UI)**: React组件和渲染逻辑
- **应用层 (App)**: 协调各层的集成层

### 2. 关注点分离 (Separation of Concerns)
- 业务逻辑与UI展现完全分离
- 状态管理与组件渲染解耦
- 事件处理与业务处理分离

### 3. 事件驱动 (Event-Driven)
- 组件间通过事件总线通信
- 避免直接依赖和紧耦合
- 支持异步和响应式编程

## 目录结构

```
src/
├── app/                         # 应用层：总装配和协调
│   ├── App.tsx                  # 主应用组件，连接各层
│   └── registerModules.ts       # 模块注册中心
│
├── core/                        # 核心层：纯业务逻辑
│   ├── services/                # 核心服务
│   │   ├── EventBus.ts          # 事件总线服务
│   │   ├── GlobalState.ts       # 全局状态管理
│   │   └── ModuleRegistry.ts    # 模块注册表
│   ├── simulation/              # 仿真引擎
│   │   └── SimulationLoop.ts    # 仿真循环控制
│   └── world/                   # 世界模型
│       ├── World.ts             # 世界容器类
│       └── systems/             # 世界系统
│           └── CollisionSystem.ts # 碰撞检测系统
│
├── modules/                     # 模块层：可插拔功能
│   ├── brains/                  # 智能体大脑模块
│   │   ├── JsScriptBrain.ts     # JavaScript脚本大脑
│   │   └── snn/                 # 脉冲神经网络模块
│   │       ├── CorticalColumn.ts
│   │       └── defaultSNN.ts    # 默认SNN拓扑
│   ├── sensors/                 # 传感器模块
│   │   └── VisionSensor.ts      # 视觉传感器
│   ├── effectors/               # 执行器模块
│   ├── learning/                # 学习算法模块
│   └── worlds/                  # 世界生成器模块
│       └── DefaultWorld.ts      # 默认世界生成器
│
├── ui/                          # UI层：用户界面
│   ├── components/              # 可复用UI组件
│   │   ├── AppHeader.tsx        # 应用头部
│   │   ├── SettingsPanel.tsx    # 设置面板
│   │   ├── TabPanel.tsx         # 标签页组件
│   │   ├── ScriptEditArea.tsx   # 脚本编辑区
│   │   ├── AgentParametersPanel.tsx # 智能体参数面板
│   │   ├── StatsOverlay.tsx     # 统计信息覆盖层
│   │   └── CanvasRenderer.tsx   # 画布渲染器
│   ├── views/                   # 主要视图组件
│   │   ├── SimulationCanvas.tsx # 仿真画布视图
│   │   └── SNNTopologyEditor.tsx # SNN拓扑编辑器
│   ├── renderers/               # 专用渲染器
│   │   ├── AgentRenderer.ts     # 智能体渲染器
│   │   ├── BackgroundRenderer.ts # 背景渲染器
│   │   └── ...                  # 其他渲染器
│   ├── controllers/             # UI控制器
│   │   └── KeyboardController.ts # 键盘控制器
│   └── styles/                  # 样式文件
│       ├── layout.css           # 布局样式
│       ├── buttons.css          # 按钮样式
│       └── ...                  # 其他样式
│
├── shared/                      # 共享层：接口和类型定义
│   └── interfaces/              # TypeScript接口
│       ├── IAgent.ts            # 智能体接口
│       ├── IBrain.ts            # 大脑接口
│       ├── ISensor.ts           # 传感器接口
│       ├── IEffector.ts         # 执行器接口
│       ├── IWorld.ts            # 世界接口
│       └── ICollidable.ts       # 可碰撞对象接口
│
└── contexts/                    # React上下文
    └── LanguageContext.tsx      # 国际化上下文
```

## 核心服务架构

### 1. EventBus（事件总线）

```typescript
interface AppEventMap {
  'ui:start': {};
  'ui:stop': {};
  'ui:snn:canvas-doubleclick': { x: number; y: number };
  'ui:snn:canvas-mousedown': { x: number; y: number; button: number; ctrlKey: boolean; shiftKey: boolean };
  'ui:snn:canvas-mousemove': { x: number; y: number; button: number; ctrlKey: boolean; shiftKey: boolean };
  'ui:snn:canvas-mouseup': { x: number; y: number; button: number; ctrlKey: boolean; shiftKey: boolean };
  'ui:snn:canvas-wheel': { deltaY: number };
}

export const globalEventBus = new EventBus<AppEventMap>();
```

**设计特点：**
- 强类型事件系统，编译期类型检查
- 支持事件订阅和取消订阅
- 解耦组件间通信

### 2. GlobalState（全局状态）

```typescript
interface AppState {
  simulationRunning: boolean;
  activeAgentId: string | null;
  cameraTarget: { x: number; y: number } | null;
  worldState: IAgent[];
  snnTopology: SNNTopology;
}

export const globalState = new GlobalState<AppState>(initialState);
```

**设计特点：**
- 类型安全的状态管理
- 发布-订阅模式通知状态变更
- 提供React Hook用于组件订阅
- 支持部分状态更新

### 3. ModuleRegistry（模块注册表）

```typescript
class ModuleRegistry {
  registerBrain(id: string, brainClass: any): void;
  registerSensor(id: string, sensorClass: any): void;
  createBrain(id: string, ...args: any[]): IBrain | null;
  createSensor(id: string, ...args: any[]): ISensor | null;
}
```

**设计特点：**
- 支持动态模块注册和创建
- 基于字符串ID的模块查找
- 支持构造函数参数传递

## 数据流架构

### 1. 用户交互流 (UI → Core)

```
用户操作 → UI组件 → EventBus → App.tsx监听器 → Core模块调用
```

**示例：启动仿真**
1. 用户点击"播放"按钮
2. `AppHeader` 组件发布 `ui:start` 事件
3. `App.tsx` 中的监听器捕获事件
4. 调用 `simulation.start()` 方法

### 2. 状态更新流 (Core → UI)

```
Core模块更新 → GlobalState → 订阅组件 → UI重新渲染
```

**示例：仿真状态更新**
1. `SimulationLoop` 更新世界状态
2. 调用 `globalState.setState({ worldState: agents })`
3. 订阅了 `worldState` 的组件自动重新渲染

### 3. SNN编辑器交互流

```
画布交互 → 事件转换 → EventBus → App.tsx处理 → GlobalState更新 → 编辑器重绘
```

**示例：创建神经元节点**
1. 用户双击SNN编辑器画布
2. `SNNTopologyEditor` 发布 `ui:snn:canvas-doubleclick` 事件
3. `App.tsx` 监听器计算世界坐标
4. 创建新节点并更新 `globalState.snnTopology`
5. 编辑器组件接收新状态并重新渲染

## 组件架构设计

### 1. 纯视图组件 (Pure View Components)

所有UI组件都设计为纯视图组件：

```typescript
// ✅ 好的设计：纯视图组件
const SNNTopologyEditor: React.FC<Props> = ({ width, height }) => {
  const { snnTopology } = globalState.useStore(s => ({ snnTopology: s.snnTopology }));
  
  const handleMouseDown = (e: React.MouseEvent) => {
    globalEventBus.emit('ui:snn:canvas-mousedown', { x: e.clientX, y: e.clientY });
  };
  
  return <canvas onMouseDown={handleMouseDown} />;
};
```

**设计原则：**
- 不包含业务逻辑
- 只负责渲染和事件转发
- 通过GlobalState获取数据
- 通过EventBus发送事件

### 2. 业务逻辑集中化

所有业务逻辑集中在 `App.tsx` 中：

```typescript
// App.tsx 中的事件处理
useEffect(() => {
  const unsubscribe = globalEventBus.on('ui:snn:canvas-doubleclick', (data) => {
    const { snnTopology } = globalState.getState();
    if (snnTopology) {
      const worldPos = canvasToWorld(data, snnTopology.canvasOffset, snnTopology.canvasScale);
      const newNode = {
        id: `neuron-${Date.now()}`,
        type: 'neuron',
        x: worldPos.x,
        y: worldPos.y,
      };
      globalState.setState({
        snnTopology: { ...snnTopology, nodes: [...snnTopology.nodes, newNode] }
      });
    }
  });
  
  return unsubscribe;
}, []);
```

## 渲染架构

### 1. PIXI.js 仿真渲染

```typescript
// SimulationCanvas.tsx
const SimulationView: React.FC = () => {
  useEffect(() => {
    const app = new PIXI.Application({...});
    const agentRenderer = new AgentRenderer(app.stage);
    
    const renderLoop = () => {
      const agents = globalState.getState().worldState;
      agentRenderer.render(agents);
    };
    
    PIXI.Ticker.shared.add(renderLoop);
  }, []);
};
```

### 2. Canvas 2D SNN编辑器渲染

```typescript
// CanvasRenderer.tsx
export class CanvasRenderer {
  static draw({ canvasRef, snnTopology }: CanvasRendererProps) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    // 清空画布
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制网格
    this.drawGrid(ctx, canvas.width, canvas.height, snnTopology.canvasOffset, snnTopology.canvasScale);
    
    // 绘制节点
    snnTopology.nodes.forEach(node => {
      const { x, y } = this.worldToCanvas(node, snnTopology.canvasOffset, snnTopology.canvasScale);
      // ... 渲染逻辑
    });
  }
}
```

## 模块化设计

### 1. 大脑模块接口

```typescript
interface IBrain {
  decide(state: any): any;
}

// 实现示例
class JsScriptBrain implements IBrain {
  constructor(private script: string) {}
  
  decide(state: any): any {
    // 执行JavaScript脚本
    return this.executeScript(state);
  }
}
```

### 2. 传感器模块接口

```typescript
interface ISensor {
  read(world: IWorld, agent: IAgent): any;
}

// 实现示例
class VisionSensor implements ISensor {
  read(world: IWorld, agent: IAgent): any {
    // 实现视觉感知逻辑
    return this.computeVision(world, agent);
  }
}
```

## 扩展性设计

### 1. 新增模块类型

要添加新的模块类型（如执行器），只需：

1. 在 `shared/interfaces/` 中定义接口
2. 在 `modules/effectors/` 中实现具体类
3. 在 `ModuleRegistry` 中添加注册方法
4. 在 `registerModules.ts` 中注册实例

### 2. 新增UI组件

要添加新的UI功能，只需：

1. 在 `ui/components/` 中创建纯视图组件
2. 在 `AppEventMap` 中定义相关事件
3. 在 `AppState` 中添加相关状态
4. 在 `App.tsx` 中添加事件监听器

## 性能优化策略

### 1. 状态订阅优化

```typescript
// 使用选择器避免不必要的重渲染
const { snnTopology } = globalState.useStore(s => ({ snnTopology: s.snnTopology }));
```

### 2. 事件处理优化

```typescript
// 使用防抖避免频繁的状态更新
const debouncedUpdate = debounce((newState) => {
  globalState.setState(newState);
}, 16); // 60fps
```

### 3. 渲染优化

```typescript
// 使用PIXI.js的高效渲染
const ticker = PIXI.Ticker.shared;
ticker.add(renderLoop);
```

## 测试策略

### 1. 单元测试

- 核心服务类（EventBus, GlobalState, ModuleRegistry）
- 模块实现类（各种Brain, Sensor等）
- 工具函数和计算逻辑

### 2. 集成测试

- 事件流测试（UI事件 → 状态更新）
- 模块注册和创建测试
- 渲染流程测试

### 3. E2E测试

- 完整的用户交互流程
- SNN编辑器功能测试
- 仿真运行测试

## 部署架构

### 1. 开发环境

```bash
npm run dev  # Vite开发服务器
```

### 2. 生产构建

```bash
npm run build  # 生成静态文件
npm run preview  # 预览生产构建
```

### 3. 部署选项

- 静态文件托管（Netlify, Vercel, GitHub Pages）
- CDN分发
- 容器化部署（Docker）

## 总结

NeuralSoup的架构设计遵循现代前端应用的最佳实践，通过分层、解耦和事件驱动的设计模式，实现了高度可维护、可扩展和可测试的代码结构。这种架构使得：

1. **业务逻辑与UI完全分离**，便于独立开发和测试
2. **模块化设计**支持功能的热插拔和扩展
3. **事件驱动架构**实现了组件间的松耦合
4. **类型安全**的状态管理和事件系统减少了运行时错误
5. **清晰的数据流**使得应用行为可预测和可调试

这种架构为未来的功能扩展和性能优化奠定了坚实的基础。 