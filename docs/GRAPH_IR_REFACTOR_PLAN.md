# AgentIR 冻结设计

本文档冻结下一代 IR 目标结构。后续重构不保留旧结构兼容，当前 `BrainPackage / GraphIRDocument / BodyDefinition` 仅作为迁移来源。

## 总体边界

运行时语义分为三层：

- `world`：环境、观测来源、动作作用点和宿主能力，不进入持久化 AgentIR。
- `body`：world 与 brain 的适配层，记录输入/输出信号节点的映射规则。
- `brain`：神经元节点及其组织结构，不记录 world 映射、不记录输入/输出 signal node。

持久化真源统一为 `AgentIR`：

```ts
export interface AgentIR {
  version: 1;
  metadata: AgentMetadata;
  body: BodyIR;
  brain: BrainIR;
  connections: AgentConnection[];
  layout?: AgentLayoutIR;
}
```

`connections` 是唯一连接真源，覆盖 `body -> brain`、`brain -> brain`、`brain -> body` 三类连接。

## BodyIR

`BodyIR` 只保存规则，规则是真源。运行时或编辑器可按规则展开出实际 body input/output 节点，但展开结果不作为第二真源保存。

```ts
export interface BodyIR {
  version: 1;
  inputRules: BodyInputRule[];
  outputRules: BodyOutputRule[];
}

export interface BodyInputRule {
  id: string;
  nodeIdPattern: string;
  sourceTemplate: string;
  scale: number;
}

export interface BodyOutputRule {
  id: string;
  nodeIdPattern: string;
  targetTemplate: string;
  decayPerSecond: number;
}
```

规则语义：

- `nodeIdPattern` 是正则表达式，用于匹配 body 节点 ID。
- `sourceTemplate` 生成 world 输入路径，例如 `vision.$1.$2`，可得到 `vision.G.12`。
- `targetTemplate` 生成 world 输出路径，例如 `action.$1`。
- `scale` 用于把已归一化到 `[0, 1]` 的外界输入缩放成向后继神经元传递的信号强度。
- `decayPerSecond` 表示输出动作激活值每秒衰退量；输出节点收到一次 brain 信号后激活值重置为 `1`，随后按 `max(0, value - decayPerSecond * deltaTime)` 衰退。

示例：

```ts
const body: BodyIR = {
  version: 1,
  inputRules: [
    {
      id: 'vision-rgb-cells',
      nodeIdPattern: '^vision-([RGB])-(\\d+)$',
      sourceTemplate: 'vision.$1.$2',
      scale: 1
    }
  ],
  outputRules: [
    {
      id: 'motor-actions',
      nodeIdPattern: '^motor-(turn-left|move-forward|turn-right)$',
      targetTemplate: 'action.$1',
      decayPerSecond: 4
    }
  ]
};
```

## BrainIR

`BrainIR` 只描述神经元及容器层级。通用神经元运行逻辑由引擎托管，节点 IR 只保留模型选择、关键参数和初始状态。

```ts
export interface BrainIR {
  version: 1;
  neurons: BrainNeuronNode[];
  containers: BrainContainerNode[];
  rootContainerId: string;
}

export interface BrainNeuronNode {
  id: string;
  model: 'izhikevich';
  params: {
    a: number;
    b: number;
    c: number;
    d: number;
    threshold: number;
  };
  initialState: {
    v: number;
    u?: number;
  };
}

export interface BrainContainerNode {
  id: string;
  label?: string;
  children: Array<{ scope: 'brain'; nodeId: string } | { scope: 'container'; nodeId: string }>;
}
```

约束：

- BrainIR 不包含 adapter。
- BrainIR 不包含 input/output signal node。
- BrainIR 不包含 world-facing source/target。
- BrainIR 不包含 layout 字段。
- `rootContainerId` 指向唯一根容器。
- 每个 neuron 或 container 除 root container 外只能被一个 container 持有。
- 第一阶段神经元模型可固定为 `izhikevich`，后续再扩展模型枚举或模型注册表。
- `initialState.v` 是初始膜电位；`initialState.u` 未设置时由 runtime 使用模型默认规则推导，例如 `b * v`。

