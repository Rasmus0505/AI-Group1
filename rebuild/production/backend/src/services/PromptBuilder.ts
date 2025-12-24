/**
 * PromptBuilder - 三层规则 Prompt 组装器
 * 负责将 Core / Scenario / Temporary 规则组装成 AI Prompt
 * 核心原则：让代码逻辑管数值，AI管演绎
 */

import { logger } from '../utils/logger';

// ============ 类型定义 ============

/** 核心规则（不可违背） */
export interface CoreRulesInput {
  bankruptcyThreshold: number;
  turnDuration: number;
  maxEntities: number;
  monthsPerTurn: number;
  decisionPrinciples: string[];
  prohibitions: string[];
}

/** 场景配置 */
export interface ScenarioInput {
  id: string;
  name: string;
  industry: string;
  initialCash: number;
  backgroundStory: string;
  victoryCondition?: string;
  specialRules?: string[];
}

/** 临时修正器 */
export interface ModifierInput {
  id: string;
  name: string;
  description: string;
  effectType: 'buff' | 'debuff' | 'neutral';
  source: 'hexagram' | 'event' | 'achievement' | 'decision' | 'system';
  affectedAttributes: string[];
  multiplier?: number;
  flatBonus?: number;
  duration: number;
}

/** 卦象信息 */
export interface HexagramInput {
  name: string;
  omen: 'positive' | 'neutral' | 'negative';
  lines: Array<'yang' | 'yin'>;
  text: string;
  yearlyTheme?: string;
}

/** 主体状态 */
export interface EntityStateInput {
  id: string;
  name: string;
  cash: number;
  attributes: Record<string, number>;
  passiveIncome: number;
  passiveExpense: number;
  broken: boolean;
}

/** 玩家决策 */
export interface DecisionInput {
  entityId: string;
  entityName: string;
  actionText: string;
  selectedOptionIds?: string[];
  hostModified?: boolean;
  hostModification?: string;
}

/** Prompt 构建配置 */
export interface PromptBuildConfig {
  currentRound: number;
  coreRules: CoreRulesInput;
  scenario: ScenarioInput;
  activeModifiers: ModifierInput[];
  currentHexagram?: HexagramInput;
  entityStates: EntityStateInput[];
  decisions: DecisionInput[];
  activeEvents?: Array<{
    id: string;
    eventType: string;
    eventContent: string;
    effectiveRounds: number;
  }>;
}


/**
 * PromptBuilder 类
 * 按照三层架构组装 AI Prompt
 */
export class PromptBuilder {
  private static instance: PromptBuilder;

  private constructor() {}

  static getInstance(): PromptBuilder {
    if (!PromptBuilder.instance) {
      PromptBuilder.instance = new PromptBuilder();
    }
    return PromptBuilder.instance;
  }

  /**
   * 构建完整的推演 Prompt
   * 按顺序组装：固定头部 → 动态背景 → 主体状态 → 玩家输入 → 执行指令
   */
  buildInferencePrompt(config: PromptBuildConfig): string {
    const sections: string[] = [];

    // 1. 固定头部：核心规则 (Immutable Core)
    sections.push(this.buildCoreRulesSection(config.coreRules));

    // 2. 场景背景 (Default Scenario)
    sections.push(this.buildScenarioSection(config.scenario));

    // 3. 动态背景：临时规则 (Mutable/Temporary)
    sections.push(this.buildTemporaryRulesSection(
      config.currentRound,
      config.activeModifiers,
      config.currentHexagram
    ));

    // 4. 活跃事件
    if (config.activeEvents && config.activeEvents.length > 0) {
      sections.push(this.buildActiveEventsSection(config.activeEvents));
    }

    // 5. 主体状态
    sections.push(this.buildEntityStatesSection(config.entityStates));

    // 6. 玩家决策
    sections.push(this.buildDecisionsSection(config.decisions));

    // 7. 执行指令
    sections.push(this.buildExecutionInstructions(config.currentRound));

    const prompt = sections.join('\n\n');

    logger.info(`[PromptBuilder] Built inference prompt`, {
      totalLength: prompt.length,
      sectionsCount: sections.length,
      currentRound: config.currentRound,
      modifiersCount: config.activeModifiers.length,
      entitiesCount: config.entityStates.length,
      decisionsCount: config.decisions.length,
    });

    return prompt;
  }

  /**
   * 构建核心规则部分（System Prompt 级别）
   */
  private buildCoreRulesSection(core: CoreRulesInput): string {
    let section = `# 核心准则 (Core Rules - 不可违背)\n\n`;
    section += `你是《凡墙皆是门》的游戏主持人AI，必须严格遵守以下核心准则：\n\n`;

    section += `## 基础参数\n`;
    section += `- 破产阈值: 现金 < ${core.bankruptcyThreshold} 元\n`;
    section += `- 回合时长: ${core.turnDuration} 秒\n`;
    section += `- 最大主体数: ${core.maxEntities}\n`;
    section += `- 每回合时间跨度: ${core.monthsPerTurn} 个月\n\n`;

    section += `## 决策原则\n`;
    core.decisionPrinciples.forEach((principle, i) => {
      section += `${i + 1}. ${principle}\n`;
    });
    section += `\n`;

    section += `## 禁止事项\n`;
    core.prohibitions.forEach((prohibition, i) => {
      section += `${i + 1}. ⛔ ${prohibition}\n`;
    });

    return section;
  }

