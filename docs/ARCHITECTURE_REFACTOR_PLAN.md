# NeuralSoup 彻底重构方案

本文档记录一次不考虑历史兼容的架构重构方案。目标不是在现有结构上继续补丁，而是收口真实主路径、统一神经网络模型真源、拆开 UI 宿主与仿真核心，并让测试跟随新的边界。

## Findings

### P0: 编辑器模型与运行时 SNN 是两套互不等价的真源

- 位置：`src/components/SNNTopologyEditor.tsx`、`src/components/utils/defaultSNNData.ts`、`src/engine/AgentController.ts`、`src/engine/CorticalColumn.ts`
- 结论：source of truth 混乱、模块间不合理侵入、伪活代码。
- 证据：拓扑编辑器维护 `nodes/synapses/receptors/effectors`，并在组件内部用 `setInterval` 执行一套 IZ 神经元脉冲传播；运行时 SNN 则由 `AgentController` 为 agent 创建硬编码多层 `CorticalColumn`，二者没有编译契约或共享模型实例。`App` 只把 `visionCells` 传给编辑器，没有把编辑器拓扑提交给仿真运行时。
- 风险：用户在拓扑沙盒里编辑的网络不会成为左侧智能体的真实控制网络，UI 语义与运行时语义持续漂移；后续任何“编辑器联动仿真”的修复都会被迫同时改两套模型。
- 建议：删除双轨。以 `BrainGraph` 作为唯一可编辑模型，运行时只能消费 `BrainProgram` 编译产物；编辑器不能自带第二套神经运行时，只能渲染、编辑、预览或调用同一个 runtime core。
- 置信度：高。

执行约束：拓扑可见不等于拓扑生效。任何 `snn` 功能变更都必须证明编辑后的 `BrainGraph` 会改变运行时主 agent 的 `ActionOutput` 或 session snapshot。

### P0: React 宿主直接持有引擎实例并跨层调度运行时细节

- 位置：`src/App.tsx`、`src/components/SimulationCanvas.tsx`、`src/engine/SimulationEngine.ts`
- 结论：局部过度耦合、模块间不合理侵入。
- 证据：`App` 保存 `SimulationEngine | null`，直接调用 `setScriptCode`、`setEnablePlayerInputInScript`、`setControlMode`、`updateAgentParameters`、`reset/start/pause/resume`；`SimulationCanvas` 同时负责 Pixi app 生命周期、engine 生命周期、初始化错误 UI、世界尺寸和 camera target。
- 风险：UI 状态、渲染器生命周期、仿真生命周期相互缠绕。初始化失败、重置、模式切换和参数变更都需要跨多个 React effect 和 engine 方法同步，容易产生半初始化实例或过期回调。
- 建议：引入明确的 `SimulationSession` 边界。React 只能 dispatch 命令和订阅快照，不能持有或操作 engine internals；Pixi canvas 只实现 renderer adapter，不能创建领域世界或配置控制器。
- 置信度：高。

### P1: `types/simulation.ts` 混合领域模型、编辑器模型、渲染缓存和 UI 状态

- 位置：`src/types/simulation.ts`
- 结论：语义分层错误、假定真源混乱。
- 证据：同一文件同时定义 `Agent/Food/Obstacle/World`、`SNNNode/SNNSynapse/Receptor/Effector`、`sprite?/visionSprites?` 等渲染字段、`SimulationState` 投影和 `ActionOutput`。领域实体知道 Pixi 渲染缓存字段，编辑器节点与运行时 agent 共用一个类型模块。
- 风险：任何模型变更都容易在编辑器、渲染、仿真之间扩散；测试也会继续把混合结构当成公共契约，阻碍删除历史字段。
- 建议：拆成 `domain/world`、`domain/brain`、`runtime/session`、`rendering/pixi`、`ui/editor` 五类类型。领域类型不得包含 Pixi/React 字段，UI 投影必须是派生 snapshot。
- 置信度：高。

### P1: 控制模式被塞进 agent 字段，导致策略、输入设备和模型执行混在一起

- 位置：`src/types/simulation.ts` 的 `Agent.controlType`、`src/engine/AgentController.ts`、`src/App.tsx`
- 结论：局部过度耦合、source of truth 混乱。
- 证据：`Agent.controlType` 同时表达 keyboard/script/snn/random；`AgentController` 直接注册全局键盘事件、编译脚本、执行 SNN、执行随机游走。`App` 的 `manual` 又映射到 `keyboard`，形成 UI 命名和 runtime 命名的双层翻译。
- 风险：输入设备、控制策略、agent 状态互相污染。新增一种控制方式会影响 entity shape、UI mode、controller switch 和测试 selector。
- 建议：agent 只保存物理和神经状态；控制方式迁移为 `ControlPolicy`，由 session 对主 agent 绑定策略。keyboard、script、brain、random 都是策略实现，输入采集归 host adapter。
- 置信度：高。

