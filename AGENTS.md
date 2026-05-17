# AGENTS.md

适用范围：整个 `neuralsoup` 仓库。用户、开发者和系统消息优先于本文档。

## 项目

- 技术栈：TypeScript、React 18、Vite、PixiJS legacy runtime、Playwright。
- 包管理器：npm，`package-lock.json` 是依赖解析真源。
- 开发服务：`npm run dev -- --host 0.0.0.0 --port 3000`；外部访问地址为 `http://<server-ip>:3000`。

## 命令

- 类型检查：`npm run type-check`。
- 领域测试：`npm run test:domain`。
- Pixi 导入约束检查：`npm run check:pixi-imports`。
- 生产构建：`npm run build`。
- 端到端测试：`npm run test:e2e`。
- 纯文档检查：`git diff --check`。

## 代码地图

- `src/App.tsx`：顶层 UI 编排。
- `src/components/`：React 界面、拓扑编辑器、画布渲染。
- `src/components/editor/`：右侧编辑区标签页、设置面板、工具栏。
- `src/domain/`：纯 brain/world 领域逻辑。
- `src/runtime/`：仿真 session 边界。
- `src/engine/`：仿真引擎、世界管理、Pixi 适配与渲染。
- `src/types/`：共享类型。
- `tests/domain/`：领域契约测试。
- `e2e/`：Playwright 用户工作流测试。

## 边界

- `src/domain/` 不依赖 React、Pixi、DOM、`window` 或浏览器事件。
- runtime 状态放在 `src/runtime/` 或 engine/session API 后面；React 负责界面状态和命令分发，不承载领域决策。
- Pixi 只能经由 `src/engine/pixi.ts` 引入；其他位置不要从 `pixi.js`、`pixi.js-legacy` 或 `@pixi/*` 直接导入。
- 右侧 `GraphView` 目前仍是拓扑沙盒；用户可见工作流覆盖放在 `e2e/`。

## 验证

- 修改 brain graph、runtime program、world snapshot 或 control policy 时，更新并运行 `npm run test:domain`。
- 修改 Pixi 依赖、Pixi 入口、渲染初始化或 renderer fallback 时，运行 `npm run check:pixi-imports`，并补充对应渲染验证。
- 修改用户工作流、Playwright selector、设置界面、拓扑交互或仿真控制时，运行 `npm run test:e2e`。

## 协作

- 未经用户明确批准，不要创建 commit、tag、force push 或改写历史。
- 获准提交时，commit message 使用 `fix(scope):中文描述`。
- 使用 subagent 时，主代理负责分析、设计、编排、集成和复审；subagent 负责边界清晰的具体实现任务。
- 对 subagent 保持耐心，不要重复实现已委派工作；达到数量上限后，关闭不再需要的 agent 释放额度。
