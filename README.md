# NeuralSoup - 具身智能体仿真系统

`neuralsoup` 是一个基于 TypeScript + React + PixiJS 的脉冲神经网络编辑器和具身智能体仿真平台。

## 核心特性

- 🧠 **SNN编辑器**: 图形化神经网络设计
- 🤖 **智能体仿真**: 120度视野，海洋环境
- 🎨 **高性能渲染**: PixiJS + 对象池优化
- 🔧 **模块化架构**: 清晰分层，易扩展

## 快速开始

```bash
npm install  # 安装依赖
npm run dev -- --host 0.0.0.0 --port 3000  # 热启动开发服务器
npm run type-check  # 运行类型检查
npm run check:pixi-imports  # 校验 Pixi 入口约束
```

开发服务器默认使用 Vite 热更新。若需要从局域网或云主机外部通过 IP 访问，请显式监听 `0.0.0.0`，然后使用：

```text
http://<服务器IP>:3000
```

说明：
- `localhost:3000` 只能本机访问。
- `0.0.0.0:3000` 表示监听全部网卡，是否能从外部访问还取决于安全组、防火墙和上游端口放通。
- 云主机、容器或虚拟机场景下，还需要确认 NAT/端口映射、反向代理和宿主机防火墙已放通 `3000` 端口。
- 若端口已被占用，可改成其他端口，例如 `npm run dev -- --host 0.0.0.0 --port 3001`。
- `npm run dev` 仅用于热更新联调；正式产物请使用 `npm run build` 构建，并仅用 `npx vite preview --host 0.0.0.0 --port 4173` 做构建结果验收，不要把 Vite dev/preview 当作正式生产服务。

Pixi 渲染链路当前遵循单一运行时入口原则：实际入口为 `src/engine/pixi.ts`。除该入口外，其他模块不得直接从 `pixi.js`、`pixi.js-legacy` 或 `@pixi/*` import；如需调整 Pixi 版本或 fallback，只改该入口并运行 `npm run check:pixi-imports` 验证。

## 项目结构

```
src/
├── App.tsx              # 顶层编排与控制面
├── components/          # 编辑器与仿真宿主组件
│   ├── hooks/           # 编辑器交互状态与事件
│   ├── renderers/       # 编辑器子渲染器
│   └── utils/           # 编辑器几何与默认数据
├── engine/              # 仿真核心引擎
├── types/               # 共享类型定义
└── main.tsx             # 应用入口
```

## 使用指南

### SNN编辑器
- 双击空白处：添加神经元
- Ctrl+按下节点后拖拽：创建连接
- Delete键：删除选中元素
- 滚轮：缩放画布

### 仿真控制
- 播放/暂停：控制仿真
- 重置：重新初始化环境
- 跟随模式：镜头跟随智能体

## 文档

- 📖 [开发者指南](./docs/DEVELOPER_GUIDE.md) - 代码结构和开发规范
- 🧭 [彻底重构方案](./docs/ARCHITECTURE_REFACTOR_PLAN.md) - 不保历史兼容的目标架构、findings 和迁移顺序
- 🧠 [模型编辑器指南](./docs/model-editor-complete-guide.md) - SNN编辑器使用说明

## 技术栈

- TypeScript + React + PixiJS + Vite
- 模块化架构，对象池优化
- Hook状态管理，Canvas/WebGL渲染
