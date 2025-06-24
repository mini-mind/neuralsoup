# 开发者指南

## 核心设计理念：分层与解耦

本项目采用**分层、模块化、事件驱动**的架构，旨在实现核心逻辑与UI展现的完全分离，提高代码的可测试性、可维护性和可扩展性。

- **`core` (核心层)**: 纯粹的TypeScript逻辑，不依赖任何UI框架（如React、PIXI.js）。理论上，核心层可以在Node.js环境中独立运行。它定义了世界规则、仿真循环和核心服务。
- **`modules` (功能模块层)**: 可插拔的功能单元，如不同类型的"大脑"、"传感器"或"执行器"。它们实现了`core`层定义的接口，并被动态加载。
- **`ui` (用户界面层)**: 所有的React组件和渲染逻辑（包括使用PIXI.js的画布渲染）。UI层通过订阅核心服务来获取状态，通过发布事件来表达用户意图。
- **`app` (应用层)**: 作为"总装车间"，负责初始化`core`模块，注册所有`modules`，并将它们与`ui`层连接起来。

这种架构使得每一层都可以独立开发和测试，极大地降低了项目的复杂性。

## 环境设置

### 系统要求

- Node.js 18+
- npm (或等效的包管理器)
- 现代浏览器 (支持WebGL)

### 快速启动

```bash
# 克隆项目
git clone <repository-url>
cd neuralsoup

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 项目结构 (新)

```
neuralsoup/
├── src/
│   ├── app/                 # ✨ 应用入口与总协调器
│   │   ├── App.tsx          # - 实例化核心模块，连接各层
│   │   └── registerModules.ts # - 注册所有可插拔模块
│   │
│   ├── core/                # ✨ 核心引擎 (纯TS, 无UI依赖)
│   │   ├── world/           #   - World类, 物理系统 (CollisionSystem)
│   │   ├── simulation/      #   - SimulationLoop
│   │   └── services/        #   - EventBus, GlobalState, ModuleRegistry
│   │
│   ├── modules/             # ✨ 可插拔的功能模块
│   │   ├── brains/          #   - JsScriptBrain, SnnBrain...
│   │   ├── sensors/         #   - VisionSensor...
│   │   └── worlds/          #   - 各种世界生成器
│   │
│   ├── ui/                  # ✨ 所有的React组件与UI逻辑
│   │   ├── components/      #   - 可复用的基础组件 (Button, Panel...)
│   │   ├── views/           #   - 主视图 (SimulationView...)
│   │   ├── renderers/       #   - PIXI.js渲染器
│   │   └── styles/          #   - 样式文件
│   │
│   ├── shared/              # ✨ 共享的TypeScript接口
│   │   └── interfaces/      #   - IAgent, IBrain, IWorld...
│
└── ... (其他配置文件)
```

## 核心概念

### 1. 事件驱动数据流

应用的数据流是单向且解耦的：

- **控制流 (用户 -> 核心)**:
  1.  用户在UI组件上操作（如点击"启动"按钮）。
  2.  UI组件向 `globalEventBus` 发布一个语义化的事件（`ui:start`）。
  3.  `App.tsx` 中设置的监听器捕获此事件。
  4.  监听器调用 `core` 模块的方法（`simulation.start()`）。

- **数据流 (核心 -> UI)**:
  1.  `SimulationLoop` 在每个tick更新 `World`。
  2.  循环将最新的世界状态（如智能体列表）更新到 `globalState` 中。
  3.  订阅了 `globalState` 的UI组件（如`SimulationView`）自动接收到新状态。
  4.  UI组件使用新状态重新渲染，无需通过props传递。

### 2. 模块注册与动态加载

通过 `ModuleRegistry` 服务，我们可以动态地创建和使用功能模块：

```typescript
// 1. 在 `registerModules.ts` 中注册模块
moduleRegistry.registerBrain('JsScriptBrain', JsScriptBrain);
moduleRegistry.registerSensor('VisionSensor', VisionSensor);

