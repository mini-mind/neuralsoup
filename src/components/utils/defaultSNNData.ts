import { SNNNode, Receptor, Effector, ReceptorInput, EffectorOutput, ReceptorModality } from '../../types/simulation';

export const createDefaultReceptor = (visionCells: number = 36): Receptor => {
  // 创建视觉感受器 - 增加节点间距，优化排布
  const visionInputs: ReceptorInput[] = [];
  const nodeSpacing = 24; // 增加节点间距，减少密集程度
  const startX = 16; // 增加起始X位置
  
  // 计算感受器内容宽度（所有节点）
  const contentWidth = startX * 2 + visionCells * nodeSpacing;
  const minReceptorWidth = 200; // 最小感受器宽度
  const receptorWidth = Math.max(minReceptorWidth, contentWidth);
  
  // 生成R通道输入 - 第1行
  for (let i = 0; i < visionCells; i++) {
    visionInputs.push({
      id: `vision-R-${i}`,
      x: startX + i * nodeSpacing,
      y: 16, // R通道在顶部，增加间距
      label: `R${i}`,
      voltage: 0,
      colorType: 'R'
    });
  }
  
  // 生成G通道输入 - 第2行
  for (let i = 0; i < visionCells; i++) {
    visionInputs.push({
      id: `vision-G-${i}`,
      x: startX + i * nodeSpacing,
      y: 36, // G通道在中间，增加间距
      label: `G${i}`,
      voltage: 0,
      colorType: 'G'
    });
  }
  
  // 生成B通道输入 - 第3行
  for (let i = 0; i < visionCells; i++) {
    visionInputs.push({
      id: `vision-B-${i}`,
      x: startX + i * nodeSpacing,
      y: 56, // B通道在底部，增加间距
      label: `B${i}`,
      voltage: 0,
      colorType: 'B'
    });
  }

  // 只保留视觉模态
  const modalities: ReceptorModality[] = [
    {
      type: 'vision',
      label: '视觉输入',
      inputs: visionInputs,
      isExpanded: true
    }
  ];

  return {
    id: 'receptor-1',
    x: 0,
    y: 0,
    width: receptorWidth,
    height: 80, // 统一使用新的高度
    modalities,
    activeModality: 'vision'
  };
};

export const createDefaultEffector = (): Effector => {
  // 创建效应器 - 初始值改为0
  const defaultEffectorOutputs: EffectorOutput[] = [
    { 
      id: 'output-left', 
      x: 20, 
      y: 25, 
      label: '左转', 
      signal: 0,
      pulseAccumulation: 0, // 初始值改为0
      decayRate: 0.85, // 加快衰减速率
      lastUpdateTime: Date.now()
    },
    { 
      id: 'output-forward', 
      x: 90, 
      y: 25, 
      label: '前进', 
      signal: 0,
      pulseAccumulation: 0, // 初始值改为0
      decayRate: 0.85, // 加快衰减速率
      lastUpdateTime: Date.now()
    },
    { 
      id: 'output-right', 
      x: 160, 
      y: 25, 
      label: '右转', 
      signal: 0,
      pulseAccumulation: 0, // 初始值改为0
      decayRate: 0.85, // 加快衰减速率
      lastUpdateTime: Date.now()
    },
    { 
      id: 'output-motivation', 
      x: 230, 
      y: 25, 
      label: '动机', 
      signal: 0,
      pulseAccumulation: 0,
      decayRate: 0.85,
      lastUpdateTime: Date.now()
    },
    { 
      id: 'output-stress', 
      x: 300, 
      y: 25, 
      label: '压力', 
      signal: 0,
      pulseAccumulation: 0,
      decayRate: 0.85,
      lastUpdateTime: Date.now()
    },
    { 
      id: 'output-homeostasis', 
      x: 370, 
      y: 25, 
      label: '稳态', 
      signal: 0,
      pulseAccumulation: 0,
      decayRate: 0.85,
      lastUpdateTime: Date.now()
    }
  ];

  return {
    id: 'effector-1',
    x: 0,
    y: 0,
    width: 410, // 增加宽度以容纳新的输出
    height: 60, // 固定高度60px，与渲染器一致
    outputs: defaultEffectorOutputs
  };
};

export const createDefaultNodes = (): SNNNode[] => {
  // 创建示例神经元 - 居左放置
  return [
    {
      id: 'neuron-1',
      x: 50, // 居左放置
      y: 150,
      type: 'neuron',
      label: '神经元1',
      params: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
      state: { v: -65, u: 0, spike: false, lastSpikeTime: 0 }
    },
    {
      id: 'neuron-2',
      x: 50, // 居左放置
      y: 250,
      type: 'neuron',
      label: '神经元2',
      params: { a: 0.02, b: 0.2, c: -65, d: 8, threshold: 30 },
      state: { v: -65, u: 0, spike: false, lastSpikeTime: 0 }
    }
  ];
}; 