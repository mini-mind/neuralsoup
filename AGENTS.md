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
- “能跑”不是完成标准；当前范围内不制造已知返工，才是完成标准。
- 不把“最小实现”作为默认交付策略。默认交付围绕当前目标的完整、可验证切片，而不是只满足表层字面要求、忽略已知影响面的局部补丁。
- “完整”不等于扩大需求。不得做无关功能、无关重构或镀金式扩展；完整边界以用户目标、真相源、现有架构、受影响调用链和明确验收标准为准。
- 禁止用占位实现、假数据、硬编码、TODO、临时绕过、只覆盖 happy path、跳过错误处理、权限、状态流转、同步产物或测试来制造“看起来完成”。
- 修改功能、契约、文档或流程时，必须检查自然相邻面：数据结构、接口契约、调用方、权限、状态、错误处理、测试、文档、生成物和用户流程。受影响就一起处理；不受影响要能说明理由。
- 如果当前上下文、时间或外部依赖不足以完成完整切片，必须先明说缺口，提出拆分方案，并等待用户确认；不能把缩水实现包装成完成。
- 小步提交可以接受，但每一步都必须是可运行、可验证、可继续扩展的完整切片。小可以，假不行；分阶段可以，返工债不行。
- 使用 subagent 时，主代理负责分析、设计、编排、集成和复审；subagent 负责边界清晰的具体实现任务。
- 对 subagent 保持耐心，不要重复实现已委派工作；达到数量上限后，关闭不再需要的 agent 释放额度。
