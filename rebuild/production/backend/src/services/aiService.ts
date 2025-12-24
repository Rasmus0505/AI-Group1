/**
 * AI推演引擎服务
 * 封装AI API调用、Prompt构建、结果解析等功能
 */

import axios, { AxiosRequestConfig } from 'axios';
import { logger } from '../utils/logger';

export interface AIConfig {
  provider?: string | null;
  endpoint?: string | null;
  headers?: Record<string, unknown> | null;
  bodyTemplate?: Record<string, unknown> | null;
}

export interface InferenceRequest {
  sessionId: string;
  round: number;
  decisions: Array<{
    playerIndex: number;
    username: string;
    nickname?: string;
    actionText?: string;
    selectedOptionIds?: unknown;
    actionType?: string;
    actionData?: unknown;
    hostModified?: boolean;
    hostModification?: unknown;
  }>;
  activeEvents: Array<{
    id: string;
    eventType: string;
    eventContent: string;
    effectiveRounds: number;
    progress: Record<string, unknown>;
    round: number;
  }>;
  gameRules: string;
  currentRound: number;
}

export interface InferenceResult {
  sessionId: string;
  round: number;
  result: {
    narrative?: string;
    outcomes?: Array<{
      playerIndex: number;
      outcome: string;
      resources?: Record<string, unknown>;
    }>;
    events?: Array<{
      type: string;
      description: string;
    }>;
    nextRoundHints?: string;
  };
  status: 'completed' | 'failed';
  error?: string;
  completedAt: Date;
}

export class AIService {
  private static instance: AIService;
  private defaultRetries = 3;
  private defaultTimeout = 60000; // 60秒超时

