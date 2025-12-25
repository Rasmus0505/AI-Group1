# 第二阶段测试

本目录包含第二阶段（用户认证系统）的测试文件和脚本。

## 文件说明

- `第二阶段测试说明.md` - 详细的测试步骤和说明
- `test-phase2.ps1` - PowerShell自动化测试脚本（Windows）
- `test-phase2.sh` - Bash自动化测试脚本（Linux/Mac）

## 快速开始

### Windows (PowerShell)

```powershell
cd 第二阶段测试
.\test-phase2.ps1
```

### Linux/Mac (Bash)

```bash
cd 第二阶段测试
chmod +x test-phase2.sh
./test-phase2.sh
```

## 测试内容

1. ✅ 用户注册
2. ✅ 用户登录
3. ✅ 获取用户信息
4. ✅ 更新用户信息
5. ✅ Token刷新
6. ✅ 忘记密码
7. ✅ 未授权访问测试

## 手动测试

请参考 `第二阶段测试说明.md` 进行详细的手动测试。

## 注意事项

- 确保后端服务运行在 `http://localhost:3000`
- 确保前端服务运行在 `http://localhost:5173`
- 确保数据库已初始化（运行 `npm run prisma:migrate`）

