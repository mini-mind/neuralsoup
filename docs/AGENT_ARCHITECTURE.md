# NeuralSoup Architecture

本文档描述仓库当前采用的 `AgentIR` 结构，以及 runtime、编辑器和共享画布内核的长期边界。

## AgentIR

顶层结构：

```ts
export interface AgentIR {
  metadata: AgentMetadata;
  body: BodyIR;
  brain: BrainIR;
  connections: ConnectionIR[];
  layout?: AgentLayoutIR;
}
```

- `metadata`：Agent 标识和展示元数据。
- `body`：外部 world 信号与 brain 端点之间的显式映射。
- `brain`：神经元模型、突触模型、神经元节点和容器层级。
- `connections`：body/brain 节点之间的有向连接和突触参数覆盖。
- `layout`：持久化画布布局，只保存节点位置和折叠状态。

## BodyIR

`BodyIR` 是 world 信号与 body signal 节点之间的显式协议：

```ts
export interface BodyIR {
  inputEndpoints: BodyInputEndpointIR[];
  outputEndpoints: BodyOutputEndpointIR[];
  mappings: BodyMappingIR[];
}

export interface BodyInputEndpointIR {
  id: string;
  source: string;
  worldPort?: string;
  scale: number;
}

export interface BodyOutputEndpointIR {
  id: string;
  target: string;
  worldPort?: string;
  decayPerSecond: number;
}

export interface BodyInputMappingIR {
  id: string;
  kind: 'input';
  endpointId: string;
  nodeId: string;
}

export interface BodyOutputMappingIR {
  id: string;
  kind: 'output';
  endpointId: string;
  nodeId: string;
}
```

约束：

- `inputEndpoints`、`outputEndpoints`、`mappings` 共同构成 `BodyIR` 唯一真源。
- `connections` 中 `scope: 'bodyInput' | 'bodyOutput'` 的 `nodeId` 必须引用 `mappings` 暴露出的 body signal 节点。
- `worldPort` 是可选宿主提示；真正可执行语义来自 `worldRegistry` 对 `source` / `target` 的解析。
- 运行期、编译期和持久化协议都不依赖隐式规则生成节点，也不接受第二套并行 body 真源。

`src/domain/brain/agent-body-rules.ts` 会基于 canonical `BodyIR` 生成 preview 与结构化诊断；这些 preview 字段不是第二套协议。

## BrainIR

`BrainIR` 保存可持久化的神经网络拓扑：

```ts
export interface BrainIR {
  neuronModels: NeuronModelIR[];
  synapseModels: SynapseModelIR[];
  neurons: BrainNeuronNode[];
  containers: BrainContainerNode[];
  rootContainerId: string;
}
```

- `neuronModels`：可复用神经元模型定义。
- `synapseModels`：可复用突触模型定义。
- `neurons`：神经元实例，引用 `neuronModelId` 并可覆盖参数、初始膜电位。
- `containers`：分组层级；`rootContainerId` 是 Brain 根容器真源。

## Connections

连接协议：

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

- `scope` 决定连接端点位于 body 输入、body 输出或 brain 节点。
- `portId` 是可选显式端口标识；未写入时由编辑器与编译器按节点类型补默认端口。
- 连接的真实可执行参数来自 `synapseModelId + parameterOverrides`，而不是 UI 展示值。

## Layout And Session State

`layout` 只保存持久化布局：

- 节点位置。
- 分组折叠状态。

以下内容不是持久化 IR，而是编辑会话态：

- 画布视角、缩放。
- 当前选择、框选、右键菜单、详情弹窗。
- 拖拽中的草稿位置。
- GraphView 的路径镜像和运行态高亮。

`useSNNTopologyState.ts` 持有 Graph 编辑会话真源；App 层只接收只读镜像，不复制第二套导航真源。

## Runtime Boundary

- `src/domain/brain/agent-compiler.ts`：把 `AgentIR` 编译为 runtime program。
- `src/domain/brain/agent-step.ts`：执行程序步进和神经元/突触状态演化。
- `src/runtime/SimulationSession.ts`：管理一次仿真会话的安装、重置和生命周期。
- `src/engine/`：管理世界、控制器、Pixi 渲染与宿主交互。

边界要求：

- `src/domain/` 不依赖 React、Pixi、DOM 或浏览器事件。
- runtime 使用 canonical `AgentIR` 和 `worldRegistry` 解析结果，不依赖编辑器私有状态。
- Pixi 只能经由 `src/engine/pixi.ts` 引入。

## Editor Boundary

- `BodyIR` 画布负责 world 信号、body signal 节点与映射边的编辑。
- `BrainIR` 画布负责容器层级、神经元、连接、聚合和运行态诊断投影。
- 两类画布共享 `src/components/editor/graph/sharedCanvasCore.ts` 的能力边界：
  - viewport / session
  - selection box
  - node drag / pan / zoom
  - connect / context menu / remove callbacks

共享内核只暴露 capability 和 callback 契约，不承载 Brain 或 Body 业务语义；具体语义由各自场景 adapter 和 coordinator 负责。

## Validation

- 修改 IR、编译、步进、body endpoint 解析、容器语义或连接规则时运行：
  - `npm run type-check`
  - `npm run test:domain`
- 修改 Pixi 入口或 renderer 相关代码时额外运行：
  - `npm run check:pixi-imports`
- 修改用户可见工作流、拓扑交互或设置界面时额外运行：
  - `npm run test:e2e`
