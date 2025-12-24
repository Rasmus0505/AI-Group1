/**
 * Modifier 注册表
 * 预定义所有可能的临时规则修正器，防止 AI 自创规则
 */

import type { TemporaryModifier, ModifierSource, ModifierEffectType } from './types/rules';

/** 注册的 Modifier 模板 */
interface ModifierTemplate {
  name: string;
  description: string;
  effectType: ModifierEffectType;
  source: ModifierSource;
  affectedAttributes: string[];
  multiplier?: number;
  flatBonus?: number;
  defaultDuration: number;
  icon?: string;
  stackable?: boolean;
  priority?: number;
}

/** 卦象相关的 Modifier */
const HEXAGRAM_MODIFIERS: Record<string, ModifierTemplate> = {
  // 乾卦 - 天行健
  HEX_QIAN: {
    name: '乾卦·天行健',
    description: '扩张性投资收益增加20%',
    effectType: 'buff',
    source: 'hexagram',
    affectedAttributes: ['投资收益', '市场份额'],
    multiplier: 1.2,
    defaultDuration: 4,
    icon: '☰',
    priority: 10,
  },
  // 坤卦 - 地势坤
  HEX_KUN: {
    name: '坤卦·地势坤',
    description: '防守型策略成本降低15%',
    effectType: 'buff',
    source: 'hexagram',
    affectedAttributes: ['运营成本', '固定支出'],
    multiplier: 0.85,
    defaultDuration: 4,
    icon: '☷',
    priority: 10,
  },
  // 坎卦 - 水
  HEX_KAN: {
    name: '坎卦·险中求',
    description: '现金流波动加剧，收支浮动±10%',
    effectType: 'neutral',
    source: 'hexagram',
    affectedAttributes: ['被动收入', '被动支出'],
    defaultDuration: 4,
    icon: '☵',
    priority: 10,
  },
  // 离卦 - 火
  HEX_LI: {
    name: '离卦·明照',
    description: '品牌曝光度提升，声誉变动幅度+25%',
    effectType: 'buff',
    source: 'hexagram',
    affectedAttributes: ['品牌声誉'],
    multiplier: 1.25,
    defaultDuration: 4,
    icon: '☲',
    priority: 10,
  },
  // 震卦 - 雷
  HEX_ZHEN: {
    name: '震卦·雷动',
    description: '突发事件概率增加，创新收益+15%',
    effectType: 'buff',
    source: 'hexagram',
    affectedAttributes: ['创新能力', '研发收益'],
    multiplier: 1.15,
    defaultDuration: 4,
    icon: '☳',
    priority: 10,
  },
  // 巽卦 - 风
  HEX_XUN: {
    name: '巽卦·风行',
    description: '市场渗透速度加快，扩张成本-10%',
    effectType: 'buff',
    source: 'hexagram',
    affectedAttributes: ['扩张成本', '市场份额'],
    multiplier: 0.9,
    defaultDuration: 4,
    icon: '☴',
    priority: 10,
  },
  // 艮卦 - 山
  HEX_GEN: {
    name: '艮卦·止',
    description: '扩张受阻，但防守稳固，固定收入+10%',
    effectType: 'neutral',
    source: 'hexagram',
    affectedAttributes: ['被动收入'],
    multiplier: 1.1,
    defaultDuration: 4,
    icon: '☶',
    priority: 10,
  },
  // 兑卦 - 泽
  HEX_DUI: {
    name: '兑卦·悦',
    description: '合作谈判顺利，交易成本-20%',
    effectType: 'buff',
    source: 'hexagram',
    affectedAttributes: ['交易成本', '合作收益'],
    multiplier: 0.8,
    defaultDuration: 4,
    icon: '☱',
    priority: 10,
  },
  // 困卦
  HEX_KUN_DIFF: {
    name: '困卦·困境',
    description: '所有主动投资收益减半',
    effectType: 'debuff',
    source: 'hexagram',
    affectedAttributes: ['投资收益'],
    multiplier: 0.5,
    defaultDuration: 2,
    icon: '䷮',
    priority: 10,
  },
};

