# NeuralSoup

`neuralsoup` 是一个基于 TypeScript、React、Vite 和 PixiJS 的具身智能体仿真与神经网络拓扑编辑项目。

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
  components/             # React 组件、拓扑编辑器和 canvas 渲染器
  components/editor/      # 右侧编辑区的标签页、设置面板和工具栏
  domain/                 # 纯领域模型和 brain/world 逻辑
  engine/                 # 仿真引擎、Pixi 入口和世界渲染
  runtime/                # 仿真 session 边界
  types/                  # 共享类型
tests/domain/             # 领域契约测试
e2e/                      # Playwright 端到端测试
```

## 交互

- 左侧游戏区域负责仿真运行、奖励/FPS 展示和智能体观察。
- 右侧编辑区顶部在 `Settings` 与 `GraphView` 之间切换。
- `Settings` 内包含智能体参数和键盘覆盖说明。
- `GraphView` 是拓扑沙盒：双击空白处添加神经元，`Ctrl` 拖拽节点创建连接，`Delete` 删除选中元素，滚轮缩放，右键拖拽平移。
- 空格用于开始/继续或暂停仿真，输入控件聚焦时不会触发全局快捷键。

## 文档

- [AGENTS.md](./AGENTS.md)：代理维护规则、命令、代码边界和验证要求。
