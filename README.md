# NeuralSoup - 具身智能体仿真系统

基于 TypeScript + React + PixiJS 的脉冲神经网络编辑器和智能体仿真平台。

## 核心特性

- 🧠 **SNN编辑器**: 图形化神经网络设计
- 🤖 **智能体仿真**: 120度视野，海洋环境
- 🎨 **高性能渲染**: PixiJS + 对象池优化
- 🔧 **模块化架构**: 清晰分层，易扩展

## 快速开始

```bash
npm install  # 安装依赖
npm run dev  # 启动开发服务器 (http://localhost:3000)
```

## 项目结构

```
src/
├── components/          # React组件
│   ├── SNNTopologyEditor.tsx     # SNN编辑器
│   ├── hooks/                    # 状态管理Hook
│   └── topology/canvas/          # 画布渲染
├── engine/              # 仿真引擎
│   ├── systems/rendering/        # 渲染系统
│   └── renderers/effects/        # 特效系统
├── types/               # TypeScript类型
└── utils/canvas/        # 画布工具
```

## 使用指南

### SNN编辑器
- 双击空白处：添加神经元
- Ctrl+拖拽：创建连接
- Delete键：删除选中元素
- 滚轮：缩放画布

### 仿真控制
- 播放/暂停：控制仿真
- 重置：重新初始化环境
- 跟随模式：镜头跟随智能体

## 文档

- 📖 [开发者指南](./docs/DEVELOPER_GUIDE.md) - 代码结构和开发规范
- 🧠 [模型编辑器指南](./docs/model-editor-complete-guide.md) - SNN编辑器使用说明

## 技术栈

- TypeScript + React + PixiJS + Vite
- 模块化架构，对象池优化
- Hook状态管理，Canvas/WebGL渲染
