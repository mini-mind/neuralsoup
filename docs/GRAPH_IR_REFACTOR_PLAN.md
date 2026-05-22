# Brain Package、Body 与 Graph IR 设计

本文档记录当前 `world -> body -> brain` 分层设计、已落地边界和下一步重构验收项。

## 分层边界

运行时边界分为三层：

- `world`：环境、观测来源、动作作用点和宿主能力。
- `body`：具身信号层，声明哪些 world 信号接入哪些 brain 边界节点。
- `brain`：模型、拓扑、叶子连接和内部计算语义。

`body` 是 world 与 brain 之间的适配器。compiler 不再从 `SignalNode.signal.id`、节点 ID 或 label 推断世界语义。

## 当前格式

导入、导出和 LocalStorage 的真源是完整 `BrainPackage`：

```ts
export interface BrainPackage {
  packageVersion: 1;
  metadata: BrainMetadata;
  definition: BrainDefinition;
  layout: BrainLayoutDocument;
  body: BodyDefinition;
}
```

规则：

- 导入器只接受完整 `BrainPackage`。
- 不接受裸 `GraphIRDocument`。
- 不为缺失的 `body` 或 `layout` 自动补默认值。
- JSON 导出包含 metadata、brain definition、layout 和 body。
- LocalStorage 使用 `neuralsoup.brain-library.v1` 保存 `BrainPackage[]`。

`BrainDefinition` 当前是 `GraphIRDocument` 的别名。这个别名只用于分阶段降低改动面，不代表长期命名已经完成。

## BodyDefinition

`BodyDefinition` 显式描述具身信号和 brain 绑定：

```ts
export interface BodyDefinition {
  version: 1;
  inputSignals: BodyInputSignal[];
  outputSignals: BodyOutputSignal[];
  brainBindings: {
    inputs: BodyInputBinding[];
    outputs: BodyOutputBinding[];
  };
}
```

默认 body 的命名：

- 输入：`vision-r-0`、`vision-g-0`、`vision-b-0`。
- 输出：`motor-turn-left`、`motor-move-forward`、`motor-turn-right`。

绑定规则：

- `bodySignalId` 必须引用 body 内存在的信号。
- input binding 只能绑定 root 直系 adapter 内的 input signal node。
- output binding 只能绑定 root 直系 adapter 内的 output signal node。
- 嵌套 adapter 可用于组内对外中转，但不参与 world/body 绑定。
- 显式传入 runtime 的 body 必须被编译校验，不能被静默替换为默认 body。

## BrainDefinition

当前 `BrainDefinition = GraphIRDocument`，仍包含 `models` 和 `root`：

```ts
export interface GraphIRDocument {
  version: 1;
  models: ModelDefinition[];
  root: RootGraph;
}
```

语义原则：

- `models` 描述神经元和信号节点模型，结构继续参考 NESTML 的 state、parameters、internals、input、output、equations、onReceive、update。
- `synapse` 不作为实例节点或模型定义出现。
- 连接权重和延迟保存在叶子连接上。
- 叶子节点是可执行模型实例。
- 非叶子节点只组织子图，不直接参与运行时执行。
- adapter 可出现在 root 或任意 group 内。
- 保存级连接只允许存在于叶子节点端口之间。
- 非叶子连接只作为 GraphView 聚合视图派生，不写回 IR。

## Layout

`BrainLayoutDocument` 保存编辑器状态：

```ts
export interface BrainLayoutDocument {
  version: 1;
  nodes: Record<string, BrainLayoutNodeState>;
}
```

当前 layout 由 `GraphIRDocument` 中的 `position` 和 `collapsed` 派生。下一阶段要把这些字段从 topology node 中移走，让 layout 成为唯一 UI 状态真源。

## Runtime

compiler 入口是：

```ts
compileBrainDefinition(definition, body)
```

编译流程：

1. 校验 brain 模型、topology 和叶子连接。
2. 校验 body 信号和 body-brain binding。
3. 展开 topology 树，收集 leaf node。
4. 实例化模型参数。
5. lower 叶子连接为 runtime connection。
6. 由 `BodyDefinition` 生成 runtime input/output binding。

关键约束：

- runtime 不读 layout。
- runtime 不从 signal 名称推断 world binding。
- GraphView 聚合连接不参与 runtime 编译。
- 选择 Brain 时，App 同步 `definition`、`body` 和由 body 推导出的视觉格数量。

## GraphView

GraphView 当前仍直接编辑 `GraphIRDocument`。长期目标是：

- 编辑 `BrainDefinition.topology`。
- 编辑 `BrainLayoutDocument`。
- 展示 `AggregateLinkView`。
- 编辑 leaf node 参数覆盖和 leaf edge 参数。
- 不编辑 body 与 world 的具身映射细节。
- 不把 layout 状态混进语义 IR。

## 后续任务

1. 把 `position` 和 `collapsed` 从 topology node 移入 `BrainLayoutDocument`。
2. 将 `GraphIRDocument` 正式重命名或替换为 `BrainDefinition`。
3. 将 `LeafLink` 正式重命名或替换为 `ConnectionEdge`。
4. 移除 `SignalNode.signal` 的 world-facing 用途；如果保留，只作为模型信号类型描述。
5. 为 body schema 增加更严格的重复绑定、fan-in/fan-out 策略和容量边界校验。

## 验收边界

- `rg "compileGraphIRDocument|StoredBrain|createStoredBrain|upsertStoredBrainDocument" src tests e2e docs` 不命中新运行路径。
- `npm run type-check` 通过。
- `npm run test:domain` 通过。
- Brain Library e2e 覆盖保存完整 package、LocalStorage 持久化、reload 后选择 Brain、导入导出、重命名、删除、复制、脏状态提示，并同步 body 对应的视觉格数量。
