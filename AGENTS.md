# AGENTS.md

本文件约束整个 `neuralsoup` 仓库及其子目录。系统、开发者和用户消息优先级高于本文档。

## 长期维护规则

- 使用 npm 维护依赖，保留并更新 `package-lock.json`。
- 默认开发服务使用 Vite；需要外部通过 IP 访问时，使用 `npm run dev -- --host 0.0.0.0 --port 3000`。
- 除 `src/engine/pixi.ts` 外，不要直接从 `pixi.js`、`pixi.js-legacy` 或 `@pixi/*` import。
- 修改 Pixi 依赖、Pixi 入口或渲染初始化逻辑后，运行 `npm run check:pixi-imports`。
- 纯文档变更至少运行 `git diff --check`。
- 修改用户关键路径、Playwright selector 或渲染降级逻辑时，运行 `npm run test:e2e`。

## 常用命令

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 3000
npm run check:pixi-imports
npm run type-check
npm run build
npm run test:e2e
```
