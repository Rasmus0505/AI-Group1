/**
 * 数据解析API服务
 * 职责：接收剧情文本，解析/生成结构化面板数据
 * 特点：要求JSON格式输出，填充前端UI面板
 */

import axios from 'axios';
import {
  PARSER_PROMPT,
  PARSER_SYSTEM_PROMPT,
  PARSER_INIT_PROMPT
} from './defaultPrompts';

export interface ParserConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
}

export interface ParserRequest {
  type: 'init' | 'round';   // 初始化解析 或 回合解析
  narrative: string;        // 剧情文本
  entities?: EntityInfo[];  // 主体信息（用于对照，回合解析时需要）
  currentRound?: number;    // 当前回合
}

export interface EntityInfo {
  id: string;
  name: string;
  currentCash?: number;
  attributes?: Record<string, number>;
}

export interface PanelData {
  roundTitle: string;
  perEntityPanel: EntityPanel[];
  leaderboard: LeaderboardEntry[];
  events: GameEvent[];
  options: DecisionOption[];
  hexagram?: HexagramData;
  riskCard?: string;
  opportunityCard?: string;
  nextRoundHints?: string;
  cashFlowWarning?: CashFlowWarning[];
}

export interface EntityPanel {
  id: string;
  name: string;
  cash: number;
  attributes: Record<string, number>;
  passiveIncome: number;
  passiveExpense: number;
  delta: Record<string, number>;
  broken: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
  rankChange: number;
}

export interface GameEvent {
  keyword: string;
  type: 'positive' | 'negative' | 'neutral';
  description: string;
  affectedEntities: string[];
}

export interface DecisionOption {
  id: string;
  title: string;
  description: string;
  expectedDelta: Record<string, number>;
  category: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface HexagramData {
  name: string;
  omen: 'positive' | 'neutral' | 'negative';
  text: string;
}

export interface CashFlowWarning {
  entityId: string;
  message: string;
  severity: 'warning' | 'critical';
}

export interface ParserResponse {
  success: boolean;
  rawText?: string;         // AI返回的原始文本（始终返回）
  panelData?: PanelData;    // 解析后的结构化数据（可能为空）
  parseSuccess?: boolean;   // JSON解析是否成功
  error?: string;
}

/**
 * 调用数据解析API
 * @param config API配置
 * @param request 请求内容（剧情文本 + 主体信息）
 */
export async function parseNarrative(
  config: ParserConfig,
  request: ParserRequest
): Promise<ParserResponse> {
  try {
    // 使用固定的系统提示词
    const systemPrompt = PARSER_SYSTEM_PROMPT;

    // 根据类型构建用户提示词
    let userPrompt = '';
    
    if (request.type === 'init') {
      // 初始化解析
      userPrompt = `【背景故事】\n${request.narrative}\n\n${PARSER_INIT_PROMPT}`;
    } else {
      // 回合解析
      userPrompt = `【当前回合】第 ${request.currentRound || 1} 回合\n\n`;
      
      // 添加主体信息
      if (request.entities && request.entities.length > 0) {
        userPrompt += `【主体列表】\n`;
        request.entities.forEach(e => {
          userPrompt += `- ${e.id}: ${e.name} (当前现金: ¥${(e.currentCash || 0).toLocaleString()})\n`;
        });
        userPrompt += `\n`;
      }
      
      userPrompt += `【剧情文本】\n${request.narrative}\n\n`;
      userPrompt += PARSER_PROMPT;
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
        temperature: 0.3, // 低温度，更稳定的输出
        max_tokens: 3000,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        timeout: 60000 // 1分钟超时
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

    // 先返回原始文本，再尝试解析JSON
    const panelData = extractJsonFromResponse(content);
    
    // 无论解析是否成功，都返回原始文本
    return {
      success: true,
      rawText: content,           // 始终返回原始文本
      panelData: panelData || undefined,  // 解析成功则返回
      parseSuccess: !!panelData   // 标记解析是否成功
    };

  } catch (error: any) {
    console.error('Parser API error:', error.message);
    
    let errorMessage = '数据解析失败';
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

/**
 * 从AI响应中提取JSON
 */
function extractJsonFromResponse(content: string): PanelData | null {
  // 尝试多种模式提取JSON
  const patterns = [
    /```json\s*([\s\S]*?)```/i,
    /```\s*([\s\S]*?)```/,
    /(\{[\s\S]*\})/
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      try {
        const jsonStr = match[1].trim();
        const parsed = JSON.parse(jsonStr);
        
        // 基本验证
        if (parsed && typeof parsed === 'object' && parsed.perEntityPanel) {
          return parsed as PanelData;
        }
      } catch (e) {
        continue;
      }
    }
  }

  return null;
}

export default { parseNarrative };