  private constructor() { }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * 构建AI Prompt
   */
  buildPrompt(request: InferenceRequest, gameRules: string): string {
    const { decisions, activeEvents, currentRound } = request;

    let prompt = `# 游戏推演请求 - 第 ${currentRound} 回合\n\n`;

    // 游戏规则：优先使用主持人配置的 gameRules，否则回退到蓝本默认规则
    if (gameRules && gameRules.trim()) {
      prompt += `## 游戏规则\n${gameRules.trim()} \n\n`;
    } else {
      // 蓝本版默认规则（简要），确保即使未配置也有合理的经营博弈逻辑
      prompt += '## 游戏规则（默认 - 凡墙皆是门蓝本）\n';
      prompt += '1. 回合与时间：每回合代表一个季度（3 个月），四个回合代表完整一年，可按「20XX 年 Q1」「20XX 年 Q2」等顺序推进。\n';
      prompt += '2. 主体：存在多个企业实体，数量由主持人配置决定，每个主体有：金钱（现金余额）、市场份额、品牌声誉、创新能力等属性；不要假定固定 ABCD。\n';
      prompt += '3. 被动收支：每回合开始时，为每个主体结算被动收益（如稳健业务收入）和被动支出（如固定成本）。\n';
      prompt += '4. 决策：玩家可以为主体输入多项主动决策指令。未收到指令的主体，只结算被动收支，不触发新的主动事件。\n';
      prompt += '5. 现金流与破产：若现金余额小于必要支出（被动支出 + 本回合决策支出），视为现金流断裂，可能导致主体破产或丧失下一回合的决策权。\n';
    prompt += '6. 事件：每回合可发生正向、负向或中性事件；允许多回合持续的长时间线事件，并跟踪其进度；事件需体现各主体决策对其他主体和整体市场的交叉影响。\n';
    prompt += '7. 卦象与随机性：每年根据周易卦象生成一条「年度叙事暗线」，用于影响事件风格与触发概率；随机事件既参考卦象，又参考各主体当前属性。\n';
    prompt += '8. 成就与评分：为关键性决策结果赋予阶段性成就标签；游戏在适当时刻给出评分面板，总结各主体表现。\n';
    prompt += '9. 现金流安全：若余额接近被动支出临界，需明确标注风险；未收到指令的主体只结算被动收支，不触发新的主动行动。\n\n';
    }

    // 活跃事件（包含详细进度信息）
    if (activeEvents && activeEvents.length > 0) {
      prompt += `## 活跃事件和规则\n`;
      activeEvents.forEach((event, index) => {
        prompt += `${index + 1}.[${event.eventType}] ${event.eventContent} \n`;
        if (event.progress && typeof event.progress === 'object') {
          const progress = event.progress as { current?: number; total?: number; lastUpdatedRound?: number };
          if (progress.current !== undefined && progress.total !== undefined) {
            const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
            prompt += `   进度: ${progress.current}/${progress.total} 回合 (${percentage}%)\n`;
            if (progress.lastUpdatedRound !== undefined) {
              prompt += `   上次更新: 第 ${progress.lastUpdatedRound} 回合\n`;
            }
          }
        }
        prompt += `   有效回合数: ${event.effectiveRounds}\n`;
        prompt += `   创建回合: 第 ${event.round} 回合\n`;
      });
      prompt += `\n`;
    } else {
      prompt += `## 活跃事件和规则\n（当前无活跃事件）\n\n`;
    }

    // 玩家决策
    prompt += `## 玩家决策\n`;
    if (decisions && decisions.length > 0) {
      decisions.forEach((decision) => {
        prompt += `玩家 ${decision.playerIndex} (${decision.nickname || decision.username}):\n`;
        if (decision.actionText) {
          prompt += `  行动: ${decision.actionText}\n`;
        }
        if (decision.selectedOptionIds) {
          prompt += `  选择: ${JSON.stringify(decision.selectedOptionIds)}\n`;
        }
        if (decision.actionData) {
          prompt += `  行动数据: ${JSON.stringify(decision.actionData)}\n`;
        }
        if (decision.hostModified && decision.hostModification) {
          prompt += `  [主持人修改] ${JSON.stringify(decision.hostModification)}\n`;
        }
        prompt += `\n`;
      });
    } else {
      prompt += `（当前回合暂无玩家决策）\n\n`;
    }

    // 推演要求：引导输出蓝本要求的结构
    prompt += '## 推演要求（输出需贴合 TurnResultDTO，且 narrative 时间节奏按季度）\n';
    prompt += '请根据以上信息进行推演，生成结果并确保以下字段可被前端直接消费：\n';
    prompt += '1. Narrative：描述本回合（季度）的关键事件与因果链路，叙事中应包含 events 的 keyword。\n';
    prompt += '2. Hexagram：给出本回合的卦象 { name, omen(positive|neutral|negative), lines[6], text, colorHint }，用于顶部卦象组件；可省略动画。\n';
    prompt += '3. Ledger：财务核算中心字段 { startingCash, passiveIncome, passiveExpense, decisionCost, balance }，区分持续性被动收支与一次性决策成本。\n';
    prompt += '4. EntityPanels：逐个主体给出属性面板，包括 id、名称、现金、市场份额、品牌声誉、创新、被动收入/支出、delta 变化、是否破产；如有信用评级和配色，可提供 creditRating / paletteKey / accentColor。主体数量由房间配置决定，不要假定固定 ABCD；标识符不要使用 emoji。\n';
    prompt += '5. Leaderboard：按综合得分给出名次与分数，标注 rankChange。\n';
    prompt += '6. Options：给出 3 个策略选项 { id,title,description,expectedDelta }，expectedDelta 用于显示资源变动预期；可追加玩家自定义输入框不替代。\n';
    prompt += '7. 风险/机会/效益：riskCard / opportunityCard / benefitCard 三张卡片的简短总结。\n';
    prompt += '8. Achievements：列出本回合解锁的成就（指明主体与触发原因）。\n';
    prompt += '9. BranchingNarratives：可选，若有多线分支决策，提供字符串数组保留分支线索。\n';
    prompt += '10. NextRoundHints：仅提示方向，不代替玩家决策。\n';
    prompt += '11. 现金流安全：若余额接近被动支出临界，请在 riskCard 或 events 中明确警示。\n';
    prompt += '\n请以 JSON 为主进行输出，字段名需与上述一致（若服务端已启用 JSON Mode，可直接输出对象）。\n';

    logger.info(`Prompt built successfully`, {
      promptLength: prompt.length,
      hasDecisions: decisions && decisions.length > 0,
      decisionsCount: decisions?.length || 0,
      hasActiveEvents: activeEvents && activeEvents.length > 0,
      activeEventsCount: activeEvents?.length || 0,
      hasGameRules: !!gameRules && gameRules.trim().length > 0,
    });

    return prompt;
  }

