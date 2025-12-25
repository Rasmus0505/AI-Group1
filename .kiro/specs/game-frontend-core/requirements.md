# Requirements Document - Updated

## Introduction

本文档定义了多人同步博弈推演游戏前端的核心功能需求。系统需要支持动态数据驱动、回合制状态机、实时通讯、非完全信息博弈等核心机制，为玩家提供沉浸式的策略对抗体验。

**最后更新：** 2025-12-25  
**当前版本：** v2.0  
**实现状态：** 核心功能已完成，高级功能待实现

## Implementation Status

### ✅ 已完成 (Completed)
- Requirement 1: Dynamic Attribute Mapping
- Requirement 2: Multi-Entity Scaling  
- Requirement 4: Phase State Machine
- Requirement 5: WebSocket Event Handling
- Requirement 6: Decision Input System
- Requirement 8: Leaderboard System
- Requirement 13: Hexagram Integration
- Requirement 15: Achievement System
- Requirement 17: Host Control Panel
- Requirement 18: Reconnection Synchronization
- Requirement 19: Timeout Handling

### 🟡 部分完成 (Partially Implemented)
- Requirement 7: Financial Calculation System (基础实现，需增强预算预览)
- Requirement 9: Health Indicator Dashboard (基础实现，需完善指标)
- Requirement 12: Temporary Events and Rules (后端完成，前端需优化)
- Requirement 14: Streaming Text Display (基础实现，需增强效果)

### ❌ 待实现 (Not Implemented)
- Requirement 3: Fog of War Logic
- Requirement 10: Multi-Channel Communication
- Requirement 11: Trade Integration
- Requirement 16: Drawer-Based Navigation

## Priority Implementation Plan

### P0 - Critical (阻塞多人游戏)
1. **Requirement 3: Fog of War Logic** - 对手信息模糊化显示
2. **Requirement 10: Multi-Channel Communication** - 多频道聊天系统

### P1 - High (影响游戏体验)
3. **Requirement 11: Trade Integration** - 玩家间交易系统
4. **Requirement 16: Drawer-Based Navigation** - 抽屉式界面导航

### P2 - Medium (提升用户体验)
5. **Requirement 7: Financial Calculation System** - 增强财务计算
6. **Requirement 14: Streaming Text Display** - 优化文本流式显示

## Glossary

- **Game_State**: 游戏状态对象，包含所有玩家属性、当前回合、阶段等完整游戏数据
- **Entity**: 博弈主体，代表参与游戏的玩家或AI控制的角色
- **Phase**: 回合阶段，包括 READING（阅读期）、DECIDING（决策期）、RESOLVING（结算期）
- **Intel_Confidence**: 情报置信度，表示对手信息的可靠程度（0-1）
- **Passive_Income**: 被动损益，无需决策产生的持续收支
- **Active_Income**: 主动损益，决策产生的一次性收支
- **Hexagram**: 周易卦象，用于引入随机性的年度全局参数
- **Decision_Panel**: 决策输入面板，玩家提交行动的界面组件
- **Leaderboard**: 排行榜，按特定维度对主体进行实时排序的组件
- **Trade_Request**: 交易请求，玩家间资源转移的请求卡片
- **Host**: 主持人，具有游戏流程控制权限的特殊角色

## Requirements

### Requirement 1: Dynamic Attribute Mapping

**User Story:** As a player, I want the UI to automatically display all my game attributes, so that I can monitor any resource type the game introduces without UI updates.

#### Acceptance Criteria

1. WHEN the Game_State contains player attributes, THE Resource_Panel SHALL iterate through all key-value pairs using Object.entries() and render a monitoring unit for each attribute
2. THE Resource_Panel SHALL NOT hardcode any specific attribute names (e.g., "金钱", "原材料", "影响力")
3. WHEN a new attribute is added to Game_State during gameplay, THE Resource_Panel SHALL automatically render a new monitoring unit without code changes
4. THE Resource_Panel SHALL display attribute name, current value, and optional progress indicator for each attribute

### Requirement 2: Multi-Entity Scaling

**User Story:** As a game host, I want the system to support any number of players (2 to N), so that I can run games with different group sizes.

#### Acceptance Criteria

1. THE UI_Components SHALL render based on Entity arrays rather than fixed slot counts
2. WHEN the number of entities changes between 2 and N, THE Leaderboard SHALL dynamically adjust its row count
3. WHEN the number of entities changes, THE Opponent_Intel_Panel SHALL dynamically adjust to show all opponents
4. THE System SHALL NOT assume a fixed number of players in any UI component

### Requirement 3: Fog of War Logic

