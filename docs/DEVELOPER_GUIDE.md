# 开发者指南

## 环境设置

### 系统要求
- Node.js 18+
- npm
- 现代浏览器（支持WebGL）

### 快速启动
```bash
# 安装依赖
npm install

# 启动热更新开发服务器
npm run dev -- --host 0.0.0.0 --port 3000

# 运行类型检查
npm run type-check

# 校验 Pixi 入口约束
npm run check:pixi-imports
```

外部访问说明：

- Vite 开发服务必须显式绑定 `0.0.0.0`，否则默认仅监听本机回环地址。
- 绑定后可通过 `http://<服务器IP>:3000` 从外部访问。
- 若外部仍无法访问，优先检查云安全组、主机防火墙、NAT/端口映射和反向代理配置。

说明：仓库当前提交的是 `package-lock.json`，默认依赖解析真源为 npm。锁文件中的 tarball URL 指向 `registry.npmmirror.com`，如需在其他 registry 环境复现，请显式配置对应 npm registry。

## 项目结构

```
neuralsoup/
├── src/
│   ├── App.tsx                 # 主应用组件
│   ├── main.tsx               # 应用入口
│   ├── components/            # React组件
│   │   ├── SNNTopologyEditor.tsx        # SNN编辑器主组件
│   │   ├── CanvasEventHandler.tsx       # 画布命中检测与坐标转换
│   │   ├── hooks/                       # 自定义Hooks
│   │   ├── renderers/                   # 编辑器子渲染器
│   │   └── utils/                       # 编辑器几何与默认数据
│   ├── engine/                # 仿真引擎
│   │   ├── SimulationEngine.ts          # 主仿真引擎
│   │   ├── WorldManager.ts              # 世界管理器
│   │   ├── WorldRenderer.ts             # Pixi 世界渲染
│   │   └── VisionSystem.ts              # 感知系统
│   ├── types/                 # TypeScript类型定义
│   ├── index.css              # 全局样式
│   └── App.css                # 宿主样式
├── docs/                      # 项目文档
└── index.html                 # Vite HTML入口
```

## 核心概念

### 1. Hook驱动的状态管理

项目使用自定义Hook管理复杂状态：

```typescript
// 状态管理Hook
const {
  nodes, synapses, receptors, effectors, selection,
  addNode, removeNodes, addSynapse
} = useSNNTopologyState();

// 事件处理Hook
const {
  handleMouseDown, handleMouseMove, handleMouseUp,
  handleDoubleClick, handleKeyDown
} = useSNNTopologyEvents({ canvasRef, state });
```

### 2. 模块化渲染系统

渲染器采用职责分离设计：

```typescript
// 主渲染协调器
class CanvasRenderer {
  static draw(state: CanvasRendererProps) {
    // 协调各个子渲染器与共享几何
    NeuronRenderer.draw(ctx, ...);
  }
}

// 专用渲染器
class NeuronRenderer {
  static draw(
    ctx: CanvasRenderingContext2D,
    nodes: SNNNode[],
    canvasOffset: { x: number; y: number },
    canvasScale: number,
    selectedNodes: string[]
  ) {
    // 专门负责神经元渲染
  }
}
```

### 3. 类型安全的设计

所有数据结构都有完整的TypeScript类型：

```typescript
interface SNNNode {
  id: string;
  x: number;
  y: number;
  type: 'neuron';
  params?: IZNeuronParams;
  state?: IZNeuronState;
}

interface SNNSynapse {
  id: string;
  from: string;
  to: string;
  weight: number;
  delay: number;
}
```

## 开发工作流

### 1. 功能开发流程

1. **需求分析** - 明确功能要求和接口设计
2. **类型定义** - 在`types/`中定义相关接口
3. **Hook开发** - 实现状态管理和业务逻辑
4. **组件开发** - 创建React组件
5. **测试验证** - 确保功能正常工作

### 2. 代码提交规范

```bash
# 提交格式
<type>(<scope>): <subject>

# 示例
feat(editor): 添加神经元自连接功能
fix(renderer): 修复画布缩放时的坐标偏移
docs(readme): 更新安装说明
refactor(engine): 重构渲染系统模块化
```

### 3. 分支管理

- `main` - 当前本地主分支
- `origin/dev`、`origin/main`、`origin/release` - 当前可见远端分支
- 如需引入新的分支约定，先以仓库当前实际分支结构为准更新文档

## 最佳实践

### 1. 组件设计原则

**单一职责原则**
```typescript
// ❌ 违反单一职责
const MultiPurposeComponent = () => {
  // 既处理渲染又处理事件还管理状态
};

// ✅ 职责分离
class CanvasRenderer {} // 只负责渲染
class CanvasEventHandler {} // 只负责命中检测与坐标转换
const useSNNTopologyState = () => {}; // 只负责状态
```

**组合优于继承**
```typescript
// ✅ 通过组合实现复杂功能
const SNNTopologyEditor = () => {
  const state = useSNNTopologyState();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const events = useSNNTopologyEvents({ canvasRef, state });
  
  return (
    <canvas
      ref={canvasRef}
      onMouseDown={events.handleMouseDown}
      onMouseMove={events.handleMouseMove}
      onMouseUp={events.handleMouseUp}
    />
  );
};
```

