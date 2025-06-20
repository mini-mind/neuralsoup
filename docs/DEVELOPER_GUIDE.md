# 开发者指南

## 环境设置

### 系统要求
- Node.js 18+
- npm 或 yarn
- 现代浏览器（支持WebGL）

### 快速启动
```bash
# 克隆项目
git clone <repository-url>
cd neuralsoup

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行类型检查
npm run type-check
```

## 项目结构

```
neuralsoup/
├── src/
│   ├── App.tsx                 # 主应用组件
│   ├── main.tsx               # 应用入口
│   ├── components/            # React组件
│   │   ├── SNNTopologyEditor.tsx        # SNN编辑器主组件
│   │   ├── CanvasEventHandler.tsx       # 画布事件处理
│   │   ├── hooks/                       # 自定义Hooks
│   │   ├── renderers/                   # 渲染器组件
│   │   ├── topology/                    # 拓扑编辑相关
│   │   │   └── canvas/                  # 画布渲染模块
│   │   └── utils/                       # 组件工具函数
│   ├── engine/                # 仿真引擎
│   │   ├── SimulationEngine.ts          # 主仿真引擎
│   │   ├── WorldManager.ts              # 世界管理器
│   │   ├── systems/                     # 系统模块
│   │   │   └── rendering/               # 渲染系统
│   │   └── renderers/                   # 渲染器
│   │       └── effects/                 # 特效系统
│   ├── types/                 # TypeScript类型定义
│   ├── utils/                 # 工具函数
│   │   └── canvas/            # 画布相关工具
│   └── styles/                # 样式文件
├── docs/                      # 项目文档
└── public/                    # 静态资源
```

## 核心概念

### 1. Hook驱动的状态管理

项目使用自定义Hook管理复杂状态：

```typescript
// 状态管理Hook
const {
  nodes, synapses, receptors, effectors,
  addNode, removeNode, updateNode
} = useSNNTopologyState();

// 事件处理Hook
const {
  handleMouseDown, handleMouseMove, handleMouseUp,
  handleDoubleClick, handleKeyDown
} = useSNNTopologyEvents();
```

### 2. 模块化渲染系统

渲染器采用职责分离设计：

```typescript
// 主渲染协调器
class CanvasRenderer {
  static draw(props: CanvasRendererProps) {
    // 协调各个子渲染器
    GridRenderer.draw(ctx, ...);
    NeuronRenderer.draw(ctx, ...);
    SynapseRenderer.draw(ctx, ...);
  }
}

// 专用渲染器
class NeuronRenderer {
  static draw(ctx: CanvasRenderingContext2D, nodes: SNNNode[]) {
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
  type: 'inhibitory' | 'excitatory';
  params: IZNeuronParams;
  state: IZNeuronState;
}

interface SNNSynapse {
  id: string;
  fromId: string;
  toId: string;
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

- `main` - 主分支，稳定版本
- `develop` - 开发分支，功能集成
- `feature/*` - 功能分支
- `hotfix/*` - 紧急修复分支

## 最佳实践

### 1. 组件设计原则

**单一职责原则**
```typescript
// ❌ 违反单一职责
const MultiPurposeComponent = () => {
  // 既处理渲染又处理事件还管理状态
};

// ✅ 职责分离
const CanvasRenderer = () => {}; // 只负责渲染
const CanvasEventHandler = () => {}; // 只负责事件
const useSNNState = () => {}; // 只负责状态
```

**组合优于继承**
```typescript
// ✅ 通过组合实现复杂功能
const SNNTopologyEditor = () => {
  const state = useSNNTopologyState();
  const events = useSNNTopologyEvents();
  
  return (
    <div>
      <CanvasRenderer {...state} />
      <CanvasEventHandler {...events} />
    </div>
  );
};
```

### 2. 性能优化技巧

**使用React.memo防止不必要重渲染**
```typescript
const NeuronRenderer = React.memo(({ nodes }: { nodes: SNNNode[] }) => {
  // 只在nodes变化时重新渲染
});
```

**使用useMemo缓存计算结果**
```typescript
const expensiveCalculation = useMemo(() => {
  return nodes.map(node => calculateSomething(node));
}, [nodes]);
```

**PixiJS对象池管理**
```typescript
// 复用图形对象而不是频繁创建销毁
const graphic = objectPool.getGraphic();
// 使用后回收
objectPool.returnGraphic(graphic);
```

### 3. 错误处理策略

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
  await simulationEngine.initialize();
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

### 2. 新增仿真特效

1. 在`engine/renderers/effects/`创建新特效类
2. 实现`initialize`、`update`、`render`方法
3. 在`WorldRenderer`中注册和使用

### 3. 集成新的学习算法

1. 在`engine/`创建新的学习算法模块
2. 定义算法接口和参数类型
3. 在仿真循环中集成算法调用

## 部署指南

### 开发部署
```bash
npm run dev
```

### 生产构建
```bash
npm run build
npm run preview  # 预览构建结果
```

### Docker部署
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 代码风格

### ESLint配置
项目使用ESLint确保代码质量，主要规则：
- 使用TypeScript严格模式
- 优先使用函数组件和Hooks
- 强制使用分号和单引号
- 禁止console.log（开发环境除外）

### 格式化
使用Prettier自动格式化代码，配置：
- 2空格缩进
- 单引号字符串
- 行末分号
- 尾随逗号 