/**
 * 游戏推演结果类型定义（后端版本）
 * 与前端 turnResult.ts 保持同步
 */

// ============ 主体/实体相关 ============

export type EntityAttributes = Record<string, number | string | boolean>;

export interface TurnEntityPanel {
  id: string;
  name: string;
  symbol?: string;
  cash: number;
  attributes: EntityAttributes;
  passiveIncome: number;
  passiveExpense: number;
  delta: Record<string, number>;
  broken: boolean;
  bankruptReason?: string;
  achievementsUnlocked: string[];
  creditRating?: string;
  paletteKey?: string;
  accentColor?: string;
  intelConfidence?: number;
}

// ============ 排行榜相关 ============

export interface TurnLeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
  rankChange?: number;
  scoreBreakdown?: Record<string, number>;
}

// ============ 周易卦象相关 ============

export interface TurnHexagram {
  name: string;
  omen: 'positive' | 'neutral' | 'negative';
  lines: Array<'yang' | 'yin'>;
  text: string;
  colorHint?: string;
  yearlyTheme?: string;
}

// ============ 决策选项相关 ============

export interface TurnOption {
  id: string;
  title: string;
  description: string;
  expectedDelta?: Record<string, number>;
  category?: 'attack' | 'defense' | 'cooperation' | 'explore' | 'trade' | 'other';
  isMalicious?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

// ============ 财务核算相关 ============

export interface TurnLedger {
  startingCash: number;
  passiveIncome: number;
  passiveExpense: number;
  decisionCost: number;
  decisionIncome?: number;
  balance: number;
  breakdown?: Array<{
    item: string;
    amount: number;
    type: 'passive_income' | 'passive_expense' | 'decision_cost' | 'decision_income';
  }>;
}

// ============ 事件相关 ============

export interface TurnEvent {
  keyword: string;
  type: 'positive' | 'negative' | 'neutral';
  description: string;
  affectedResource?: string;
  newValue?: number;
  affectedEntities?: string[];
  isLongTerm?: boolean;
  remainingRounds?: number;
}

// ============ 成就相关 ============

export interface TurnAchievement {
  id: string;
  entityId: string;
  title: string;
  description: string;
  triggerReason?: string;
  icon?: string;
}

// ============ 评估卡片相关 ============

export interface AssessmentCard {
  title: string;
  summary: string;
  level?: 'low' | 'medium' | 'high';
  details?: string[];
}

// ============ 主结果DTO ============

export interface TurnResultDTO {
  roundTitle?: string;
  narrative: string;
  events: TurnEvent[];
  redactedSegments?: Array<{
    start: number;
    end: number;
    reason?: string;
  }>;
  perEntityPanel: TurnEntityPanel[];
  leaderboard: TurnLeaderboardEntry[];
  riskCard: string | AssessmentCard;
  opportunityCard: string | AssessmentCard;
  benefitCard: string | AssessmentCard;
  achievements: TurnAchievement[];
  hexagram?: TurnHexagram;
  options?: TurnOption[];
  ledger?: TurnLedger;
  branchingNarratives?: string[];
  nextRoundHints?: string;
  cashFlowWarning?: {
    entityId: string;
    message: string;
    severity: 'warning' | 'critical';
  }[];
}

// ============ 游戏初始化相关 ============

export interface GameInitConfig {
  entityCount: number;
  gameMode: 'multi_control' | 'single_protagonist';
  protagonistId?: string;
  initialCash: number;
  initialAttributes?: EntityAttributes;
  passiveFormulaDesc?: string;
}

export interface GameInitResult {
  backgroundStory: string;
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
  yearlyHexagram: TurnHexagram;
  initialOptions: TurnOption[];
  cashFormula: string;
}

// ============ 决策提交相关 ============

export interface PlayerDecisionInput {
  entityId: string;
  selectedOptionIds?: string[];
  freeText?: string;
  actionType?: 'standard' | 'custom' | 'skip';
  actionData?: Record<string, unknown>;
}

export interface HostModification {
  original: PlayerDecisionInput;
  modified: PlayerDecisionInput;
  reason?: string;
  modifiedAt: string;
}

// ============ JSON Schema 用于 Prompt ============

/**
 * 生成 TurnResultDTO 的 JSON Schema 描述（用于 Prompt）
 */
export const TURN_RESULT_JSON_SCHEMA = `
{
  "roundTitle": "string (回合标题，如：第1回合：2024年上半年)",
  "narrative": "string (叙事文本，描述本回合关键事件与因果链路，时间节奏按季度/半年)",
  "events": [
    {
      "keyword": "string (事件关键词)",
      "type": "positive|negative|neutral",
      "description": "string (事件描述)",
      "affectedResource": "string (可选，影响的资源名)",
      "newValue": "number (可选，资源新值)",
      "affectedEntities": ["string"] (可选，影响的主体ID列表),
      "isLongTerm": "boolean (可选，是否为长时间线事件)",
      "remainingRounds": "number (可选，剩余回合数)"
    }
  ],
  "perEntityPanel": [
    {
      "id": "string (主体ID，如 A, B, C)",
      "name": "string (主体中文名称)",
      "cash": "number (现金余额)",
      "attributes": { "属性名": "number|string" } (动态属性字典),
      "passiveIncome": "number (被动收入)",
      "passiveExpense": "number (被动支出)",
      "delta": { "属性名": "number" } (本回合变动),
      "broken": "boolean (是否破产)",
      "bankruptReason": "string (可选，破产原因)",
      "achievementsUnlocked": ["string"] (本回合解锁的成就ID),
      "intelConfidence": "number (可选，0-1，情报置信度)"
    }
  ],
  "leaderboard": [
    {
      "id": "string",
      "name": "string",
      "score": "number",
      "rank": "number",
      "rankChange": "number (可选，排名变化)"
    }
  ],
  "hexagram": {
    "name": "string (卦名)",
    "omen": "positive|neutral|negative",
    "lines": ["yang"|"yin"] (6个爻，从下到上),
    "text": "string (象曰/解释)"
  },
  "ledger": {
    "startingCash": "number",
    "passiveIncome": "number",
    "passiveExpense": "number",
    "decisionCost": "number",
    "balance": "number"
  },
  "options": [
    {
      "id": "string (1, 2, 3)",
      "title": "string (选项标题)",
      "description": "string (选项描述)",
      "expectedDelta": { "资源名": "number" } (预期变动)
    }
  ],
  "riskCard": "string (企业风险简评)",
  "opportunityCard": "string (企业机会简评)",
  "benefitCard": "string (当前效益简评)",
  "achievements": [
    {
      "id": "string",
      "entityId": "string",
      "title": "string",
      "description": "string",
      "triggerReason": "string (可选)"
    }
  ],
  "branchingNarratives": ["string"] (可选，分支叙事线索),
  "nextRoundHints": "string (可选，下回合提示)",
  "cashFlowWarning": [
    {
      "entityId": "string",
      "message": "string",
      "severity": "warning|critical"
    }
  ] (可选，现金流警告)
}
`;

/**
 * 生成 GameInitResult 的 JSON Schema 描述（用于初始化 Prompt）
 */
export const GAME_INIT_JSON_SCHEMA = `
{
  "backgroundStory": "string (商业背景故事，约600字，自然段落小说形式)",
  "entities": [
    {
      "id": "string (A, B, C...)",
      "name": "string (中文名称，如：蓝鲸工业)",
      "cash": "number (初始现金)",
      "attributes": { "市场份额": "number", "品牌声誉": "number", ... },
      "passiveIncome": "number (每回合被动收入)",
      "passiveExpense": "number (每回合被动支出)",
      "backstory": "string (可选，主体背景简介)"
    }
  ],
  "yearlyHexagram": {
    "name": "string",
    "omen": "positive|neutral|negative",
    "lines": ["yang"|"yin"],
    "text": "string",
    "yearlyTheme": "string (年度叙事暗线)"
  },
  "initialOptions": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "expectedDelta": { "资源名": "number" }
    }
  ],
  "cashFormula": "string (资金变动公式说明)"
}
`;
