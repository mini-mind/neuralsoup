# AgentIR 冻结设计

本文档冻结下一阶段 `AgentIR` 目标结构。后续重构放弃旧版兼容，不再保留 `BrainPackage`、`GraphIRDocument`、`BodyDefinition`、`AdapterNode`、`SignalNode`、`LeafLink` 等旧结构作为导入、导出或运行主路径。

## 总体边界

运行时语义分为三层：

- `World`：环境、观测来源、动作作用点和宿主能力，不进入持久化 `AgentIR`。
- `BodyIR`：简化的感受器和效应器，负责 `World -> Brain` 输入信号转换和 `Brain -> World` 输出信号转换。
- `BrainIR`：神经元、神经元组、神经元模型、突触模型和 brain 内部拓扑，不记录 world 语义。

持久化真源统一为 `AgentIR`：

```ts
export interface AgentIR {
  version: 1;
  metadata: AgentMetadata;
  body: BodyIR;
  brain: BrainIR;
  connections: ConnectionIR[];
  layout?: AgentLayoutIR;
}
```

`connections` 是唯一拓扑连接真源，覆盖 `bodyInput -> brain`、`brain -> brain`、`brain -> bodyOutput` 三类连接。突触行为不再直接写在 connection 上，而是通过 `synapseModelId` 引用 `BrainIR.synapseModels`。

## BodyIR

`BodyIR` 只保存映射规则。规则是真源，按规则展开出的 input/output signal node 是编辑器和运行时投影，不作为第二真源保存。

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

- `nodeIdPattern` 是正则表达式，用于匹配 body 输入或输出信号节点 ID。
- `sourceTemplate` 生成 world 输入来源，例如 `vision.$1.$2`，可解析成 `vision.G.12`。
- `targetTemplate` 生成 world 输出目标，例如 `action.$1`。
- `scale` 用于把已归一化到 `[0, 1]` 的外界输入缩放为向后继神经元传递的信号强度。
- `decayPerSecond` 表示输出动作激活值每秒衰退量；输出节点收到一次 brain 信号后激活值重置为 `1`，随后按 `max(0, value - decayPerSecond * deltaTime)` 衰退。

`BodyIR` 不保存 runtime 状态，不保存 world registry，不保存实际展开出的 signal node 列表。输入/输出 signal node 是否存在，以规则解析结果和 connection 引用共同决定。

## BrainIR

`BrainIR` 描述 brain 内部结构和可复用模型注册表。通用神经元更新逻辑、突触运行时状态、学习 trace、delay queue 等由引擎托管，不进入 IR。

```ts
export interface BrainIR {
  version: 1;
  neuronModels: NeuronModelIR[];
  synapseModels: SynapseModelIR[];
  neurons: BrainNeuronNode[];
  containers: BrainContainerNode[];
  rootContainerId: string;
}
```

### NeuronModelIR

神经元模型注册表是模板共享，不是参数量化。多个神经元可以引用同一模型模板，也可以在实例上做少量覆盖。

第一阶段只要求支持 `izhikevich` family 的多 profile 混用，暂不引入 `LIF`、`AdEx`、`Hodgkin-Huxley` 等多 family 混用。

```ts
export interface NeuronModelIR {
  id: string;
  family: 'izhikevich';
  label?: string;
  params: IzhikevichNeuronParameters;
}

export interface IzhikevichNeuronParameters {
  a: number;
  b: number;
  c: number;
  d: number;
  threshold: number;
}
```

### SynapseModelIR

突触模型注册表描述连接行为。connection 只引用模型，不直接携带完整突触动力学。

第一阶段建议支持轻量但具备放电和学习价值的模型集合：

- `static-current`：最低成本基线。
- `single-exp-conductance`：单指数电导突触。
- `dual-exp-conductance`：默认推荐主力模型。
- `dual-exp-stdp`：双指数电导加 trace-based STDP。
- `dual-exp-stp`：双指数电导加短时程可塑性，默认只用于少量连接。

