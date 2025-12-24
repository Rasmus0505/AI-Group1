import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { getSubjectTheme, SubjectId } from './gameSubjectTheme';

interface SuggestionChange {
  label: string;
  delta: number;
}

interface DecisionSuggestion {
  id: number;
  title: string;
  description: string;
  expectedChanges: SuggestionChange[];
}

interface OpponentStatus {
  id: string;
  name: string;
  isLocked: boolean;
}

interface DecisionConsoleProps {
  subjectId: SubjectId;
  suggestions: DecisionSuggestion[];
  opponents?: OpponentStatus[];
}

/**
 * DecisionConsole
 * - Show AI suggestions with expected attribute changes.
 * - Provide free-form input and a submit button that locks after click.
 */
const DecisionConsole: React.FC<DecisionConsoleProps> = ({
  subjectId,
  suggestions,
  opponents,
}) => {
  const theme = getSubjectTheme(subjectId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [locked, setLocked] = useState(false);

  const handleSubmit = () => {
    if (locked) return;
    if (!text.trim() && selectedId == null) {
      return;
    }
    setLocked(true);
  };

  const renderChange = (change: SuggestionChange) => {
    const colorClass =
      change.delta > 0 ? 'text-emerald-400' : change.delta < 0 ? 'text-red-400' : 'text-slate-300';
    const sign = change.delta > 0 ? '+' : '';
    return (
      <span key={change.label} className={`text-[10px] ${colorClass}`}>
        {change.label}: {sign}
        {change.delta}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-950/70 border border-slate-800/70 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-[0.3em]">
            Command console
          </span>
          <span className="text-[10px] text-slate-500">
            Choose suggestion or describe a custom decision.
          </span>
        </div>
        <span
          className={[
            'h-6 px-2 rounded-full border text-[10px] flex items-center',
            theme.borderColor,
            theme.softBg,
            theme.textColor,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          Subject {theme.indicatorLabel}
        </span>
      </div>

      {opponents && opponents.length > 0 && (
        <div className="mb-3 rounded-xl border border-slate-800/80 bg-slate-950/80 px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-300">Opponent status</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">
              Live
            </span>
          </div>
          <div className="space-y-1 text-[11px]">
            {opponents.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between text-slate-300"
              >
                <span>{item.name}</span>
                <span className="flex items-center gap-1">
                  <span
                    className={[
                      'h-1.5 w-1.5 rounded-full',
                      item.isLocked ? 'bg-emerald-400' : 'bg-amber-400',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                  <span className="text-[10px] text-slate-400">
                    {item.isLocked ? 'Locked' : 'Thinking'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 mb-3">
        {suggestions.map(s => (
          <button
            key={s.id}
            type="button"
            disabled={locked}
            onClick={() => setSelectedId(s.id)}
            className={[
              'w-full text-left rounded-xl border px-3 py-2 text-xs transition',
              selectedId === s.id
                ? theme.softBg + ' ' + theme.borderColor
                : 'border-slate-700/70 bg-slate-900/60 hover:bg-slate-900',
              locked ? 'opacity-60 cursor-not-allowed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-100">
                {s.id}. {s.title}
              </span>
              <span className="text-[10px] text-slate-500">AI suggestion</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-1 leading-snug">{s.description}</p>
            <div className="flex flex-wrap gap-2">{s.expectedChanges.map(renderChange)}</div>
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        <textarea
          rows={4}
          value={text}
          disabled={locked}
          onChange={e => setText(e.target.value)}
          className={[
            'w-full flex-1 bg-slate-950/80 border rounded-xl px-3 py-2 text-xs text-slate-100 resize-none outline-none',
            locked
              ? 'border-slate-700/70'
              : theme.borderColor + ' shadow-[0_0_0_1px_rgba(148,163,184,0.6)]',
          ]
            .filter(Boolean)
            .join(' ')}
          placeholder="Describe a custom decision if you do not want to follow any suggestion."
        />
      </div>

      <motion.button
        type="button"
        onClick={handleSubmit}
        disabled={locked}
        whileTap={locked ? undefined : { scale: 0.97 }}
        className={[
          'mt-3 w-full inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition',
          locked
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : 'bg-slate-100 text-slate-950 hover:bg-slate-300',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {locked ? 'Locked, waiting for other subjects...' : 'Submit decision'}
      </motion.button>
    </div>
  );
};

export default DecisionConsole;