### 2. 性能优化技巧

**PixiJS对象池管理**
```typescript
// 复用图形对象而不是频繁创建销毁
const graphic = objectPool.getGraphic();
// 使用后回收
objectPool.returnGraphic(graphic);
```

### 3. Pixi 运行时入口原则

- Pixi 运行时入口保持单一，实际入口文件为 `src/engine/pixi.ts`。
- 除 `src/engine/pixi.ts` 外，其他模块不得直接从 `pixi.js`、`pixi.js-legacy` 或 `@pixi/*` import；类型、构造器和扩展注册都应经由该入口统一导出。
- 如需调整 Pixi 版本或 fallback 策略，只改 `src/engine/pixi.ts`，并同步运行 `npm run check:pixi-imports` 与渲染结果验证，避免运行时分叉。

### 4. 错误处理策略

**全局错误边界**
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Component Error:', error, errorInfo);
  }
}
```

**异步操作错误处理**
```typescript
try {
  simulationEngine.initialize();
} catch (error) {
  console.error('Simulation initialization failed:', error);
  // 显示用户友好的错误信息
}
```

## 调试技巧

### 1. React DevTools

- 使用Components面板查看组件状态
- 使用Profiler分析性能瓶颈
- 使用Console面板查看状态变化

### 2. PixiJS调试

```typescript
// 启用PixiJS调试模式
app.stage.interactive = true;
app.stage.on('pointerdown', (event) => {
  console.log('PixiJS Event:', event.data.global);
});
```

### 3. 状态调试

```typescript
// 在Hook中添加调试日志
useEffect(() => {
  console.log('State changed:', { nodes, synapses });
}, [nodes, synapses]);
```

## 常见问题解决

### 1. 渲染性能问题

**症状**: 画布卡顿，FPS低下
**解决方案**:
- 检查是否使用了对象池
- 确认是否开启了硬件加速
- 优化渲染循环，避免不必要的重绘

### 2. 状态同步问题

**症状**: UI状态与实际状态不一致
**解决方案**:
- 检查useEffect依赖数组
- 确认状态更新是否为异步
- 使用React Strict Mode检查副作用

### 3. TypeScript类型错误

**症状**: 编译时类型错误
**解决方案**:
- 检查接口定义是否完整
- 确认导入路径是否正确
- 使用类型断言时要谨慎

### 4. 内存泄漏

**症状**: 长时间运行后内存不断增长
**解决方案**:
- 确保事件监听器正确清理
- 检查定时器是否清理
- 验证PixiJS对象是否正确销毁

## 扩展开发

### 1. 添加新的神经元类型

1. 在`types/simulation.ts`中扩展类型定义
2. 在`NeuronRenderer`中添加渲染逻辑
3. 在相关Hook中添加处理逻辑

### 2. 扩展世界渲染

1. 先判断能力应落在 `WorldRenderer`、`VisionSystem` 还是编辑器渲染链
2. 直接扩展现有模块，不要重新引入不存在的 `engine/renderers/effects/` 目录
3. 同步更新相关类型与文档，保持目录说明和真实结构一致

### 3. 集成新的学习算法

1. 在`engine/`创建新的学习算法模块
2. 定义算法接口和参数类型
3. 在仿真循环中集成算法调用

## 部署指南

### 开发部署
```bash
npm run dev -- --host 0.0.0.0 --port 3000
```

当前仓库推荐把“热启动部署”理解为 Vite 开发模式常驻运行。它适合联调、UI 调整和交互开发，不适合作为正式生产服务。

如果需要后台常驻，可用例如下：

```bash
nohup npm run dev -- --host 0.0.0.0 --port 3000 > vite-dev.log 2>&1 &
```

检查监听状态：

```bash
ss -ltnp | rg ':3000\\b'
```

检查本机 IP：

```bash
hostname -I
```

边界说明：

- `npm run dev -- --host 0.0.0.0 --port 3000` 是开发态热更新服务，适合联调和临时环境排查。
- 对外开放开发态端口时，默认同时暴露 HMR 与源码映射等开发能力，不应替代正式发布链路。
- 若需要让他人通过 IP 临时访问开发环境，除了监听 `0.0.0.0` 外，还要确认安全组、防火墙、NAT/端口映射和代理转发配置一致。

### 生产构建
```bash
npm run build
npx vite preview --host 0.0.0.0 --port 4173  # 预览构建结果
```

边界说明：

- `npm run build` 生成可发布的静态产物。
- `npx vite preview` 只用于本地或预发阶段快速验收构建结果，不承担正式生产 SLA、进程托管或边缘缓存职责。
- 正式生产部署应由静态文件服务器、对象存储/CDN 或受管反向代理承接构建产物，而不是长期直接运行 Vite preview。

### Docker 构建预览（非生产）
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]
```

说明：该镜像仅用于容器内验收 `dist/` 构建结果，不应用作正式生产服务。正式生产请将 `npm run build` 产物交给静态文件服务器、对象存储/CDN 或反向代理托管。

## 代码风格

### 当前校验
当前仓库中应保持通过的最小校验集：
- `npm run type-check`
- `npm run build`
- `npm run check:pixi-imports`
