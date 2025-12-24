import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import ResourcePanel from '../components/ResourcePanel';
import NarrativeFeed from '../components/NarrativeFeed';
import ChatSystem from '../components/ChatSystem';

type PhaseState = 'READING' | 'DECIDING' | 'RESOLVING';

interface AllocationState {
  a: number;
  b: number;
  c: number;
}

/**
 * GameDashboard
 * - Main 16:9 style dashboard layout for financial cyber-noir game.
 * - Implements four regions:
 *   Left: ResourcePanel
 *   Center: NarrativeFeed
 *   Right: ChatSystem
 *   Bottom: Decision console as a sliding drawer with resource sliders.
 */
const GameDashboard: React.FC = () => {
  const [phase, setPhase] = useState<PhaseState>('READING');
  const [totalSeconds] = useState(60);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [allocation, setAllocation] = useState<AllocationState>({ a: 40, b: 35, c: 25 });
  const [previewResource, setPreviewResource] = useState(100);
  const [lastSharedSnippet, setLastSharedSnippet] = useState('');

  // simple phase timer and state machine
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          if (phase === 'READING') {
            setPhase('DECIDING');
            return totalSeconds;
          }
          if (phase === 'DECIDING') {
            setPhase('RESOLVING');
            return 5;
          }
          if (phase === 'RESOLVING') {
            setPhase('READING');
            return totalSeconds;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, totalSeconds]);

  useEffect(() => {
    // update preview for remaining resources based on allocation
    const totalAllocated = allocation.a + allocation.b + allocation.c;
    const base = 100;
    setPreviewResource(Math.max(0, base - totalAllocated));
  }, [allocation]);

  // resource linking: keep total bounded to 100
  const handleSliderChange = (key: keyof AllocationState, value: number) => {
    const updated: AllocationState = { ...allocation, [key]: value };
    const sum = updated.a + updated.b + updated.c;
    if (sum <= 100) {
      setAllocation(updated);
      return;
    }
    // if over limit, scale down other sliders
    const over = sum - 100;
    const keys = (['a', 'b', 'c'] as (keyof AllocationState)[]).filter(k => k !== key);
    const othersSum = keys.reduce((acc, k) => acc + allocation[k], 0);
    if (othersSum <= 0) {
      setAllocation({ ...updated, [key]: Math.max(0, 100 - othersSum) });
      return;
    }
    const adjusted = { ...updated };
    keys.forEach(k => {
      const ratio = allocation[k] / othersSum;
      adjusted[k] = Math.max(0, allocation[k] - over * ratio);
    });
    setAllocation(adjusted);
  };

  const narrativeText = `
Global inflation has reached 5% while regional credit spreads widen sharply.
Negotiations around a potential debt restructuring are constrained by leverage ratios and looming default risk.
Your position is exposed to both liquidity shortage and counterparty failure, while AI-driven funds increase volatility.
Any delay in decision will shrink the negotiation window and worsen market perception of your balance sheet.
  `;

  const renderSlider = (label: string, key: keyof AllocationState, color: string) => (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400 font-mono">
          {Math.round(allocation[key])}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={allocation[key]}
          onChange={e => handleSliderChange(key, Number(e.target.value))}
          disabled={phase !== 'DECIDING'}
          className="w-full accent-emerald-400"
        />
        <div className={`w-2 h-2 rounded-full ${color}`} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050507] text-slate-100 flex flex-col items-center justify-center">
      <div className="w-full h-screen max-h-[900px] max-w-7xl px-6 py-6">
        <div className="h-full flex flex-col gap-4">
          <header className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                Financial cyber-noir
              </span>
              <h1 className="mt-1 text-lg font-semibold text-slate-100">
                Strategic Game Dashboard
              </h1>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Phase: {phase}
            </div>
          </header>

          <main className="flex-1 flex flex-col gap-3">
            <div className="flex-1 grid grid-cols-12 gap-3">
              {/* Left sidebar: 20% */}
              <div className="col-span-3">
                <ResourcePanel
                  player={{
                    money: 720,
                    force: 65,
                    influence: 58,
                    intelLevel: 80,
                  }}
                  opponents={[
                    { id: 'b', name: 'Rival fund', moneyMin: 120000, moneyMax: 200000, confidence: 'medium' },
                    { id: 'c', name: 'Regional bank', moneyMin: 80000, moneyMax: 160000, confidence: 'low' },
                  ]}
                />
              </div>

              {/* Center: 50% */}
              <div className="col-span-6">
                <NarrativeFeed
                  phase={phase}
                  fullText={narrativeText}
                  totalSeconds={totalSeconds}
                  remainingSeconds={remainingSeconds}
                  onShareSnippet={setLastSharedSnippet}
                />
              </div>

              {/* Right sidebar: 30% */}
              <div className="col-span-3">
                <ChatSystem lastSharedSnippet={lastSharedSnippet} />
              </div>
            </div>

            {/* Bottom decision console drawer */}
            <div className="relative">
              <motion.div
                initial={false}
                animate={{ y: drawerOpen ? 0 : 80 }}
                transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                className="bg-[#0a0a0b] border border-slate-800 rounded-2xl px-4 pt-2 pb-3 shadow-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setDrawerOpen(prev => !prev)}
                  className="mx-auto mb-2 flex items-center justify-center text-[11px] text-slate-400"
                >
                  <span className="h-1 w-10 rounded-full bg-slate-700" />
                </button>
                {drawerOpen && (
                  <div className="grid grid-cols-4 gap-4 text-xs">
                    <div className="col-span-3">
                      <div className="text-[11px] text-slate-400 mb-2">
                        Resource allocation
                        <span className="ml-2 text-[10px] text-slate-500">
                          Total budget fixed, sliders are linked.
                        </span>
                      </div>
                      {renderSlider('Operational cash', 'a', 'bg-yellow-400')}
                      {renderSlider('Strategic positions', 'b', 'bg-red-400')}
                      {renderSlider('Information operations', 'c', 'bg-emerald-400')}
                    </div>
                    <div className="col-span-1 flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] text-slate-400 mb-1">
                          Estimated remaining
                        </div>
                        <div className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900">
                          <div className="text-[10px] text-slate-500 mb-1">
                            After this allocation
                          </div>
                          <div className="text-base font-mono text-yellow-300">
                            {previewResource.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={phase !== 'DECIDING'}
                        className={[
                          'mt-2 w-full rounded-xl px-3 py-2 text-xs font-semibold',
                          phase === 'DECIDING'
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        Confirm decision
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </main>
        </div>

        {phase === 'RESOLVING' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-none"
          >
            <div className="px-6 py-4 rounded-2xl border border-slate-700 bg-[#050508] shadow-2xl">
              <div className="text-xs text-slate-400 mb-1 text-center uppercase tracking-[0.3em]">
                AI engine
              </div>
              <div className="text-sm text-slate-100 text-center">
                Resolving decisions and updating resource states...
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default GameDashboard;