  /**
   * 根据配置构建请求体
   */
  buildRequestBody(config: AIConfig, prompt: string): Record<string, unknown> {
    const { bodyTemplate } = config;

    if (bodyTemplate && typeof bodyTemplate === 'object') {
      try {
        // 如果有模板，使用模板并替换占位符
        const body = JSON.parse(JSON.stringify(bodyTemplate));

        // 记录原始模板
        logger.info(`Using bodyTemplate for AI request`, {
          templateKeys: Object.keys(body),
          hasMessages: 'messages' in body,
          templatePreview: JSON.stringify(body).substring(0, 300),
        });

        // 递归替换占位符的函数
        const replacePlaceholders = (obj: any): any => {
          if (typeof obj === 'string') {
            // 如果是字符串，检查是否包含占位符
            if (obj === '{{prompt}}' || obj === '{{PROMPT}}') {
              return prompt;
            }
            // 如果字符串中包含占位符（作为子字符串），也进行替换
            return obj
              .replace(/\{\{prompt\}\}/g, prompt)
              .replace(/\{\{PROMPT\}\}/g, prompt);
          } else if (Array.isArray(obj)) {
            // 如果是数组，递归处理每个元素
            return obj.map(item => replacePlaceholders(item));
          } else if (obj !== null && typeof obj === 'object') {
            // 如果是对象，递归处理每个属性
            const result: any = {};
            for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = replacePlaceholders(obj[key]);
              }
            }
            return result;
          }
          return obj;
        };

        const result = replacePlaceholders(body);
        
        // 验证结果
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid bodyTemplate: result is not an object');
        }

        // 记录构建后的请求体（不记录完整内容，只记录结构）
        logger.info(`Request body built from template`, {
          keys: Object.keys(result),
          hasMessages: 'messages' in result,
          messagesCount: Array.isArray(result.messages) ? result.messages.length : 0,
          model: result.model || 'not set',
          requestBodyPreview: JSON.stringify(result).substring(0, 500),
        });

