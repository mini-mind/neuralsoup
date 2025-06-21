/**
 * App组件状态管理Hook
 * 统一管理应用的各种状态
 */

import { useState, useCallback } from 'react';
import { SimulationEngine } from '../../engine/SimulationEngine';

export interface AgentParameters {
  visionCells: number;
  visionRange: number;
  visionAngle: number;
}

export const useAppState = () => {
  // 基础状态
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isScriptMode, setIsScriptMode] = useState(false);
  const [enableManualOverride, setEnableManualOverride] = useState(false);
  
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [gameAreaWidth, setGameAreaWidth] = useState(60);
  
  // 模态框状态
  const [showAgentParamsModal, setShowAgentParamsModal] = useState(false);
  
  // 画布尺寸
  const [canvasWidth, setCanvasWidth] = useState(window.innerWidth * 0.6);
  const [canvasHeight, setCanvasHeight] = useState(window.innerHeight);
  
  // 智能体参数
  const [agentParameters, setAgentParameters] = useState<AgentParameters>({
    visionCells: 36,
    visionRange: 250,
    visionAngle: 120
  });
  
  // 统计数据
  const [stats, setStats] = useState({
    fps: 0,
    totalReward: 0,
    collisionCount: 0,
    neuralState: { motivation: 0, stress: 0, homeostasis: 0.5 }
  });
  
  // 脚本代码
  const [onFrameCode, setOnFrameCode] = useState(`// 实现每帧的智能体控制逻辑
// 这段代码会在点击"应用脚本"时执行一次进行初始化
// 之后每帧只调用onFrame函数

// 全局变量（在脚本应用时初始化一次）
let stepCount = 0;
let memory = {};
let lastDirection = 0;

// state: 主智能体的感受器数据
//   - vision: number[] - 视觉数据 (n个单元格 × 3通道 RGB)
//   - gotReward: boolean - 上一帧是否获得奖励
// action: 效应器控制对象
//   - move(direction): void - 移动函数，direction为[前进, 左转, 右转]的强度数组

function onFrame(state, action) {
  stepCount++; // 记录步数
  
  // 示例：简单的前进行为
  action.move([0.5, 0, 0]); // 50%速度前进
  
  // 示例：检测奖励
  if (state.gotReward) {
    console.log('获得奖励！步数:', stepCount);
    if (!memory.totalReward) memory.totalReward = 0;
    memory.totalReward++;
  }
  
  // 示例：基于视觉的简单反应
  // const avgRed = state.vision.filter((_, i) => i % 3 === 0).reduce((a, b) => a + b) / (state.vision.length / 3);
  // if (avgRed > 0.5) {
  //   action.move([0, 0.3, 0]); // 看到红色时左转
  // }
  
  return null;
}`);

  // 计算画布尺寸
  const calculateCanvasDimensions = useCallback(() => {
    const newWidth = window.innerWidth * (gameAreaWidth / 100);
    const newHeight = window.innerHeight;
    setCanvasWidth(newWidth);
    setCanvasHeight(newHeight);
  }, [gameAreaWidth]);

  // 格式化数字
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return {
    // 状态
    isRunning,
    isPaused,
    isScriptMode,
    enableManualOverride,
    isDragging,
    gameAreaWidth,
    showAgentParamsModal,
    canvasWidth,
    canvasHeight,
    agentParameters,
    stats,
    onFrameCode,
    
    // 状态设置器
    setIsRunning,
    setIsPaused,
    setIsScriptMode,
    setEnableManualOverride,
    setIsDragging,
    setGameAreaWidth,
    setShowAgentParamsModal,
    setCanvasWidth,
    setCanvasHeight,
    setAgentParameters,
    setStats,
    setOnFrameCode,
    
    // 辅助函数
    calculateCanvasDimensions,
    formatNumber,
  };
}; 