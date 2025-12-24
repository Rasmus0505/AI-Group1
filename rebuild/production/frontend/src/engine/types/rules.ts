/**
 * 三层规则架构类型定义
 * 基于《凡墙皆是门》游戏蓝本
 */

// ============ 第一层：核心规则 (Immutable Core) ============

/** 核心规则 - 不可违背的物理定律 */
export interface CoreRules {
  /** 破产阈值（现金低于此值判定破产） */
  bankruptcyThreshold: number;
  /** 回合时长（秒） */
  turnDuration: number;
  /** 最大主体数量 */
  maxEntities: number;
  /** 每回合代表的时间（月） */
  monthsPerTurn: number;
  /** 决策原则（不可违背的规则描述） */
  decisionPrinciples: string[];
  /** 禁止事项 */
  prohibitions: string[];
}

/** 默认核心规则 */
export const DEFAULT_CORE_RULES: CoreRules = {
  bankruptcyThreshold: 0,
  turnDuration: 180,
  maxEntities: 6,
  monthsPerTurn: 6,
  decisionPrinciples: [
    '玩家指令绝对优先，未收到指令的主体仅更新被动收支',
    '不允许AI代替玩家主动发起主体行为',
    '不允许系统撮合主体间合作事项',
    '禁止明显扰乱游戏公平性的决策输入',
  ],
  prohibitions: [
    '系统不得代替玩家进行主体决策',
    '系统不得自动发起玩家行为',
    '系统不得预设剧情走向',
  ],
};

// ============ 第二层：场景规则 (Default Scenario) ============

/** 被动收支项 */
export interface PassiveItem {
  /** 项目名称 */
  name: string;
  /** 金额（正数为收入，负数为支出） */
  amount: number;
  /** 说明 */
  description?: string;
  /** 是否为百分比（基于某属性计算） */
  isPercentage?: boolean;
  /** 百分比基准属性 */
  baseAttribute?: string;
}

/** 场景配置 - 游戏剧本 */
export interface ScenarioConfig {
  /** 场景ID */
  id: string;
  /** 场景名称 */
  name: string;
  /** 行业/主题 */
  industry: string;
  /** 初始资金 */
  initialCash: number;
  /** 初始属性模板 */
  initialAttributes: Record<string, number | string>;
  /** 被动收入项列表 */
  passiveIncomeItems: PassiveItem[];
  /** 被动支出项列表 */
  passiveExpenseItems: PassiveItem[];
  /** 背景故事 */
  backgroundStory: string;
  /** 胜利条件描述 */
  victoryCondition?: string;
  /** 特殊规则 */
  specialRules?: string[];
}

/** 默认场景配置 */
export const DEFAULT_SCENARIO: ScenarioConfig = {
  id: 'default',
  name: '商业博弈',
  industry: '综合商业',
  initialCash: 100000,
  initialAttributes: {
    '市场份额': 20,
    '品牌声誉': 50,
    '创新能力': 50,
  },
  passiveIncomeItems: [
    { name: '稳健业务收入', amount: 8000, description: '每回合固定收入' },
  ],
  passiveExpenseItems: [
    { name: '固定运营成本', amount: 5000, description: '每回合固定支出' },
    { name: '人员薪资', amount: 2000, description: '每回合固定支出' },
  ],
  backgroundStory: '',
  victoryCondition: '游戏结束时综合得分最高者获胜',
};

// ============ 第三层：动态规则 (Mutable/Temporary) ============

/** Modifier 来源类型 */
export type ModifierSource = 'hexagram' | 'event' | 'achievement' | 'decision' | 'system';

/** Modifier 效果类型 */
export type ModifierEffectType = 'buff' | 'debuff' | 'neutral';

/** 临时规则修正器 */
export interface TemporaryModifier {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 效果描述 */
  description: string;
  /** 效果类型 */
  effectType: ModifierEffectType;
  /** 来源 */
  source: ModifierSource;
  /** 影响的属性列表 */
  affectedAttributes: string[];
  /** 数值修正（乘数，1.0 表示无变化） */
  multiplier?: number;
  /** 固定值修正 */
  flatBonus?: number;
  /** 剩余回合数（-1 表示永久） */
  duration: number;
  /** 创建回合 */
  createdAtRound: number;
  /** 图标（可选） */
  icon?: string;
  /** 是否可叠加 */
  stackable?: boolean;
  /** 优先级（数字越大优先级越高） */
  priority?: number;
}

// ============ 卦象系统 ============

/** 卦象定义 */
export interface HexagramDefinition {
  /** 卦象ID */
  id: string;
  /** 卦名 */
  name: string;
  /** 六爻 */
  lines: Array<'yang' | 'yin'>;
  /** 象曰 */
  text: string;
  /** 吉凶 */
  omen: 'positive' | 'neutral' | 'negative';
  /** 关联的 Modifier */
  modifiers: Omit<TemporaryModifier, 'id' | 'createdAtRound' | 'duration'>[];
  /** 默认持续回合数 */
  defaultDuration: number;
}

// ============ 规则状态 ============

/** 完整的规则状态 */
export interface RuleState {
  /** 核心规则 */
  core: CoreRules;
  /** 当前场景 */
  scenario: ScenarioConfig;
  /** 活跃的临时修正器 */
  activeModifiers: TemporaryModifier[];
  /** 当前卦象 */
  currentHexagram?: HexagramDefinition;
  /** 当前回合 */
  currentRound: number;
}

/** 规则变更事件 */
export interface RuleChangeEvent {
  type: 'modifier_added' | 'modifier_removed' | 'modifier_expired' | 'hexagram_changed' | 'scenario_changed';
  payload: unknown;
  timestamp: number;
}
