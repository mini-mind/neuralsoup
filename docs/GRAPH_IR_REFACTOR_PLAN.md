# AgentIR 规范（BodyIR/BrainIR）

本文档定义当前仓库采用的 `AgentIR` 规范。`BodyIR` 的生产语义为：**显式 endpoint + mapping edges 是唯一生产真源**。

## 冻结结论

- 冻结后的 canonical `BodyIR` 只包含显式 endpoint 与显式 mapping edges。
- runtime/compiler/storage/UI 只消费 explicit mappings，不消费 regex/template 规则。
- 不保留 generator tooling；批量生成/规则投影不进入产品主线。
- 仓库主线只接受本文定义的 canonical shape。

## Canonical Shape

`AgentIR` 顶层不变：

```ts
export interface AgentIR {
  metadata: AgentMetadata;
  body: BodyIR;
  brain: BrainIR;
  connections: ConnectionIR[];
  layout?: AgentLayoutIR;
}
```

`BodyIR` canonical shape：

```ts
export interface BodyIR {
  inputEndpoints: BodyInputEndpoint[];
  outputEndpoints: BodyOutputEndpoint[];
  mappings: BodyMappingEdge[];
}

export interface BodyInputEndpoint {
  id: string;
  source: string;
  scale: number;
  portId?: string;
  metadata?: Record<string, unknown>;
}

export interface BodyOutputEndpoint {
  id: string;
  target: string;
  decayPerSecond: number;
  portId?: string;
  metadata?: Record<string, unknown>;
}

export type BodyMappingEdge =
  | {
      id: string;
      direction: 'input';
      endpointId: string; // refs BodyInputEndpoint.id
      bodyNodeId: string; // stable bodyInput node id used by ConnectionIR endpoint
    }
  | {
      id: string;
      direction: 'output';
      bodyNodeId: string; // stable bodyOutput node id used by ConnectionIR endpoint
      endpointId: string; // refs BodyOutputEndpoint.id
    };
```

约束：

- `inputEndpoints` / `outputEndpoints` / `mappings` 共同构成 `BodyIR` 唯一真源。
- `ConnectionIR` 的 `scope: 'bodyInput'|'bodyOutput'` 只能引用 `mappings` 中出现的 `bodyNodeId`。
- 每条 `mappings` 必须可解析到唯一 endpoint；禁止隐式推断。
- 生产路径禁止依赖节点命名约定、正则匹配或模板替换来恢复 endpoint 语义。

## Runtime / Compiler / Storage / UI 边界

### Runtime

- runtime 只接收编译后的 explicit endpoint 引用与 mapping 关系。
- runtime 不执行 regex/template 展开，不持有 rule engine。

### Compiler

目标入口：

```ts
compileAgentIR(agent: AgentIR, worldRegistry: WorldRegistry): AgentProgram
```

编译阶段对 `BodyIR` 的最小要求：

1. 校验 `inputEndpoints` / `outputEndpoints` 引用完整性。
2. 校验 `mappings` 的 `endpointId` 与 `bodyNodeId` 唯一性与方向合法性。
3. 校验 `connections` 中 body 端点均存在于 `mappings`。
4. 通过 `worldRegistry` 解析 endpoint 的 source/target 能力。
5. lower `bodyInput -> brain` 与 `brain -> bodyOutput` 时仅使用 explicit mappings。

### Storage

- 持久化只写 canonical `BodyIR`（explicit endpoints + mappings）。
- 导入/导出主协议只接受本文定义的数据形状。
- normalization 层不维护隐式推导分支。

### UI（GraphView/Editor）

- UI 编辑面板直接编辑 endpoint 与 mapping edge。
- UI 不暴露第二真源工作流；若提供生成器入口，产物必须回写为 mappings。
- UI 回显与连接校验均基于 mappings，不基于 regex/template 解析结果。

## Generator Tooling

结论：**不保留**。

- 产品内不提供 regex/template 批量生成器。
- runtime/compiler/storage/UI 不接受 generator 定义，也不接受 generator 产物以外的隐式规则语义。
- 如未来确需离线转换脚本，应视为仓库外部的一次性工具，而非产品协议或编辑器能力。

## 非规范语义

以下语义不属于当前规范：

- `nodeIdPattern` 正则匹配驱动 endpoint 推导。
- `sourceTemplate` / `targetTemplate` 模板替换驱动 world path 推导。
- 基于规则展开 signal node 列表并在运行期二次计算。

边界结论：

- 这些语义不是生产协议。
- runtime/compiler/storage/UI 不读取这些语义。
- 文档中若提及这些语义，仅用于定义当前规范的边界。

## 验收边界

满足以下条件才视为冻结完成：

- schema 层不存在“rules 作为主语义”的 `BodyIR` 定义。
- compiler/runtime 代码路径不再读取 regex/template rule 字段。
- storage 导入导出仅保留 explicit endpoints + mappings 主协议。
- UI 主编辑流只读写 explicit mappings。
- 不存在 generator tooling 入口，也不存在相关运行期或编辑器依赖。
- 生产测试以 explicit mappings 为基线：
  - `npm run type-check`
  - `npm run test:domain`
  - 涉及 UI 交互变更时运行 `npm run test:e2e`

## 落地状态

- 仓库内主路径不依赖任何隐式规则语义。
- 默认 seed 数据仅包含 canonical `BodyIR`。
- 新增或编辑 body 映射时，不需要 regex/template 才能完成工作流。

## 非目标

- 不为非规范输入提供生产路径支持。
- 不引入第二套并行 body 真源（例如 rules + mappings 双写长期共存）。
- 不引入 generator tooling，也不在 runtime 重新实现 generator 能力。