执行约束：`scriptPolicy` 的编译或执行失败必须进入显式错误状态，不得退回 random action 或静默使用默认动作。`brainPolicy` 不得自行 new 神经网络，只能接收 `BrainProgram`。

### P1: Pixi 单入口已经收口，但渲染边界仍然承担领域行为

- 位置：`src/engine/pixi.ts`、`src/engine/WorldRenderer.ts`、`src/components/SimulationCanvas.tsx`
- 结论：边界部分收紧但职责仍混合。
- 证据：Pixi import 已统一到 `src/engine/pixi.ts`，但 `WorldRenderer` 内部维护 camera target、世界尺寸、对象池、背景噪声、视野扇形绘制和调试日志；`SimulationCanvas` 固定 world size 并设置 camera target。
- 风险：渲染器继续理解主 agent、视野角度和 camera 策略，领域变更会牵动 Pixi 代码；渲染失败路径也容易被误认为 engine 失败。
- 建议：保留 Pixi 单入口，但把渲染器收窄为 `RendererPort.render(snapshot)`。camera、viewport、world snapshot 由 session 生成；Pixi adapter 只负责把 snapshot 绘制到 canvas。
- 置信度：高。

### P2: E2E 测试偏向当前 DOM 和降级行为，缺少领域边界测试

- 位置：`e2e/app.spec.ts`、`playwright.config.ts`
- 结论：测试债务。
- 证据：Playwright 已覆盖启动、渲染错误 UI、参数弹窗、脚本语法、拓扑交互等浏览器路径，但缺少纯 TypeScript 单元测试来锁定 `BrainGraph -> BrainProgram -> ActionOutput`、world step determinism、session command reducer 等新边界。
- 风险：重构只能靠浏览器端症状判断，底层模型和 session 契约容易回归后才在 UI 中暴露。
- 建议：重构时先补领域层测试，再调整 E2E。E2E 只保留用户工作流和渲染启动契约，不反向要求源码保留旧 DOM 或旧字段。
- 置信度：高。

执行约束：触达 `App`、viewport、session、brain editor、brain compiler 或 shared types 的 PR，至少要有一个无头契约测试覆盖真实领域语义；只断言 `data-testid` 或文本变化的测试不能作为主要安全网。

## 目标架构

目标结构按语义分层，而不是按现有历史文件名迁移：

```text
src/
  app/
    App.tsx
    simulationStore.ts
    commandHandlers.ts
  domain/
    world/
      types.ts
      worldFactory.ts
      worldStep.ts
      collision.ts
      vision.ts
    brain/
      graph.ts
      defaults.ts
      compiler.ts
      program.ts
      step.ts
      validation.ts
    control/
      policy.ts
      keyboardPolicy.ts
      scriptPolicy.ts
      brainPolicy.ts
      randomPolicy.ts
  runtime/
    SimulationSession.ts
    SimulationClock.ts
    snapshots.ts
    commands.ts
  rendering/
    pixi/
      pixi.ts
      PixiRenderer.ts
      sceneMapper.ts
  ui/
    simulation/
      SimulationViewport.tsx
      SimulationControls.tsx
      AgentParametersDialog.tsx
    brain-editor/
      BrainEditor.tsx
      BrainCanvas.tsx
      editorState.ts
      editorEvents.ts
      renderers/
  tests/
```

### 关键边界

- `domain/*` 是纯 TypeScript，不依赖 React、Pixi、DOM、`window`、`performance`、`requestAnimationFrame`。
- `runtime/SimulationSession` 是唯一能持有可变仿真世界的对象，外部只能发送 `SimulationCommand` 并订阅 `SimulationSnapshot`。
- `domain/brain/graph.ts` 是可编辑神经网络唯一真源。编辑器读写 `BrainGraph`，运行时只消费 `compileBrainGraph(graph)` 输出的 `BrainProgram`。
- `ControlPolicy` 是控制策略边界。keyboard/script/brain/random 不写入 agent schema，只产生 `ActionOutput`。
- `rendering/pixi` 只处理 Pixi 生命周期和绘制，不生成世界、不决定控制模式、不持有业务状态。
- React 层只拥有 UI 状态和命令分发，不直接调用 engine 内部方法。

