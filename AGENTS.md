# AGENTS.md

适用于整个 `neuralsoup` 仓库。系统、开发者和用户消息优先级高于本文档。

## 长期规则

- 使用 npm，保留并更新 `package-lock.json`。
- 未经用户明确准许，不要创建 git commit、tag 或改写历史。
- 经用户明确准许需要提交时，commit message 使用 `fix(scope):中文描述` 格式。
- 多代理协作时，主代理负责分析、设计、编排、集成和复审；subagents 负责边界清晰的具体实现。
- 对 subagents 保持绝对耐心，不要重复实现已委派任务；达到数量上限后，关闭不再需要的 subagents 以释放限额。
- 需要外部通过 IP 访问开发服务时，使用 `npm run dev -- --host 0.0.0.0 --port 3000`。
- 除 `src/engine/pixi.ts` 外，不要直接从 `pixi.js`、`pixi.js-legacy` 或 `@pixi/*` import。
- 修改 Pixi 依赖、Pixi 入口或渲染初始化逻辑后，运行 `npm run check:pixi-imports`。
- 修改用户关键路径、Playwright selector 或渲染降级逻辑时，运行 `npm run test:e2e`。
- 纯文档变更至少运行 `git diff --check`。
