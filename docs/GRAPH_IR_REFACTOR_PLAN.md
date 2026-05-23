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

当前实现中，`body.visionCellCount` 仍是兼容访问器，而不是持久化字段：

- 不作为持久化字段写出。
- 运行时由 `AgentIR.connections` 与 `AgentLayoutIR` 中的 body vision markers 推导。
- 旧存储载荷若仍带该字段，只在导入归一化时用于恢复稀疏 vision coverage，然后立即收口回推导语义。
- 当前核心 domain 仍保留 legacy fallback 读取路径；后续需要继续下沉到 import/migration 边界，避免 AgentIR 域内长期保留双真源语义。

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

当前 v1 runtime grammar 仍然是受限的 host contract，而不是完全通用的 world DSL：

- 输入 `sourceTemplate` 目前必须解析成 `vision.<channel>.<cellIndex>`。
- 输出 `targetTemplate` 目前必须解析成 `action.<turn-left|move-forward|turn-right>`。
- 更通用的 source/target registry 仍是后续重构项，尚未完成下沉。
- GraphView 对“未连线 body endpoint 的主动枚举”目前也只支持这套受限 grammar；它还不是 compile 同级的通用 regex 投影器。

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
  label: string;
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

`label` 当前仍保留在 `BrainIR` 中，作为节点显示元数据随 IR 持久化；它不参与 world/runtime 语义判定，但当前编辑器和 compat bridge 仍依赖它保真 round-trip。

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

当前实现已按上述规则校验；`bodyInput -> bodyOutput` 会被 `validateAgentIR/compileAgentIR` 显式拒绝。

`portId` 当前可选，第一阶段可以不使用；保留它是为了后续支持多端口神经元或更复杂模型。

## Layout

布局是编辑器状态，不属于语义 IR。

```ts
export interface AgentLayoutIR {
  version: 1;
  nodes: Record<string, AgentLayoutNodeState>;
}

export interface AgentLayoutNodeState {
  position?: { x: number; y: number };
  collapsed?: boolean;
}
```

layout 只影响 GraphView 展示，不参与 runtime 编译。

当前真实状态：

- `position` 与 `collapsed` 是 `AgentLayoutIR` 的唯一持久真源。
- viewport/scale 仍停留在 React session state，不进入 canonical `AgentIR`。
- `size` / `expanded` 是视图计算态，不是稳定持久化真源。

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

compat 约束：

- legacy `GraphIRDocument` setter 若需要超出当前 session 的 `visionCells`，必须返回 `invalid`，不能再做 silent reconcile。
- legacy getter/setter 若无法无损保留 `BodyIR` 规则语义，必须显式报错，不能伪装成功 round-trip。

## 当前实现迁移

当前实现仍是过渡结构：

- `BrainPackage` 需要替换为 `AgentIR`。
- `BodyDefinition` 需要替换为规则真源 `BodyIR`。
- `GraphIRDocument` 需要替换为纯 `BrainIR`。
- `AdapterNode` 和 `SignalNode` 需要从 brain topology 中移除。
- `LeafLink` 需要替换为 `AgentConnection`。
- `position`、`collapsed` 已进入 `AgentLayoutIR`；`expanded`、`size` 和 viewport 不再作为 canonical schema 目标。

当前 Brain Library 的真实边界如下：

- LocalStorage 主格式是 canonical `BrainLibraryRecord` envelope，而不是 `AgentPackage`。
- 默认导入/导出交换格式是 `neuralsoup-agent` envelope，核心载荷是 `AgentIR`。
- legacy `AgentPackage` 仍作为兼容输入/显式兼容导出面保留。
- legacy LocalStorage / legacy package 兼容仍存在，但应继续下沉到显式 migration/import 边界，而不是长期污染生产主路径。

当前 Brain Library 额外约束：

- 内存主态与编辑主态都以 `agent.metadata` 为身份真源。
- “保存当前 Brain”会原子切换当前编辑/运行 Agent 到新建库条目的 `AgentIR`，避免当前 Agent 与库条目身份漂移。
- `AgentPackage` 仍作为外部兼容 envelope 保留，但 legacy package helper 已显式下沉到 compat/legacy 命名。

## 当前剩余缺口

当前实现与冻结设计相比，仍有以下明确缺口：

- `BodyIR` 已进入 schema、compiler、runtime、storage，并具备生产可用的规则编辑、endpoint 投影预览和可见 validation。
- GraphView 对 body endpoint 的主动投影仍是受限 grammar，不等同于 compile 级 regex 语义。
- GraphView 的 viewport/scale、expanded 和 size 仍是 session/computed state；若未来需要跨会话恢复，应以新 schema 单独设计，而不是复活旧字段。

## 验收边界

- 生产代码不再暴露 `BrainPackage`、`GraphIRDocument`、`BodyDefinition`、`AdapterNode`、`SignalNode`、`LeafLink` 作为持久化主结构。
- 运行时入口收口为 `compileAgentIR(agent)` 或等价 AgentIR 编译边界。
- GraphView 直接编辑 `AgentIR.brain`、`AgentIR.connections` 和 `AgentIR.layout`，不再把 body signal node 混入 brain topology。
- BodyIR 需要具备生产可用的编辑与审查闭环：至少能编辑规则、查看 endpoint 投影，并在无效时展示可定位的 validation。
- `npm run type-check` 通过。
- `npm run test:domain` 通过。
- 涉及 GraphView 或 Brain Library 行为时，`npm run test:e2e -- --grep "graph view|brain library"` 通过。
