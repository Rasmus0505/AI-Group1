import React, { useState } from 'react';
import { Button, Modal, Tabs, Typography, Space, Tag, Divider } from 'antd';
import { QuestionCircleOutlined, BookOutlined, UserOutlined, SettingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface HelpContent {
  id: string;
  title: string;
  content: string;
  category: 'player' | 'host' | 'general';
  lastUpdated: string;
}

// 默认帮助内容
const defaultHelpContent: HelpContent[] = [
  {
    id: 'quick-start',
    title: '快速入门',
    category: 'general',
    content: `
# 🎮 快速入门指南

欢迎来到《凡墙皆是门》！这是一款基于AI的多人商业博弈游戏。

## 基本流程
1. **加入房间** - 等待主持人开始游戏
2. **决策阶段** - 在时限内提交你的商业决策
3. **审核阶段** - 主持人审核所有决策
4. **推演阶段** - AI计算结果并生成剧情
5. **结果阶段** - 查看推演结果，准备下一回合

## 核心规则
- 💰 **现金流原则**：现金 < 0 即破产出局
- 🎯 **决策权原则**：你的指令绝对优先
- ⏰ **回合制**：每回合代表半年时间
- 🎲 **卦象系统**：影响全局的随机事件

## 界面说明
- **左侧**：你的资源状态和队友进度
- **中间**：剧情叙述和决策输入区
- **右侧**：排行榜、任务和大事纪
- **顶部**：回合信息、倒计时和规则状态
    `,
    lastUpdated: '2025-12-25'
  },
  {
    id: 'player-guide',
    title: '玩家操作指南',
    category: 'player',
    content: `
# 🎮 玩家操作指南

## 决策输入技巧

### ✅ 有效决策示例
- "投入30000元进行市场推广，提升品牌知名度"
- "研发新产品，预算50000元，预期提升创新能力"
- "降低运营成本，优化人员配置，节省15%支出"
- "与主体B协商价格联盟，共同应对市场竞争"

### ❌ 无效决策
- 代替其他玩家做决策
- 要求系统撮合合作
- 违反游戏公平性的行为

## 财务管理

### 现金流警告
- ⚠️ **警告**：现金流紧张，需要注意
- 🚨 **危险**：执行后将无法支付下回合被动支出
- ❌ **破产**：执行后现金 < 0，将立即破产

### 建议
保持至少2回合的被动支出作为安全垫

## 策略技巧
1. **关注卦象**：利用有利的卦象效果
2. **观察对手**：根据排行榜调整策略
3. **长期规划**：考虑多回合的连锁影响
4. **风险控制**：避免孤注一掷
    `,
    lastUpdated: '2025-12-25'
  },
  {
    id: 'host-guide',
    title: '主持人操作指南',
    category: 'host',
    content: `
# 🛠️ 主持人操作指南

## 游戏配置流程

### 1. AI模型配置
- 选择AI服务提供商（推荐DeepSeek）
- 配置API Key和模型参数
- 测试连接确保正常

### 2. 规则配置
- 设置游戏规则和背景
- 配置玩家数量和初始资金
- 设置决策时限和超时策略

### 3. 游戏初始化
- 生成背景故事和主体状态
- 确认卦象和初始选项
- 标记验证通过并开始游戏

## 游戏流程控制

### 决策阶段
- 监控玩家提交进度
- 可以延长时限（5分钟/10分钟）
- 决定何时进入审核阶段

### 审核阶段
- 查看所有玩家决策
- 修改违规或不当内容
- 添加临时事件和规则
- 提交给AI推演

### 结果阶段
- 查看推演结果
- 决定是否进入下一回合
- 处理特殊情况

## 高级功能
- **临时事件**：单回合或多回合有效
- **临时规则**：动态调整游戏规则
- **时限调整**：灵活控制游戏节奏
- **存档管理**：保存重要游戏状态
    `,
    lastUpdated: '2025-12-25'
  },
  {
    id: 'rules-system',
    title: '规则系统说明',
    category: 'general',
    content: `
# ⚖️ 规则系统说明

## 三层规则架构

### 1. 核心规则（不可违背）
- **现金流原则**：现金 < 0 判定破产
- **决策权原则**：玩家指令绝对优先
- **回合制流程**：决策 → 审核 → 推演 → 结果
- **公平原则**：系统不撮合主体间合作

### 2. 场景规则（本局设定）
- 初始资金和行业背景
- 被动收支公式
- 胜利条件
- 特殊规则

### 3. 临时规则（动态变化）
- **卦象效果**：年度起卦带来的修正
- **事件效果**：突发事件的临时约束
- **成就奖励**：解锁成就后的加成

## 卦象系统

每年（2回合）随机生成周易卦象：

| 卦象 | 效果示例 |
|------|----------|
| 乾卦 | 扩张性投资收益 +20% |
| 坤卦 | 防守型策略成本 -15% |
| 坎卦 | 现金流波动加剧 |
| 离卦 | 品牌曝光度提升 |
| 困卦 | 所有主动投资收益减半 |

## 成就系统
- **行业领袖**：品牌声誉永久 +5
- **创新先锋**：研发成本永久 -10%
- **稳健经营**：被动收入 +5%
    `,
    lastUpdated: '2025-12-25'
  }
];

interface HelpButtonProps {
  className?: string;
  size?: 'small' | 'middle' | 'large';
  type?: 'default' | 'primary' | 'text';
}

export const HelpButton: React.FC<HelpButtonProps> = ({
  className = '',
  size = 'middle',
  type = 'default'
}) => {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [helpContent, setHelpContent] = useState<HelpContent[]>(defaultHelpContent);
  const [developerMode, setDeveloperMode] = useState(false);
  const [developerPassword, setDeveloperPassword] = useState('');

  const handleDeveloperAccess = () => {
    // 简单的开发者权限验证
    if (developerPassword === 'dev2025') {
      setDeveloperMode(true);
    } else {
      alert('权限密令错误');
    }
  };

  const handleSaveContent = (id: string, newContent: string) => {
    setHelpContent(prev => prev.map(item => 
      item.id === id 
        ? { ...item, content: newContent, lastUpdated: new Date().toISOString().split('T')[0] }
        : item
    ));
  };

  const filterContentByCategory = (category: string) => {
    return helpContent.filter(item => item.category === category || category === 'general');
  };

  return (
    <>
      <Button
        icon={<QuestionCircleOutlined />}
        onClick={() => setVisible(true)}
        className={className}
        size={size}
        type={type}
        title="帮助"
      >
        帮助
      </Button>

      <Modal
        title={
          <Space>
            <BookOutlined />
            <span>游戏帮助</span>
            {developerMode && <Tag color="orange">开发者模式</Tag>}
          </Space>
        }
        open={visible}
        onCancel={() => {
          setVisible(false);
          setDeveloperMode(false);
          setDeveloperPassword('');
        }}
        footer={[
          !developerMode && (
            <Button
              key="developer"
              type="text"
              size="small"
              onClick={() => {
                const password = prompt('请输入开发者权限密令：');
                if (password) {
                  setDeveloperPassword(password);
                  handleDeveloperAccess();
                }
              }}
            >
              开发者
            </Button>
          ),
          <Button key="close" onClick={() => setVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
        style={{ top: 20 }}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'general',
              label: (
                <span>
                  <BookOutlined />
                  通用帮助
                </span>
              ),
              children: (
                <div>
                  {filterContentByCategory('general').map(item => (
                    <div key={item.id} style={{ marginBottom: 24 }}>
                      <Space align="center" style={{ marginBottom: 8 }}>
                        <Title level={4} style={{ margin: 0 }}>{item.title}</Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          更新于 {item.lastUpdated}
                        </Text>
                      </Space>
                      <div style={{ 
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                        fontSize: 14
                      }}>
                        {item.content}
                      </div>
                      <Divider />
                    </div>
                  ))}
                </div>
              )
            },
            {
              key: 'player',
              label: (
                <span>
                  <UserOutlined />
                  玩家指南
                </span>
              ),
              children: (
                <div>
                  {filterContentByCategory('player').map(item => (
                    <div key={item.id} style={{ marginBottom: 24 }}>
                      <Space align="center" style={{ marginBottom: 8 }}>
                        <Title level={4} style={{ margin: 0 }}>{item.title}</Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          更新于 {item.lastUpdated}
                        </Text>
                      </Space>
                      <div style={{ 
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                        fontSize: 14
                      }}>
                        {item.content}
                      </div>
                      <Divider />
                    </div>
                  ))}
                </div>
              )
            },
            {
              key: 'host',
              label: (
                <span>
                  <SettingOutlined />
                  主持人指南
                </span>
              ),
              children: (
                <div>
                  {filterContentByCategory('host').map(item => (
                    <div key={item.id} style={{ marginBottom: 24 }}>
                      <Space align="center" style={{ marginBottom: 8 }}>
                        <Title level={4} style={{ margin: 0 }}>{item.title}</Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          更新于 {item.lastUpdated}
                        </Text>
                        {developerMode && (
                          <Button
                            size="small"
                            type="link"
                            onClick={() => {
                              const newContent = prompt('编辑内容：', item.content);
                              if (newContent !== null) {
                                handleSaveContent(item.id, newContent);
                              }
                            }}
                          >
                            编辑
                          </Button>
                        )}
                      </Space>
                      <div style={{ 
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                        fontSize: 14
                      }}>
                        {item.content}
                      </div>
                      <Divider />
                    </div>
                  ))}
                </div>
              )
            }
          ]}
        />
      </Modal>
    </>
  );
};

export default HelpButton;