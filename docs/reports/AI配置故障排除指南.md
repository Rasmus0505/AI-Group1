# AI配置故障排除指南

## 问题症状

如果您在主持人配置页面遇到以下错误：
- `ECONNABORTED` - 连接被中止
- `timeout` - 超时错误
- `Generate init error: AxiosError` - 生成初始化数据失败

## 解决方案

### 1. 超时问题修复 ⏰

**问题原因**: AI初始化生成是一个复杂任务，通常需要1-3分钟时间，之前的超时设置太短。

**已修复**:
- 前端API超时从10秒增加到120秒
- 后端AI服务超时从60秒增加到180秒（专门针对初始化任务）
- 前端显示进度提示，告知用户需要等待时间

### 2. 网络连接优化 🌐

**建议配置**:
- 确保网络连接稳定
- 避免在网络高峰期进行初始化
- 如果使用VPN，确保连接稳定

### 3. AI API配置检查 🔧

#### DeepSeek配置（推荐）
```
提供商: DeepSeek
模型: deepseek-chat
API Key: sk-xxxxxxxxxxxxxxxx
端点: https://api.deepseek.com/v1/chat/completions
```

#### OpenAI配置
```
提供商: OpenAI
模型: gpt-4o-mini
API Key: sk-xxxxxxxxxxxxxxxx
端点: https://api.openai.com/v1/chat/completions
```

#### 智谱GLM配置
```
提供商: 智谱GLM
模型: glm-4
API Key: xxxxxxxxxxxxxxxx
端点: https://open.bigmodel.cn/api/paas/v4/chat/completions
```

### 4. 常见错误及解决方案 🛠️

#### 错误: "API密钥无效"
- 检查API Key是否正确复制
- 确认API Key没有过期
- 验证API Key对应的服务商是否正确

#### 错误: "API端点不存在"
- 检查端点URL是否正确
- 确认选择的提供商与端点匹配
- 验证网络是否能访问该端点

#### 错误: "API调用频率超限"
- 等待一段时间后重试
- 检查API账户的调用限制
- 考虑升级API套餐

#### 错误: "连接超时"
- 检查网络连接稳定性
- 尝试更换网络环境
- 稍后重试（避开网络高峰期）

### 5. 最佳实践 ✨

#### 推荐的AI服务商选择
1. **DeepSeek** - 性价比最高，响应速度快
2. **OpenAI GPT-4o-mini** - 质量稳定，成本适中
3. **智谱GLM-4** - 国内服务，网络延迟低

#### 配置步骤
1. 先完成API配置并保存
2. 配置游戏规则（可使用默认规则）
3. 设置玩家数量（建议2-4个主体）
4. 生成初始化数据（耐心等待1-3分钟）

#### 故障排除步骤
1. 检查浏览器控制台的详细错误信息
2. 验证API配置是否正确
3. 测试网络连接稳定性
4. 尝试使用不同的AI服务商
5. 如果问题持续，查看后端日志

### 6. 调试信息 🔍

现在系统会在浏览器控制台显示详细的调试信息：

```javascript
// 开始生成时的信息
开始生成初始化数据... {
  roomId: "xxx",
  entityCount: 4,
  gameMode: "multi_control",
  apiEndpoint: "https://api.deepseek.com/v1/chat/completions",
  hasApiHeaders: true
}

// 成功时的信息
初始化数据生成成功: { backgroundStory: "...", entities: [...] }

// 错误时的信息
Generate init error: AxiosError
Network Error Code: ECONNABORTED
API Error Details: { message: "..." }
```

### 7. 性能优化建议 🚀

#### 减少生成时间
- 选择响应速度快的AI服务商（如DeepSeek）
- 减少主体数量（2-3个而不是4-6个）
- 简化行业主题描述

#### 提高成功率
- 使用稳定的网络连接
- 避免在服务商维护时间进行操作
- 准备备用的API配置

### 8. 应急方案 🆘

如果AI生成持续失败，可以：

1. **使用默认规则**: 点击"查看默认蓝本规则"，直接使用系统提供的规则
2. **手动配置**: 跳过AI生成，手动设置游戏参数
3. **更换服务商**: 尝试不同的AI API提供商
4. **简化配置**: 减少主体数量和复杂度

### 9. 联系支持 📞

如果问题仍然存在，请提供以下信息：
- 浏览器控制台的完整错误日志
- 使用的AI服务商和配置
- 网络环境信息
- 操作步骤重现

## 总结

通过以上优化，AI初始化的成功率应该大大提高。关键是要有耐心等待（1-3分钟是正常的），确保网络稳定，并正确配置AI API。如果仍有问题，请查看浏览器控制台的详细错误信息进行针对性解决。