**User Story:** As a player, I want opponent resource values to be obscured based on intelligence confidence, so that the game maintains incomplete information dynamics.

#### Acceptance Criteria

1. WHEN displaying opponent resources, THE System SHALL check the Intel_Confidence value for each resource
2. WHEN Intel_Confidence is below 0.5, THE System SHALL display a range interval (e.g., "100k-150k") instead of exact values
3. WHEN Intel_Confidence is below 0.2, THE System SHALL display "???" or apply visual masking
4. THE System SHALL clearly distinguish between "my precise data" and "opponent fuzzy data" in comparison views
5. WHEN Intel_Confidence is updated via WebSocket, THE System SHALL immediately refresh the displayed values

### Requirement 4: Phase State Machine

**User Story:** As a player, I want the UI to automatically lock/unlock features based on the current game phase, so that I can only perform valid actions.

#### Acceptance Criteria

1. WHILE Phase is READING, THE Decision_Panel SHALL be locked and display "阅读中，请等待..."
2. WHILE Phase is READING, THE System SHALL enable text streaming display for narrative content
3. WHILE Phase is DECIDING, THE Decision_Panel SHALL be unlocked and accept input
4. WHILE Phase is DECIDING, THE Trade_Module and Task_Panel SHALL be accessible
5. WHILE Phase is RESOLVING, THE System SHALL lock all interactive elements
6. WHILE Phase is RESOLVING, THE System SHALL display inference progress indicator
7. WHEN Phase changes via WebSocket event "phase_changed", THE System SHALL immediately update UI state

### Requirement 5: WebSocket Event Handling

**User Story:** As a player, I want real-time updates when game state changes, so that I stay synchronized with other players.

#### Acceptance Criteria

1. THE System SHALL subscribe to "decision_submitted" events and update submission status indicators
2. THE System SHALL subscribe to "phase_changed" events and trigger phase state transitions
3. THE System SHALL subscribe to "intel_updated" events and refresh opponent intelligence data
4. THE System SHALL subscribe to "game_state_update" events and refresh all relevant UI components
5. WHEN WebSocket disconnects, THE System SHALL display connection status indicator
6. WHEN WebSocket reconnects, THE System SHALL request full Game_State to resynchronize

### Requirement 6: Decision Input System

**User Story:** As a player, I want to submit decisions via preset options or free text, so that I have flexibility in my strategic choices.

#### Acceptance Criteria

1. THE Decision_Panel SHALL display AI-recommended options with labels (1/2/3) and expected resource changes
2. THE Decision_Panel SHALL provide a free-text input field for custom decisions
3. WHEN a player selects a preset option, THE System SHALL populate the text field with the option content
4. BEFORE submission, THE System SHALL validate that resource costs do not exceed current balance
5. IF resource validation fails, THEN THE System SHALL display an error message and prevent submission
6. WHEN decision is submitted successfully, THE System SHALL clear the input and show confirmation

### Requirement 7: Financial Calculation System

**User Story:** As a player, I want to see separated passive and active income/expenses, so that I can make informed financial decisions.

#### Acceptance Criteria

1. THE Financial_Panel SHALL separately display "被动损益" (passive) and "主动损益" (active) sections
2. THE System SHALL calculate and display "预计剩余资源" in real-time as player inputs decisions
3. WHEN a decision option is selected, THE System SHALL update the projected balance preview
4. THE Ledger_Display SHALL show: starting balance, passive income, passive expense, decision cost, and final balance

### Requirement 8: Leaderboard System

**User Story:** As a player, I want to see real-time rankings based on key metrics, so that I can assess my competitive position.

#### Acceptance Criteria

1. THE Leaderboard SHALL support sorting by multiple dimensions (net assets, profit, score)
2. WHEN a round completes, THE Leaderboard SHALL re-sort and display rank changes
3. THE Leaderboard SHALL display rank change indicators (up/down arrows with delta)
4. THE Leaderboard SHALL support side-by-side comparison of "my precise data" vs "opponent fuzzy data"
5. THE Leaderboard SHALL calculate and display potential resource gaps between entities

### Requirement 9: Health Indicator Dashboard

**User Story:** As a player, I want to see qualitative health indicators, so that I have context beyond raw numbers.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL display three indicators: "企业风险", "企业机会", "当前效益"
2. THE Health_Dashboard SHALL render these as qualitative assessments (e.g., high/medium/low)
3. WHEN inference results contain health data, THE System SHALL update the dashboard accordingly

### Requirement 10: Multi-Channel Communication

**User Story:** As a player, I want to communicate via public, private, and alliance channels, so that I can coordinate strategies.

