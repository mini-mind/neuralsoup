# Graph IR 重构设计与验收边界

本文档定义下一代 Graph IR。重构不考虑旧 `BrainGraph` 结构兼容；旧的 `inputs / neurons / outputs / synapses` 扁平结构只作为需要被替换的现状。

## 设计目标

- Graph IR 表达业务语义，不只表达拓扑连线。
- 模型定义与拓扑实例分离。
- 拓扑采用分层节点集：叶子节点是模型实例，非叶子节点是拓扑子图。
- 非叶子节点之间的连接是内部叶子连接的统计视图，不作为保存真源。
- `synapse` 不作为模型实例节点；连接参数归入叶子连接，突触事件语义由接收方神经元模型处理。
- 顶层 graph 允许神经元叶子节点、神经元组非叶子节点和 adapter 非叶子节点并存。

## 分层结构

Graph 文档由两层组成：

- 模型层：定义神经元或信号节点的状态、参数、端口、方程和事件处理。
- 拓扑层：定义模型实例和子图组织，并保存叶子节点之间的连接。

```ts
export interface GraphIRDocument {
  version: 1;
  models: ModelDefinition[];
  root: RootGraph;
}
```

## 模型层 IR

模型层参照 NESTML 的组织方式，但先使用 TypeScript 结构化 IR，而不是文本 DSL。

```ts
export interface ModelDefinition {
  id: string;
  kind: 'neuron' | 'signal';
  doc?: string;
  state: VariableDefinition[];
  parameters: VariableDefinition[];
  internals: VariableDefinition[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  equations: EquationDefinition[];
  onReceive: ReceiveHandlerDefinition[];
  update: UpdateStepDefinition[];
}
```

模型层语义：

- `state`：跨 tick 保留的动态状态，例如膜电位。
- `parameters`：实例可覆盖的模型参数，例如时间常数、阈值、重置电位。
- `internals`：推导变量或临时辅助变量，不作为外部可配置项。
- `inputs`：输入端口，带信号类型。
- `outputs`：输出端口，带信号类型。
- `equations`：连续动力学描述。
- `onReceive`：输入事件处理。
- `update`：离散更新步骤，例如阈值检测、spike 发放和状态重置。

`synapse` 不进入模型层。连接强度、延迟等轻量参数保存在叶子连接；接收事件如何改变状态由目标模型的 `onReceive` 定义。

## 拓扑层 IR

拓扑层只有节点集和叶子连接。节点分为叶子节点与非叶子节点。

```ts
export type TopologyNode =
  | NeuronNode
  | SignalNode
  | NeuronGroupNode
  | AdapterNode;

export interface RootGraph {
  id: 'root';
  children: TopologyNode[];
  links: LeafLink[];
}
```

### 叶子节点

叶子节点是可执行模型实例。

```ts
export interface NeuronNode {
  kind: 'neuron';
  id: string;
  label: string;
  modelId: string;
  position?: Position;
  parameterOverrides?: Record<string, LiteralValue>;
}

export interface SignalNode {
  kind: 'signal';
  id: string;
  label: string;
  modelId: string;
  direction: 'input' | 'output';
  signal: SignalDefinition;
  position?: Position;
  parameterOverrides?: Record<string, LiteralValue>;
}
```

`SignalNode` 是特殊的叶子节点，用来连接外部世界和 graph。它仍然引用模型定义，因此可以拥有状态、端口和更新语义。

### 非叶子节点

非叶子节点是拓扑子图，负责组织和折叠，不直接参与运行时执行。

```ts
export interface NeuronGroupNode {
  kind: 'neuron-group';
  id: string;
  label: string;
  children: TopologyNode[];
  position?: Position;
  collapsed?: boolean;
}

export interface AdapterNode {
  kind: 'adapter';
  id: string;
  label: string;
  adapterType: 'input' | 'output' | 'io';
  children: SignalNode[];
  position?: Position;
  collapsed?: boolean;
}
```

Adapter 可出现在 root 或任意 `neuron-group` 内。每个 adapter 都是非叶子节点，内部叶子节点只能是 `SignalNode`。只有 root 直系 adapter 承担 world input/output 边界绑定；嵌套 adapter 用于组内对外连接中转。

### 叶子连接

IR 只保存叶子节点端口之间的连接。

```ts
export interface LeafLink {
  id: string;
  from: LeafPortRef;
  to: LeafPortRef;
  weight: number;
  delayMs?: number;
}

export interface LeafPortRef {
  nodeId: string;
  portId: string;
}
```

规则：

- `from.nodeId` 和 `to.nodeId` 必须引用叶子节点。
- `from.portId` 必须引用输出端口。
- `to.portId` 必须引用输入端口。
- 非叶子节点之间不存在保存级连接。
- GraphView 可派生非叶子聚合连接，用于展示连接数量、权重总和和内部连接列表。

## 派生视图

非叶子连接是派生视图，不写入 IR。

```ts
export interface AggregateLinkView {
  fromNodeId: string;
  toNodeId: string;
  leafLinkIds: string[];
  count: number;
  totalWeight: number;
}
```

派生规则：

