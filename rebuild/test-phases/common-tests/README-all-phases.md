# 全阶段测试脚本使用说明

## 概述

`test-all-phases.ps1` 是一个一键运行所有测试阶段的脚本，它会按顺序执行从 Phase 1/2 到 Phase 15 的所有测试。

## 测试阶段列表

1. **Phase 1/2**: 基础搭建 + 用户认证系统
2. **Phase 3**: 房间系统基础
3. **Phase 4**: WebSocket 最小实时子系统
4. **Phase 5**: 主持人初始化设定
5. **Phase 6**: 游戏核心决策流程
6. **Phase 7**: 主持人审核功能
7. **Phase 8**: AI推演引擎集成
8. **Phase 9**: 多回合事件进度跟踪
9. **Phase 10**: 游戏状态管理
10. **Phase 11**: 游戏历史
11. **Phase 12**: 交易系统
12. **Phase 13**: 游戏存档/恢复
13. **Phase 14**: 游戏历史详情
14. **Phase 15**: 最终阶段

## 使用方法

### 前置条件

1. **确保后端服务正在运行**
   ```powershell
   cd "rebuild\production\backend"
   npm run dev
   ```

2. **确保数据库已初始化**
   ```powershell
   cd "rebuild\production\backend"
   npm run prisma:migrate
   npm run seed
   ```

3. **确保 Docker 服务运行中**（PostgreSQL + Redis）

### 运行全阶段测试

在 PowerShell 中执行：

```powershell
cd "rebuild\test-phases\common-tests"
.\test-all-phases.ps1
```

### 自定义配置

脚本支持通过环境变量配置：

```powershell
$env:ADMIN_USERNAME = "developer"
$env:ADMIN_DEFAULT_PASSWORD = "000000"
.\test-all-phases.ps1
```

## 功能特性

### 1. 自动错误处理
- 如果某个阶段失败，脚本会询问是否继续
- 可以选择继续、停止或重试

### 2. 进度跟踪
- 显示当前执行的阶段编号（如 [5/14]）
- 显示每个阶段的执行时间
- 显示总执行时间

### 3. 统计报告
测试完成后会显示：
- 总阶段数
- 通过的阶段数
- 失败的阶段数
- 跳过的阶段数
- 总执行时间

### 4. 环境变量传递
- 自动为 Phase 6 传递管理员账号环境变量
- 支持 UTF-8 编码（包括中文用户名）

## 输出示例

```
========================================
All Phases Combined Test (Phase 1-15)
========================================

Environment variables set:
  ADMIN_USERNAME: developer
  ADMIN_DEFAULT_PASSWORD: 000000

Starting test execution at: 2024-01-01 12:00:00
Total phases to run: 14

========================================
[1/14] Phase 1/2 Continuous Test (Foundation + Auth)
========================================
Script path: E:\...\test-phase1-2.ps1

=== Starting Phase 1/2 Continuous Test ===
✔ Phase 1/2 Continuous Test passed
  Duration: 15.23 seconds
=== Completed Phase 1/2 Continuous Test ===

...

========================================
Test Execution Summary
========================================
Total phases:     14
Passed:           14
Failed:           0
Skipped:          0
Total duration:   45.67 minutes
Start time:       2024-01-01 12:00:00
End time:         2024-01-01 12:45:40
========================================

========================================
All phases tests passed successfully!
========================================
```

## 故障排除

### 问题：某个阶段失败

**解决方案**：
1. 查看错误信息，确定失败原因
2. 可以选择继续执行后续阶段
3. 或者单独运行失败的阶段进行调试：
   ```powershell
   cd "rebuild\test-phases\phaseX-tests"
   .\test-phaseX.ps1
   ```

### 问题：找不到测试脚本

**可能原因**：
- 测试脚本文件不存在
- 文件路径不正确

**解决方案**：
- 检查 `rebuild\test-phases` 目录下是否有对应的测试脚本
- 确保脚本文件名正确（如 `test-phase3.ps1`）

### 问题：环境变量未传递

**解决方案**：
- Phase 6 会自动传递环境变量
- 其他阶段如需环境变量，可以手动设置：
  ```powershell
  $env:YOUR_VAR = "value"
  .\test-all-phases.ps1
  ```

## 注意事项

1. **执行时间**：全阶段测试可能需要较长时间（通常 30-60 分钟），请确保有足够时间
2. **服务状态**：确保后端服务在整个测试过程中保持运行
3. **数据库状态**：建议在测试前重置数据库或使用测试数据库
4. **网络连接**：某些测试可能需要网络连接（如 AI API 调用）

## 单独运行某个阶段

如果需要单独运行某个阶段的测试：

```powershell
cd "rebuild\test-phases\phaseX-tests"
.\test-phaseX.ps1
```

## 相关文档

- [前六阶段联合测试说明](./使用说明.md)
- [各阶段测试 README](../README.md)

