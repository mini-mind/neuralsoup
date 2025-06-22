import { useState, useCallback, useEffect, useRef } from "react";
import { SimulationEngine } from "../engine/SimulationEngine";

export const useScriptState = () => {
  // 脚本相关状态
  const [onFrameCode, setOnFrameCode] = useState(`// 智能体控制脚本 - 极简示例
// 这段代码在点击"应用脚本"时执行一次进行初始化
// 之后每帧调用onFrame函数

// 全局变量
let stepCount = 0;

// agent: 智能体对象，包含：
//   - vision: number[] - 视觉数据 (n个单元格 × 3通道 RGB)
//   - reward: number - 上一帧获得的奖励数值
//   - move(direction): void - 移动函数，direction为[前进, 左转, 右转, 后退]

function onFrame(agent) {
  stepCount++;
  
  // 基础行为：前进
  agent.move([0.6, 0, 0, 0]); // [前进0.6, 左转0, 右转0, 后退0]
  
  // 获得奖励时加速
  if (agent.reward > 0) {
    console.log('获得奖励:', agent.reward);
    agent.move([1.0, 0, 0, 0]); // 全速前进
  }
  
  // 每100步随机转向
  if (stepCount % 100 === 0) {
    const turn = Math.random() > 0.5 ? [0.3, 0.5, 0, 0] : [0.3, 0, 0.5, 0];
    agent.move(turn); // [前进, 左转, 右转, 后退]
  }
}`);

  const [isScriptApplied, setIsScriptApplied] = useState(false);

  // 脚本版本管理
  const [savedScripts, setSavedScripts] = useState<{ [key: string]: string }>(
    () => {
      const saved = localStorage.getItem("neuralSoup_savedScripts");
      return saved
        ? JSON.parse(saved)
        : {
            智能觅食者: `// 智能觅食者 - 高级AI行为脚本
// 具备视觉感知、奖励学习和适应性行为

let stepCount = 0;
let rewardHistory = [];
let explorationMode = true;
let lastRewardTime = 0;
let avoidanceTimer = 0;

function onFrame(agent) {
  stepCount++;
  
  // 分析视觉输入
  const vision = agent.vision || [];
  const frontVision = vision.slice(0, 12); // 前方视野
  const leftVision = vision.slice(12, 24); // 左侧视野  
  const rightVision = vision.slice(24, 36); // 右侧视野
  
  // 计算视野中的食物密度
  let frontFood = 0, leftFood = 0, rightFood = 0;
  for(let i = 0; i < 12; i += 3) {
    if(frontVision[i+1] > 0.5) frontFood++; // 绿色通道表示食物
    if(leftVision[i+1] > 0.5) leftFood++;
    if(rightVision[i+1] > 0.5) rightFood++;
  }
  
  // 计算障碍物威胁
  let frontThreat = 0;
  for(let i = 0; i < 12; i += 3) {
    if(frontVision[i] > 0.5 || frontVision[i+2] > 0.5) frontThreat++; // 红/蓝色表示障碍
  }
  
  // 奖励学习机制
  if(agent.reward > 0) {
    rewardHistory.push(stepCount);
    lastRewardTime = stepCount;
    explorationMode = false; // 进入利用模式
    console.log('获得奖励:', agent.reward, '开始利用模式');
  }
  
  // 模式切换：如果太久没有获得奖励，切换到探索模式
  if(stepCount - lastRewardTime > 200) {
    explorationMode = true;
  }
  
  // 避障行为
  if(frontThreat > 2 || avoidanceTimer > 0) {
    avoidanceTimer = Math.max(0, avoidanceTimer - 1);
    if(avoidanceTimer === 0) avoidanceTimer = 30; // 避障30步
    
    // 选择威胁较小的方向
    if(leftFood > rightFood) {
      agent.move([0.2, 0.8, 0, 0]); // 左转避障
    } else {
      agent.move([0.2, 0, 0.8, 0]); // 右转避障  
    }
    return;
  }
  
  // 智能觅食行为
  if(!explorationMode && (frontFood > 0 || leftFood > 0 || rightFood > 0)) {
    // 利用模式：朝向食物最多的方向
    if(frontFood >= Math.max(leftFood, rightFood)) {
      agent.move([1.0, 0, 0, 0]); // 直接前进
    } else if(leftFood > rightFood) {
      agent.move([0.6, 0.6, 0, 0]); // 左转前进
    } else {
      agent.move([0.6, 0, 0.6, 0]); // 右转前进
    }
  } else {
    // 探索模式：螺旋搜索或随机游走
    if(explorationMode) {
      const spiralPhase = (stepCount % 100) / 100;
      const turnStrength = Math.sin(spiralPhase * Math.PI * 2) * 0.3;
      agent.move([0.7, Math.max(0, turnStrength), Math.max(0, -turnStrength), 0]);
    } else {
      // 基础前进
      agent.move([0.8, 0, 0, 0]);
    }
  }
  
  // 每100步输出状态
  if(stepCount % 100 === 0) {
    console.log('步数:', stepCount, '模式:', explorationMode ? '探索' : '利用', 
               '奖励次数:', rewardHistory.length);
  }
}`,
          };
    },
  );

  const [currentScriptName, setCurrentScriptName] = useState("智能觅食者");

  const engineRef = useRef<SimulationEngine | null>(null);

  // 初始化默认脚本
  useEffect(() => {
    if (savedScripts["智能觅食者"] && !onFrameCode.includes("智能觅食者")) {
      setOnFrameCode(savedScripts["智能觅食者"]);
    }
  }, [savedScripts]);

  // 保存当前脚本到选中项
  const saveToCurrentScript = useCallback(() => {
    const newSavedScripts = {
      ...savedScripts,
      [currentScriptName]: onFrameCode,
    };
    setSavedScripts(newSavedScripts);
    localStorage.setItem(
      "neuralSoup_savedScripts",
      JSON.stringify(newSavedScripts),
    );
    console.log("脚本已保存到:", currentScriptName);
  }, [onFrameCode, savedScripts, currentScriptName]);

  // 应用脚本
  const handleApplyScript = useCallback(() => {
    if (!onFrameCode.trim()) {
      alert("请先编写onFrame函数代码");
      return;
    }

    if (!engineRef.current) {
      alert("仿真引擎未就绪");
      return;
    }

    try {
      // 先保存代码到当前选中的脚本
      saveToCurrentScript();

      // 然后应用脚本
      if (typeof (engineRef.current as any).setScriptCode === "function") {
        (engineRef.current as any).setScriptCode(onFrameCode);
      }

      if (typeof (engineRef.current as any).applyScript === "function") {
        const success = (engineRef.current as any).applyScript();

        if (success) {
          setIsScriptApplied(true);
          console.log("脚本已成功应用并保存到:", currentScriptName);
        } else {
          setIsScriptApplied(false);
          alert("脚本应用失败：未找到onFrame函数或脚本执行出错");
        }
      } else {
        setIsScriptApplied(false);
        alert("引擎不支持脚本应用功能");
      }
    } catch (e) {
      setIsScriptApplied(false);
      alert("脚本应用失败：" + (e as Error).message);
    }
  }, [onFrameCode, saveToCurrentScript, currentScriptName]);

  // 脚本切换处理
  const handleScriptChange = useCallback((scriptName: string, code: string) => {
    setCurrentScriptName(scriptName);
    setOnFrameCode(code);
    setIsScriptApplied(false);
  }, []);

  // 监听脚本代码变化，重置应用状态
  useEffect(() => {
    setIsScriptApplied(false);
  }, [onFrameCode]);

  // 设置引擎引用
  const setEngineRef = useCallback((engine: SimulationEngine | null) => {
    engineRef.current = engine;
  }, []);

  return {
    // 状态
    onFrameCode,
    isScriptApplied,
    savedScripts,
    currentScriptName,

    // 设置函数
    setOnFrameCode,
    setSavedScripts,
    setEngineRef,

    // 处理函数
    handleApplyScript,
    handleScriptChange,
    saveToCurrentScript,
  };
};
