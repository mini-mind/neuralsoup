# 皮质柱脉冲神经网络算法说明

## 概述

本项目实现了一个以**皮质柱（Cortical Column）**为核心构建单元的脉冲神经网络，结合RL-STDP学习机制和多层次稳态调节，能够在动态环境中进行自适应学习。网络架构模拟大脑皮层的微电路结构，具备生物合理的学习和调节机制。

## 核心算法

### 1. Izhikevich神经元模型

神经元动力学方程：
```
dv/dt = 0.04v² + 5v + 140 - u + I
du/dt = a(bv - u)
```

放电条件：
```
if v ≥ v_peak:
    v ← c
    u ← u + d
    emit_spike()
    进入不应期
```

参数：
- `v`: 膜电位
- `u`: 恢复变量
- `I`: 输入电流
- `a`: 恢复变量的时间尺度
- `b`: 恢复变量对膜电位阈下振荡的敏感性
- `c`: 放电后膜电位重置值 (mV)
- `d`: 放电后恢复变量的增量
- `v_peak`: 放电阈值 (mV)

神经元类型参数：
- **兴奋性神经元 (Excitatory)**: `a=0.02, b=0.2, c=-65.0, d=8.0, v_peak=-55.0`
- **抑制性神经元 (Inhibitory)**: `a=0.1, b=0.2, c=-65.0, d=2.0, v_peak=-55.0`
- **输入神经元 (Input)**: `a=0.02, b=0.2, c=-65.0, d=8.0, v_peak=-55.0`
- **行动神经元 (Action)**: `a=0.02, b=0.2, c=-65.0, d=8.0, v_peak=-55.0`

### 2. 皮质柱微电路结构

每个皮质柱包含6个神经元：
- **4个兴奋性神经元** (E1-E4): 信号放大和模式维持
- **2个抑制性神经元** (I1-I2): 竞争和稳定

柱内连接模式：
```
# 循环兴奋连接
E1 ↔ E2, E1 ↔ E3, E2 ↔ E4, E3 ↔ E4

# 反馈抑制
E1, E2 → I1

# 广泛抑制
I1 → E1, E2, E3, E4, I2

# 抑制调节
I1 ↔ I2
```

权重范围：
- **兴奋性权重**: 0.3-0.8 (柱内)
- **抑制性权重**: -1.5到-0.4 (柱内)
- **延时范围**: 0.5-2.0ms

### 3. RL-STDP学习规则

#### 资格迹更新
```
for each spike pair (t_pre, t_post):
    Δt = t_post - t_pre
    if |Δt| ≤ τ_STDP:
        if Δt > 0:  # 因果关系 (LTP)
            e += exp(-|Δt|/τ_STDP)
        else:       # 反因果关系 (LTD)
            e += -0.3 × exp(-|Δt|/τ_STDP)

# 资格迹衰减
e(t) = e(t-dt) × exp(-dt/τ_eligibility)
```

#### 权重更新规则
```
when reward R received:
    if R > 0:  # 正奖励
        for excitatory_synapse with e > 0:
            Δw = η_exc × R × e
        for inhibitory_synapse:
            Δw = η_disinh × R × |e|  # 解除抑制
            w → 0 (削弱抑制)
            
    else:      # 负奖励/惩罚
        for excitatory_synapse:
            Δw = -η_LTD × |R| × |e|
        for inhibitory_synapse with e > 0:
            Δw = -η_inh × |R| × e
```

学习率参数：
- `η_exc = 0.01`: 兴奋性LTP学习率
- `η_disinh = 0.005`: 解除抑制学习率  
- `η_LTD = 0.008`: LTD学习率
- `η_inh = 0.002`: 抑制性LTP学习率

### 4. 稳态可塑性机制

#### 突触缩放
```
# 神经元活动统计
activity_freq[i] = spike_count[i] / activity_window

# 缩放因子计算
frequency_error = target_frequency - activity_freq[i]
scaling_factor = 1.0 + scaling_rate × frequency_error

# 权重缩放（仅兴奋性突触）
for excitatory_synapse → neuron_i:
    w_new = w_old × scaling_factor
```

#### 全局活动调节
```
# 网络活动水平（平均放电频率）
network_activity_hz = total_spikes_in_interval / (interval_steps * dt / 1000.0) # Hz

# 抑制调节因子
activity_error = network_activity_hz - target_activity
adjustment = regulation_strength × activity_error / target_activity
inhibition_modulation = clamp(1.0 + adjustment, 0.1, 3.0)

# 应用到抑制性突触
for inhibitory_synapse:
    effective_weight = weight × inhibition_modulation
```

### 5. 内在探索驱动

动机水平M(t)更新：
```
when reward R received:
    if reward > 0:
        M(t) += boost_factor * reward
        M(t) = min(M(t), max_m)
    else:
        M(t) += suppression_factor * reward
        M(t) = max(M(t), 0)

# 停滞复苏机制        
if no_reward_time > stagnation_threshold:
    M(t) += rebound_rate * dt
    M(t) = min(M(t), max_m)
```

## 网络架构

### 层级结构
```
输入层: 3个神经元 (ID: 0, 1, 2)
隐藏层: 4个皮质柱 × 6个神经元 = 24个神经元 (ID: 10-33)
行动层: 1个神经元 (ID: 100)
```

