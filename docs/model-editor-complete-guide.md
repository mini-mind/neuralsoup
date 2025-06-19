# 模型编辑器完整指南

## 概述

模型编辑器是neuralsoup项目中用于设计和编辑神经网络拓扑的核心组件，支持直观的图形化神经网络构建。

## 核心功能

### 1. 网络组件
- **输入节点（感受器）**：接收外部输入信号（视觉、音频、触觉）
- **神经元**：IZ模型神经元，支持脉冲发放和状态可视化
- **输出节点（效应器）**：运动控制和情绪状态输出

### 2. 连接规则
- 输入节点 → 神经元/输出节点
- 神经元 → 输出节点/其他神经元/自连
- 输出节点 → 神经元

### 3. 交互方式
- **双击空白处**：添加新神经元
- **左键拖拽**：框选多个神经元或拖拽神经元
- **Ctrl+左键**：多选神经元
- **Ctrl+拖拽节点**：创建连接（hover高亮可连接目标）
- **右键拖拽**：平移画布
- **Delete键**：删除选中元素
- **滚轮**：缩放画布视图

## 技术实现

### 组件架构
```
SNNTopologyEditor (主组件)
├── CanvasRenderer (渲染器)
│   ├── NeuronRenderer (神经元渲染)
│   ├── ReceptorRenderer (感受器渲染)
│   └── EffectorRenderer (效应器渲染)
├── CanvasEventHandler (事件处理)
├── useSNNTopologyState (状态管理)
└── useSNNTopologyEvents (事件逻辑)
```

### 状态管理
```typescript
interface ConnectionState {
  from: string;
  fromType: 'node' | 'receptor' | 'effector';
  mouseX: number;
  mouseY: number;
}
```

### 自连接渲染
```typescript
// 使用贝塞尔曲线绘制自然的自连环
ctx.moveTo(centerX, centerY - 20);
const cp1X = centerX + loopSize;
const cp1Y = centerY - loopSize;
const cp2X = centerX + loopSize;
const cp2Y = centerY + loopSize;
const endX = centerX + 20;
const endY = centerY;
ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
```

### 连接高亮逻辑
```typescript
// Hover状态检测
if (hoveredElement && hoveredElement.type === 'neuron' && canConnectTo(hoveredElement)) {
  setHoveredNode(hoveredElement.element.id);
}

// 渲染高亮效果
if (isHovered) {
  ctx.strokeStyle = '#fbbf24'; // 黄色hover高亮
  ctx.lineWidth = 4; // 更粗边框表示可连接
}
```

## 视觉设计

### 颜色方案
- **神经元**：蓝色渐变，根据膜电位变化
- **选中状态**：紫色边框
- **Hover状态**：黄色高亮边框
- **连接线**：绿色（正权重）/ 红色（负权重）
- **权重表示**：线条粗细（weight * 5）

### 布局优化
- **感受器**：增加节点间距（24px），优化RGB三行布局
- **效应器**：扩展宽度以包含愉悦度和唤醒度输出
- **连接端点**：精确计算边缘位置而非中心连接

## 功能特性

### 实时仿真
- IZ神经元模型实时计算
- 脉冲传播和突触权重更新
- 效应器信号累积和衰减

### 可视化反馈
- 神经元膜电位实时显示
- 脉冲发放视觉效果
- 连接创建过程中的hover提示

### 编辑功能
- 支持所有连接类型（包括自连接）
- 多选和批量操作
- 动态权重调整

## 使用指南

### 基本操作流程
1. **创建神经元**：双击空白处
2. **选择节点**：左键点击或Ctrl+点击多选
3. **创建连接**：Ctrl+拖拽节点到目标（黄色高亮表示可连接）
4. **调整视图**：右键拖拽平移，滚轮缩放
5. **删除元素**：选中后按Delete键

### 连接类型示例
- **输入到神经元**：视觉输入 → 感知神经元
- **神经元间连接**：感知神经元 → 决策神经元
- **自连接**：记忆神经元 → 自己（显示为贝塞尔曲线环）
- **神经元到输出**：决策神经元 → 运动控制

### 高级功能
- **批量选择**：框选多个神经元进行批量操作
- **精确定位**：连接端点自动吸附到节点边缘
- **视觉反馈**：实时hover提示和连接预览

## 性能优化

### 渲染优化
- 画布分层渲染，减少重绘
- 视口裁剪，只渲染可见区域
- 感受器滚动条优化

### 交互优化
- 事件节流和防抖
- 智能碰撞检测
- 平滑缩放和平移

## 扩展性

### 插件架构
- 渲染器模块化设计
- 事件处理器可扩展
- 状态管理解耦

### 自定义节点类型
- 支持新的神经元模型
- 自定义渲染样式
- 扩展连接规则

## 故障排除

### 常见问题
1. **连接创建失败**：确保按住Ctrl键并在目标节点上释放
2. **hover高亮不显示**：检查是否在连接模式下
3. **自连接显示异常**：确认自连接使用贝塞尔曲线渲染

### 调试工具
- 浏览器开发者工具
- React DevTools
- 画布调试模式

## 更新日志

### v2.0 主要改进
- ✅ 自连接贝塞尔曲线渲染
- ✅ Ctrl+拖拽连接创建
- ✅ 实时hover高亮反馈
- ✅ 优化感受器节点布局
- ✅ 新增愉悦度和唤醒度输出
- ✅ 连接端点边缘定位

### v1.0 基础功能
- ✅ 基本神经网络编辑
- ✅ IZ神经元模型
- ✅ 多种连接类型支持
- ✅ 实时仿真和可视化 