- 对任意 `LeafLink`，向上寻找 `from` 和 `to` 所在的当前视图层级节点。
- 如果两端落在不同非叶子节点下，生成或累加对应 `AggregateLinkView`。
- 当前视图进入某个子图后，重新按该子图的 children 计算聚合连接。

## 编译语义

编译器从 `GraphIRDocument` 生成运行时 program。

阶段：

1. 校验模型定义：ID 唯一、端口唯一、变量唯一、表达式引用合法。
2. 展开拓扑树：收集所有叶子节点，建立 `nodeId -> path` 索引。
3. 校验叶子连接：端口方向、信号类型、节点可达性、重复连接策略。
4. 实例化模型：合并默认参数与 `parameterOverrides`。
5. Lower 到运行时结构：把 `LeafLink` 编译为目标节点输入表、权重和延迟队列。
6. 生成 UI 派生数据：当前层级 children、聚合连接、breadcrumb、selection path。

## GraphView 交互边界

- GraphView 编辑当前层级的 children 和叶子连接。
- 双击 `neuron-group` 或 `adapter` 进入子图。
- breadcrumb 用于返回父级。
- 叶子节点 inspector 编辑实例参数覆盖。
- 模型定义编辑器不放在画布主交互里，应作为独立 inspector 或设置页。
- 非叶子节点之间的连线只展示派生聚合结果，不允许直接保存为 graph link。
- adapter 默认可固定在画布边侧展示，但布局固定不进入领域 IR。

## 重构计划

### Phase 1：落地新 IR 类型和校验器

- 新增 `src/domain/brain/ir.ts` 或 `src/domain/brain/ir/`。
- 定义 `GraphIRDocument`、`ModelDefinition`、`TopologyNode`、`LeafLink`。
- 新增校验器，覆盖模型 ID、端口、树结构、叶子连接和 adapter 子节点约束。
- 新增 `tests/domain/graph-ir.contract.test.ts`。

验收：

- `npm run type-check` 通过。
- `npm run test:domain` 覆盖合法 IR、非法端口、非叶子连接、adapter 非 signal 子节点、重复 ID。

### Phase 2：默认 graph 改为新 IR

- 用新 IR 重写默认视觉输入、神经元和运动输出。
- adapter 表达输入/输出边界。
- `BrainGraph` 旧默认工厂和旧 editor adapter 不再作为新路径真源。

验收：

- 默认 IR 能通过校验。
- 默认 IR 能表达现有视觉输入和三类运动输出。
- 仓库内不再新增旧 `BrainGraph` 默认数据入口。

### Phase 3：编译器改为消费新 IR

- 编译器从 `GraphIRDocument` 生成运行时 program。
- `LeafLink` lower 到目标节点输入表。
- `SignalNode` 作为外部 adapter 与 runtime observation/action 绑定。

验收：

- 领域测试证明编辑叶子连接或模型参数会改变 runtime action。
- 非叶子聚合连接不参与 runtime 真源。
- `npm run test:domain` 通过。

### Phase 4：GraphView 改为分层编辑器

- GraphView 读写新 IR。
- 支持进入/退出非叶子节点。
- 支持 adapter 展示、叶子节点选择、叶子连接编辑、聚合连接只读展示。
- 移除旧 `SNNNode / Receptor / Effector / SNNSynapse` 作为 GraphView 真源。

验收：

- Playwright 覆盖进入子图、返回父级、创建叶子连接、编辑叶子参数、adapter 节点可见。
- 旧拓扑投影类型不再承担新 GraphView 保存语义。
- `npm run test:e2e` 通过。

### Phase 5：移除旧 `BrainGraph` 路径

- 删除旧 `inputs / neurons / outputs / synapses` 扁平 IR。
- 删除旧默认数据和旧 editor adapter。
- 清理 runtime、App、SimulationCanvas 中的旧 graph status 类型。
- `GraphIRDocument` 成为 runtime/UI 唯一 brain graph 真源，不再保留 legacy projection 运行路径。

验收：

- `rg "BrainGraph|SNNSynapse|Receptor|Effector|createDefaultBrainGraph" src tests e2e` 不再命中新运行路径。
- `npm run type-check`、`npm run test:domain`、`npm run build`、`npm run test:e2e` 全部通过。

当前状态：

- 已完成。runtime、SimulationSession、SimulationEngine、SimulationCanvas、App 和 GraphView 均只接受或回传 `GraphIRDocument` / Graph IR runtime status。
- `BrainGraph`、旧 editor adapter、旧 topology sandbox render/util/test 路径已移除。

## 总体验收边界

- Graph 的保存真源是 `GraphIRDocument`。
- 模型层能表达状态、参数、内部变量、端口、方程、事件接收和离散更新。
- 拓扑层是分层节点集，非叶子节点只组织子图。
- 连接真源只允许存在于叶子节点端口之间。
- 非叶子连接是派生统计视图，不写入 IR，不参与 runtime 编译。
- `synapse` 不作为实例节点或模型定义出现。
- adapter 可嵌套在任意容器下，内部只包含 `SignalNode`；只有顶层 adapter 参与 world 边界绑定。
- GraphView、runtime compiler 和 domain tests 使用同一套新 IR。
