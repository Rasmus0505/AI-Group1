/**
 * AI推演引擎服务
 * 封装AI API调用、Prompt构建、结果解析等功能
 * 支持跨回合的对话历史记忆
 */

import axios, { AxiosRequestConfig } from 'axios';
import https from 'https';
import http from 'http';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 对话历史消息格式
interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 历史记忆配置
interface HistoryConfig {
  enabled: boolean;           // 是否启用历史记忆
  maxRounds: number;          // 最多保留多少回合的历史
  maxTokens: number;          // 最大 token 数限制（粗略估算）
  summarizeOldRounds: boolean; // 是否对旧回合进行摘要压缩
}

// Lorebook 条目 - 关键词触发式长期记忆
interface LorebookEntry {
  id: string;
  keywords: string[];         // 触发关键词
  content: string;            // 注入的内容
  priority: number;           // 优先级（高优先级先注入）
  enabled: boolean;
  category: 'entity' | 'event' | 'rule' | 'relationship' | 'world';
  maxActivations?: number;    // 最大激活次数（可选）
  activationCount?: number;   // 已激活次数
}

// 创建自定义 HTTPS Agent，增加连接稳定性
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  timeout: 120000,
  maxSockets: 10,
  maxFreeSockets: 5,
  // 允许自签名证书（如果需要）
  rejectUnauthorized: true,
});

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  timeout: 120000,
  maxSockets: 10,
  maxFreeSockets: 5,
});

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
  // 游戏初始化数据（主持人配置生成的）
  gameInitData?: {
    backgroundStory?: string;
    entities?: Array<{
      id: string;
      name: string;
      cash: number;
      attributes?: Record<string, number>;
      passiveIncome?: number;
      passiveExpense?: number;
      backstory?: string;
    }>;
    yearlyHexagram?: {
      name: string;
      omen: string;
      lines: Array<string>;
      text: string;
      yearlyTheme?: string;
    };
  };
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
  private defaultRetries = 5;  // 增加重试次数（采用main分支的改进）
  private defaultTimeout = 120000; // 120秒超时（采用main分支的改进）
  private initTimeout = 300000; // 初始化任务5分钟超时，与前端保持一致（保留你的改进）

  // 历史记忆默认配置
  private defaultHistoryConfig: HistoryConfig = {
    enabled: true,
    maxRounds: 10,       // 调高：保留最近10回合的完整历史
    maxTokens: 16000,    // 调高：支持更大的上下文窗口
    summarizeOldRounds: true,
  };

  // Lorebook 缓存（按 sessionId 存储）
  private lorebookCache: Map<string, LorebookEntry[]> = new Map();

  private constructor() { }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * 保存对话历史到数据库
   */
  async saveConversationHistory(
    sessionId: string,
    round: number,
    messages: ConversationMessage[]
  ): Promise<void> {
    try {
      const records = messages.map(msg => ({
        sessionId,
        round,
        role: msg.role,
        content: msg.content,
        tokenCount: this.estimateTokenCount(msg.content),
      }));

      await prisma.aIConversationHistory.createMany({
        data: records,
      });

      logger.info(`Saved ${messages.length} conversation messages for session ${sessionId}, round ${round}`);
    } catch (error: any) {
      logger.error(`Failed to save conversation history`, {
        error: error.message,
        sessionId,
        round,
      });
    }
  }

  /**
   * 获取历史对话记录
   */
  async getConversationHistory(
    sessionId: string,
    currentRound: number,
    config: Partial<HistoryConfig> = {}
  ): Promise<ConversationMessage[]> {
    const historyConfig = { ...this.defaultHistoryConfig, ...config };

    if (!historyConfig.enabled) {
      return [];
    }

    try {
      // 获取最近 N 回合的历史
      const minRound = Math.max(1, currentRound - historyConfig.maxRounds);
      
      const history = await prisma.aIConversationHistory.findMany({
        where: {
          sessionId,
          round: {
            gte: minRound,
            lt: currentRound, // 不包含当前回合
          },
        },
        orderBy: [
          { round: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      if (history.length === 0) {
        return [];
      }

      // 转换为消息格式
      let messages: ConversationMessage[] = history.map((h: any) => ({
        role: h.role as 'system' | 'user' | 'assistant',
        content: h.content,
      }));

      // 估算总 token 数，如果超出限制则进行压缩
      let totalTokens = messages.reduce((sum, m) => sum + this.estimateTokenCount(m.content), 0);

      if (totalTokens > historyConfig.maxTokens && historyConfig.summarizeOldRounds) {
        messages = this.compressHistory(messages, historyConfig.maxTokens);
        totalTokens = messages.reduce((sum, m) => sum + this.estimateTokenCount(m.content), 0);
      }

      logger.info(`Retrieved conversation history for session ${sessionId}`, {
        currentRound,
        historyRounds: `${minRound} - ${currentRound - 1}`,
        messageCount: messages.length,
        estimatedTokens: totalTokens,
      });

      return messages;
    } catch (error: any) {
      logger.error(`Failed to get conversation history`, {
        error: error.message,
        sessionId,
        currentRound,
      });
      return [];
    }
  }

  /**
   * 压缩历史记录（保留最近的完整记录，对旧记录进行摘要）
   */
  private compressHistory(
    messages: ConversationMessage[],
    maxTokens: number
  ): ConversationMessage[] {
    // 按回合分组（假设每回合有 user + assistant 两条消息）
    const rounds: ConversationMessage[][] = [];
    let currentRoundMessages: ConversationMessage[] = [];

    for (const msg of messages) {
      currentRoundMessages.push(msg);
      if (msg.role === 'assistant') {
        rounds.push([...currentRoundMessages]);
        currentRoundMessages = [];
      }
    }
    if (currentRoundMessages.length > 0) {
      rounds.push(currentRoundMessages);
    }

    // 从最新的回合开始保留，直到达到 token 限制
    const result: ConversationMessage[] = [];
    let currentTokens = 0;
    const summaries: string[] = [];

    // 先保留最近的完整回合
    for (let i = rounds.length - 1; i >= 0; i--) {
      const roundMessages = rounds[i];
      const roundTokens = roundMessages.reduce((sum, m) => sum + this.estimateTokenCount(m.content), 0);

      if (currentTokens + roundTokens <= maxTokens * 0.7) {
        // 还有空间，保留完整记录
        result.unshift(...roundMessages);
        currentTokens += roundTokens;
      } else {
        // 空间不足，生成摘要
        const summary = this.summarizeRound(roundMessages);
        summaries.unshift(summary);
      }
    }

    // 如果有摘要，添加到开头
    if (summaries.length > 0) {
      const summaryMessage: ConversationMessage = {
        role: 'system',
        content: `【历史回合摘要】\n${summaries.join('\n')}`,
      };
      result.unshift(summaryMessage);
    }

    return result;
  }

  /**
   * 对单个回合的消息生成摘要
   */
  private summarizeRound(messages: ConversationMessage[]): string {
    // 提取关键信息
    const userContent = messages.find(m => m.role === 'user')?.content || '';
    const assistantContent = messages.find(m => m.role === 'assistant')?.content || '';

    // 从 user 消息中提取回合号
    const roundMatch = userContent.match(/第\s*(\d+)\s*回合/);
    const roundNum = roundMatch ? roundMatch[1] : '?';

    // 从 assistant 响应中提取关键事件（简化版）
    let keyEvents = '';
    try {
      const jsonMatch = assistantContent.match(/```json\s*([\s\S]*?)```/i);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.events && Array.isArray(parsed.events)) {
          keyEvents = parsed.events.slice(0, 3).map((e: any) => e.keyword || e.description).join('、');
        }
        if (parsed.narrative) {
          // 提取叙事的前100字作为摘要
          keyEvents = keyEvents || parsed.narrative.substring(0, 100) + '...';
        }
      }
    } catch {
      // 解析失败，使用简单截取
      keyEvents = assistantContent.substring(0, 100) + '...';
    }

    return `第${roundNum}回合: ${keyEvents}`;
  }

  /**
   * 粗略估算 token 数量（中文约 2 字符/token，英文约 4 字符/token）
   */
  private estimateTokenCount(text: string): number {
    if (!text) return 0;
    // 简单估算：中文字符数 + 英文单词数
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const numbers = (text.match(/\d+/g) || []).length;
    return Math.ceil(chineseChars / 1.5 + englishWords + numbers);
  }

  /**
   * 清理会话的历史记录（游戏结束时调用）
   */
  async clearConversationHistory(sessionId: string): Promise<void> {
    try {
      const result = await prisma.aIConversationHistory.deleteMany({
        where: { sessionId },
      });
      // 同时清理 Lorebook 缓存
      this.lorebookCache.delete(sessionId);
      logger.info(`Cleared ${result.count} conversation history records for session ${sessionId}`);
    } catch (error: any) {
      logger.error(`Failed to clear conversation history`, {
        error: error.message,
        sessionId,
      });
    }
  }

  // ==================== Lorebook 长期记忆系统 ====================

  /**
   * 初始化 Lorebook（从游戏初始化数据生成）
   * Lorebook 是一种关键词触发式的长期记忆，当 prompt 中出现特定关键词时自动注入相关背景
   */
  initializeLorebook(
    sessionId: string,
    gameInitData?: InferenceRequest['gameInitData'],
    customEntries?: LorebookEntry[]
  ): void {
    const entries: LorebookEntry[] = [];

    // 从游戏初始化数据自动生成 Lorebook 条目
    if (gameInitData) {
      // 1. 主体信息条目
      if (gameInitData.entities) {
        gameInitData.entities.forEach((entity, index) => {
          entries.push({
            id: `entity_${entity.id}`,
            keywords: [entity.name, entity.id, `主体${entity.id}`],
            content: this.buildEntityLoreContent(entity),
            priority: 100 - index, // 主体信息高优先级
            enabled: true,
            category: 'entity',
          });
        });
      }

      // 2. 背景故事条目（分段）
      if (gameInitData.backgroundStory) {
        const storySegments = this.segmentBackgroundStory(gameInitData.backgroundStory);
        storySegments.forEach((segment, index) => {
          entries.push({
            id: `story_${index}`,
            keywords: segment.keywords,
            content: segment.content,
            priority: 50 - index,
            enabled: true,
            category: 'world',
          });
        });
      }

      // 3. 年度卦象条目
      if (gameInitData.yearlyHexagram) {
        const hex = gameInitData.yearlyHexagram;
        entries.push({
          id: 'yearly_hexagram',
          keywords: ['卦象', '周易', hex.name, '年度', '运势'],
          content: `【年度卦象：${hex.name}】\n吉凶：${hex.omen}\n象曰：${hex.text}\n${hex.yearlyTheme ? `年度主题：${hex.yearlyTheme}` : ''}`,
          priority: 80,
          enabled: true,
          category: 'world',
        });
      }
    }

    // 添加自定义条目
    if (customEntries) {
      entries.push(...customEntries);
    }

    this.lorebookCache.set(sessionId, entries);
    logger.info(`Initialized Lorebook for session ${sessionId}`, {
      entryCount: entries.length,
      categories: [...new Set(entries.map(e => e.category))],
    });
  }

  /**
   * 构建主体的 Lore 内容
   */
  private buildEntityLoreContent(entity: {
    id: string;
    name: string;
    cash: number;
    attributes?: Record<string, number>;
    passiveIncome?: number;
    passiveExpense?: number;
    backstory?: string;
  }): string {
    let content = `【${entity.name}（${entity.id}）档案】\n`;
    content += `初始资金：¥${entity.cash?.toLocaleString() || 0}\n`;
    if (entity.passiveIncome) content += `被动收入：+¥${entity.passiveIncome.toLocaleString()}/回合\n`;
    if (entity.passiveExpense) content += `被动支出：-¥${entity.passiveExpense.toLocaleString()}/回合\n`;
    if (entity.attributes) {
      content += `属性：${Object.entries(entity.attributes).map(([k, v]) => `${k}=${v}`).join(', ')}\n`;
    }
    if (entity.backstory) content += `背景：${entity.backstory}\n`;
    return content;
  }

  /**
   * 将背景故事分段并提取关键词
   */
  private segmentBackgroundStory(story: string): Array<{ keywords: string[]; content: string }> {
    // 按段落分割
    const paragraphs = story.split(/\n\n+/).filter(p => p.trim().length > 50);
    
    return paragraphs.map(paragraph => {
      // 提取关键词（简单实现：提取名词性词汇）
      const keywords: string[] = [];
      
      // 提取引号内的内容作为关键词
      const quotedMatches = paragraph.match(/[「『""]([^」』""]+)[」』""]/g);
      if (quotedMatches) {
        keywords.push(...quotedMatches.map(m => m.slice(1, -1)));
      }
      
      // 提取可能的公司/人名（连续2-4个汉字）
      const nameMatches = paragraph.match(/[\u4e00-\u9fa5]{2,4}(?:公司|集团|企业|工业|科技|贸易)/g);
      if (nameMatches) {
        keywords.push(...nameMatches);
      }

      return {
        keywords: [...new Set(keywords)].slice(0, 5), // 最多5个关键词
        content: paragraph.length > 200 ? paragraph.substring(0, 200) + '...' : paragraph,
      };
    });
  }

  /**
   * 根据当前 prompt 内容匹配并注入 Lorebook 条目
   */
  getTriggeredLoreEntries(
    sessionId: string,
    promptContent: string,
    maxTokens: number = 2000
  ): string {
    const entries = this.lorebookCache.get(sessionId);
    if (!entries || entries.length === 0) {
      return '';
    }

    // 找出被触发的条目
    const triggeredEntries: LorebookEntry[] = [];
    
    for (const entry of entries) {
      if (!entry.enabled) continue;
      
      // 检查是否有关键词匹配
      const isTriggered = entry.keywords.some(keyword => 
        promptContent.includes(keyword)
      );
      
      if (isTriggered) {
        // 检查激活次数限制
        if (entry.maxActivations && (entry.activationCount || 0) >= entry.maxActivations) {
          continue;
        }
        triggeredEntries.push(entry);
        entry.activationCount = (entry.activationCount || 0) + 1;
      }
    }

    if (triggeredEntries.length === 0) {
      return '';
    }

    // 按优先级排序
    triggeredEntries.sort((a, b) => b.priority - a.priority);

    // 构建注入内容，控制 token 数量
    let loreContent = '【Lorebook 背景知识】\n';
    let currentTokens = this.estimateTokenCount(loreContent);

    for (const entry of triggeredEntries) {
      const entryTokens = this.estimateTokenCount(entry.content);
      if (currentTokens + entryTokens > maxTokens) {
        break;
      }
      loreContent += `\n${entry.content}\n`;
      currentTokens += entryTokens;
    }

    logger.info(`Triggered ${triggeredEntries.length} Lorebook entries for session ${sessionId}`, {
      triggeredIds: triggeredEntries.map(e => e.id),
      totalTokens: currentTokens,
    });

    return loreContent;
  }

  /**
   * 动态添加 Lorebook 条目（用于记录重要事件）
   */
  addLorebookEntry(sessionId: string, entry: LorebookEntry): void {
    const entries = this.lorebookCache.get(sessionId) || [];
    entries.push(entry);
    this.lorebookCache.set(sessionId, entries);
    
    logger.info(`Added Lorebook entry for session ${sessionId}`, {
      entryId: entry.id,
      keywords: entry.keywords,
      category: entry.category,
    });
  }

  /**
   * 从推演结果中提取重要事件并添加到 Lorebook
   */
  extractAndAddLoreFromResult(
    sessionId: string,
    round: number,
    result: InferenceResult['result']
  ): void {
    // 提取重要事件
    if (result.events && Array.isArray(result.events)) {
      result.events.forEach((event: any, index: number) => {
        // 只记录重要事件（如长期事件、重大变化）
        if (event.isLongTerm || event.type === 'negative' || event.type === 'positive') {
          this.addLorebookEntry(sessionId, {
            id: `event_r${round}_${index}`,
            keywords: [event.keyword, event.description?.substring(0, 10)].filter(Boolean),
            content: `【第${round}回合事件】${event.description || event.keyword}`,
            priority: 30,
            enabled: true,
            category: 'event',
          });
        }
      });
    }

    // 提取成就（使用 any 类型访问动态属性）
    const resultAny = result as any;
    if (resultAny.achievements && Array.isArray(resultAny.achievements)) {
      resultAny.achievements.forEach((ach: any) => {
        this.addLorebookEntry(sessionId, {
          id: `achievement_${ach.id}`,
          keywords: [ach.title, ach.entityId].filter(Boolean),
          content: `【成就解锁】${ach.entityId}: ${ach.title} - ${ach.description}`,
          priority: 40,
          enabled: true,
          category: 'event',
        });
      });
    }
  }

  // ==================== Lorebook 系统结束 ====================

  /**
   * 构建AI Prompt
   */
  buildPrompt(request: InferenceRequest, gameRules: string): string {
    const { decisions, activeEvents, currentRound, gameInitData } = request;

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

    // 游戏初始化数据（主持人配置生成的背景、主体、卦象）
    if (gameInitData) {
      // 背景故事
      if (gameInitData.backgroundStory) {
        prompt += `## 商业背景故事\n${gameInitData.backgroundStory}\n\n`;
      }

      // 主体信息（关键！告诉 AI 主体的名称和初始状态）
      if (gameInitData.entities && gameInitData.entities.length > 0) {
        prompt += `## 主体信息\n`;
        prompt += `本游戏共有 ${gameInitData.entities.length} 个决策主体，请严格使用以下主体名称和ID：\n\n`;
        gameInitData.entities.forEach((entity) => {
          prompt += `### 主体 ${entity.id}：${entity.name}\n`;
          prompt += `- 初始资金: ¥${entity.cash?.toLocaleString() || 0}\n`;
          if (entity.passiveIncome) {
            prompt += `- 被动收入: +¥${entity.passiveIncome.toLocaleString()}/回合\n`;
          }
          if (entity.passiveExpense) {
            prompt += `- 被动支出: -¥${entity.passiveExpense.toLocaleString()}/回合\n`;
          }
          if (entity.attributes) {
            const attrs = Object.entries(entity.attributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            prompt += `- 属性: ${attrs}\n`;
          }
          if (entity.backstory) {
            prompt += `- 背景: ${entity.backstory}\n`;
          }
          prompt += `\n`;
        });
        prompt += `**重要**: 在推演结果中，perEntityPanel 必须使用上述主体的 id 和 name，不要自行编造主体名称！\n\n`;
      }

      // 年度卦象
      if (gameInitData.yearlyHexagram) {
        const hex = gameInitData.yearlyHexagram;
        prompt += `## 年度卦象\n`;
        prompt += `- 卦名: ${hex.name}\n`;
        prompt += `- 吉凶: ${hex.omen === 'positive' ? '吉' : hex.omen === 'negative' ? '凶' : '中'}\n`;
        if (hex.lines) {
          prompt += `- 爻象: ${hex.lines.join(' ')}\n`;
        }
        if (hex.text) {
          prompt += `- 象曰: ${hex.text}\n`;
        }
        if (hex.yearlyTheme) {
          prompt += `- 年度主题: ${hex.yearlyTheme}\n`;
        }
        prompt += `\n请在推演叙事中适当融入卦象的意境和暗示。\n\n`;
      }
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
    prompt += `**重要**: 以下是本回合各主体玩家提交的实际决策，AI 必须基于这些决策内容进行推演，不要忽略或替换玩家的决策！\n\n`;
    if (decisions && decisions.length > 0) {
      decisions.forEach((decision) => {
        // 尝试匹配主体名称
        let entityName = decision.nickname || decision.username;
        if (gameInitData?.entities) {
          const matchedEntity = gameInitData.entities.find(
            (e, idx) => idx === decision.playerIndex || e.id === String(decision.playerIndex)
          );
          if (matchedEntity) {
            entityName = `${matchedEntity.name} (${matchedEntity.id})`;
          }
        }
        prompt += `### 主体 ${decision.playerIndex} - ${entityName} 的决策:\n`;
        if (decision.actionText) {
          prompt += `  **玩家输入的行动**: ${decision.actionText}\n`;
        }
        if (decision.selectedOptionIds) {
          prompt += `  **选择的选项ID**: ${JSON.stringify(decision.selectedOptionIds)}\n`;
        }
        if (decision.actionData) {
          prompt += `  **行动数据**: ${JSON.stringify(decision.actionData)}\n`;
        }
        if (decision.hostModified && decision.hostModification) {
          prompt += `  **[主持人修改]**: ${JSON.stringify(decision.hostModification)}\n`;
        }
        prompt += `\n`;
      });
      prompt += `**请务必在 narrative 叙事中体现上述玩家决策的执行过程和结果！**\n\n`;
    } else {
      prompt += `（当前回合暂无玩家决策，所有主体只结算被动收支）\n\n`;
    }

    // 推演要求：引导输出蓝本要求的结构
    prompt += '## 推演要求\n';
    prompt += '请根据以上信息进行推演，**必须以 JSON 格式输出**，确保可被前端直接解析。\n\n';
    prompt += '### 输出 JSON Schema:\n';
    prompt += '```json\n';
    prompt += '{\n';
    prompt += '  "roundTitle": "第X回合：20XX年上/下半年",\n';
    prompt += '  "narrative": "叙事文本，描述本回合关键事件与因果链路，时间节奏按季度/半年",\n';
    prompt += '  "events": [\n';
    prompt += '    {\n';
    prompt += '      "keyword": "事件关键词",\n';
    prompt += '      "type": "positive|negative|neutral",\n';
    prompt += '      "description": "事件描述",\n';
    prompt += '      "affectedEntities": ["A", "B"],\n';
    prompt += '      "isLongTerm": false,\n';
    prompt += '      "remainingRounds": 0\n';
    prompt += '    }\n';
    prompt += '  ],\n';
    prompt += '  "perEntityPanel": [\n';
    prompt += '    {\n';
    prompt += '      "id": "A",\n';
    prompt += '      "name": "主体中文名称",\n';
    prompt += '      "cash": 1000000,\n';
    prompt += '      "attributes": { "市场份额": 25, "品牌声誉": 70, "创新能力": 60 },\n';
    prompt += '      "passiveIncome": 50000,\n';
    prompt += '      "passiveExpense": 30000,\n';
    prompt += '      "delta": { "cash": 20000, "市场份额": 2 },\n';
    prompt += '      "broken": false,\n';
    prompt += '      "achievementsUnlocked": [],\n';
    prompt += '      "intelConfidence": 1.0\n';
    prompt += '    }\n';
    prompt += '  ],\n';
    prompt += '  "leaderboard": [\n';
    prompt += '    { "id": "A", "name": "名称", "score": 100, "rank": 1, "rankChange": 0 }\n';
    prompt += '  ],\n';
    prompt += '  "hexagram": {\n';
    prompt += '    "name": "卦名",\n';
    prompt += '    "omen": "positive|neutral|negative",\n';
    prompt += '    "lines": ["yang", "yin", "yang", "yang", "yin", "yang"],\n';
    prompt += '    "text": "象曰/解释文本"\n';
    prompt += '  },\n';
    prompt += '  "ledger": {\n';
    prompt += '    "startingCash": 1000000,\n';
    prompt += '    "passiveIncome": 50000,\n';
    prompt += '    "passiveExpense": 30000,\n';
    prompt += '    "decisionCost": 10000,\n';
    prompt += '    "balance": 1010000\n';
    prompt += '  },\n';
    prompt += '  "perEntityOptions": {\n';
    prompt += '    "A": [\n';
    prompt += '      {\n';
    prompt += '        "id": "A1",\n';
    prompt += '        "title": "针对主体A当前局势的选项标题",\n';
    prompt += '        "description": "基于主体A本回合决策结果和当前状态生成的策略建议",\n';
    prompt += '        "expectedDelta": { "cash": -50000, "市场份额": 5 },\n';
    prompt += '        "category": "attack|defense|cooperation|explore|trade",\n';
    prompt += '        "riskLevel": "low|medium|high"\n';
    prompt += '      }\n';
    prompt += '    ],\n';
    prompt += '    "B": [\n';
    prompt += '      {\n';
    prompt += '        "id": "B1",\n';
    prompt += '        "title": "针对主体B当前局势的选项标题",\n';
    prompt += '        "description": "基于主体B本回合决策结果和当前状态生成的策略建议",\n';
    prompt += '        "expectedDelta": { "cash": -30000, "品牌声誉": 3 },\n';
    prompt += '        "category": "attack|defense|cooperation|explore|trade",\n';
    prompt += '        "riskLevel": "low|medium|high"\n';
    prompt += '      }\n';
    prompt += '    ]\n';
    prompt += '  },\n';
    prompt += '  // 注意：perEntityOptions 为每个主体单独生成3个策略选项，基于该主体本回合的实际决策结果\n';
    prompt += '  // expectedDelta 中 cash 是实际金额（如 -50000 表示减少5万元），\n';
    prompt += '  // 其他属性是百分点变化（如 市场份额: 5 表示增加5个百分点，不是5%）\n';
    prompt += '  "riskCard": "企业风险简评",\n';
    prompt += '  "opportunityCard": "企业机会简评",\n';
    prompt += '  "benefitCard": "当前效益简评",\n';
    prompt += '  "achievements": [\n';
    prompt += '    { "id": "ach_1", "entityId": "A", "title": "成就标题", "description": "成就描述", "triggerReason": "触发原因" }\n';
    prompt += '  ],\n';
    prompt += '  "branchingNarratives": ["分支线索1", "分支线索2"],\n';
    prompt += '  "nextRoundHints": "下回合提示（仅提示方向，不代替玩家决策）",\n';
    prompt += '  "cashFlowWarning": [\n';
    prompt += '    { "entityId": "B", "message": "现金流警告信息", "severity": "warning|critical" }\n';
    prompt += '  ]\n';
    prompt += '}\n';
    prompt += '```\n\n';
    prompt += '### 关键要求:\n';
    prompt += '1. **必须输出有效 JSON**，用 ```json 代码块包裹\n';
    prompt += '2. **必须基于玩家提交的实际决策进行推演**，narrative 叙事中要体现玩家决策的执行和结果\n';
    prompt += '3. narrative 中应包含 events 的 keyword，便于前端高亮\n';
    prompt += '4. perEntityPanel 数量必须与房间配置的主体数量一致\n';
    prompt += '5. 未收到指令的主体只结算被动收支，不触发主动事件\n';
    prompt += '6. 若余额接近被动支出临界，必须在 cashFlowWarning 中警示\n';
    prompt += '7. **perEntityOptions 必须为每个主体单独生成3个策略选项**：\n';
    prompt += '   - 选项必须基于该主体**本回合实际执行的决策结果**来生成\n';
    prompt += '   - 不要把上回合的预设选项照搬，而是根据当前局势动态生成新选项\n';
    prompt += '   - 每个主体的选项应该反映其独特的处境、资源状况和战略机会\n';
    prompt += '   - 选项ID格式为"主体ID+序号"，如A1、A2、A3、B1、B2、B3\n';
    prompt += '8. 主体 id 使用 A/B/C/D，不要使用 emoji\n';

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
   * 根据配置构建请求体（支持历史消息）
   */
  buildRequestBody(
    config: AIConfig,
    prompt: string,
    historyMessages: ConversationMessage[] = []
  ): Record<string, unknown> {
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
          historyMessageCount: historyMessages.length,
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

        // 如果有历史消息且结果中有 messages 数组，插入历史
        if (historyMessages.length > 0 && Array.isArray(result.messages)) {
          // 找到 system 消息的位置，在其后插入历史
          const systemIndex = result.messages.findIndex((m: any) => m.role === 'system');
          const insertIndex = systemIndex >= 0 ? systemIndex + 1 : 0;
          
          // 插入历史消息
          result.messages.splice(insertIndex, 0, ...historyMessages);
          
          logger.info(`Inserted ${historyMessages.length} history messages into request`, {
            totalMessages: result.messages.length,
          });
        }

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

    // 默认请求体格式（OpenAI风格）- 包含历史消息
    logger.info(`Using default request body format (OpenAI style)`, {
      historyMessageCount: historyMessages.length,
    });

    const messages: ConversationMessage[] = [
      {
        role: 'system',
        content: '你是一个游戏推演引擎，根据玩家的决策和游戏规则，生成游戏剧情和结果。你需要保持游戏世界的连贯性，记住之前回合发生的事件和决策结果。',
      },
      ...historyMessages,
      {
        role: 'user',
        content: prompt,
      },
    ];

    return {
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 8000,
    };
  }

  /**
   * 调用AI API（支持历史消息）
   */
  async callAI(
    config: AIConfig,
    prompt: string,
    retries = this.defaultRetries,
    timeout?: number,
    historyMessages: ConversationMessage[] = []
  ): Promise<InferenceResult['result']> {
    if (!config.endpoint) {
      throw new Error('AI API endpoint not configured');
    }

    // 构建请求体（包含历史消息）
    let requestBody = this.buildRequestBody(config, prompt, historyMessages);
    logger.info(`Prepared request body for AI API call`, {
      endpoint: config.endpoint,
      provider: config.provider,
      bodyKeys: Object.keys(requestBody),
      promptLength: prompt.length,
      historyMessageCount: historyMessages.length,
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
        'Connection': 'keep-alive',
        ...((config.headers as Record<string, string>) || {}),
      },
      data: requestBody,
      timeout: timeout || this.defaultTimeout,  // 保留灵活的超时参数
      // 使用自定义 Agent 增加连接稳定性（采用main分支的改进）
      httpAgent: httpAgent,
      httpsAgent: httpsAgent,
      // 设置最大重定向次数
      maxRedirects: 5,
      // 验证状态码
      validateStatus: (status) => status >= 200 && status < 300,
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
        } else if (error.code === 'ECONNRESET') {
          errorMessage = '网络连接被重置，可能是网络不稳定或代理问题，正在重试...';
        } else if (error.code === 'EPIPE' || error.code === 'EPROTO') {
          errorMessage = 'TLS/SSL连接异常，可能是网络环境问题';
        } else if (error.message?.includes('socket') || error.message?.includes('TLS')) {
          errorMessage = '网络socket连接异常，可能是网络不稳定';
        }

        logger.warn(`AI API call failed (attempt ${attempt}/${retries}): ${errorMessage}`, {
          endpoint: config.endpoint,
          errorCode: error.code,
          statusCode: error.response?.status,
          responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'N/A',
          responseHeaders: error.response?.headers ? Object.keys(error.response.headers) : 'N/A',
        });

        if (attempt < retries) {
          // 对于网络连接错误，使用更长的退避时间
          const isNetworkError = ['ECONNRESET', 'EPIPE', 'EPROTO', 'ETIMEDOUT', 'ECONNREFUSED'].includes(error.code) 
            || error.message?.includes('socket') 
            || error.message?.includes('TLS');
          
          // 网络错误使用更长的基础延迟
          const baseDelay = isNetworkError ? 3000 : 1000;
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
          
          logger.info(`Waiting ${delay}ms before retry (network error: ${isNetworkError})`);
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
   * 支持从 AI 响应中提取 JSON 格式的 TurnResultDTO
   */
  private parseNarrativeResponse(content: string): InferenceResult['result'] {
    // 尝试提取 JSON 块
    const jsonPatterns = [
      /```json\s*([\s\S]*?)```/i,  // Markdown JSON 代码块
      /```\s*([\s\S]*?)```/,       // 普通代码块
      /(\{[\s\S]*\})/,             // 直接 JSON 对象
    ];

    for (const pattern of jsonPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        try {
          const jsonStr = match[1].trim();
          const parsed = JSON.parse(jsonStr);
          
          // 验证是否包含必要字段
          if (parsed && typeof parsed === 'object') {
            logger.info(`Successfully parsed JSON from AI response`, {
              hasNarrative: !!parsed.narrative,
              hasPerEntityPanel: Array.isArray(parsed.perEntityPanel),
              hasLeaderboard: Array.isArray(parsed.leaderboard),
              hasHexagram: !!parsed.hexagram,
              hasOptions: Array.isArray(parsed.options),
              parsedKeys: Object.keys(parsed),
            });
            
            // 返回完整的解析结果，映射到 InferenceResult['result'] 格式
            return {
              narrative: parsed.narrative || content,
              outcomes: this.mapEntityPanelsToOutcomes(parsed.perEntityPanel),
              events: this.mapTurnEvents(parsed.events),
              nextRoundHints: parsed.nextRoundHints,
              // 保留完整的解析数据供前端使用
              ...parsed,
            };
          }
        } catch (parseError: any) {
          logger.warn(`Failed to parse JSON from AI response`, {
            error: parseError.message,
            jsonPreview: match[1]?.substring(0, 200),
          });
        }
      }
    }

    // 如果无法解析 JSON，返回原始文本
    logger.info(`No valid JSON found in AI response, returning raw narrative`);
    return {
      narrative: content,
      outcomes: [],
      events: [],
    };
  }

  /**
   * 将 perEntityPanel 映射为 outcomes 格式（向后兼容）
   */
  private mapEntityPanelsToOutcomes(panels: any[] | undefined): Array<{
    playerIndex: number;
    outcome: string;
    resources?: Record<string, unknown>;
  }> {
    if (!Array.isArray(panels)) return [];
    
    return panels.map((panel, index) => ({
      playerIndex: index,
      outcome: panel.broken 
        ? `${panel.name} 已破产: ${panel.bankruptReason || '现金流断裂'}` 
        : `${panel.name} 当前现金: ${panel.cash}`,
      resources: {
        cash: panel.cash,
        ...panel.attributes,
        passiveIncome: panel.passiveIncome,
        passiveExpense: panel.passiveExpense,
      },
    }));
  }

  /**
   * 将 TurnEvent[] 映射为旧格式（向后兼容）
   */
  private mapTurnEvents(events: any[] | undefined): Array<{
    type: string;
    description: string;
  }> {
    if (!Array.isArray(events)) return [];
    
    return events.map(event => ({
      type: event.type || 'neutral',
      description: event.description || event.keyword || '',
    }));
  }

  /**
   * 执行推演（完整流程，支持历史记忆 + Lorebook）
   */
  async performInference(
    config: AIConfig,
    request: InferenceRequest,
    historyConfig?: Partial<HistoryConfig>
  ): Promise<InferenceResult['result']> {
    const { sessionId, currentRound, gameInitData } = request;

    logger.info(`Building prompt for session ${sessionId}, round ${currentRound}`, {
      decisionsCount: request.decisions?.length || 0,
      activeEventsCount: request.activeEvents?.length || 0,
      gameRulesLength: request.gameRules?.length || 0,
    });

    // 第一回合时初始化 Lorebook
    if (currentRound === 1 && gameInitData) {
      this.initializeLorebook(sessionId, gameInitData);
    }

    // 获取历史对话记录
    const historyMessages = await this.getConversationHistory(
      sessionId,
      currentRound,
      historyConfig
    );

    // 构建基础 prompt
    let prompt = this.buildPrompt(request, request.gameRules);

    // 获取 Lorebook 触发的背景知识并注入到 prompt
    const loreContent = this.getTriggeredLoreEntries(sessionId, prompt, 2000);
    if (loreContent) {
      // 在 prompt 开头注入 Lorebook 内容
      prompt = loreContent + '\n\n' + prompt;
    }

    logger.info(`Built prompt for session ${sessionId}, round ${currentRound}`, {
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 200) + '...',
      historyMessageCount: historyMessages.length,
      hasLoreContent: !!loreContent,
    });

    logger.info(`Calling AI API for session ${sessionId}, round ${currentRound}`, {
      endpoint: config.endpoint,
      provider: config.provider,
      withHistory: historyMessages.length > 0,
      withLorebook: !!loreContent,
    });

    // 调用 AI（带历史消息）
    const result = await this.callAI(config, prompt, this.defaultRetries, undefined, historyMessages);

    // 保存本回合的对话历史
    const currentRoundMessages: ConversationMessage[] = [
      { role: 'user', content: prompt },
      { role: 'assistant', content: result.narrative || JSON.stringify(result) },
    ];
    await this.saveConversationHistory(sessionId, currentRound, currentRoundMessages);

    // 从结果中提取重要事件添加到 Lorebook
    this.extractAndAddLoreFromResult(sessionId, currentRound, result);

    logger.info(`AI inference completed for session ${sessionId}, round ${currentRound}`, {
      hasNarrative: !!result.narrative,
      narrativeLength: result.narrative?.length || 0,
      outcomesCount: result.outcomes?.length || 0,
      eventsCount: result.events?.length || 0,
      historySaved: true,
      loreUpdated: true,
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

  /**
   * 游戏初始化 - 生成背景故事、主体初始状态、年度卦象等
   */
  async initializeGame(
    config: AIConfig,
    initConfig: {
      entityCount: number;
      gameMode: 'multi_control' | 'single_protagonist';
      protagonistId?: string;
      initialCash: number;
      gameRules?: string;
      industryTheme?: string; // 行业主题（如：科技、零售、制造）
    }
  ): Promise<{
    backgroundStory: string;
    entities: Array<{
      id: string;
      name: string;
      cash: number;
      attributes: Record<string, number>;
      passiveIncome: number;
      passiveExpense: number;
      backstory?: string;
    }>;
    yearlyHexagram: {
      name: string;
      omen: 'positive' | 'neutral' | 'negative';
      lines: Array<'yang' | 'yin'>;
      text: string;
      yearlyTheme?: string;
    };
    initialOptions: Array<{
      id: string;
      title: string;
      description: string;
      expectedDelta?: Record<string, number>;
    }>;
    cashFormula: string;
  }> {
    const entityIds = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, initConfig.entityCount).split('');
    
    let prompt = `# 游戏初始化请求\n\n`;
    
    prompt += `## 配置参数\n`;
    prompt += `- 主体数量: ${initConfig.entityCount}\n`;
    prompt += `- 游戏模式: ${initConfig.gameMode === 'multi_control' ? '多主体操控模式' : '单主角模式'}\n`;
    if (initConfig.protagonistId) {
      prompt += `- 主角ID: ${initConfig.protagonistId}\n`;
    }
    prompt += `- 初始资金: ${initConfig.initialCash.toLocaleString()} 元\n`;
    if (initConfig.industryTheme) {
      prompt += `- 行业主题: ${initConfig.industryTheme}\n`;
    }
    prompt += `\n`;

    if (initConfig.gameRules) {
      prompt += `## 游戏规则\n${initConfig.gameRules}\n\n`;
    }

    prompt += `## 初始化任务\n`;
    prompt += `请根据《凡墙皆是门》游戏蓝本，完成以下初始化工作：\n\n`;
    prompt += `1. **商业背景故事**（约600字）：\n`;
    prompt += `   - 用自然段落写小说故事，描述 ${initConfig.entityCount} 个企业之间的博弈背景\n`;
    prompt += `   - 故事中不要讲卦象\n`;
    prompt += `   - 各企业之间要有联系和竞争关系\n\n`;
    prompt += `2. **主体初始状态**：\n`;
    prompt += `   - 为每个主体生成中文名称（如：蓝鲸工业、红隼贸易）\n`;
    prompt += `   - 设定初始属性：市场份额、品牌声誉、创新能力等\n`;
    prompt += `   - 设定被动收入和被动支出（确保净损益为正）\n\n`;
    prompt += `3. **年度卦象**：\n`;
    prompt += `   - 随机生成一个周易卦象\n`;
    prompt += `   - 提供卦名、六爻、象曰解释\n`;
    prompt += `   - 生成年度叙事暗线（影响事件风格）\n\n`;
    prompt += `4. **初始决策选项**：\n`;
    prompt += `   - 为玩家提供 3 个初始决策选项\n`;
    prompt += `   - 每个选项附带预期资源变动\n\n`;
    prompt += `5. **资金变动公式**：\n`;
    prompt += `   - 简要说明资金计算规则\n\n`;

    prompt += `## 输出格式（必须为 JSON）\n`;
    prompt += '```json\n';
    prompt += '{\n';
    prompt += '  "backgroundStory": "商业背景故事（约600字）",\n';
    prompt += '  "entities": [\n';
    entityIds.forEach((id, index) => {
      prompt += `    {\n`;
      prompt += `      "id": "${id}",\n`;
      prompt += `      "name": "主体${id}的中文名称",\n`;
      prompt += `      "cash": ${initConfig.initialCash},\n`;
      prompt += `      "attributes": { "市场份额": 25, "品牌声誉": 70, "创新能力": 60 },\n`;
      prompt += `      "passiveIncome": 50000,\n`;
      prompt += `      "passiveExpense": 30000,\n`;
      prompt += `      "backstory": "主体背景简介"\n`;
      prompt += `    }${index < entityIds.length - 1 ? ',' : ''}\n`;
    });
    prompt += '  ],\n';
    prompt += '  "yearlyHexagram": {\n';
    prompt += '    "name": "卦名",\n';
    prompt += '    "omen": "positive|neutral|negative",\n';
    prompt += '    "lines": ["yang", "yin", "yang", "yang", "yin", "yang"],\n';
    prompt += '    "text": "象曰/解释文本",\n';
    prompt += '    "yearlyTheme": "年度叙事暗线"\n';
    prompt += '  },\n';
    prompt += '  "initialOptions": [\n';
    prompt += '    { "id": "1", "title": "选项标题", "description": "选项描述", "expectedDelta": { "cash": -50000 } },\n';
    prompt += '    { "id": "2", "title": "选项标题", "description": "选项描述", "expectedDelta": { "cash": -30000 } },\n';
    prompt += '    { "id": "3", "title": "选项标题", "description": "选项描述", "expectedDelta": { "cash": -20000 } }\n';
    prompt += '  ],\n';
    prompt += '  "cashFormula": "资金变动公式说明"\n';
    prompt += '}\n';
    prompt += '```\n';

    try {
      logger.info(`Initializing game with ${initConfig.entityCount} entities`, {
        gameMode: initConfig.gameMode,
        initialCash: initConfig.initialCash,
      });

      const result = await this.callAI(config, prompt, this.defaultRetries, this.initTimeout);

      // 解析结果
      if (result.narrative) {
        const jsonPatterns = [
          /```json\s*([\s\S]*?)```/i,
          /```\s*([\s\S]*?)```/,
          /(\{[\s\S]*"backgroundStory"[\s\S]*\})/,
        ];

        for (const pattern of jsonPatterns) {
          const match = result.narrative.match(pattern);
          if (match && match[1]) {
            try {
              const parsed = JSON.parse(match[1].trim());
              if (parsed.backgroundStory && parsed.entities) {
                logger.info(`Game initialization successful`, {
                  entitiesCount: parsed.entities.length,
                  hasHexagram: !!parsed.yearlyHexagram,
                  hasOptions: Array.isArray(parsed.initialOptions),
                });
                return parsed;
              }
            } catch (parseError: any) {
              logger.warn(`Failed to parse game init JSON`, { error: parseError.message });
            }
          }
        }
      }

      // 如果解析失败，返回默认值
      logger.warn(`Failed to parse game initialization result, using defaults`);
      return this.getDefaultGameInit(initConfig);
    } catch (error: any) {
      logger.error(`Game initialization failed`, { error: error.message });
      return this.getDefaultGameInit(initConfig);
    }
  }

  /**
   * 获取默认的游戏初始化数据（AI 调用失败时的回退）
   */
  private getDefaultGameInit(initConfig: {
    entityCount: number;
    initialCash: number;
  }): {
    backgroundStory: string;
    entities: Array<{
      id: string;
      name: string;
      cash: number;
      attributes: Record<string, number>;
      passiveIncome: number;
      passiveExpense: number;
    }>;
    yearlyHexagram: {
      name: string;
      omen: 'positive' | 'neutral' | 'negative';
      lines: Array<'yang' | 'yin'>;
      text: string;
    };
    initialOptions: Array<{
      id: string;
      title: string;
      description: string;
      expectedDelta?: Record<string, number>;
    }>;
    cashFormula: string;
  } {
    const defaultNames = ['蓝鲸工业', '红隼贸易', '青龙科技', '白虎物流', '玄武金融', '朱雀传媒'];
    const entityIds = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, initConfig.entityCount).split('');

    return {
      backgroundStory: `在这个充满机遇与挑战的商业世界中，${initConfig.entityCount}家企业正在展开激烈的市场竞争。每家企业都有自己独特的优势和战略方向，它们在市场份额、品牌声誉和创新能力等方面各有千秋。随着市场环境的不断变化，这些企业需要做出明智的决策，以在竞争中脱颖而出。`,
      entities: entityIds.map((id, index) => ({
        id,
        name: defaultNames[index] || `企业${id}`,
        cash: initConfig.initialCash,
        attributes: {
          '市场份额': Math.floor(100 / initConfig.entityCount),
          '品牌声誉': 50 + Math.floor(Math.random() * 30),
          '创新能力': 50 + Math.floor(Math.random() * 30),
        },
        passiveIncome: Math.floor(initConfig.initialCash * 0.05),
        passiveExpense: Math.floor(initConfig.initialCash * 0.03),
      })),
      yearlyHexagram: {
        name: '乾卦',
        omen: 'positive' as const,
        lines: ['yang', 'yang', 'yang', 'yang', 'yang', 'yang'] as Array<'yang' | 'yin'>,
        text: '天行健，君子以自强不息。',
      },
      initialOptions: [
        { id: '1', title: '扩大市场', description: '投入资金扩大市场份额', expectedDelta: { cash: -50000, '市场份额': 5 } },
        { id: '2', title: '研发创新', description: '投入研发提升创新能力', expectedDelta: { cash: -30000, '创新能力': 10 } },
        { id: '3', title: '品牌建设', description: '投入品牌营销提升声誉', expectedDelta: { cash: -20000, '品牌声誉': 8 } },
      ],
      cashFormula: '期末现金 = 期初现金 + 被动收入 - 被动支出 + 决策收益 - 决策成本',
    };
  }
}

export const aiService = AIService.getInstance();

