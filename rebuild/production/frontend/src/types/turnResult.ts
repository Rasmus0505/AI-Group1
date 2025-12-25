/**
 * 游戏推演结果类型定义
 * 基于《凡墙皆是门》游戏蓝本规则
 */

// ============ 主体/实体相关 ============

/** 主体动态属性（支持任意键值对） */
export type EntityAttributes = Record<string, number | string | boolean>;

/** 主体面板 - 每个博弈主体的完整状态 */
export interface TurnEntityPanel {
  /** 主体唯一标识（如 A, B, C） */
  id: string;
  /** 主体中文名称（如：蓝鲸工业） */
  name: string;
  /** 主体标识符号（用于UI区分，不使用emoji） */
  symbol?: string;
  /** 现金余额（核心属性） */
  cash: number;
  /** 动态属性字典（市场份额、品牌声誉、创新能力等） */
  attributes: EntityAttributes;
  /** 被动收入（每回合自动获得） */
  passiveIncome: number;
  /** 被动支出（每回合自动扣除） */
  passiveExpense: number;
  /** 本回合属性变动 */
  delta: Record<string, number>;
  /** 是否破产 */
  broken: boolean;
  /** 破产原因（如有） */
  bankruptReason?: string;
  /** 本回合解锁的成就ID列表 */
  achievementsUnlocked: string[];
  /** 信用评级（可选） */
  creditRating?: string;
  /** 主题色键名（用于UI配色） */
  paletteKey?: string;
  /** 强调色（十六进制） */
  accentColor?: string;
  /** 情报置信度（0-1，用于战争迷雾） */
  intelConfidence?: number;
  /** 市场份额（兼容旧代码） */
  marketShare?: number;
  /** 品牌声誉（兼容旧代码） */
  reputation?: number;
  /** 创新能力（兼容旧代码） */
  innovation?: number;
}

// ============ 排行榜相关 ============

export interface TurnLeaderboardEntry {
  /** 主体ID */
  id: string;
  /** 主体名称 */
  name: string;
  /** 综合得分 */
  score: number;
  /** 当前排名 */
  rank: number;
  /** 排名变化（正数上升，负数下降） */
  rankChange?: number;
  /** 各维度得分明细 */
  scoreBreakdown?: Record<string, number>;
}

// ============ 周易卦象相关 ============

export interface TurnHexagram {
  /** 卦名（如：乾卦） */
  name: string;
  /** 卦象寓意 */
  omen: 'positive' | 'neutral' | 'negative';
  /** 六爻（从下到上） */
  lines: Array<'yang' | 'yin'>;
  /** 象曰/解释文本 */
  text: string;
  /** 配色提示 */
  colorHint?: string;
  /** 年度叙事暗线（影响事件风格） */
  yearlyTheme?: string;
}

// ============ 决策选项相关 ============

export interface TurnOption {
  /** 选项ID（1, 2, 3） */
  id: string;
  /** 选项标题 */
  title: string;
  /** 选项描述 */
  description: string;
  /** 预期资源变动 */
  expectedDelta?: Record<string, number>;
  /** 选项类别 */
  category?: 'attack' | 'defense' | 'cooperation' | 'explore' | 'trade' | 'other';
  /** 是否为恶意选项（蓝本允许） */
  isMalicious?: boolean;
  /** 风险等级 */
  riskLevel?: 'low' | 'medium' | 'high';
}

// ============ 财务核算相关 ============

export interface TurnLedger {
  /** 期初现金 */
  startingCash: number;
  /** 被动收入合计 */
  passiveIncome: number;
  /** 被动支出合计 */
  passiveExpense: number;
  /** 决策成本（一次性支出） */
  decisionCost: number;
  /** 决策收益（一次性收入） */
  decisionIncome?: number;
  /** 期末余额 */
  balance: number;
  /** 收支明细 */
  breakdown?: Array<{
    item: string;
    amount: number;
    type: 'passive_income' | 'passive_expense' | 'decision_cost' | 'decision_income';
  }>;
}

// ============ 事件相关 ============

export interface TurnEvent {
  /** 事件关键词（用于叙事高亮） */
  keyword: string;
  /** 事件类型 */
  type: 'positive' | 'negative' | 'neutral';
  /** 事件描述 */
  description: string;
  /** 影响的资源（兼容旧代码） */
  resource?: string;
  /** 影响的资源 */
  affectedResource?: string;
  /** 资源新值 */
  newValue?: number;
  /** 影响的主体ID列表 */
  affectedEntities?: string[];
  /** 是否为长时间线事件 */
  isLongTerm?: boolean;
  /** 剩余回合数（长时间线事件） */
  remainingRounds?: number;
}