  /**
   * 构建场景背景部分
   */
  private buildScenarioSection(scenario: ScenarioInput): string {
    let section = `# 游戏场景 (Scenario)\n\n`;
    section += `- 场景名称: ${scenario.name}\n`;
    section += `- 行业主题: ${scenario.industry}\n`;
    section += `- 初始资金: ${scenario.initialCash.toLocaleString()} 元\n`;

    if (scenario.victoryCondition) {
      section += `- 胜利条件: ${scenario.victoryCondition}\n`;
    }

    if (scenario.backgroundStory) {
      section += `\n## 背景故事\n${scenario.backgroundStory}\n`;
    }

    if (scenario.specialRules && scenario.specialRules.length > 0) {
      section += `\n## 特殊规则\n`;
      scenario.specialRules.forEach((rule, i) => {
        section += `${i + 1}. ${rule}\n`;
      });
    }

    return section;
  }


  /**
   * 构建临时规则部分（Context Injection）
   */
  private buildTemporaryRulesSection(
    currentRound: number,
    modifiers: ModifierInput[],
    hexagram?: HexagramInput
  ): string {
    let section = `# 当前回合临时约束 (Temporary Rules)\n\n`;
    section += `当前是第 ${currentRound} 回合。\n\n`;

    // 卦象影响
    if (hexagram) {
      section += `## 年度卦象\n`;
      section += `- 卦名: ${hexagram.name}\n`;
      section += `- 吉凶: ${this.formatOmen(hexagram.omen)}\n`;
      section += `- 象曰: ${hexagram.text}\n`;
      if (hexagram.yearlyTheme) {
        section += `- 年度暗线: ${hexagram.yearlyTheme}\n`;
      }
      section += `\n`;
    }

    // 活跃的 Modifier
    if (modifiers.length > 0) {
      section += `## 生效中的规则修正\n`;
      
      const buffModifiers = modifiers.filter(m => m.effectType === 'buff');
      const debuffModifiers = modifiers.filter(m => m.effectType === 'debuff');
      const neutralModifiers = modifiers.filter(m => m.effectType === 'neutral');

      if (buffModifiers.length > 0) {
        section += `\n### 增益效果 (Buffs)\n`;
        buffModifiers.forEach(m => {
          section += this.formatModifier(m);
        });
      }

      if (debuffModifiers.length > 0) {
        section += `\n### 减益效果 (Debuffs)\n`;
        debuffModifiers.forEach(m => {
          section += this.formatModifier(m);
        });
      }

      if (neutralModifiers.length > 0) {
        section += `\n### 中性效果\n`;
        neutralModifiers.forEach(m => {
          section += this.formatModifier(m);
        });
      }
    } else {
      section += `当前无特殊规则修正生效。\n`;
    }

    return section;
  }

  /**
   * 格式化单个 Modifier
   */
  private formatModifier(m: ModifierInput): string {
    let line = `- **${m.name}** [来源: ${this.formatSource(m.source)}]\n`;
    line += `  - 效果: ${m.description}\n`;
    line += `  - 影响属性: ${m.affectedAttributes.join(', ')}\n`;
    
    if (m.multiplier !== undefined && m.multiplier !== 1) {
      const percent = Math.round((m.multiplier - 1) * 100);
      line += `  - 数值修正: ${percent >= 0 ? '+' : ''}${percent}%\n`;
    }
    if (m.flatBonus !== undefined && m.flatBonus !== 0) {
      line += `  - 固定加成: ${m.flatBonus >= 0 ? '+' : ''}${m.flatBonus}\n`;
    }
    
    if (m.duration === -1) {
      line += `  - 持续时间: 永久\n`;
    } else {
      line += `  - 剩余回合: ${m.duration}\n`;
    }
    
    return line;
  }

  /**
   * 构建活跃事件部分
   */
  private buildActiveEventsSection(events: Array<{
    id: string;
    eventType: string;
    eventContent: string;
    effectiveRounds: number;
  }>): string {
    let section = `# 活跃事件\n\n`;
    
    events.forEach((event, i) => {
      section += `${i + 1}. [${event.eventType}] ${event.eventContent}\n`;
      section += `   - 有效回合数: ${event.effectiveRounds}\n`;
    });

    return section;
  }

