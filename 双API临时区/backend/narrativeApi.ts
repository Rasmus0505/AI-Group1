/**
 * 剧情推演API服务
 * 职责：接收主持人提示词，调用AI生成纯文本剧情
 * 特点：不要求JSON格式，只生成流畅的叙事文本
 */

import axios from 'axios';
import {
  NARRATIVE_INIT_PROMPT,
  NARRATIVE_ROUND_PROMPT,
  NARRATIVE_SYSTEM_PROMPT
} from './defaultPrompts';

export interface NarrativeConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
}

export interface NarrativeRequest {
  type: 'init' | 'round';   // 初始化 或 回合推演
  prompt?: string;          // 主持人额外提示词（可选）
  previousParserOutput?: string; // 上回合数值解析API的原始输出（核心上下文）
  playerDecisions?: string[]; // 玩家决策摘要（可选）
  currentRound?: number;    // 当前回合数
  entities?: Array<{        // 主体信息（回合推演时需要，从parser输出提取）
    id: string;
    name: string;
    cash: number;
  }>;
}

export interface NarrativeResponse {
  success: boolean;
  narrative?: string;       // 生成的剧情文本
  error?: string;
}

/**
 * 调用剧情推演API
 * @param config API配置（endpoint + apiKey）
 * @param request 请求内容（提示词 + 上下文）
 */
export async function generateNarrative(
  config: NarrativeConfig,
  request: NarrativeRequest
): Promise<NarrativeResponse> {
  try {
    // 使用固定的系统提示词
    const systemPrompt = NARRATIVE_SYSTEM_PROMPT;

    // 根据类型构建用户提示词
    let userPrompt = '';
    
    if (request.type === 'init') {
      // 初始化：使用固定的初始化提示词
      userPrompt = NARRATIVE_INIT_PROMPT;
      if (request.prompt) {
        userPrompt += `\n\n【主持人补充要求】\n${request.prompt}`;
      }
    } else {
      // 回合推演：组合上下文 + 固定提示词
      userPrompt = `# 第 ${request.currentRound || 1} 回合推演\n\n`;
      
      // 【核心】添加上回合数值解析API的完整输出
      if (request.previousParserOutput) {
        userPrompt += `## 上回合数值解析结果（请基于此数据推演）\n`;
        userPrompt += `\`\`\`\n${request.previousParserOutput}\n\`\`\`\n\n`;
      }
      
      // 添加玩家决策（本回合的核心输入）
      if (request.playerDecisions && request.playerDecisions.length > 0) {
        userPrompt += `## 本回合玩家决策\n`;
        request.playerDecisions.forEach((d, i) => {
          userPrompt += `${i + 1}. ${d}\n`;
        });
        userPrompt += `\n`;
      }
      
      // 添加主持人额外提示
      if (request.prompt) {
        userPrompt += `## 主持人补充说明\n${request.prompt}\n\n`;
      }
      
      // 添加固定的推演要求
      userPrompt += `## 推演要求\n${NARRATIVE_ROUND_PROMPT}`;
    }

    // 调用API
    const response = await axios.post(
      config.endpoint,
      {
        model: config.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 2000,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        timeout: 120000 // 2分钟超时
      }
    );

    // 提取响应内容
    const content = response.data?.choices?.[0]?.message?.content;
    
    if (!content) {
      return {
        success: false,
        error: 'API返回内容为空'
      };
    }

    return {
      success: true,
      narrative: content.trim()
    };

  } catch (error: any) {
    console.error('Narrative API error:', error.message);
    
    let errorMessage = '剧情生成失败';
    if (error.response?.status === 401) {
      errorMessage = 'API密钥无效';
    } else if (error.response?.status === 429) {
      errorMessage = 'API调用频率超限';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = '请求超时，请重试';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

export default { generateNarrative };