// ============ 成就相关 ============

export interface TurnAchievement {
  /** 成就ID */
  id: string;
  /** 获得成就的主体ID */
  entityId: string;
  /** 成就标题 */
  title: string;
  /** 成就描述 */
  description: string;
  /** 触发原因 */
  triggerReason?: string;
  /** 成就图标 */
  icon?: string;
}

// ============ 评估卡片相关 ============

export interface AssessmentCard {
  /** 标题 */
  title: string;
  /** 内容摘要 */
  summary: string;
  /** 等级 */
  level?: 'low' | 'medium' | 'high';
  /** 详细说明 */
  details?: string[];
}

// ============ 主结果DTO ============

export interface TurnResultDTO {
  /** 回合标题（如：第X回合：20XX年上半年） */
  roundTitle?: string;
  
  /** 叙事文本（描述本回合关键事件与因果链路） */
  narrative: string;
  
  /** 事件列表 */
  events: TurnEvent[];
  
  /** 脱敏片段（战争迷雾用） */
  redactedSegments?: Array<{
    start: number;
    end: number;
    reason?: string;
  }>;
  
  /** 各主体面板 */
  perEntityPanel: TurnEntityPanel[];
  
  /** 排行榜 */
  leaderboard: TurnLeaderboardEntry[];
  
  /** 风险评估卡片 */
  riskCard: string | AssessmentCard;
  
  /** 机会评估卡片 */
  opportunityCard: string | AssessmentCard;
  
  /** 效益评估卡片 */
  benefitCard: string | AssessmentCard;
  
  /** 本回合解锁的成就 */
  achievements: TurnAchievement[];
  
  /** 周易卦象 */
  hexagram?: TurnHexagram;
  
  /** 决策选项（供下回合使用） - 旧格式，全局选项 */
  options?: TurnOption[];
  
  /** 各主体专属决策选项（供下回合使用） - 新格式，按主体分组 */
  perEntityOptions?: Record<string, TurnOption[]>;
  
  /** 财务核算 */
  ledger?: TurnLedger;
  
  /** 分支叙事线索 */
  branchingNarratives?: string[];
  
  /** 下回合提示 */
  nextRoundHints?: string;
  
  /** 现金流警告（余额接近临界时） */
  cashFlowWarning?: {
    entityId: string;
    message: string;
    severity: 'warning' | 'critical';
  }[];
}

// ============ 游戏初始化相关 ============

/** 游戏初始化配置 */
export interface GameInitConfig {
  /** 主体数量 */
  entityCount: number;
  /** 游戏模式 */
  gameMode: 'multi_control' | 'single_protagonist';
  /** 单主角模式下的主角ID */
  protagonistId?: string;
  /** 初始资金 */
  initialCash: number;
  /** 初始属性模板 */
  initialAttributes?: EntityAttributes;
  /** 被动收支公式描述 */
  passiveFormulaDesc?: string;
}

/** 游戏初始化结果（AI生成） */
export interface GameInitResult {
  /** 商业背景故事（约600字） */
  backgroundStory: string;
  /** 各主体初始状态 */
  entities: Array<{
    id: string;
    name: string;
    symbol?: string;
    cash: number;
    attributes: EntityAttributes;
    passiveIncome: number;
    passiveExpense: number;
    backstory?: string;
  }>;
  /** 年度卦象 */
  yearlyHexagram: TurnHexagram;
  /** 初始决策选项 */
  initialOptions: TurnOption[];
  /** 资金变动公式说明 */
  cashFormula: string;
}

// ============ 决策提交相关 ============

/** 玩家决策输入 */
export interface PlayerDecisionInput {
  /** 主体ID */
  entityId: string;
  /** 选择的选项ID（可多选） */
  selectedOptionIds?: string[];
  /** 自由文本决策 */
  freeText?: string;
  /** 决策类型 */
  actionType?: 'standard' | 'custom' | 'skip';
  /** 附加数据 */
  actionData?: Record<string, unknown>;
}

/** 主持人修改记录 */
export interface HostModification {
  /** 原始决策 */
  original: PlayerDecisionInput;
  /** 修改后决策 */
  modified: PlayerDecisionInput;
  /** 修改原因 */
  reason?: string;
  /** 修改时间 */
  modifiedAt: string;
}