### 连接模式
1. **输入→隐藏 (皮质柱)**: 80%连接概率，权重 **5.0-15.0**
2. **隐藏柱间 (皮质柱之间)**: 40%连接概率，兴奋性连接权重 **3.0-8.0**，抑制性连接权重 **-8.0到-3.0**
3. **隐藏→行动**: 60%连接概率，兴奋性连接权重 **8.0-20.0**，抑制性连接权重 **-15.0到-5.0**

## 算法伪代码

### 主仿真循环
```python
def main_simulation_loop():
    initialize_cortical_column_network()
    initialize_rgb_color_environment()
    
    for step in range(total_steps):
        current_time = step * dt
        
        # 1. 环境输入
        rgb_values = environment.get_current_rgb_values()
        external_inputs = {
            input_id: rgb_values[i] * input_strength
            for i, input_id in enumerate([0, 1, 2])
        }
        
        # 2. 网络步进
        spike_states = network.step(external_inputs)
        
        # 3. 环境反馈
        action_occurred = spike_states[100]
        reward = environment.calculate_reward(action_occurred)
        
        # 4. 学习更新
        if reward != 0:
            network.apply_reward(reward)
        else:
            # 如果没有奖励，也要更新 M(t) 以处理停滞复苏逻辑
            intrinsic_exploration_drive.update_m(current_time=current_time, reward=0.0)
        
        # 5. 记录数据
        record_network_state(spike_states, current_time)
```

### 皮质柱网络初始化
```python
def initialize_cortical_column_network():
    # 创建4个皮质柱
    for col_id in range(4):
        base_neuron_id = 10 + col_id × 6
        column = CorticalColumn(col_id, base_neuron_id)
        cortical_columns.append(column)
    
    # 创建层间连接
    create_input_to_hidden_connections()
    create_inter_column_connections() 
    create_hidden_to_action_connections()
```

### 事件驱动仿真
```python
def network_step(external_inputs):
    # 1. 处理事件队列
    process_synaptic_events(current_time)
    
    # 2. 重置神经元输入
    for neuron in all_neurons:
        neuron.reset_inputs()
    
    # 3. 应用外部输入
    apply_external_inputs(external_inputs)
    
    # 4. 更新所有神经元
    spike_states = {}
    for neuron_id, neuron in all_neurons.items():
        spiked = neuron.update(dt, current_time, M_t)
        spike_states[neuron_id] = spiked
        if spiked:
            schedule_synaptic_events(neuron_id, current_time)
    
    # 5. 更新稳态机制
    update_homeostasis(spike_states)
    
    return spike_states
```

## 关键创新点

1. **皮质柱微电路**: 模拟大脑皮层的规范化连接模式，实现特征检测和竞争机制
2. **差异化学习**: 兴奋性和抑制性突触采用不同的学习规则，生物合理
3. **多层次稳态**: 突触缩放 + 全局调节 + 内在探索，三重稳态机制
4. **事件驱动仿真**: 优先队列管理突触延时，精确时序控制
5. **解除抑制机制**: 正奖励削弱抑制连接，促进信号传递和探索

## 参数配置

### 网络结构参数
```python
num_input_neurons = 3
num_cortical_columns = 4
neurons_per_column = 6  # 4E + 2I
num_action_neurons = 1
total_neurons = 28
```

### 学习参数
```python
# RL-STDP参数
eta_exc = 0.01      # 兴奋性LTP学习率
eta_disinh = 0.005  # 解除抑制学习率
eta_ltd = 0.008     # LTD学习率  
eta_inh = 0.002     # 抑制性LTP学习率
tau_stdp = 20.0     # STDP时间常数 (ms)
tau_eligibility = 1000.0  # 资格迹衰减时间常数 (ms)

# 稳态参数
target_frequency = 2.0    # 突触缩放目标频率 (Hz)
scaling_rate = 0.001      # 突触缩放速率
target_activity = 3.0     # 全局目标活动 (Hz)
regulation_strength = 0.5  # 全局调节强度
```

### 探索参数
```python
# 内在探索驱动
initial_m = 0.1           # 初始动机水平
max_m = 1.0              # 最大动机水平
reward_boost_factor = 0.5 # 奖励提升因子
punishment_suppression = 0.2  # 惩罚抑制因子
stagnation_threshold = 500    # 停滞阈值时间 (ms)
rebound_rate = 0.0001    # 复苏速率
```

## 性能评估

### 学习效率指标
- **权重演化**: 监控兴奋性和抑制性权重的动态变化
- **资格迹活跃度**: 评估学习机制的响应性
- **奖励获取率**: 衡量行为策略的改进

### 稳态机制指标  
- **活动分布**: 各神经元的放电频率分布
- **缩放效果**: 突触缩放对低活动神经元的恢复
- **全局平衡**: 网络整体兴奋-抑制平衡状态

### 探索行为指标
- **M(t)动态**: 探索动机的时间演化
- **行为多样性**: 行动模式的变化程度
- **适应速度**: 环境变化时的响应时间

---

本算法结合了皮质柱微电路、多层次可塑性和稳态调节机制，为脉冲神经网络提供了生物合理且高效的学习架构。 