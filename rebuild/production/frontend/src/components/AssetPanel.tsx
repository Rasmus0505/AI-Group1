import React, { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Award, TrendingUp } from 'lucide-react';
import { getSubjectTheme, SubjectId } from './gameSubjectTheme';

interface CashFlowInfo {
  cashBalance: number;
  passiveIncome: number;
  passiveExpense: number;
  decisionCost: number;
}

interface RankingEntry {
  subjectId: SubjectId;
  name: string;
  score: number;
  trend: 'up' | 'down' | 'flat';
}

interface AssetPanelProps {
  subjectId: SubjectId;
  cashFlow: CashFlowInfo;
  rankings: RankingEntry[];
  achievements: string[];
}

/**
 * AssetPanel
 * - Show detailed cash flow metrics and rankings.
 * - Contains "cash break predictor": trigger alert style when cash will be broken.
 */
const AssetPanel: React.FC<AssetPanelProps> = ({
  subjectId,
  cashFlow,
  rankings,
  achievements,
}) => {
  const theme = getSubjectTheme(subjectId);

  const willBreak = useMemo(() => {
    const required = cashFlow.passiveExpense + cashFlow.decisionCost;
    return cashFlow.cashBalance < required;
  }, [cashFlow]);

  const containerClass = willBreak
    ? 'bg-red-950/70 border-red-600/70'
    : 'bg-slate-950/60 border-slate-700/70';

  return (
    <div className="flex flex-col gap-4 h-full">
      <div
        className={[
          'rounded-2xl border px-4 py-3 shadow-sm transition-colors',
          containerClass,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Cash flow status</span>
          {willBreak ? (
            <span className="text-[10px] text-red-400 uppercase tracking-widest">
              Break risk
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">
              Stable
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-slate-400 mb-1">Balance</div>
            <div className="text-sm font-semibold text-slate-100">
              {cashFlow.cashBalance.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Passive income</div>
            <div className="text-sm font-semibold text-emerald-400">
              +{cashFlow.passiveIncome.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-slate-400 mb-1">Passive expense</div>
            <div className="text-sm font-semibold text-amber-400">
              -{cashFlow.passiveExpense.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-400">Decision exposure</span>
          <span className="text-slate-100 font-semibold">
            -{cashFlow.decisionCost.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-300 flex items-center gap-1">
            <TrendingUp size={14} className={theme.primaryColor} />
            Rankings
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Live</span>
        </div>
        <div className="space-y-1">
          {rankings.map(entry => {
            const entryTheme = getSubjectTheme(entry.subjectId);
            const trendIcon =
              entry.trend === 'up' ? (
                <ArrowUpRight size={12} className="text-emerald-400" />
              ) : entry.trend === 'down' ? (
                <ArrowDownRight size={12} className="text-red-400" />
              ) : null;
            return (
              <div
                key={entry.name}
                className="flex items-center justify-between text-[11px] bg-slate-900/60 rounded-lg px-2 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={[
                      'h-5 w-5 rounded-full border text-[10px] flex items-center justify-center',
                      entryTheme.borderColor,
                      entryTheme.softBg,
                      entryTheme.textColor,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {entryTheme.indicatorLabel}
                  </div>
                  <span className="text-slate-200">{entry.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-300 font-semibold">
                    {entry.score.toLocaleString()}
                  </span>
                  {trendIcon}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-300 flex items-center gap-1">
            <Award size={14} className={theme.primaryColor} />
            Achievements
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">
            Current round
          </span>
        </div>
        <div className="space-y-1 text-[11px] text-slate-300 overflow-y-auto">
          {achievements.length === 0 ? (
            <span className="text-slate-500">No key decisions unlocked this round.</span>
          ) : (
            achievements.map(item => (
              <div
                key={item}
                className={[
                  'px-2 py-1 rounded-lg border text-xs',
                  theme.softBg,
                  theme.borderColor,
                  theme.textColor,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {item}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetPanel;