#### Acceptance Criteria

1. THE Chat_System SHALL support public channel visible to all players
2. THE Chat_System SHALL support point-to-point private messaging
3. THE Chat_System SHALL support multi-person alliance channels
4. THE Chat_System SHALL display channel indicators and unread message counts
5. WHEN a message is received, THE System SHALL show notification in the appropriate channel

### Requirement 11: Trade Integration

**User Story:** As a player, I want to initiate and accept trades within the chat interface, so that negotiations flow naturally.

#### Acceptance Criteria

1. THE Chat_System SHALL support embedding Trade_Request cards within messages
2. WHEN a trade is proposed, THE System SHALL display a structured trade card with resource details
3. WHEN a trade is accepted, THE System SHALL immediately update local resource values (optimistic update)
4. WHEN a trade is rejected or expires, THE System SHALL display appropriate status

### Requirement 12: Temporary Events and Rules

**User Story:** As a player, I want to see active temporary events and their remaining duration, so that I can plan accordingly.

#### Acceptance Criteria

1. THE Event_Panel SHALL display all active temporary events with descriptions
2. THE Event_Panel SHALL show remaining rounds for each temporary event
3. WHEN an event expires, THE System SHALL remove it from the active list
4. WHEN a new event is injected, THE System SHALL display it with appropriate notification

### Requirement 13: Hexagram Integration

**User Story:** As a player, I want to see the current year's hexagram and its interpretation, so that I understand the round's global parameters.

#### Acceptance Criteria

1. THE Hexagram_Display SHALL show the hexagram name and symbol sequence (6 lines: yang/yin)
2. THE Hexagram_Display SHALL show the interpretation text (象曰)
3. THE Hexagram_Display SHALL indicate omen type (positive/neutral/negative)
4. WHEN a new round starts with a new hexagram, THE System SHALL update the display

### Requirement 14: Streaming Text Display

**User Story:** As a player, I want narrative text to appear progressively, so that I can read at a controlled pace.

#### Acceptance Criteria

1. THE Narrative_Feed SHALL support character-by-character or word-by-word text streaming
2. THE Narrative_Feed SHALL synchronize text reveal with data updates
3. THE System SHALL allow text streaming regardless of backend delivery mode
4. THE Narrative_Feed SHALL highlight key terms (percentages, economic indicators)

### Requirement 15: Achievement System

**User Story:** As a player, I want to be notified when I unlock achievements, so that I feel rewarded for accomplishments.

#### Acceptance Criteria

1. WHEN inference results contain achievement unlocks, THE System SHALL trigger achievement popup
2. THE Achievement_Popup SHALL display achievement title and description
3. THE System SHALL track and display cumulative achievements per player

### Requirement 16: Drawer-Based Navigation

**User Story:** As a player, I want trade, task, and save features as overlays rather than separate pages, so that I maintain game context.

#### Acceptance Criteria

1. THE Trade_Feature SHALL be implemented as a drawer or modal component
2. THE Task_Feature SHALL be implemented as a drawer or modal component
3. THE Save_Feature SHALL be implemented as a drawer or modal component
4. WHEN opening these features, THE System SHALL NOT navigate away from the game session page

### Requirement 17: Host Control Panel

**User Story:** As a host, I want special controls to manage the game flow, so that I can facilitate the session.

#### Acceptance Criteria

1. THE Host_Panel SHALL provide ability to modify player decision text before inference
2. THE Host_Panel SHALL provide ability to inject intervention events
3. THE Host_Panel SHALL provide ability to configure AI API templates
4. THE Host_Panel SHALL provide manual phase transition controls (e.g., "开始推演" button)
5. THE Host_Panel SHALL only be visible to users with host role

### Requirement 18: Reconnection Synchronization

**User Story:** As a player, I want to recover my game state after disconnection, so that I can continue playing seamlessly.

#### Acceptance Criteria

1. WHEN a player reconnects, THE System SHALL request full Game_State using sessionId
2. WHEN Game_State is received, THE System SHALL restore all dynamic resource displays
3. WHEN Game_State is received, THE System SHALL restore historical inference logs
4. THE System SHALL display reconnection status during the sync process

### Requirement 19: Timeout Handling

**User Story:** As a player, I want the system to handle decision timeouts automatically, so that the game progresses even if someone is AFK.

#### Acceptance Criteria

1. THE System SHALL display countdown timer for decision deadline
2. WHEN deadline approaches (< 60 seconds), THE System SHALL show urgent warning
3. WHEN deadline passes, THE System SHALL follow backend timeout strategy (auto-submit or skip)
4. THE System SHALL lock decision input after timeout