## 数据流

```text
BrainEditor edits BrainGraph
  -> compileBrainGraph(BrainGraph) returns BrainProgram
  -> SimulationSession receives SetBrainProgram command
  -> session tick collects Observation
  -> ControlPolicy decides ActionOutput
  -> worldStep mutates/replaces WorldState
  -> session emits SimulationSnapshot
  -> React controls render state
  -> PixiRenderer renders snapshot
```

这个数据流里只有三种跨层数据：

- `SimulationCommand`：UI 到 runtime 的输入。
- `SimulationSnapshot`：runtime 到 UI/rendering 的只读投影。
- `BrainGraph/BrainProgram`：编辑器和运行时之间的正式模型契约。

## 不兼容清理规则

本次目标明确不保留旧内部兼容：

- 删除 `SNNTopologyEditor` 内部 `setInterval` 神经仿真，改为使用 `domain/brain/step` 或只显示 runtime preview snapshot。
- 删除 `Agent.controlType`，改为 session 级主 agent policy binding。
- 删除领域实体里的 `sprite`、`visionSprites` 等渲染缓存字段。
- 删除 `SimulationEngine` 对 React 回调的直接依赖，改成 session event/subscription。
- 删除 UI mode 到 engine mode 的字符串翻译层，统一使用 `ControlPolicyId`。
- 删除编辑器中不可被运行时消费的输出端口语义，或将其提升为正式 `BrainProgram` 输出契约。
- 删除无调用点或只服务旧设计的检测 helper，例如单体碰撞路径规划 helper，除非迁移时能证明新边界仍需要。

## 迁移顺序

### Phase 1: 建立新模型真源

1. 新增 `domain/brain`，定义 `BrainGraph`、`BrainProgram`、编译器和校验器。
2. 把 `defaultSNNData` 迁移为 `domain/brain/defaults`，使默认模型不依赖 React canvas 坐标。
3. 为 `BrainGraph -> BrainProgram` 增加单元测试，覆盖输入维度、输出通道、非法边、空图和权重符号。

### Phase 2: 拆 runtime session

1. 新增 `domain/world` 和 `runtime/SimulationSession`。
2. 将 `WorldManager`、`VisionSystem`、`CollisionDetector` 的领域逻辑迁移为纯函数或小对象。
3. `SimulationSession.tick(dt)` 成为唯一仿真推进入口。
4. `SimulationSnapshot` 成为 UI 和 Pixi 的唯一读取模型。

### Phase 3: 拆控制策略

1. 从 `AgentController` 中拆出 `ControlPolicy` 接口。
2. keyboard 输入采集移到 React host adapter，session 只接收输入 snapshot。
3. script 编译成为 `scriptPolicy` 的显式错误状态，不用随机动作掩盖脚本失败。
4. brain policy 只接收 `BrainProgram` 和 observation。

### Phase 4: 收窄渲染和 React 宿主

1. 将 `SimulationCanvas` 改名为 `SimulationViewport`，只创建 renderer adapter 并订阅 snapshot。
2. `PixiRenderer.render(snapshot)` 替代 `WorldRenderer.renderWorld(world)`。
3. `App` 拆成 store、controls、viewport、brain editor；`App` 不再持有 engine 实例。

### Phase 5: 编辑器接入真实模型

1. `BrainEditor` 只编辑 `BrainGraph` 和 `EditorViewportState`。
2. 神经元详情、突触详情直接修改 `BrainGraph`。
3. 编辑器 preview 使用同一 `domain/brain/step`，不得复制运行时算法。
4. E2E 断言“编辑后的模型能驱动仿真策略”，而不是只断言拓扑画布交互。

## 验证计划

最小验证集：

```bash
npm run type-check
npm run check:pixi-imports
```

扩大验证集：

```bash
npm run build
```

最终回归：

```bash
npm run test:e2e
```

重构期间应新增领域层测试命令。新增后，领域测试必须先于 Playwright 执行；Playwright 只验证端到端工作流和渲染启动契约。

## 完成标准

- 编辑器和运行时使用同一个 `BrainGraph` 真源。
- 仿真推进只能通过 `SimulationSession.tick`。
- UI 不持有 engine internals。
- Pixi adapter 不包含领域决策。
- 领域实体不包含渲染缓存、React 状态或 DOM 对象。
- 删除旧双轨后，全仓搜索不到旧 `SNNTopologyEditor` runtime loop、`Agent.controlType`、直接 engine callback 绑定和绕过 `BrainProgram` 的 SNN 执行路径。
