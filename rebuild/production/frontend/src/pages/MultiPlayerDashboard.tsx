import React, { useEffect, useMemo, useState } from 'react';
import { Shield, Wallet, Users, Clock, Activity, Send, History } from 'lucide-react';

// ========================
// Phase definition
// ========================

type Phase = 'READING_PHASE' | 'DECISION_PHASE' | 'WAITING_PHASE';

// ========================
// Timer Component
// ========================

interface PhaseTimerProps {
  totalSeconds: number;
  remainingSeconds: number;
  phase: Phase;
}

/**
 * PhaseTimer
 * - 显示一个条状倒计时进度条
 * - 剩余时间进入最后 10 秒时变为红色，并带有轻微动画
 */
const PhaseTimer: React.FC<PhaseTimerProps> = ({ totalSeconds, remainingSeconds, phase }) => {
  const percent = Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100));

  const isDanger = remainingSeconds <= 10 && phase === 'DECISION_PHASE';

  const barColor = useMemo(() => {
    if (phase === 'WAITING_PHASE') return 'bg-slate-500';
    if (isDanger) return 'bg-red-500';
    if (phase === 'DECISION_PHASE') return 'bg-emerald-500';
    return 'bg-amber-400';
  }, [phase, isDanger]);

  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-1 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Clock size={14} />
          {phase === 'READING_PHASE' && <span>Reading phase</span>}
          {phase === 'DECISION_PHASE' && <span>Decision phase</span>}
          {phase === 'WAITING_PHASE' && <span>Waiting for other players</span>}
        </span>
        <span className={isDanger ? 'text-red-400 font-semibold' : ''}>
          {remainingSeconds}s
        </span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <div
          className={[
            'h-full transition-all duration-300 ease-out',
            barColor,
            isDanger ? 'animate-pulse' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// ========================
// Asset Panel
// ========================

interface AssetState {
  cash: number;
  reputation: number;
  power: number;
}

interface AssetPanelProps {
  assets: AssetState;
  onSnapshotClick?: (index: number) => void;
}

/**
 * AssetPanel
 * - 左侧个人资产与状态展示
 * - 包含简单的历史快照列表（仅 UI 预览用）
 */
const AssetPanel: React.FC<AssetPanelProps> = ({ assets, onSnapshotClick }) => {
  const snapshots = [
    { round: 1, summary: 'Conservative expansion, stable cash flow.' },
    { round: 2, summary: 'Aggressive pricing, market share increased.' },
    { round: 3, summary: 'Credit tightening, liquidity risk rising.' },
  ];

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center">
          <Users size={18} className="text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-100">Player A</span>
          <span className="text-xs text-slate-500">Synchronous strategic game</span>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Wallet size={14} />
            Cash
          </span>
          <span className="font-semibold text-slate-100">{assets.cash}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${Math.min(100, assets.cash / 20)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
          <span className="flex items-center gap-1">
            <Shield size={14} />
            Reputation
          </span>
          <span className="font-semibold text-slate-100">{assets.reputation}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${assets.reputation}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
          <span className="flex items-center gap-1">
            <Activity size={14} />
            Power
          </span>
          <span className="font-semibold text-slate-100">{assets.power}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-400 transition-all"
            style={{ width: `${assets.power}%` }}
          />
        </div>
      </div>

      <div className="flex-1 bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 tracking-wide flex items-center gap-1">
            <History size={14} />
            History snapshots
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">last 3 rounds</span>
        </div>
        <div className="space-y-2 overflow-y-auto">
          {snapshots.map((item, index) => (
            <button
              key={item.round}
              type="button"
              onClick={() => onSnapshotClick && onSnapshotClick(index)}
              className="w-full text-left text-xs bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg p-2 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-200 font-medium">Round {item.round}</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-snug">{item.summary}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ========================
// Narrative Display
// ========================

interface NarrativeDisplayProps {
  markdownText: string;
}

/**
 * NarrativeDisplay
 * - 中部文本阅读区，使用较大的行距与 serif 字体
 * - 简单高亮关键经济指标（示例：匹配包含 "%" 的词）
 */
const NarrativeDisplay: React.FC<NarrativeDisplayProps> = ({ markdownText }) => {
  const highlighted = useMemo(() => {
    const tokens = markdownText.split(' ');
    return tokens.map((word, index) => {
      const isIndicator = word.includes('%') || /GDP|inflation|interest/i.test(word);
      if (isIndicator) {
        return (
          <span
            key={`${word}-${index}`}
            className="inline-block px-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 mx-0.5"
          >
            {word}
          </span>
        );
      }
      return (
        <span key={`${word}-${index}`} className="mx-0.5">
          {word}
        </span>
      );
    });
  }, [markdownText]);

  return (
    <div className="h-full flex flex-col bg-slate-900/60 border border-slate-700/60 rounded-2xl p-5">
      <div className="flex-1 overflow-y-auto">
        <div className="prose prose-invert max-w-none font-serif text-slate-100 text-sm leading-7">
          {highlighted}
        </div>
      </div>
    </div>
  );
};

// ========================
// Action Control Panel
// ========================

interface ResourceAllocation {
  cash: number;
  marketing: number;
  research: number;
}

interface ActionControlProps {
  phase: Phase;
  allocation: ResourceAllocation;
  onAllocationChange: (next: ResourceAllocation) => void;
}

/**
 * ActionControl
 * - 右侧决策面板：资源分配滑块 + 策略文本输入 + 提交按钮
 * - 资源滑块总和受到约束，模拟预算上限
 * - 不同 Phase 下控件的可用状态不同
 */
const ActionControl: React.FC<ActionControlProps> = ({ phase, allocation, onAllocationChange }) => {
  const [strategy, setStrategy] = useState('');
  const disabled = phase !== 'DECISION_PHASE';

  // 简单联动：保持总和不超过 100
  const handleSliderChange = (key: keyof ResourceAllocation, value: number) => {
    const raw = { ...allocation, [key]: value };
    const total = raw.cash + raw.marketing + raw.research;

    if (total <= 100) {
      onAllocationChange(raw);
      return;
    }

    // 如果超过 100，则按比例缩放其他两个资源
    const over = total - 100;
    const othersKeys = (['cash', 'marketing', 'research'] as (keyof ResourceAllocation)[]).filter(
      k => k !== key,
    );
    const othersSum = othersKeys.reduce((acc, k) => acc + raw[k], 0);

    if (othersSum <= 0) {
      onAllocationChange({ ...raw, [key]: Math.max(0, 100 - othersSum) });
      return;
    }

    const adjusted = { ...raw };
    othersKeys.forEach(k => {
      const part = (raw[k] / othersSum) * over;
      adjusted[k] = Math.max(0, raw[k] - part);
    });

    onAllocationChange(adjusted);
  };

  const handleSubmit = () => {
    // 此处不做实际提交逻辑，只保留占位，方便后续接入后端
    // 可以加入简单的前端校验
    if (!strategy.trim()) {
      return;
    }
  };

  const renderSlider = (label: string, key: keyof ResourceAllocation, color: string) => (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{Math.round(allocation[key])}%</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={allocation[key]}
          disabled={disabled}
          onChange={e => handleSliderChange(key, Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
        <div className={`w-2 h-2 rounded-full ${color}`} />
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-widest">
            Strategy panel
          </span>
          <span className="text-[10px] text-slate-500">
            Allocate resources and describe your intention
          </span>
        </div>
        <span
          className={[
            'px-2 py-0.5 text-[10px] rounded-full border',
            phase === 'DECISION_PHASE'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-900/20'
              : 'border-slate-600 text-slate-400 bg-slate-800/40',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {phase === 'DECISION_PHASE' ? 'Active' : 'Locked'}
        </span>
      </div>

      <div className="mb-2 text-[11px] text-slate-400">
        <span>Total budget is limited. Moving one slider will affect the available room of others.</span>
      </div>

      {renderSlider('Cash reserve', 'cash', 'bg-emerald-400')}
      {renderSlider('Marketing', 'marketing', 'bg-amber-400')}
      {renderSlider('Research', 'research', 'bg-sky-400')}

      <div className="mt-2 mb-2 text-[10px] text-slate-500 flex justify-between">
        <span>Sum</span>
        <span>
          {Math.round(allocation.cash + allocation.marketing + allocation.research)}
          %
        </span>
      </div>

      <div className="mt-2 flex-1 flex flex-col">
        <textarea
          rows={5}
          value={strategy}
          disabled={disabled}
          onChange={e => setStrategy(e.target.value)}
          className={[
            'w-full flex-1 bg-slate-950/70 border rounded-xl px-3 py-2 text-xs text-slate-100 resize-none outline-none',
            phase === 'DECISION_PHASE'
              ? 'border-emerald-500/60 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]'
              : 'border-slate-700/70',
          ]
            .filter(Boolean)
            .join(' ')}
          placeholder={
            phase === 'DECISION_PHASE'
              ? 'Describe your strategic intention for this round...'
              : 'You can edit strategy when decision phase starts.'
          }
        />
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={handleSubmit}
        className={[
          'mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
          disabled
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Send size={16} />
        {phase === 'WAITING_PHASE' ? 'Waiting for other players...' : 'Submit decision'}
      </button>
    </div>
  );
};

// ========================
// Page Component
// ========================

const MultiPlayerDashboard: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('READING_PHASE');
  const [remainingSeconds, setRemainingSeconds] = useState(45);
  const totalSeconds = 45;

  const [assets] = useState<AssetState>({
    cash: 1200,
    reputation: 70,
    power: 55,
  });

  const [allocation, setAllocation] = useState<ResourceAllocation>({
    cash: 40,
    marketing: 35,
    research: 25,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          // 简单模拟阶段切换
          if (phase === 'READING_PHASE') {
            setPhase('DECISION_PHASE');
            return totalSeconds;
          }
          if (phase === 'DECISION_PHASE') {
            setPhase('WAITING_PHASE');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, totalSeconds]);

  const narrativeMock = `
Global inflation has reached 5% while regional GDP growth slows down.
Your board is split between tightening credit and launching an aggressive acquisition campaign.
Meanwhile, interest rates remain at 3%, creating a narrow but critical window for leverage.
Any delay will increase default risk across your portfolio and may trigger a liquidity crisis.
  `;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-6">
      <div className="max-w-7xl mx-auto h-[calc(100vh-3rem)] flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs tracking-[0.35em] uppercase text-slate-500">Synchronous AI game</span>
            <h1 className="mt-1 text-xl font-semibold text-slate-100">Strategic Command Dashboard</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Room #042 · 3 players connected</span>
          </div>
        </header>

        <PhaseTimer totalSeconds={totalSeconds} remainingSeconds={remainingSeconds} phase={phase} />

        <main className="flex-1 flex gap-4">
          {/* Left: 20% */}
          <section className="w-1/5 min-w-[220px]">
            <AssetPanel assets={assets} />
          </section>

          {/* Center: 55% */}
          <section className="flex-1">
            <NarrativeDisplay markdownText={narrativeMock} />
          </section>

          {/* Right: 25% */}
          <section className="w-1/4 min-w-[260px]">
            <ActionControl phase={phase} allocation={allocation} onAllocationChange={setAllocation} />
          </section>
        </main>
      </div>
    </div>
  );
};

export default MultiPlayerDashboard;


