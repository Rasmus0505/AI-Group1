# Implementation Plan: 双API架构重构

## Overview

本实现计划将现有单一API调用流程重构为双API架构，分阶段完成：数据模型扩展 → AIService重构 → WebSocket事件 → 前端状态管理 → 错误处理 → 测试验证。

## Tasks

- [ ] 1. 数据模型扩展
  - [ ] 1.1 扩展Prisma Schema添加Parser API配置字段
    - 在HostConfig模型中添加parserApiProvider、parserApiEndpoint、parserApiHeaders、parserApiBodyTemplate、dualApiEnabled字段
    - 运行prisma migrate生成迁移文件
    - _Requirements: 1.1_

  - [ ] 1.2 创建InferenceResult模型
    - 添加InferenceResult模型存储剧情文本和面板数据
    - 包含sessionId、round、narrativeText、panelData、panelStatus等字段
    - _Requirements: 7.1, 7.3_

  - [ ] 1.3 更新TypeScript类型定义
    - 在gameTypes.ts中添加NarrativeResult、PanelData接口
    - 更新HostConfig相关类型
    - _Requirements: 2.4, 3.6_

- [ ] 2. AIService核心重构
  - [ ] 2.1 实现generateNarrative方法
    - 创建专门的Narrative Prompt构建器，不包含JSON输出要求
    - 实现纯文本剧情生成逻辑
    - 配置120秒超时
    - _Requirements: 2.1, 2.2, 8.1_

  - [ ]* 2.2 编写Property 3测试：Narrative输出格式
    - **Property 3: Narrative输出格式**
    - 验证Prompt不包含JSON schema要求
    - **Validates: Requirements 2.1, 2.2**

  - [ ] 2.3 实现parseNarrativeToPanel方法
    - 创建Parser Prompt构建器，要求JSON格式输出
    - 实现剧情文本到结构化数据的解析
    - 配置60秒超时
    - _Requirements: 3.2, 3.3, 8.2_

  - [ ]* 2.4 编写Property 4测试：Parser输出格式
    - **Property 4: Parser输出格式**
    - 验证输出符合TurnResultDTO schema
    - **Validates: Requirements 3.3, 3.6**

  - [ ] 2.5 实现performDualInference编排方法
    - 编排Narrative和Parser两个API调用
    - 支持剧情ready回调
    - 实现配置路由逻辑（单API/双API模式）
    - _Requirements: 1.2, 1.3, 2.3, 3.1_

  - [ ]* 2.6 编写Property 1测试：配置路由正确性
    - **Property 1: 配置路由正确性**
    - 验证单API和双API配置下的路由行为
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 2.7 编写Property 2测试：剧情优先广播
    - **Property 2: 剧情优先广播**
    - 验证剧情广播时间早于面板广播
    - **Validates: Requirements 2.3, 3.1**

- [ ] 3. Checkpoint - 核心服务验证
  - 确保AIService重构完成且测试通过
  - 验证单API和双API模式都能正常工作
  - 如有问题请询问用户

- [ ] 4. 错误处理与重试机制
  - [ ] 4.1 实现Narrative失败处理
    - 记录错误日志
    - 广播narrative_failed事件
    - 保持回合状态不变
    - _Requirements: 2.5, 6.1_

  - [ ]* 4.2 编写Property 6测试：Narrative失败阻断
    - **Property 6: Narrative失败阻断**
    - 验证失败时回合状态不变
    - **Validates: Requirements 2.5, 6.1**

  - [ ] 4.3 实现Parser失败处理
    - 保存剧情文本（即使解析失败）
    - 广播panel_parse_failed事件
    - 允许游戏继续
    - _Requirements: 3.5, 6.2_

  - [ ]* 4.4 编写Property 5测试：Parser失败降级
    - **Property 5: Parser失败降级**
    - 验证Parser失败时剧情仍可访问
    - **Validates: Requirements 3.5, 6.2**

  - [ ] 4.5 实现指数退避重试逻辑
    - 配置重试间隔（1s, 2s, 4s, 8s...）
    - 设置最大重试次数
    - _Requirements: 6.4_

  - [ ]* 4.6 编写Property 9测试：指数退避重试
    - **Property 9: 指数退避重试**
    - 验证重试间隔符合指数退避模式
    - **Validates: Requirements 6.4**