```ts
export type SynapseModelIR =
  | StaticCurrentSynapseModelIR
  | SingleExpConductanceSynapseModelIR
  | DualExpConductanceSynapseModelIR
  | DualExpStdPSynapseModelIR
  | DualExpStpSynapseModelIR;

export interface SynapseModelBaseIR {
  id: string;
  label?: string;
  kind: string;
}

export interface StaticCurrentSynapseModelIR extends SynapseModelBaseIR {
  kind: 'static-current';
  defaults: {
    weight: number;
    delayMs: number;
  };
}

export interface SingleExpConductanceSynapseModelIR extends SynapseModelBaseIR {
  kind: 'single-exp-conductance';
  defaults: {
    weight: number;
    delayMs: number;
    gMax: number;
    reversalPotential: number;
    tauDecayMs: number;
  };
}

export interface DualExpConductanceSynapseModelIR extends SynapseModelBaseIR {
  kind: 'dual-exp-conductance';
  defaults: {
    weight: number;
    delayMs: number;
    gMax: number;
    reversalPotential: number;
    tauRiseMs: number;
    tauDecayMs: number;
  };
}

export interface DualExpStdPSynapseModelIR extends SynapseModelBaseIR {
  kind: 'dual-exp-stdp';
  defaults: {
    weight: number;
    delayMs: number;
    gMax: number;
    reversalPotential: number;
    tauRiseMs: number;
    tauDecayMs: number;
    aPlus: number;
    aMinus: number;
    tauPlusMs: number;
    tauMinusMs: number;
    wMin: number;
    wMax: number;
  };
}

export interface DualExpStpSynapseModelIR extends SynapseModelBaseIR {
  kind: 'dual-exp-stp';
  defaults: {
    weight: number;
    delayMs: number;
    gMax: number;
    reversalPotential: number;
    tauRiseMs: number;
    tauDecayMs: number;
    utilization: number;
    tauFacilitationMs: number;
    tauRecoveryMs: number;
  };
}
```

`NMDA voltage-dependent`、Markov 受体动力学和 calcium-based plasticity 暂不进入第一阶段 schema。后续如需支持，应作为新的 `SynapseModelIR.kind` 扩展，而不是改写 connection 语义。

### BrainNeuronNode

神经元实例只记录身份、模型引用、少量实例覆盖和初始状态。

```ts
export interface BrainNeuronNode {
  id: string;
  label?: string;
  neuronModelId: string;
  parameterOverrides?: Partial<IzhikevichNeuronParameters>;
  initialState: {
    v: number;
    u?: number;
  };
}
```

`initialState.v` 是初始膜电位。`initialState.u` 未设置时由 runtime 使用模型默认规则推导，例如 `b * v`。

### BrainContainerNode

容器只表达层级。非叶子节点之间的连接是叶子连接的统计投影，不作为独立 semantic connection 保存。

```ts
export interface BrainContainerNode {
  id: string;
  label?: string;
  children: Array<
    | { scope: 'brain'; nodeId: string }
    | { scope: 'container'; nodeId: string }
  >;
}
```

约束：

- `BrainIR` 不包含 adapter 实例节点。
- `BrainIR` 不包含 input/output signal node 的持久列表。
- `BrainIR` 不包含 world-facing source/target。
- `rootContainerId` 指向唯一根容器。
- 每个 neuron 或非 root container 只能被一个 container 持有。

## ConnectionIR

`ConnectionIR` 只描述拓扑边和所使用的突触模型。

```ts
export type ConnectionEndpointIR =
  | { scope: 'bodyInput'; nodeId: string; portId?: string }
  | { scope: 'bodyOutput'; nodeId: string; portId?: string }
  | { scope: 'brain'; nodeId: string; portId?: string };

export interface ConnectionIR {
  id: string;
  from: ConnectionEndpointIR;
  to: ConnectionEndpointIR;
  synapseModelId: string;
  parameterOverrides?: SynapseParameterOverrides;
}
```

