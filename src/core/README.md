# Core 模块

这个目录包含了应用程序的核心业务逻辑和类型定义。

## 目录结构

### `/entities`
包含智能体相关的类型定义：
- `IAgent` - 智能体接口
- `IBrain` - 大脑接口
- `ISensor` - 传感器接口  
- `IEffector` - 执行器接口

### `/world`
包含世界相关的类型定义和实现：
- `IWorld` - 世界接口
- `ICollidable` - 可碰撞实体接口
- `World` - 世界类实现

### `/simulation`
包含仿真循环管理：
- `SimulationLoop` - 仿真循环管理器

### `/services`
包含核心服务：
- `EventBus` - 事件总线
- `GlobalState` - 全局状态管理
- `ModuleRegistry` - 模块注册表

## 类型导入

推荐使用统一的类型导入：

```typescript
import type { IWorld, IAgent, IBrain } from '../core/types';
```

这样可以避免深层路径导入，并且更容易维护。 