  /**
   * 构建主体状态部分
   */
  private buildEntityStatesSection(entities: EntityStateInput[]): string {
    let section = `# 主体当前状态\n\n`;

    entities.forEach(entity => {
      const status = entity.broken ? '❌ 已破产' : '✅ 运营中';
      section += `## 主体 ${entity.id} - ${entity.name} ${status}\n`;
      section += `- 现金: ${entity.cash.toLocaleString()} 元\n`;
      section += `- 被动收入: +${entity.passiveIncome.toLocaleString()} 元/回合\n`;
      section += `- 被动支出: -${entity.passiveExpense.toLocaleString()} 元/回合\n`;
      section += `- 净现金流: ${(entity.passiveIncome - entity.passiveExpense).toLocaleString()} 元/回合\n`;
      
      section += `- 属性:\n`;
      Object.entries(entity.attributes).forEach(([key, value]) => {
        section += `  - ${key}: ${value}\n`;
      });
      section += `\n`;
    });

    return section;
  }


  /**
   * 构建玩家决策部分
   */
  private buildDecisionsSection(decisions: DecisionInput[]): string {
    let section = `# 本回合玩家决策\n\n`;

    if (decisions.length === 0) {
      section += `（本回合暂无玩家提交决策）\n`;
      return section;
    }

    decisions.forEach(decision => {
      section += `## 主体 ${decision.entityId} (${decision.entityName}) 的决策\n`;
      section += `- 行动指令: "${decision.actionText}"\n`;
      
      if (decision.selectedOptionIds && decision.selectedOptionIds.length > 0) {
        section += `- 选择的选项: ${decision.selectedOptionIds.join(', ')}\n`;
      }
      
      if (decision.hostModified && decision.hostModification) {
        section += `- ⚠️ [主持人修改]: ${decision.hostModification}\n`;
      }
      section += `\n`;
    });

    return section;
  }

  /**
   * 构建执行指令部分
   */
  private buildExecutionInstructions(_currentRound: number): string {
    let section = `# 执行指令\n\n`;
    section += `请根据上述所有规则和状态进行本回合推演：\n\n`;
    section += `1. **严格遵守核心准则**，不得违背任何禁止事项\n`;
    section += `2. **应用临时规则修正**，计算时考虑所有生效中的 Modifier\n`;
    section += `3. **处理玩家决策**，未收到指令的主体仅更新被动收支\n`;
    section += `4. **考虑交叉影响**，各主体决策对其他主体和市场的影响\n`;
    section += `5. **检查现金流**，若有主体接近破产阈值，必须在 cashFlowWarning 中警示\n`;
    section += `6. **生成叙事**，narrative 中应包含 events 的 keyword\n`;
    section += `7. **更新排行榜**，按综合得分排序\n`;
    section += `8. **提供决策选项**，为下回合提供 3 个策略选项\n\n`;
    
    section += `**输出格式**: 必须以 JSON 格式输出，用 \`\`\`json 代码块包裹。\n`;

    return section;
  }

  // ============ 辅助方法 ============

  private formatOmen(omen: 'positive' | 'neutral' | 'negative'): string {
    switch (omen) {
      case 'positive': return '吉 ✨';
      case 'negative': return '凶 ⚠️';
      default: return '中 ⚖️';
    }
  }

  private formatSource(source: ModifierInput['source']): string {
    switch (source) {
      case 'hexagram': return '卦象';
      case 'event': return '事件';
      case 'achievement': return '成就';
      case 'decision': return '决策';
      case 'system': return '系统';
      default: return source;
    }
  }

  /**
   * 构建简化版 Prompt（用于决策选项生成等轻量场景）
   */
  buildLightPrompt(
    entityState: EntityStateInput,
    activeModifiers: ModifierInput[],
    context?: string
  ): string {
    let prompt = `# 决策选项生成\n\n`;
    
    prompt += `## 主体状态\n`;
    prompt += `- 名称: ${entityState.name} (${entityState.id})\n`;
    prompt += `- 现金: ${entityState.cash.toLocaleString()} 元\n`;
    prompt += `- 净现金流: ${(entityState.passiveIncome - entityState.passiveExpense).toLocaleString()} 元/回合\n`;
    
    Object.entries(entityState.attributes).forEach(([key, value]) => {
      prompt += `- ${key}: ${value}\n`;
    });

    if (activeModifiers.length > 0) {
      prompt += `\n## 当前生效的规则修正\n`;
      activeModifiers.forEach(m => {
        prompt += `- ${m.name}: ${m.description}\n`;
      });
    }

    if (context) {
      prompt += `\n## 额外上下文\n${context}\n`;
    }

    prompt += `\n## 任务\n`;
    prompt += `请为该主体生成 3 个合理的决策选项，每个选项包含：\n`;
    prompt += `- id: 选项编号\n`;
    prompt += `- title: 简短标题\n`;
    prompt += `- description: 详细描述\n`;
    prompt += `- expectedDelta: 预期资源变动\n`;
    prompt += `- category: 类别 (attack/defense/cooperation/explore/trade)\n`;
    prompt += `- riskLevel: 风险等级 (low/medium/high)\n`;

    return prompt;
  }
}

export const promptBuilder = PromptBuilder.getInstance();
export default PromptBuilder;