- [ ] 5. WebSocket事件扩展
  - [ ] 5.1 添加narrative_ready事件处理
    - 在gameHandler.ts中添加事件广播
    - 包含sessionId、round、narrative、timestamp
    - _Requirements: 2.3_

  - [ ] 5.2 添加panel_data_ready事件处理
    - 广播解析完成的面板数据
    - 包含完整的PanelData结构
    - _Requirements: 3.4_

  - [ ] 5.3 添加panel_parse_failed事件处理
    - 广播解析失败信息
    - 包含错误信息和canRetry标志
    - _Requirements: 3.5_

- [ ] 6. 游戏路由集成
  - [ ] 6.1 修改推演触发逻辑
    - 在game.ts中集成performDualInference
    - 实现剧情ready回调广播
    - _Requirements: 2.3, 3.1_

  - [ ] 6.2 添加重新解析API端点
    - POST /api/game/:sessionId/round/:round/reparse
    - 使用存储的剧情文本重新调用Parser_API
    - _Requirements: 6.5, 7.2_

  - [ ] 6.3 更新推演结果存储逻辑
    - 使用InferenceResult模型存储
    - 分别记录剧情和面板数据
    - _Requirements: 7.1_

  - [ ]* 6.4 编写Property 7测试：数据关联一致性
    - **Property 7: 数据关联一致性**
    - 验证存储的数据关联正确
    - **Validates: Requirements 7.1, 7.3**

- [ ] 7. Checkpoint - 后端集成验证
  - 确保WebSocket事件正常广播
  - 验证推演流程端到端工作
  - 如有问题请询问用户

- [ ] 8. 前端状态管理
  - [ ] 8.1 创建InferenceState状态管理
    - 添加narrativeStatus、panelStatus独立状态
    - 实现状态更新逻辑
    - _Requirements: 4.2, 5.1_

  - [ ]* 8.2 编写Property 10测试：前端状态独立性
    - **Property 10: 前端状态独立性**
    - 验证剧情和面板状态独立管理
    - **Validates: Requirements 4.2, 4.4, 5.1**

  - [ ] 8.3 实现WebSocket事件监听
    - 监听narrative_ready更新剧情状态
    - 监听panel_data_ready更新面板状态
    - 监听panel_parse_failed处理错误
    - _Requirements: 2.3, 3.4, 3.5_

  - [ ] 8.4 实现历史数据保留逻辑
    - Parser失败时保留上一回合面板数据
    - _Requirements: 5.3_

  - [ ]* 8.5 编写Property 11测试：历史数据保留
    - **Property 11: 历史数据保留**
    - 验证失败时保留旧数据
    - **Validates: Requirements 5.3**

- [ ] 9. 前端UI更新
  - [ ] 9.1 创建剧情展示组件
    - 独立的剧情文本展示区域
    - 支持滚动阅读
    - _Requirements: 4.1, 4.3_

  - [ ] 9.2 添加面板加载状态指示
    - 显示loading/ready/error状态
    - 不阻塞剧情阅读
    - _Requirements: 4.4, 5.4_

  - [ ] 9.3 实现关键词高亮
    - 在剧情文本中高亮事件关键词
    - _Requirements: 4.5_

- [ ] 10. 主持人配置界面
  - [ ] 10.1 扩展API配置表单
    - 添加Parser API配置区域
    - 添加双API模式开关
    - 清晰区分两组API用途
    - _Requirements: 1.1, 1.4_

  - [ ] 10.2 添加重新解析按钮
    - 在推演结果页面添加重新解析功能
    - _Requirements: 6.5_

- [ ] 11. 缓存与性能优化
  - [ ] 11.1 实现推演结果缓存
    - 使用Redis缓存最近的推演结果
    - 支持快速回顾
    - _Requirements: 8.5_

  - [ ]* 11.2 编写Property 12测试：缓存有效性
    - **Property 12: 缓存有效性**
    - 验证缓存包含完整数据
    - **Validates: Requirements 8.5**

  - [ ] 11.3 实现超时配置
    - Narrative_API: 120秒
    - Parser_API: 60秒
    - _Requirements: 8.1, 8.2_

  - [ ]* 11.4 编写Property 8测试：超时控制
    - **Property 8: 超时控制**
    - 验证超时配置正确
    - **Validates: Requirements 8.1, 8.2**

- [ ] 12. Final Checkpoint - 完整验证
  - 确保所有测试通过
  - 验证单API和双API模式都能正常工作
  - 验证错误降级策略有效
  - 如有问题请询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 建议优先完成核心服务重构（任务1-3），确保后端逻辑正确
- 前端更新（任务8-10）可以在后端稳定后进行
- 每个Checkpoint是验证阶段性成果的好时机
- Property测试使用Jest + fast-check进行属性测试
