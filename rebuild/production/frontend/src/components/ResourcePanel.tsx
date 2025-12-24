import React from 'react';
import { Shield, Sword, Eye, Trophy } from 'lucide-react';

interface PlayerResources {
  money: number;
  force: number;
  influence: number;
  intelLevel: number;
}

interface OpponentIntel {
  id: string;
  name: string;
  moneyMin: number;
  moneyMax: number;
  confidence: 'low' | 'medium' | 'high';
}

interface ResourcePanelProps {
  player: PlayerResources;
  opponents: OpponentIntel[];
}

/**
 * ResourcePanel
 * - Left sidebar for player multi-dimensional resources.
 * - Shows "incomplete information" opponent intel using range plus blur effect.
 *
 * 非完全信息视觉遮蔽逻辑说明：
 * - 对手的具体数值不直接展示，而是用 moneyMin - moneyMax 的范围文案；
 * - 范围文本添加 Tailwind 的 blur-sm 滤镜，使玩家只能感知大致区间；
 * - 可以根据 confidence 调整模糊强度或文本颜色，以表达情报可信度。
 */
const ResourcePanel: React.FC<ResourcePanelProps> = ({ player, opponents }) => {
  const renderBar = (label: string, value: number, max: number, color: string, icon: React.ReactNode) => {
    const percent = Math.max(0, Math.min(100, (value / max) * 100));
    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            {icon}
            {label}
          </span>
          <span className="font-mono text-slate-100">{value}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  const confidenceLabel = (level: OpponentIntel['confidence']) => {
    if (level === 'high') return 'High confidence';
    if (level === 'medium') return 'Medium confidence';
    return 'Low confidence';
  };

  return (
    <aside className="h-full flex flex-col bg-[#0b0b0d] border border-slate-800 rounded-2xl px-4 py-4 gap-4">
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-[0.25em] mb-2">
          Intel and assets
        </div>
        {renderBar('Money', player.money, 1000, 'bg-yellow-500', <Trophy size={14} className="text-yellow-400" />)}
        {renderBar('Force', player.force, 100, 'bg-red-500', <Sword size={14} className="text-red-400" />)}
        {renderBar(
          'Influence',
          player.influence,
          100,
          'bg-sky-500',
          <Shield size={14} className="text-sky-400" />,
        )}
        {renderBar(
          'Intel level',
          player.intelLevel,
          100,
          'bg-emerald-500',
          <Eye size={14} className="text-emerald-400" />,
        )}
      </div>

      <div className="flex-1 flex flex-col mt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-300 flex items-center gap-1">
            <Eye size={14} className="text-slate-400" />
            Opponent intel
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Partial</span>
        </div>
        <div className="space-y-2 text-xs overflow-y-auto">
          {opponents.map(o => (
            <div
              key={o.id}
              className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 flex flex-col"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-200 font-medium">{o.name}</span>
                <span className="text-[10px] text-slate-500">{confidenceLabel(o.confidence)}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                <span className="mr-1">Money window:</span>
                {/* 模糊呈现的范围文本，实现“非完全信息”遮蔽效果 */}
                <span className="font-mono text-slate-300 blur-sm hover:blur-none transition">
                  ${o.moneyMin.toLocaleString()} - ${o.moneyMax.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          {opponents.length === 0 && (
            <div className="text-[11px] text-slate-500">No intel collected yet.</div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default ResourcePanel;


