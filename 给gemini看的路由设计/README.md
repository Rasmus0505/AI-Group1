# AI-Group1 智能体博弈系统

![Version](https://img.shields.io/badge/version-v1.0.0-blue)
![Build](https://img.shields.io/badge/build-passing-brightgreen)

## 🌟 项目简介
本项目是一个基于 AI 动态推演的博弈系统，支持多人在线协作。系统通过 AI 模型（如 DeepSeek、Gemini 或本地 LLM）生成游戏剧情，玩家输入决策后，AI 实时推演因果关系并影响全球博弈状态。

### 核心特性
- **AI 动态叙事**：每一局游戏都是唯一的，由 AI 实时生成。
- **多人联机**：支持 3+ 玩家实时在线博弈。
- **任务系统**：动态生成的挑战与主支线任务。
- **策略分析**：对历史博弈数据进行多维度策略评估。
- **全栈技术**：Node.js 后端 + React 前端 + Prisma 数据库。

---

## 🚀 快速启动

### 1. 环境准备
- **Node.js**: >= 18.x
- **Docker**: 用于运行 PostgreSQL 和 Redis (可选，可通过本地环境代替)

### 2. 一键启动 (推荐)
在根目录下直接双击运行：
```powershell
run-dev.bat
```
该脚本会自动：
- 检查环境
- 启动容器 (若有 Docker)
- 安装前后端依赖
- 执行数据库迁移与种子填充 (npm run seed)
- 启动开发服务器

### 3. 说明文档
- **多人联机演示指南**：查看 [docs/三人联机演示脚本.md](./docs/三人联机演示脚本.md)
- **快捷功能介绍**：查看 [tools/快捷双击功能介绍.md](./tools/快捷双击功能介绍.md)
- **项目完整报告**：查看 [docs/项目结项与完善成功性报告.md](./docs/项目结项与完善成功性报告.md)

---

## 🛠 开发规范与结构

### 目录说明
- `rebuild/production/backend`: 后端核心，包含所有 API 和 WebSocket 逻辑。
- `rebuild/production/frontend`: 前端核心，基于 React + AntD + Glassmorphism。
- `tools/`: 各种维护脚本（清理、初始化、数据库检查）。
- `docs/`: 核心文档资产。
- `rebuild/test-phases/`: 15 个阶段的自动化测试脚本。

### 开发规范
- **禁止使用 Emoji** (代码与注释中)。
- **命名规范**：变量/函数使用 `camelCase`。
- **一功能一文件**：严禁过度拆分，保持模块内敛。

---

## 🧪 测试验收
进入 `rebuild/test-phases/` 对应阶段文件夹，运行 `.ps1` 脚本进行验收。
例如验收第 12 阶段（交易系统）：
```powershell
cd rebuild/test-phases/phase12-tests
./test-phase12.ps1
```

---

## 📄 默认账户信息
| 角色 | 用户名 | 密码 | 说明 |
| :--- | :--- | :--- | :--- |
| 开发者 | `developer` | `000000` | 拥有管理员权限 |
| 玩家1 | `testuser1` | `Test1234!` | 预设测试账号 |
| 玩家2 | `testuser2` | `Test1234!` | 预设测试账号 |

---

© 2024 AI-Group1 | 由 Antigravity 强力驱动
