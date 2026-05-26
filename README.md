# NeuralSoup

`neuralsoup` 是一个基于 TypeScript、React、Vite 和 PixiJS 的具身智能体仿真与拓扑编辑项目。仓库主线只接受当前 `AgentIR` 规范。

## 快速启动

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```

服务启动后访问：

```text
http://<服务器IP>:3000
```

## 常用命令

```bash
npm run type-check
npm run test:domain
npm run check:pixi-imports
npm run build
npm run test:e2e
```

## 目录

```text
src/
  App.tsx                 # 顶层 UI 编排
  components/             # React 组件、拓扑编辑器和仿真画布
  components/editor/      # 右侧编辑区的标签页、设置面板和工具栏
  domain/                 # 纯领域模型和 brain/world 逻辑
  engine/                 # 仿真引擎、Pixi 入口和世界渲染
  runtime/                # 仿真 session 边界
  types/                  # 共享类型
tests/domain/             # 领域契约测试
e2e/                      # Playwright 端到端测试
```

## 架构

- `AgentIR` 是唯一持久化真源，顶层分为 `BodyIR`、`BrainIR`、`connections` 和可选 `layout`。
- `src/domain/brain/` 负责 IR、编译、运行时步进、校验和 body endpoint 解析，不依赖 React 或 Pixi。
- `src/runtime/SimulationSession.ts` 和 `src/engine/` 负责仿真 session、世界状态、渲染和宿主集成。
- 右侧编辑区包含 `BodyIR` 画布、`BrainIR` 画布和设置页；`src/components/editor/graph/sharedCanvasCore.ts` 提供两类画布复用的交互能力边界。
- `GraphView` 负责拓扑可视化、选择、连线、分组、详情编辑和运行态诊断映射；持久化只写回 `AgentIR`，画布视角、缩放、选择和弹窗等属于会话态。

## 界面

- 左侧游戏区域负责仿真运行、奖励/FPS 展示和智能体观察。
- 右侧编辑区顶部在 `Settings` 与 `GraphView` 之间切换。
- `Settings` 内包含智能体参数和手动控制说明。
- `BodyIR` 画布编辑 world 信号与 body signal 节点的映射。
- `GraphView` 编辑 BrainIR 容器、神经元、连接和分组层级。
- 空格用于开始/继续或暂停仿真，输入控件聚焦时不会触发全局快捷键。

## 文档

- [AGENTS.md](./AGENTS.md)：代理维护规则、命令、代码边界和验证要求。
- [docs/AGENT_ARCHITECTURE.md](./docs/AGENT_ARCHITECTURE.md)：当前 `AgentIR` 结构、编译运行时边界和编辑器职责说明。