## AgentConnection

连接端点保留可扩展结构：

```ts
export type AgentConnectionEndpoint =
  | { scope: 'bodyInput'; nodeId: string; portId?: string }
  | { scope: 'bodyOutput'; nodeId: string; portId?: string }
  | { scope: 'brain'; nodeId: string; portId?: string };

export interface AgentConnection {
  id: string;
  from: AgentConnectionEndpoint;
  to: AgentConnectionEndpoint;
  weight: number;
  delayMs?: number;
}
```

合法方向：

- 允许 `bodyInput -> brain`。
- 允许 `brain -> brain`。
- 允许 `brain -> bodyOutput`。
- 禁止 `bodyOutput -> brain`。
- 禁止 `brain -> bodyInput`。
- 禁止 `bodyInput -> bodyOutput`。

`portId` 当前可选，第一阶段可以不使用；保留它是为了后续支持多端口神经元或更复杂模型。

## Layout

布局是编辑器状态，不属于语义 IR。

```ts
export interface AgentLayoutIR {
  version: 1;
  nodes: Record<string, AgentLayoutNodeState>;
  viewportByContainerId?: Record<string, AgentLayoutViewport>;
}

export interface AgentLayoutNodeState {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  collapsed?: boolean;
  expanded?: boolean;
}

export interface AgentLayoutViewport {
  x: number;
  y: number;
  scale: number;
}
```

layout 只影响 GraphView 展示，不参与 runtime 编译。`viewportByContainerId` 用于恢复不同层级画布的平移和缩放状态；`size` 用于保存展开容器或自定义节点尺寸。

## 编译边界

目标入口：

```ts
compileAgentIR(agent: AgentIR): AgentProgram
```

编译流程：

1. 校验 `body.inputRules` / `body.outputRules` 的正则和模板。
2. 从 `connections` 中收集被引用的 `bodyInput` / `bodyOutput` 节点 ID。
3. 用 body 规则解析这些 body 节点 ID，得到 world `source` / `target`、`scale` 和 `decayPerSecond`。
4. 校验 brain neuron、container 引用和 root container。
5. 校验连接方向和端点存在性。
6. lower `bodyInput -> brain` 为 runtime input injection。
7. lower `brain -> brain` 为 neuron connection。
8. lower `brain -> bodyOutput` 为 runtime action output。

runtime 不从节点命名、label 或模板以外的字段推断 world 语义。

## 当前实现迁移

当前实现仍是过渡结构：

- `BrainPackage` 需要替换为 `AgentIR`。
- `BodyDefinition` 需要替换为规则真源 `BodyIR`。
- `GraphIRDocument` 需要替换为纯 `BrainIR`。
- `AdapterNode` 和 `SignalNode` 需要从 brain topology 中移除。
- `LeafLink` 需要替换为 `AgentConnection`。
- `position`、`collapsed`、`expanded`、`size` 和 viewport 需要从 topology/UI 临时状态移入 `AgentLayoutIR`。

当前 Brain Library 的导入、导出和 LocalStorage 外部格式仍是 `AgentPackage` envelope；内部编辑与运行时真源正在收口到 `AgentIR`。后续再决定是否继续把外部格式收口为裸 `AgentIR`。

## 验收边界

- 生产代码不再暴露 `BrainPackage`、`GraphIRDocument`、`BodyDefinition`、`AdapterNode`、`SignalNode`、`LeafLink` 作为持久化主结构。
- 运行时入口收口为 `compileAgentIR(agent)` 或等价 AgentIR 编译边界。
- GraphView 直接编辑 `AgentIR.brain`、`AgentIR.connections` 和 `AgentIR.layout`，不再把 body signal node 混入 brain topology。
- `npm run type-check` 通过。
- `npm run test:domain` 通过。
- 涉及 GraphView 或 Brain Library 行为时，`npm run test:e2e -- --grep "graph view|brain library"` 通过。
