/**
 * 双API测试服务器
 * 独立运行，用于验证双API流程
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// ============ 默认提示词 ============

const NARRATIVE_INIT_PROMPT = `这是一场商业竞争博弈游戏，有3个主体在有限市场资源下寻求相对更优的发展，故事背景为零售行业，请尽可能生动地生成一篇长篇幅的背景故事作为游戏基础。

要求：
1. 背景故事约600-800字
2. 介绍行业背景、市场环境、竞争格局
3. 为3个主体分别设定：企业名称、初始资金(100-500万)、核心属性(市场份额/品牌声誉/创新能力 0-100)、被动收支、企业背景
4. 生成年度卦象（卦名、吉凶、象曰）
5. 为每个主体生成3个初始决策选项`;

const NARRATIVE_ROUND_PROMPT = `推演本回合所有决策造成的影响，推演下一回合剧情走向，各主体的资金变动计算公式由你制定。

具体要求：
1. 计算本回合被动收益和被动支出结果
2. 计算一次性收益支出结果（基于玩家决策）
3. 更新下回合被动收益支出预算
4. 计算当前资金额度
5. 展示各决策与事件如何导致推演结果，展现连锁反应
6. 检测本回合有无玩家解锁新成就
7. 生成下回合的3个决策选项
8. 如果有主体现金流危险，发出警告`;

const NARRATIVE_SYSTEM_PROMPT = `你是《凡墙皆是门》商业博弈游戏的AI主持人。用生动有画面感的语言描述事件，体现决策因果关系。只输出剧情文本，不需要JSON格式。`;

const PARSER_SYSTEM_PROMPT = `你是数据解析助手，将游戏剧情转换为结构化JSON。必须用\`\`\`json代码块包裹输出。`;

const PARSER_PROMPT = `请从剧情中提取以下JSON结构：
{
  "roundTitle": "第X回合标题",
  "perEntityPanel": [{ "id": "A/B/C", "name": "企业名", "cash": 数字, "attributes": {"市场份额":0-100,"品牌声誉":0-100,"创新能力":0-100}, "passiveIncome": 数字, "passiveExpense": 数字, "delta": {"cash":变化,"市场份额":变化} }],
  "leaderboard": [{ "id": "A", "name": "企业名", "score": 分数, "rank": 1-3 }],
  "events": [{ "keyword": "关键词", "type": "positive/negative/neutral", "description": "描述" }],
  "options": [{ "id": "1", "title": "选项", "description": "描述", "category": "attack/defense/explore", "riskLevel": "low/medium/high" }],
  "hexagram": { "name": "卦名", "omen": "positive/neutral/negative", "text": "象曰" },
  "cashFlowWarning": [{ "entityId": "A", "message": "警告", "severity": "warning/critical" }]
}
如果剧情没有明确数值，请合理推断。`;


// ============ API调用函数 ============

async function callAI(config, systemPrompt, userPrompt) {
  try {
    const response = await axios.post(
      config.endpoint,
      {
        model: config.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 3000,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        timeout: 120000
      }
    );
    return { success: true, content: response.data?.choices?.[0]?.message?.content?.trim() };
  } catch (error) {
    console.error('API Error:', error.message);
    return { success: false, error: error.response?.data?.error?.message || error.message };
  }
}

// ============ 路由 ============

// 游戏初始化
app.post('/api/dual/init', async (req, res) => {
  const { narrativeConfig, parserConfig } = req.body;
  
  if (!narrativeConfig?.endpoint || !narrativeConfig?.apiKey) {
    return res.status(400).json({ success: false, error: '缺少剧情API配置' });
  }
  if (!parserConfig?.endpoint || !parserConfig?.apiKey) {
    return res.status(400).json({ success: false, error: '缺少解析API配置' });
  }

  console.log('=== 初始化游戏 ===');
  
  // Step 1: 生成背景故事
  console.log('Step 1: 调用剧情API生成背景...');
  const narrativeResult = await callAI(narrativeConfig, NARRATIVE_SYSTEM_PROMPT, NARRATIVE_INIT_PROMPT);
  
  if (!narrativeResult.success) {
    return res.json({ success: false, step: 'narrative', error: narrativeResult.error });
  }
  
  console.log('背景故事生成成功，长度:', narrativeResult.content.length);

  // Step 2: 解析初始数据
  console.log('Step 2: 调用解析API...');
  const parsePrompt = `以下是游戏背景故事：\n\n${narrativeResult.content}\n\n${PARSER_PROMPT}`;
  const parseResult = await callAI(parserConfig, PARSER_SYSTEM_PROMPT, parsePrompt);
  
  let panelData = null;
  let parseSuccess = false;
  
  if (parseResult.success && parseResult.content) {
    // 尝试提取JSON
    const jsonMatch = parseResult.content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        panelData = JSON.parse(jsonMatch[1]);
        parseSuccess = true;
        console.log('JSON解析成功');
      } catch (e) {
        console.log('JSON解析失败:', e.message);
      }
    }
  }

  res.json({
    success: true,
    narrative: narrativeResult.content,
    parserRawText: parseResult.content || null,
    panelData,
    parseSuccess
  });
});

// 生成回合剧情
app.post('/api/dual/narrative', async (req, res) => {
  const { config, currentRound, previousParserOutput, playerDecisions, extraPrompt } = req.body;
  
  if (!config?.endpoint || !config?.apiKey) {
    return res.status(400).json({ success: false, error: '缺少API配置' });
  }

  console.log(`=== 第${currentRound}回合剧情生成 ===`);

  let userPrompt = `# 第 ${currentRound || 1} 回合推演\n\n`;
  
  if (previousParserOutput) {
    userPrompt += `## 上回合数值解析结果\n\`\`\`\n${previousParserOutput}\n\`\`\`\n\n`;
  }
  
  if (playerDecisions && playerDecisions.length > 0) {
    userPrompt += `## 本回合玩家决策\n`;
    playerDecisions.forEach((d, i) => { userPrompt += `${i + 1}. ${d}\n`; });
    userPrompt += `\n`;
  }
  
  if (extraPrompt) {
    userPrompt += `## 主持人补充\n${extraPrompt}\n\n`;
  }
  
  userPrompt += `## 推演要求\n${NARRATIVE_ROUND_PROMPT}`;

  const result = await callAI(config, NARRATIVE_SYSTEM_PROMPT, userPrompt);
  
  res.json({
    success: result.success,
    narrative: result.content,
    error: result.error
  });
});

// 解析剧情数据
app.post('/api/dual/parse', async (req, res) => {
  const { config, narrative } = req.body;
  
  if (!config?.endpoint || !config?.apiKey) {
    return res.status(400).json({ success: false, error: '缺少API配置' });
  }
  if (!narrative) {
    return res.status(400).json({ success: false, error: '缺少剧情文本' });
  }

  console.log('=== 解析剧情数据 ===');

  const parsePrompt = `以下是本回合剧情：\n\n${narrative}\n\n${PARSER_PROMPT}`;
  const result = await callAI(config, PARSER_SYSTEM_PROMPT, parsePrompt);
  
  let panelData = null;
  let parseSuccess = false;
  
  if (result.success && result.content) {
    const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        panelData = JSON.parse(jsonMatch[1]);
        parseSuccess = true;
      } catch (e) {
        console.log('JSON解析失败:', e.message);
      }
    }
  }

  res.json({
    success: result.success,
    rawText: result.content,
    panelData,
    parseSuccess,
    error: result.error
  });
});

// 启动服务器
const PORT = 3099;
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  双API测试服务器已启动`);
  console.log(`  访问: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
