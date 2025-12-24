import React from 'react';
import { Users, Zap, TrendingUp, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip } from 'antd';

type ResourceKey = 'wealth' | 'power' | 'influence';

export interface IntelResource {
  value: number; // true value, never rendered directly
  min: number;
  max: number;
  confidence: number; // 0 - 1
  lastUpdatedMinutesAgo: number;
  source: 'public_signal' | 'private_leak' | 'historical_model';
}

export interface OpponentIntelRecord {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'thinking';
  avatarColor?: string;
  resources: Record<ResourceKey, IntelResource>;
}

export interface OpponentIntelProps {
  opponents: OpponentIntelRecord[];
  onOpenPrivateChannel?: (opponentId: string) => void;
  onProbeIntel?: (opponentId: string) => void;
}

const SOURCE_LABEL: Record<IntelResource['source'], string> = {
  public_signal: 'Public bulletin',
  private_leak: 'Private leak',
  historical_model: 'Historical model',
};

const STATUS_LABEL: Record<OpponentIntelRecord['status'], string> = {
  online: 'Online',
  offline: 'Offline',
  thinking: 'Thinking',
};

const RESOURCE_META: Record<
  ResourceKey,
  { label: string; icon: React.ReactNode; accent: string }
> = {
  wealth: {
    label: 'Wealth',
    icon: <TrendingUp size={12} className="text-amber-300" />,
    accent: 'from-amber-500/80 to-amber-400/40',
  },
  power: {
    label: 'Power',
    icon: <Zap size={12} className="text-rose-300" />,
    accent: 'from-rose-500/80 to-rose-400/40',
  },
  influence: {
    label: 'Influence',
    icon: <Users size={12} className="text-sky-300" />,
    accent: 'from-sky-500/80 to-sky-400/40',
  },
};

const formatRangeText = (min: number, max: number) => {
  const format = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
    return v.toFixed(0);
  };
  return `${format(min)} - ${format(max)}`;
};

const formatFuzzyValue = (value: number) => {
  // Render last digit as unknown to express uncertainty
  const base = Math.floor(value);
  const s = base.toString();
  if (s.length === 1) return '?';
  return `${s.slice(0, -1)}?`;
};

const OpponentIntel: React.FC<OpponentIntelProps> = ({
  opponents,
  onOpenPrivateChannel,
  onProbeIntel,
}) => {
  const renderUncertaintyBar = (r: IntelResource, accent: string) => {
    const total = Math.max(r.max, 1);
    const minPercent = Math.min(100, Math.max(0, (r.min / total) * 100));
    const maxPercent = Math.min(100, Math.max(minPercent, (r.max / total) * 100));

    const rangeWidth = maxPercent - minPercent;

    return (
      <div className="mt-1 h-1.5 w-full rounded-full bg-slate-900/90 overflow-hidden relative">
        {/* confirmed baseline */}
        <motion.div
          className={`absolute left-0 top-0 h-full bg-gradient-to-r ${accent}`}
          initial={{ width: `${minPercent * 0.8}%` }}
          animate={{ width: `${minPercent}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
        {/* potential range with stripes / opacity */}
        <motion.div
          className="absolute top-0 h-full bg-slate-100/10"
          style={{
            left: `${minPercent}%`,
          }}
          initial={{ width: `${rangeWidth * 0.7}%`, opacity: 0.6 }}
          animate={{ width: `${rangeWidth}%`, opacity: 0.35 }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        >
          <div className="w-full h-full opacity-60 bg-[linear-gradient(135deg,rgba(148,163,184,0.35)_0%,transparent_40%,transparent_60%,rgba(148,163,184,0.35)_100%)] bg-[length:16px_16px]" />
        </motion.div>
      </div>
    );
  };

  const renderValueCell = (key: ResourceKey, intel: IntelResource) => {
    const highConfidence = intel.confidence >= 0.7;
    const mediumConfidence = intel.confidence >= 0.5 && intel.confidence < 0.7;

    const baseText =
      highConfidence || mediumConfidence
        ? formatFuzzyValue(intel.value)
        : formatRangeText(intel.min, intel.max);

    const description =
      highConfidence || mediumConfidence
        ? 'Approximate point estimate'
        : 'Wide range estimate';

    const content = (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span className="font-mono">
            {baseText}
            {highConfidence ? '' : ''}
          </span>
          <span className="text-[10px] text-slate-500">
            {SOURCE_LABEL[intel.source]}
          </span>
        </div>
        {renderUncertaintyBar(intel, RESOURCE_META[key].accent)}
      </div>
    );

    const tooltipTitle = `${description} · Last updated ${intel.lastUpdatedMinutesAgo} min ago`;

    return (
      <Tooltip title={tooltipTitle} mouseEnterDelay={0.1} mouseLeaveDelay={0.05}>
        <div
          className={[
            'relative rounded-lg border border-slate-800/80 px-2 py-1.5 bg-slate-900/60',
            'backdrop-blur-md shadow-[0_0_0_1px_rgba(15,23,42,0.6)]',
            highConfidence
              ? 'hover:border-emerald-500/60'
              : mediumConfidence
                ? 'hover:border-amber-500/60'
                : 'hover:border-slate-500/60 animate-pulse',
          ].join(' ')}
        >
          {/* subtle noise / glow for low confidence */}
          {!highConfidence && (
            <div className="pointer-events-none absolute inset-0 rounded-lg bg-[radial-gradient(circle_at_top,rgba(248,250,252,0.15),transparent_55%)] opacity-50 mix-blend-screen" />
          )}
          {content}
        </div>
      </Tooltip>
    );
  };

  return (
    <section className="h-full w-full flex flex-col rounded-2xl border border-slate-800/80 bg-slate-950/40 backdrop-blur-xl shadow-[0_0_0_1px_rgba(15,23,42,0.8)]">
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs text-slate-300 tracking-[0.18em] uppercase">
          <EyeOff size={14} className="text-slate-400" />
          <span>Opponent Intel · Fog of War</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          Military · Cyber-Noir
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {opponents.map(op => (
          <div
            key={op.id}
            className="rounded-xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-3 py-2.5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="relative h-7 w-7 rounded-full border border-slate-700/80 bg-slate-900/80 flex items-center justify-center overflow-hidden hover:border-emerald-400/70 transition-colors"
                  onClick={() => onOpenPrivateChannel?.(op.id)}
                >
                  <div
                    className="absolute inset-0 opacity-60"
                    style={{
                      background:
                        op.avatarColor ||
                        'radial-gradient(circle_at_top,#22c55e33,#0f172a)',
                    }}
                  />
                  <Users size={14} className="relative text-slate-100" />
                </button>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-100 font-medium">
                    {op.name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {STATUS_LABEL[op.status]}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-full border border-slate-700/80 text-[10px] text-slate-300 hover:border-amber-400/70 hover:text-amber-200 transition-colors font-mono"
                  onClick={() => onProbeIntel?.(op.id)}
                >
                  Probe
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5 text-[11px] font-mono text-slate-200">
              {(Object.keys(RESOURCE_META) as ResourceKey[]).map(key => {
                const intel = op.resources[key];
                if (!intel) return null;
                const meta = RESOURCE_META[key];
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        {meta.icon}
                        <span>{meta.label}</span>
                      </span>
                    </div>
                    {renderValueCell(key, intel)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {opponents.length === 0 && (
          <div className="h-full flex items-center justify-center text-[11px] text-slate-600 font-mono">
            No opponent intel available.
          </div>
        )}
      </div>
    </section>
  );
};

export default OpponentIntel;


