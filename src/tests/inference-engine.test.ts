/**
 * 推理引擎测试
 * 验证推理引擎的基本功能
 */

import {
  InferenceEngine,
  StateUpdateEngine,
  UIStateSynchronizer,
  TopologyChecker,
  InferenceEngineManager,
  NodeType,
  UpdateStrategy
} from '../core/inference-engine';
import { IzhikevichNeuron } from '../core/entities/neuron';
import { VoltageInputNode, VoltageAccumulatorNode } from '../core/entities/voltage-nodes';

/**
 * 模拟节点类（用于测试）
 */
class MockNeuron {
  public voltage: number = -70;
  public id: string;

  constructor(id: string) {
    this.id = id;
  }

  update(input: number, deltaTime: number): boolean {
    this.voltage += input * deltaTime;
    const spiked = this.voltage > -55;
    if (spiked) {
      this.voltage = -70; // 重置
    }
    return spiked;
  }

  getState() {
    return {
      voltage: this.voltage,
      isSpiking: this.voltage > -55
    };
  }
}

/**
 * 测试推理引擎基本功能
 */
function testInferenceEngineBasics() {
  console.log('=== 测试推理引擎基本功能 ===');
  
  const engine = new InferenceEngine();
  
  // 创建测试节点
  const neuron1 = new MockNeuron('neuron1');
  const neuron2 = new MockNeuron('neuron2');
  const inputNode = new VoltageInputNode('input1');
  
  // 添加节点
  engine.addNode('neuron1', neuron1, NodeType.NEURON);
  engine.addNode('neuron2', neuron2, NodeType.NEURON);
  engine.addNode('input1', inputNode, NodeType.INPUT);
  
  // 添加连接
  engine.addRelation('input1', 'neuron1', 1.0, NodeType.INPUT, NodeType.NEURON);
  engine.addRelation('neuron1', 'neuron2', 0.5, NodeType.NEURON, NodeType.NEURON);
  
  // 检查状态
  const engineState = engine.getEngineState();
  console.log('引擎状态:', engineState);
  
  // 测试更新
  const externalInputs = new Map([['input1', 10]]);
  engine.update(0.016, externalInputs);
  
  // 检查节点状态
  const nodeStates = engine.getAllNodeStates();
  console.log('节点状态:', Array.from(nodeStates.entries()));
  
  // 验证拓扑
  const validation = engine.validateTopology();
  console.log('拓扑验证:', validation);
  
  console.log('✓ 推理引擎基本功能测试完成\n');
}

/**
 * 测试拓扑检查器
 */
function testTopologyChecker() {
  console.log('=== 测试拓扑检查器 ===');
  
  const checker = new TopologyChecker();
  const engine = new InferenceEngine();
  
  // 创建测试拓扑
  const neuron1 = new MockNeuron('neuron1');
  const neuron2 = new MockNeuron('neuron2');
  const neuron3 = new MockNeuron('neuron3');
  
  engine.addNode('neuron1', neuron1, NodeType.NEURON);
  engine.addNode('neuron2', neuron2, NodeType.NEURON);
  engine.addNode('neuron3', neuron3, NodeType.NEURON);
  
  // 创建循环依赖
  engine.addRelation('neuron1', 'neuron2', 1.0, NodeType.NEURON, NodeType.NEURON);
  engine.addRelation('neuron2', 'neuron3', 1.0, NodeType.NEURON, NodeType.NEURON);
  engine.addRelation('neuron3', 'neuron1', 1.0, NodeType.NEURON, NodeType.NEURON);
  
  // 检测循环依赖
  const nodes = new Map(engine.getAllNodes().map(n => [n.id, n]));
  const circularResult = checker.detectCircularDependencies(nodes);
  console.log('循环依赖检测:', circularResult);
  
  // 全面检查拓扑
  const relations = engine.getRelations();
  const topologyResult = checker.checkTopology(nodes, relations);
  console.log('拓扑检查结果:', topologyResult);
  
  console.log('✓ 拓扑检查器测试完成\n');
}

/**
 * 测试状态更新引擎
 */