        return result;
      } catch (error: any) {
        logger.error(`Failed to process bodyTemplate`, {
          error: error.message,
          bodyTemplateType: typeof bodyTemplate,
          stack: error.stack,
        });
        throw new Error(`bodyTemplate处理失败: ${error.message}`);
      }
    }

    // 默认请求体格式（OpenAI风格）
    logger.info(`Using default request body format (OpenAI style)`);
    return {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个游戏推演引擎，根据玩家的决策和游戏规则，生成游戏剧情和结果。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    };
  }

  /**
   * 调用AI API
   */
  async callAI(
    config: AIConfig,
    prompt: string,
    retries = this.defaultRetries
  ): Promise<InferenceResult['result']> {
    if (!config.endpoint) {
      throw new Error('AI API endpoint not configured');
    }

    // 构建请求体
    const requestBody = this.buildRequestBody(config, prompt);
    logger.info(`Prepared request body for AI API call`, {
      endpoint: config.endpoint,
      provider: config.provider,
      bodyKeys: Object.keys(requestBody),
      promptLength: prompt.length,
    });

    // Check if streaming is enabled and disable it if so (backend doesn't support streaming yet)
    const isStreaming = requestBody.stream === true;
    if (isStreaming) {
      logger.warn(`Stream mode is enabled but backend doesn't support streaming yet. Setting stream=false for this request.`);
      requestBody = { ...requestBody, stream: false };
    }

    let axiosConfig: AxiosRequestConfig = {
      method: 'POST',
      url: config.endpoint,
      headers: {
        'Content-Type': 'application/json',
        ...((config.headers as Record<string, string>) || {}),
      },
      data: requestBody,
      timeout: this.defaultTimeout,
    };

    // 记录请求配置（不记录敏感信息）
    logger.info(`AI API request config prepared`, {
      method: axiosConfig.method,
      url: axiosConfig.url,
      headersKeys: Object.keys(axiosConfig.headers || {}),
      hasData: !!requestBody,
      timeout: axiosConfig.timeout,
      isStreamingRequest: isStreaming,
      requestBodyStructure: requestBody ? {
        keys: Object.keys(requestBody),
        model: requestBody.model,
        hasMessages: 'messages' in requestBody,
        messagesCount: Array.isArray(requestBody.messages) ? requestBody.messages.length : 0,
        messagesPreview: Array.isArray(requestBody.messages) 
          ? requestBody.messages.map((m: any) => ({
              role: m.role,
              contentLength: m.content?.length || 0,
              contentPreview: m.content?.substring(0, 100) || '',
            }))
          : [],
        temperature: requestBody.temperature,
        maxTokens: requestBody.max_tokens || requestBody.maxTokens,
        stream: requestBody.stream,
      } : null,
    });

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.info(`Calling AI API (attempt ${attempt}/${retries}): ${config.endpoint}`);
        
        const response = await axios(axiosConfig);

        // Log the raw response for debugging
        logger.info(`AI API response received (attempt ${attempt}/${retries})`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.keys(response.headers || {}),
          dataType: typeof response.data,
          dataKeys: typeof response.data === 'object' && response.data !== null ? Object.keys(response.data) : 'N/A',
          responsePreview: typeof response.data === 'string' 
            ? response.data.substring(0, 500) 
            : JSON.stringify(response.data).substring(0, 500),
        });

        // 解析响应（根据不同的AI服务提供商可能有不同的格式）
        const parsed = this.parseResponse(response.data, config.provider || 'default');
        
        logger.info(`AI API response parsed successfully`, {
          hasNarrative: !!parsed.narrative,
          narrativeLength: parsed.narrative?.length || 0,
          outcomesCount: parsed.outcomes?.length || 0,
          eventsCount: parsed.events?.length || 0,
          parsedKeys: Object.keys(parsed),
        });
        
        return parsed;
      } catch (error: any) {
        lastError = error;
        
        // 构建详细的错误信息
        let errorMessage = error.message || 'Unknown error';
        
        if (error.response) {
          // HTTP错误响应
          const status = error.response.status;
          const data = error.response.data;
          
          if (status === 401) {
            errorMessage = 'API密钥无效或已过期，请检查Authorization头配置';
          } else if (status === 404) {
            errorMessage = 'API端点不存在，请检查endpoint配置';
          } else if (status === 429) {
            errorMessage = 'API调用频率超限，请稍后重试';
          } else if (status >= 500) {
            errorMessage = `API服务器错误 (${status})，请稍后重试`;
          } else {
            errorMessage = `API请求失败 (${status}): ${JSON.stringify(data)}`;
          }
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          errorMessage = '无法连接到API服务器，请检查endpoint地址和网络连接';
        } else if (error.code === 'ETIMEDOUT') {
          errorMessage = '连接超时，请检查网络或增加超时时间';
        }
        
        logger.warn(`AI API call failed (attempt ${attempt}/${retries}): ${errorMessage}`, {
          endpoint: config.endpoint,
          errorCode: error.code,
          statusCode: error.response?.status,
          responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'N/A',
          responseHeaders: error.response?.headers ? Object.keys(error.response.headers) : 'N/A',
        });

        if (attempt < retries) {
          // 指数退避重试
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const finalError = new Error(`AI API调用失败（已重试${retries}次）: ${lastError?.message || 'Unknown error'}`);
    (finalError as any).originalError = lastError;
    throw finalError;
  }

  /**
   * 解析AI响应（支持多种格式）
   */
  private parseResponse(data: unknown, provider: string): InferenceResult['result'] {
    logger.info(`Parsing AI response for provider: ${provider}`, {
      dataType: typeof data,
      isNull: data === null,
      isArray: Array.isArray(data),
      keys: typeof data === 'object' && data !== null ? Object.keys(data) : 'N/A',
      fullDataPreview: typeof data === 'string' 
        ? data.substring(0, 1000) 
        : JSON.stringify(data).substring(0, 1000),
    });
    
    if (typeof data !== 'object' || data === null) {
      logger.warn(`AI response is not an object for provider: ${provider}, using default format`, {
        dataType: typeof data,
        dataPreview: typeof data === 'string' ? data.substring(0, 200) : String(data),
      });
      return {
        narrative: typeof data === 'string' ? data : JSON.stringify(data),
      };
    }

    const obj = data as Record<string, unknown>;

    // OpenAI/DeepSeek格式：{ choices: [{ message: { content: "..." } }] }
    // DeepSeek API 使用与 OpenAI 兼容的格式
    if (provider === 'openai' || provider === 'deepseek' || provider === 'default') {
      if (obj.choices && Array.isArray(obj.choices) && obj.choices.length > 0) {
        const choice = obj.choices[0] as Record<string, unknown>;
        if (choice.message && typeof choice.message === 'object') {
          const message = choice.message as Record<string, unknown>;
          if (message.content && typeof message.content === 'string') {
            return this.parseNarrativeResponse(message.content);
          }
        }
      }

      // 直接返回结果格式
      if (obj.result) {
        return obj.result as InferenceResult['result'];
      }

      // 如果响应本身就是结果格式
      if (obj.narrative || obj.outcomes) {
        return obj as InferenceResult['result'];
      }
    }

    // 其他提供商的解析逻辑可以在这里添加
    // 例如：anthropic, google, custom等

    // 如果无法解析，尝试通用解析
    logger.warn(`Unable to parse AI response for provider: ${provider}, attempting generic parse`, {
      responseKeys: Object.keys(obj),
      responsePreview: JSON.stringify(obj).substring(0, 200),
    });

    // 尝试通用解析：查找可能的 content 字段
    if (obj.content && typeof obj.content === 'string') {
      return this.parseNarrativeResponse(obj.content);
    }

    // 如果完全无法解析，返回默认格式
    return {
      narrative: typeof data === 'string' ? data : JSON.stringify(data),
    };
  }

  /**
   * 解析文本格式的推演结果
   */
  private parseNarrativeResponse(content: string): InferenceResult['result'] {
    // 简单的文本解析逻辑
    // 实际项目中可以使用更复杂的解析，比如JSON提取、Markdown解析等

    return {
      narrative: content,
      // 可以尝试从文本中提取结构化信息
      outcomes: [],
      events: [],
    };
  }

  /**
   * 执行推演（完整流程）
   */
  async performInference(
    config: AIConfig,
    request: InferenceRequest
  ): Promise<InferenceResult['result']> {
    logger.info(`Building prompt for session ${request.sessionId}, round ${request.round}`, {
      decisionsCount: request.decisions?.length || 0,
      activeEventsCount: request.activeEvents?.length || 0,
      gameRulesLength: request.gameRules?.length || 0,
    });

    const prompt = this.buildPrompt(request, request.gameRules);
    logger.info(`Built prompt for session ${request.sessionId}, round ${request.round}`, {
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 200) + '...',
    });

    logger.info(`Calling AI API for session ${request.sessionId}, round ${request.round}`, {
      endpoint: config.endpoint,
      provider: config.provider,
    });

    const result = await this.callAI(config, prompt);
    
    logger.info(`AI inference completed for session ${request.sessionId}, round ${request.round}`, {
      hasNarrative: !!result.narrative,
      narrativeLength: result.narrative?.length || 0,
      outcomesCount: result.outcomes?.length || 0,
      eventsCount: result.events?.length || 0,
    });

    return result;
  }

  /**
   * Generate decision options for a player
   * Build prompt, call AI API, and parse JSON response
   */
  async generateDecisionOptions(
    config: AIConfig,
    gameRules: string,
    gameState: Record<string, unknown> | null,
    playerInfo: {
      playerIndex: number;
      username: string;
      nickname?: string;
      resources?: Record<string, unknown>;
      attributes?: Record<string, unknown>;
      recentDecisions?: Array<{ round: number; actionText?: string }>;
    },
    otherPlayersInfo?: Array<{
      playerIndex: number;
      username: string;
      resources?: Record<string, unknown>;
      attributes?: Record<string, unknown>;
    }>,
    activeEvents?: Array<{
      eventType: string;
      eventContent: string;
      effectiveRounds: number;
    }>
  ): Promise<Array<{
    option_id: string;
    text: string;
    expected_effect: string;
    category: string;
  }>> {
    // Build prompt for generating decision options
    let prompt = `# Generate Decision Options\n\n`;
    
    if (gameRules && gameRules.trim()) {
      prompt += `## Game Rules\n${gameRules.trim()}\n\n`;
    }

    if (gameState) {
      prompt += `## Current Game State\n${JSON.stringify(gameState, null, 2)}\n\n`;
    }

    prompt += `## Player Information\n`;
    prompt += `- Player Index: ${playerInfo.playerIndex}\n`;
    prompt += `- Player Name: ${playerInfo.username}${playerInfo.nickname ? ` (${playerInfo.nickname})` : ''}\n`;
    
    if (playerInfo.resources) {
      prompt += `- Current Resources: ${JSON.stringify(playerInfo.resources)}\n`;
    }
    if (playerInfo.attributes) {
      prompt += `- Current Attributes: ${JSON.stringify(playerInfo.attributes)}\n`;
    }
    if (playerInfo.recentDecisions && playerInfo.recentDecisions.length > 0) {
      prompt += `- Recent Decisions:\n`;
      playerInfo.recentDecisions.slice(-3).forEach(decision => {
        prompt += `  - Round ${decision.round}: ${decision.actionText || 'N/A'}\n`;
      });
    }

    if (otherPlayersInfo && otherPlayersInfo.length > 0) {
      prompt += `\n## Other Players Status\n`;
      otherPlayersInfo.forEach(player => {
        prompt += `- Player ${player.playerIndex} (${player.username}): `;
        if (player.resources) {
          prompt += `Resources: ${JSON.stringify(player.resources)}`;
        }
        if (player.attributes) {
          prompt += ` Attributes: ${JSON.stringify(player.attributes)}`;
        }
        prompt += `\n`;
      });
    }

    if (activeEvents && activeEvents.length > 0) {
      prompt += `\n## Active Events\n`;
      activeEvents.forEach(event => {
        prompt += `- [${event.eventType}] ${event.eventContent} (Effective: ${event.effectiveRounds} rounds)\n`;
      });
    }

    prompt += `\n## Task\n`;
    prompt += `Please generate 3-4 decision options for player ${playerInfo.playerIndex}. Requirements:\n`;
    prompt += `1. Options should be based on current game state, feasible and relevant\n`;
    prompt += `2. Options should be diverse, covering different strategic directions (attack/defense/cooperation/explore/trade)\n`;
    prompt += `3. Each option should include:\n`;
    prompt += `   - text: Brief and clear option text (10-20 characters)\n`;
    prompt += `   - expected_effect: Description of possible effects\n`;
    prompt += `   - category: One of (attack, defense, cooperation, explore, trade)\n`;
    prompt += `4. Options must comply with game rules and not contain illegal operations\n\n`;
    prompt += `## Response Format (JSON only)\n`;
    prompt += `{\n`;
    prompt += `  "options": [\n`;
    prompt += `    {\n`;
    prompt += `      "option_id": "1",\n`;
    prompt += `      "text": "Option text here",\n`;
    prompt += `      "expected_effect": "Expected effect description",\n`;
    prompt += `      "category": "attack|defense|cooperation|explore|trade"\n`;
    prompt += `    }\n`;
    prompt += `  ]\n`;
    prompt += `}\n`;

    try {
      logger.info(`Generating decision options for player ${playerInfo.playerIndex}`, {
        promptLength: prompt.length,
      });

      // Call AI API
      const result = await this.callAI(config, prompt);

      // Parse the narrative/result to extract JSON
      let optionsArray: Array<{
        option_id: string;
        text: string;
        expected_effect: string;
        category: string;
      }> = [];

      if (result.narrative) {
        // Try to extract JSON from narrative text
        const jsonMatch = result.narrative.match(/\{[\s\S]*"options"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.options && Array.isArray(parsed.options)) {
              optionsArray = parsed.options;
            }
          } catch (parseError) {
            logger.warn(`Failed to parse JSON from narrative`, { error: parseError });
          }
        }
      }

      // If no options found, return empty array
      if (optionsArray.length === 0) {
        logger.warn(`No valid options generated for player ${playerInfo.playerIndex}`);
        return [];
      }

      logger.info(`Generated ${optionsArray.length} decision options for player ${playerInfo.playerIndex}`);
      return optionsArray.slice(0, 4); // Limit to max 4 options
    } catch (error: any) {
      logger.error(`Failed to generate decision options`, {
        error: error.message,
        playerIndex: playerInfo.playerIndex,
      });
      // Return empty array on error, don't throw
      return [];
    }
  }
}

export const aiService = AIService.getInstance();

