# 神经网络系统文档

## 概述

本系统实现了一个完整的尖峰神经网络（SNN）仿真框架，包含神经元模型、突触模型、网络拓扑管理和可视化编辑器。

## 核心组件

### 1. 神经元系统

#### INeuron 接口
定义了神经元的基本行为：
- `update(input, deltaTime)` - 更新神经元状态
- `reset()` - 重置神经元
- `getState()` - 获取当前状态

#### IzhikevichNeuron 类
基于Izhikevich 2003年模型的神经元实现：
- 支持不同类型：input（输入）、hidden（隐藏）、output（输出）
- 自动根据类型设置合适的参数
- 实时计算膜电位和动作电位

```typescript
const neuron = new IzhikevichNeuron('neuron-1', 'hidden', 100, 200);
const spiked = neuron.update(10, 1); // 输入电流10，时间步长1ms
```

### 2. 突触系统

#### ISynapse 接口
定义了突触的基本行为：
- `process(preSpike, preNeuron, postNeuron, deltaTime)` - 处理突触传递
- `getState()` - 获取突触状态
- `reset()` - 重置突触状态

#### STDPSynapse 类
实现了STDP（尖峰时序依赖可塑性）学习规则：
- 自动根据前后神经元的发放时序调整权重
- 支持LTP（长时程增强）和LTD（长时程抑制）
- 可配置学习参数

```typescript
const synapse = new STDPSynapse('syn-1', 'pre-neuron', 'post-neuron', 0.5);
const current = synapse.process(true, preNeuron, postNeuron, 1);
```

### 3. 网络拓扑系统

#### NetworkNode 类
封装神经元，提供拓扑管理接口：
- 位置管理（x, y坐标）
- 选择状态管理
- 神经元状态代理

#### NetworkEdge 类
封装突触，表示神经元间的连接：
- 连接关系管理
- 突触状态代理
- 选择状态管理

#### NetworkTopology 类
管理整个网络的拓扑结构：
- 节点和边的增删改查
- 网络仿真更新
- 统计信息计算

```typescript
const topology = new NetworkTopology();
topology.addNode(neuron);
topology.addEdge(synapse);
topology.update(1, externalInputs);
```

## 使用示例

### 创建简单网络

```typescript
import { IzhikevichNeuron, STDPSynapse, NetworkTopology } from '../core/types';

// 创建神经元
const input = new IzhikevichNeuron('input-1', 'input', 100, 150);
const hidden = new IzhikevichNeuron('hidden-1', 'hidden', 300, 150);
const output = new IzhikevichNeuron('output-1', 'output', 500, 150);

// 创建突触
const syn1 = new STDPSynapse('syn-1', 'input-1', 'hidden-1', 0.8);
const syn2 = new STDPSynapse('syn-2', 'hidden-1', 'output-1', 0.6);

// 构建网络
const network = new NetworkTopology();
network.addNode(input);
network.addNode(hidden);
network.addNode(output);
network.addEdge(syn1);
network.addEdge(syn2);

// 仿真运行
const inputs = new Map([['input-1', 15]]);
network.update(1, inputs);
```

### 可视化编辑器

系统提供了一个交互式的可视化编辑器：
- 实时显示神经元状态（膜电位、发放状态）
- 突触权重可视化（线条粗细和颜色）
- 支持拖拽移动节点
- 点击选择查看详细信息
- 缩放和平移画布

#### 交互操作
- **左键点击** - 选择节点或边
- **拖拽** - 移动节点位置
- **右键拖拽** - 平移画布
- **滚轮** - 缩放画布
- **双击** - 创建新节点（兼容模式）

#### 颜色编码
- **绿色** - 输入层神经元
- **蓝色** - 隐藏层神经元
- **橙色** - 输出层神经元
- **红色** - 正在发放动作电位的神经元
- **红色连线** - 活跃的突触连接

## 参数配置

### Izhikevich神经元参数
- `a` - 恢复时间常数 (0.02)
- `b` - 恢复敏感性 (0.2)
- `c` - 重置后的电位值 (-65mV)
- `d` - 重置后恢复变量的增量 (8)

### STDP突触参数
- `learningRate` - 学习率 (0.01)
- `tauPlus` - LTP时间常数 (20ms)
- `tauMinus` - LTD时间常数 (20ms)
- `aPlus` - LTP幅度 (0.1)
- `aMinus` - LTD幅度 (0.12)

## 演示数据

系统包含一个预构建的演示网络：
- 3个输入神经元
- 4个隐藏层神经元
- 2个输出神经元
- 14个STDP突触连接

可通过 `createDemoNetworkTopology()` 函数创建。

## 扩展性

系统采用接口驱动的设计，易于扩展：
- 实现 `INeuron` 接口添加新的神经元模型
- 实现 `ISynapse` 接口添加新的突触模型
- 继承 `NetworkTopology` 类添加特殊的网络类型

## 性能考虑

- 使用邻接表优化连接查找
- 批量更新减少状态变更通知
- Canvas绘制优化，支持大规模网络可视化
- 时间步长可调，平衡精度和性能 