import React, { useMemo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TurnLeaderboardEntry } from '../types/turnResult';

interface LeaderboardPanelProps {
  /** 排行榜数据 */
  entries: TurnLeaderboardEntry[];
  /** 当前玩家ID（用于高亮） */
  currentPlayerId?: string;
  /** 排序维度 */
  sortBy?: 'score' | 'cash' | 'marketShare';
  /** 是否显示详细分数 */
  showDetails?: boolean;
  /** 标题 */
  title?: string;
}

/**
 * LeaderboardPanel - 实时排行榜组件（浅色玻璃态风格）
 * - 支持动态排序
 * - 显示排名变化（上升/下降）
 * - 高亮当前玩家
 * - 支持多维度得分展示
 */
const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  entries,
  currentPlayerId,
  sortBy = 'score',
  showDetails = false,
  title = '全局排行榜',
}) => {
  // 按指定维度排序
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      const aValue = a.scoreBreakdown?.[sortBy] ?? a.score;
      const bValue = b.scoreBreakdown?.[sortBy] ?? b.score;
      return bValue - aValue;
    });
  }, [entries, sortBy]);

  // 计算最高分（用于进度条）
  const maxScore = useMemo(() => {
    return Math.max(...entries.map(e => e.score), 1);
  }, [entries]);

  // 获取排名变化图标
  const getRankChangeIcon = (change?: number) => {
    if (change === undefined || change === 0) {
      return <Minus size={12} className="text-slate-400" />;
    }
    if (change > 0) {
      return <TrendingUp size={12} className="text-emerald-500" />;
    }
    return <TrendingDown size={12} className="text-rose-500" />;
  };

  // 获取排名样式（浅色风格）
  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-amber-100 text-amber-600 border-amber-300';
    if (rank === 2) return 'bg-slate-100 text-slate-600 border-slate-300';
    if (rank === 3) return 'bg-orange-100 text-orange-600 border-orange-300';
    return 'bg-gray-100 text-slate-500 border-slate-200';
  };

  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-slate-400 text-sm">
        暂无排行榜数据
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Trophy size={16} className="text-amber-500" />
          {title}
        </div>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
          LIVE
        </span>
      </div>

      <div className="space-y-2">
        {sortedEntries.map((entry) => {
          const isCurrentPlayer = entry.id === currentPlayerId;
          const barWidth = Math.max(8, (entry.score / maxScore) * 100);
          const rankChange = entry.rankChange;

          return (
            <div
              key={entry.id}
              className={`
                relative rounded-lg border px-3 py-2 transition-all
                ${isCurrentPlayer 
                  ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-100' 
                  : 'bg-white border-slate-200 hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {/* 排名徽章 */}
                <div
                  className={`
                    w-8 h-8 rounded-lg flex items-center justify-center
                    text-sm font-bold border
                    ${getRankStyle(entry.rank)}
                  `}
                >
                  {entry.rank}
                </div>

                {/* 名称和分数 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium truncate ${isCurrentPlayer ? 'text-indigo-700' : 'text-slate-700'}`}>
                      {entry.name}
                      {isCurrentPlayer && (
                        <span className="ml-2 text-[10px] text-indigo-500">(你)</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-slate-600">
                        {entry.score.toLocaleString()}
                      </span>
                      {rankChange !== undefined && rankChange !== 0 && (
                        <span className={`flex items-center gap-0.5 text-[10px] ${rankChange > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {getRankChangeIcon(rankChange)}
                          {Math.abs(rankChange)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 分数进度条 */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        entry.rank === 1 
                          ? 'bg-gradient-to-r from-amber-400 to-amber-300' 
                          : isCurrentPlayer 
                            ? 'bg-gradient-to-r from-indigo-500 to-indigo-400'
                            : 'bg-slate-300'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* 详细分数（可选） */}
                  {showDetails && entry.scoreBreakdown && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(entry.scoreBreakdown).map(([key, value]) => (
                        <span
                          key={key}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-slate-500"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeaderboardPanel;