async function testStateUpdateEngine() {
  console.log('=== 测试状态更新引擎 ===');
  
  const updateEngine = new StateUpdateEngine({
    strategy: UpdateStrategy.SEQUENTIAL,
    maxParallelTasks: 2,
    timeSliceMs: 10,
    enableProfiling: true,
    enableStateCache: true
  });
  
  const engine = new InferenceEngine();
  
  // 创建简单网络
  const neuron1 = new MockNeuron('neuron1');
  const neuron2 = new MockNeuron('neuron2');
  
  engine.addNode('neuron1', neuron1, NodeType.NEURON);
  engine.addNode('neuron2', neuron2, NodeType.NEURON);
  engine.addRelation('neuron1', 'neuron2', 1.0, NodeType.NEURON, NodeType.NEURON);
  
  // 执行更新
  const nodes = new Map(engine.getAllNodes().map(n => [n.id, n]));
  const relations = new Map(engine.getRelations().map(r => [r.id, r]));
  const computeOrder = engine.getComputeOrder();
  
  const result = await updateEngine.updateNodes(nodes, relations, computeOrder, 0.016);
  console.log('更新结果:', result);
  
  // 检查统计信息
  const stats = updateEngine.getStats();
  console.log('更新统计:', stats);
  
  console.log('✓ 状态更新引擎测试完成\n');
}

/**
 * 测试UI状态同步器
 */
function testUIStateSynchronizer() {
  console.log('=== 测试UI状态同步器 ===');
  
  const uiSync = new UIStateSynchronizer({
    updateFrequency: 30,
    batchSize: 10,
    enableThrottling: true,
    enableDeltaUpdates: true,
    voltageThreshold: 0.5,
    enableInterpolation: true
  });
  
  // 模拟节点状态更新
  const nodeState = { voltage: -65, isSpiking: false };
  const position = { x: 100, y: 200 };
  
  uiSync.syncNodeState('test-node', nodeState, position, 'neuron');
  
  // 检查UI状态
  const uiState = uiSync.getNodeUIState('test-node');
  console.log('UI状态:', uiState);
  
  // 检查性能统计
  const perfStats = uiSync.getPerformanceStats();
  console.log('UI性能统计:', perfStats);
  
  // 清理
  uiSync.destroy();
  
  console.log('✓ UI状态同步器测试完成\n');
}

/**
 * 测试推理引擎管理器
 */
async function testInferenceEngineManager() {
  console.log('=== 测试推理引擎管理器 ===');
  
  const manager = new InferenceEngineManager({
    enableTopologyValidation: true,
    enablePerformanceMonitoring: true,
    enableAutoOptimization: true
  });
  
  // 创建模拟的NetworkTopology
  const mockTopology = {
    neurons: new Map([
      ['neuron1', new MockNeuron('neuron1')],
      ['neuron2', new MockNeuron('neuron2')]
    ]),
    synapses: new Map([
      ['synapse1', {
        id: 'synapse1',
        presynapticNeuronId: 'neuron1',
        postsynapticNeuronId: 'neuron2',
        weight: 1.0
      }]
    ])
  };
  
  try {
    // 初始化
    await manager.initialize(mockTopology as any);
    console.log('管理器初始化成功');
    
    // 启动
    manager.start();
    
    // 执行更新
    const externalInputs = new Map([['neuron1', 5]]);
    const metrics = await manager.update(0.016, externalInputs);
    console.log('更新指标:', metrics);
    
    // 检查系统状态
    const systemState = manager.getSystemState();
    console.log('系统状态:', systemState);
    
    // 获取拓扑验证结果
    const validation = manager.getTopologyValidation();
    console.log('拓扑验证:', validation);
    
    // 停止和清理
    manager.stop();
    manager.destroy();
    
  } catch (error) {
    console.error('管理器测试失败:', error);
  }
  
  console.log('✓ 推理引擎管理器测试完成\n');
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🧠 开始推理引擎测试套件\n');
  
  try {
    testInferenceEngineBasics();
    testTopologyChecker();
    await testStateUpdateEngine();
    testUIStateSynchronizer();
    await testInferenceEngineManager();
    
    console.log('🎉 所有测试完成！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  runAllTests();
}

export {
  testInferenceEngineBasics,
  testTopologyChecker,
  testStateUpdateEngine,
  testUIStateSynchronizer,
  testInferenceEngineManager,
  runAllTests
};