`parameterOverrides` 只用于少量实例例外。常规情况下，连接应复用 `synapseModelId` 对应模板参数。

合法方向：

- 允许 `bodyInput -> brain`。
- 允许 `brain -> brain`。
- 允许 `brain -> bodyOutput`。
- 禁止 `bodyOutput -> brain`。
- 禁止 `brain -> bodyInput`。
- 禁止 `bodyInput -> bodyOutput`。

## AgentLayoutIR

布局是编辑器状态，不参与 runtime 语义，但作为 AgentIR 的可选持久化部分保存。

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

布局原则：

- 节点画布位置是持久真源。
- 组内局部位置可由子节点画布位置计算最大矩形包围盒后映射得到。
- 组展开尺寸由子节点包围盒、padding 和最小尺寸计算，不作为语义字段保存。
- viewport、scale、选择集、弹窗、拖拽中间态仍是 session state。

组局部坐标计算规则：

```ts
groupBounds = boundingBox(children.scenePositions).inflate(padding)
childLocalPosition = childScenePosition - groupBounds.origin
```

组移动时，组内子节点随组整体平移；展开后拖动子节点时，先更新节点画布位置，再由包围盒重新投影组内局部布局。

## 编译边界

目标入口：

```ts
compileAgentIR(agent: AgentIR, worldRegistry: WorldRegistry): AgentProgram
```

编译流程：

1. 校验 `BodyIR` 规则正则和模板。
2. 从 `connections` 收集被引用的 `bodyInput` / `bodyOutput` signal node ID。
3. 通过 `WorldRegistry` 解析 body endpoint，得到输入来源、输出目标、端口能力、`scale` 和 `decayPerSecond`。
4. 校验 `BrainIR` 的 neuron、container、model registry 和 root container。
5. 校验每个 neuron 的 `neuronModelId` 存在。
6. 校验每个 connection 的方向、端点存在性和 `synapseModelId` 存在。
7. lower `bodyInput -> brain` 为 runtime input injection。
8. lower `brain -> brain` 为 neuron-to-neuron synapse runtime。
9. lower `brain -> bodyOutput` 为 runtime action output。

runtime 不从节点命名、label 或 layout 推断 world/brain 语义。

## 重构任务

1. 更新 TypeScript schema：新增 `NeuronModelIR`、`SynapseModelIR`、`ConnectionIR`，移除 connection 上的 `weight` / `delayMs` 主语义。
2. 更新默认 seed：把现有 Izhikevich 参数迁移到 `brain.neuronModels`，把默认连接参数迁移到 `brain.synapseModels`。
3. 更新 compiler/program：connection lower 时解析 `synapseModelId`，生成运行时突触实例。
4. 更新 GraphView：连线详情编辑 synapse 模型引用和少量 override；节点详情编辑 neuron model 引用和初始膜电位。
5. 更新 domain tests：覆盖模型缺失、连接方向、突触模板引用、实例 override、body endpoint 解析。
6. 更新 e2e 关键链路：创建神经元、创建连接、切换/编辑模型、保存导入导出。
7. 删除旧结构兼容路径：旧 schema 不再作为导入、导出、storage normalization 或 runtime fallback。

## 验收边界

- 生产代码不再暴露旧持久化结构作为主路径或兼容输入。
- `AgentIR` 是保存、导入、导出、GraphView 编辑和 runtime 编译的唯一持久化协议。
- `ConnectionIR` 不再直接承载完整突触动力学；突触行为来自 `SynapseModelIR`。
- `BrainNeuronNode` 不再直接承载完整模型定义；神经元行为来自 `NeuronModelIR`。
- `BodyIR` 只描述 world/body 映射规则，不保存展开 signal node 列表。
- `npm run type-check` 通过。
- `npm run test:domain` 通过。
- 涉及 GraphView、Brain Library 或导入导出行为时，运行对应 Playwright 关键链路测试。
