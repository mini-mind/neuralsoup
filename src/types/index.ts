/**
 * 项目类型统一导出文件
 * 提供清晰的类型导入路径，避免深层嵌套导入
 */

// === 核心类型 ===
export type {
  // 世界和智能体
  IWorld,
  ICollidable,
  IAgent,
  IBrain,
  ISensor,
  IEffector,
  
  // 神经网络核心
  IProcessableNode,
  INeuron,
  NodeState,
  NeuronState,
  IzhikevichParams,
  LIFParams,
  ISynapse,
  SynapseState,
  STDPParams,
  NetworkStats,
  
  // 插件系统
  IPlugin,
  PluginConfig,
  IPluginFactory,
} from '../core/types';

export {
  // 抽象基类
  AbstractPlugin,
  AbstractSensor,
  AbstractEffector,
  
  // 具体实现
  IzhikevichNeuron,
  LIFNeuron,
  STDPSynapse,
  BasicSynapse,
  NetworkNode,
  NetworkEdge,
  NetworkTopology,
  VoltageInputNode,
  VoltageAccumulatorNode,
} from '../core/types';

// === UI类型 ===
export type {
  // UI特定类型
  UINode,
  UIEdge,
  UITopology,
  NodeAdapter,
  EdgeAdapter,
  
  // 编辑器类型
  Vector2D,
  NodeGroup,
  InteractionState,
  SelectionBox,
  CanvasTransform,
  
  // 向后兼容别名
  SNNNode,
  SNNEdge,
  SNNTopology,
} from '../ui/types/snn.types';

export type {
  GraphEditorProps,
  ManagedEdge,
} from '../ui/types/editor.types';
