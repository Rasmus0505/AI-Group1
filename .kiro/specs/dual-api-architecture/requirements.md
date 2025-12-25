# Requirements Document

## Introduction

本文档描述将现有单一API调用流程重构为双API架构的需求。新架构将"剧情推演"和"数据解析"分离为两个独立的API调用，以降低单次调用复杂度、提升玩家体验流畅度、减少格式解析错误。

## Glossary

- **Narrative_API**: 负责生成剧情叙述文本的AI API调用，输出纯文本剧情
- **Parser_API**: 负责将剧情文本解析为结构化面板数据的AI API调用
- **AIService**: 后端AI服务模块，封装所有AI API调用逻辑
- **TurnResult**: 回合推演结果的完整数据结构，包含剧情和面板数据
- **NarrativeResult**: Narrative_API返回的纯剧情文本结果
- **PanelData**: Parser_API解析后的结构化面板数据（资源、属性、排行榜等）
- **GameSession**: 游戏会话实体，存储当前游戏状态
- **HostConfig**: 主持人配置，包含API密钥和端点配置

## Requirements

### Requirement 1: 双API配置支持

**User Story:** As a 主持人, I want to 配置两个独立的API密钥和端点, so that 剧情推演和数据解析可以使用不同的AI服务。

#### Acceptance Criteria

1. THE HostConfig SHALL 支持配置两组独立的API设置（Narrative_API和Parser_API）
2. WHEN 主持人只配置一组API时, THE System SHALL 使用该API同时处理剧情推演和数据解析（向后兼容）
3. WHEN 主持人配置两组API时, THE System SHALL 分别使用对应API处理各自任务
4. THE System SHALL 在配置界面清晰区分两组API的用途说明

### Requirement 2: 剧情推演API调用

**User Story:** As a 玩家, I want to 在AI推演完成后立即看到剧情文本, so that 我不需要等待数据解析完成就能开始阅读。

#### Acceptance Criteria

1. WHEN 回合推演开始时, THE Narrative_API SHALL 仅生成纯文本剧情叙述
2. THE Narrative_API的Prompt SHALL 不包含JSON格式输出要求，仅要求生成流畅的剧情文本
3. WHEN Narrative_API返回结果后, THE System SHALL 立即通过WebSocket广播剧情文本给所有玩家
4. THE NarrativeResult SHALL 包含完整的回合叙事，包括事件描述、玩家决策结果、环境变化等
5. IF Narrative_API调用失败, THEN THE System SHALL 返回错误信息并允许重试

### Requirement 3: 数据解析API调用

**User Story:** As a 系统, I want to 将剧情文本解析为结构化数据, so that 前端面板可以正确显示资源变化和状态更新。

#### Acceptance Criteria

1. WHEN 剧情文本广播完成后, THE System SHALL 异步调用Parser_API进行数据解析
2. THE Parser_API SHALL 接收剧情文本和当前游戏状态作为输入
3. THE Parser_API SHALL 输出符合TurnResultDTO格式的JSON数据
4. WHEN Parser_API返回结果后, THE System SHALL 通过WebSocket广播面板数据更新
5. IF Parser_API调用失败, THEN THE System SHALL 显示"数据更新中"状态并允许重试
6. THE PanelData SHALL 包含：perEntityPanel、leaderboard、events、options、hexagram等字段

### Requirement 4: 前端剧情展示

**User Story:** As a 玩家, I want to 在专门的区域查看完整的AI推演剧情, so that 我可以沉浸式阅读游戏叙事。

#### Acceptance Criteria

1. THE Frontend SHALL 提供独立的剧情展示区域，显示Narrative_API的完整输出
2. WHEN 剧情文本到达时, THE Frontend SHALL 立即渲染显示，无需等待面板数据
3. THE Frontend SHALL 支持剧情文本的滚动阅读和历史回顾
4. WHILE 面板数据加载中, THE Frontend SHALL 显示加载指示器但不阻塞剧情阅读
5. THE Frontend SHALL 在剧情文本中高亮显示关键事件关键词

### Requirement 5: 面板数据异步更新

**User Story:** As a 玩家, I want to 在阅读剧情的同时看到面板数据逐步更新, so that 我可以同时了解叙事和数值变化。

#### Acceptance Criteria

1. THE Frontend SHALL 支持剧情和面板数据的独立更新
2. WHEN 面板数据到达时, THE Frontend SHALL 平滑更新各个面板组件
3. IF 面板数据解析失败, THEN THE Frontend SHALL 显示友好的错误提示并保留上一回合数据
4. THE Frontend SHALL 显示面板数据的加载状态（加载中/已完成/失败）
5. WHEN 面板数据更新完成, THE Frontend SHALL 播放适当的视觉反馈动画

### Requirement 6: 错误处理与降级

**User Story:** As a 系统管理员, I want to 在API调用失败时有合理的降级策略, so that 游戏体验不会因单点故障而完全中断。

#### Acceptance Criteria

1. IF Narrative_API失败, THEN THE System SHALL 阻止进入下一阶段并提示重试
2. IF Parser_API失败, THEN THE System SHALL 允许玩家继续阅读剧情，面板显示"解析失败"
3. THE System SHALL 记录所有API调用的成功/失败日志
4. WHEN API调用超时时, THE System SHALL 使用指数退避策略进行重试
5. THE System SHALL 支持主持人手动触发重新解析

### Requirement 7: 数据一致性

**User Story:** As a 开发者, I want to 确保剧情和面板数据的一致性, so that 玩家看到的叙事和数值变化是匹配的。

#### Acceptance Criteria

1. THE System SHALL 将剧情文本和对应的面板数据关联存储
2. WHEN 重新解析时, THE System SHALL 使用原始剧情文本作为输入
3. THE System SHALL 在面板数据中包含对应的回合号和时间戳
4. IF 面板数据与剧情文本不匹配, THEN THE System SHALL 记录警告日志
5. THE System SHALL 支持查看历史回合的剧情和面板数据

### Requirement 8: 性能优化

**User Story:** As a 玩家, I want to 获得流畅的游戏体验, so that API调用延迟不会影响我的游戏节奏。

#### Acceptance Criteria

1. THE Narrative_API调用 SHALL 在120秒内完成
2. THE Parser_API调用 SHALL 在60秒内完成
3. THE System SHALL 支持两个API调用的并行执行（如果配置允许）
4. WHEN 网络不稳定时, THE System SHALL 显示连接状态指示
5. THE System SHALL 缓存最近的推演结果以支持快速回顾