/** 事件相关的 Modifier */
const EVENT_MODIFIERS: Record<string, ModifierTemplate> = {
  // 政策利好
  EVT_POLICY_FAVOR: {
    name: '政策利好',
    description: '政府补贴，每回合额外收入',
    effectType: 'buff',
    source: 'event',
    affectedAttributes: ['被动收入'],
    flatBonus: 5000,
    defaultDuration: 3,
    icon: '📜',
    priority: 5,
  },
  // 市场寒冬
  EVT_MARKET_WINTER: {
    name: '市场寒冬',
    description: '整体市场萎缩，收入降低15%',
    effectType: 'debuff',
    source: 'event',
    affectedAttributes: ['被动收入', '销售收入'],
    multiplier: 0.85,
    defaultDuration: 2,
    icon: '❄️',
    priority: 5,
  },
  // 原材料涨价
  EVT_MATERIAL_RISE: {
    name: '原材料涨价',
    description: '生产成本增加20%',
    effectType: 'debuff',
    source: 'event',
    affectedAttributes: ['生产成本', '被动支出'],
    multiplier: 1.2,
    defaultDuration: 2,
    icon: '📈',
    priority: 5,
  },
  // 技术突破
  EVT_TECH_BREAKTHROUGH: {
    name: '技术突破',
    description: '创新能力大幅提升',
    effectType: 'buff',
    source: 'event',
    affectedAttributes: ['创新能力'],
    flatBonus: 15,
    defaultDuration: 3,
    icon: '💡',
    priority: 5,
  },
  // 法律制裁
  EVT_LEGAL_SANCTION: {
    name: '法律制裁',
    description: '部分决策选项受限',
    effectType: 'debuff',
    source: 'event',
    affectedAttributes: ['决策自由度'],
    defaultDuration: 2,
    icon: '⚖️',
    priority: 8,
  },
};

/** 成就相关的 Modifier */
const ACHIEVEMENT_MODIFIERS: Record<string, ModifierTemplate> = {
  // 首富成就
  ACH_RICHEST: {
    name: '行业领袖',
    description: '品牌声誉永久+5',
    effectType: 'buff',
    source: 'achievement',
    affectedAttributes: ['品牌声誉'],
    flatBonus: 5,
    defaultDuration: -1, // 永久
    icon: '👑',
    priority: 3,
  },
  // 创新先锋
  ACH_INNOVATOR: {
    name: '创新先锋',
    description: '研发成本永久-10%',
    effectType: 'buff',
    source: 'achievement',
    affectedAttributes: ['研发成本'],
    multiplier: 0.9,
    defaultDuration: -1,
    icon: '🚀',
    priority: 3,
  },
  // 稳健经营
  ACH_STABLE: {
    name: '稳健经营',
    description: '被动收入+5%',
    effectType: 'buff',
    source: 'achievement',
    affectedAttributes: ['被动收入'],
    multiplier: 1.05,
    defaultDuration: -1,
    icon: '🏛️',
    priority: 3,
  },
};

/** 合并所有注册的 Modifier */
const ALL_MODIFIERS: Record<string, ModifierTemplate> = {
  ...HEXAGRAM_MODIFIERS,
  ...EVENT_MODIFIERS,
  ...ACHIEVEMENT_MODIFIERS,
};

/**
 * Modifier 注册表类
 */
export class ModifierRegistry {
  private static instance: ModifierRegistry;
  private registry: Map<string, ModifierTemplate>;

  private constructor() {
    this.registry = new Map(Object.entries(ALL_MODIFIERS));
  }

  static getInstance(): ModifierRegistry {
    if (!ModifierRegistry.instance) {
      ModifierRegistry.instance = new ModifierRegistry();
    }
    return ModifierRegistry.instance;
  }

  /** 检查 Modifier 是否已注册 */
  isRegistered(id: string): boolean {
    return this.registry.has(id);
  }

  /** 获取 Modifier 模板 */
  getTemplate(id: string): ModifierTemplate | undefined {
    return this.registry.get(id);
  }

  /** 创建 Modifier 实例 */
  createModifier(
    id: string,
    currentRound: number,
    overrides?: Partial<ModifierTemplate>
  ): TemporaryModifier | null {
    const template = this.registry.get(id);
    if (!template) {
      console.warn(`[ModifierRegistry] 未注册的 Modifier: ${id}`);
      return null;
    }

    const merged = { ...template, ...overrides };

    return {
      id: `${id}_${Date.now()}`,
      name: merged.name,
      description: merged.description,
      effectType: merged.effectType,
      source: merged.source,
      affectedAttributes: merged.affectedAttributes,
      multiplier: merged.multiplier,
      flatBonus: merged.flatBonus,
      duration: merged.defaultDuration,
      createdAtRound: currentRound,
      icon: merged.icon,
      stackable: merged.stackable,
      priority: merged.priority ?? 0,
    };
  }

  /** 获取所有卦象 Modifier ID */
  getHexagramModifierIds(): string[] {
    return Object.keys(HEXAGRAM_MODIFIERS);
  }

  /** 获取所有事件 Modifier ID */
  getEventModifierIds(): string[] {
    return Object.keys(EVENT_MODIFIERS);
  }

  /** 获取所有成就 Modifier ID */
  getAchievementModifierIds(): string[] {
    return Object.keys(ACHIEVEMENT_MODIFIERS);
  }

  /** 注册自定义 Modifier（用于扩展） */
  registerCustomModifier(id: string, template: ModifierTemplate): void {
    if (this.registry.has(id)) {
      console.warn(`[ModifierRegistry] Modifier ${id} 已存在，将被覆盖`);
    }
    this.registry.set(id, template);
  }
}

export default ModifierRegistry;