// 2. 在需要的地方，通过字符串ID创建实例
const brain = moduleRegistry.createBrain('JsScriptBrain', scriptCode);
const sensor = moduleRegistry.createSensor('VisionSensor', config);
```

### 3. SNN编辑器架构

SNN（脉冲神经网络）编辑器采用完全事件驱动的架构：

- **纯视图组件**: `SNNTopologyEditor` 是一个纯React组件，不包含任何业务逻辑。
- **状态管理**: 所有SNN拓扑数据存储在 `globalState.snnTopology` 中。
- **交互事件**: 用户的鼠标交互（点击、拖拽、滚轮）转换为标准化事件发送给 `globalEventBus`。
- **逻辑处理**: `App.tsx` 监听这些事件并更新全局状态，实现节点创建、拖拽、缩放等功能。

```typescript
// 用户双击画布 -> 创建新节点
globalEventBus.emit('ui:snn:canvas-doubleclick', { x, y });

// App.tsx 监听事件并更新状态
globalEventBus.on('ui:snn:canvas-doubleclick', (data) => {
  const newNode = { id: `neuron-${Date.now()}`, type: 'neuron', x: worldPos.x, y: worldPos.y };
  globalState.setState({ 
    snnTopology: { ...snnTopology, nodes: [...snnTopology.nodes, newNode] } 
  });
});
```

### 4. 全局状态管理

`GlobalState` 服务提供类型安全的状态管理：

```typescript
interface AppState {
  simulationRunning: boolean;
  activeAgentId: string | null;
  cameraTarget: { x: number; y: number } | null;
  worldState: IAgent[]; // 仿真世界状态
  snnTopology: SNNTopology; // SNN编辑器状态
}

// 组件中使用
const { snnTopology } = globalState.useStore(s => ({ snnTopology: s.snnTopology }));
```

## UI架构设计

### 布局结构

应用采用经典的三栏布局：

```
┌─────────────────────────────────────────────────────────┐
│                    AppHeader (顶部导航)                    │
├─────────────────────────────┬───────────────────────────┤
│                             │                           │
│     SimulationCanvas        │      SettingsPanel        │
│      (左侧仿真区域)            │      (右侧控制面板)         │
│                             │                           │
│  ┌─────────────────────┐    │  ┌─────────────────────┐  │
│  │    StatsOverlay     │    │  │   TabPanel          │  │
│  │   (统计信息覆盖)      │    │  │ ┌─────┬─────┬─────┐ │  │
│  └─────────────────────┘    │  │ │脚本 │参数 │SNN  │ │  │
│                             │  │ └─────┴─────┴─────┘ │  │
│                             │  │                     │  │
│                             │  │   (标签页内容区域)    │  │
│                             │  └─────────────────────┘  │
└─────────────────────────────┴───────────────────────────┘
```

### 组件层次结构

```
App
├── AppHeader                    # 顶部导航栏
└── main-layout
    ├── simulation-container     # 左侧仿真区域
    │   ├── SimulationCanvas     # PIXI.js 渲染的仿真画布
    │   └── StatsOverlay         # 统计信息覆盖层
    └── control-panel           # 右侧控制面板
        └── SettingsPanel
            └── TabPanel         # 标签页容器
                ├── ScriptEditArea      # 脚本编辑标签
                ├── AgentParametersPanel # 智能体参数标签
                └── SNNTopologyEditor   # SNN编辑器标签
```

### 响应式设计

- **桌面端**: 固定双栏布局，右侧控制面板宽度450px
- **移动端**: 可收缩的控制面板，支持全屏仿真模式

## 开发工作流

1.  **定义接口**: 在 `src/shared/interfaces` 中为新功能定义清晰的契约。
2.  **创建模块**: 在 `src/modules` 中创建实现该接口的新模块。
3.  **注册模块**: 在 `src/app/registerModules.ts` 中注册你的新模块。
4.  **开发UI**: 在 `src/ui` 中创建与用户交互的组件。让组件通过 `globalEventBus` 发布事件，通过 `globalState` 订阅数据。
5.  **组装应用**: 在 `App.tsx` 或相关模块中，监听UI事件并调用核心逻辑。

---
此文档将随项目进展持续更新。
