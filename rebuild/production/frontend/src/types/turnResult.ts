export interface TurnEntityPanel {
  id: string;
  name: string;
  cash: number;
  marketShare?: number;
  reputation?: number;
  innovation?: number;
  passiveIncome: number;
  passiveExpense: number;
  delta: Record<string, number>;
  broken: boolean;
  achievementsUnlocked: string[];
  creditRating?: string;
  paletteKey?: string;
  accentColor?: string;
}

export interface TurnLeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
  rankChange?: number;
}

export interface TurnHexagram {
  name: string;
  omen: 'positive' | 'neutral' | 'negative';
  lines: Array<'yang' | 'yin'>;
  text: string;
  colorHint?: string;
}

export interface TurnOption {
  id: string;
  title: string;
  description: string;
  expectedDelta?: Record<string, number>;
}

export interface TurnLedger {
  startingCash: number;
  passiveIncome: number;
  passiveExpense: number;
  decisionCost: number;
  balance: number;
}

export interface TurnResultDTO {
  narrative: string;
  events: Array<{
    keyword: string;
    resource: string;
    newValue: number;
  }>;
  redactedSegments?: Array<{
    start: number;
    end: number;
  }>;
  perEntityPanel: TurnEntityPanel[];
  leaderboard: TurnLeaderboardEntry[];
  riskCard: string;
  opportunityCard: string;
  benefitCard: string;
  achievements: Array<{
    id: string;
    entityId: string;
    title: string;
    description: string;
  }>;
  hexagram?: TurnHexagram;
  options?: TurnOption[];
  ledger?: TurnLedger;
  branchingNarratives?: string[];
  nextRoundHints?: string;
}


