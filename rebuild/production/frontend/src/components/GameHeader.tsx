import React from 'react';
import { motion } from 'framer-motion';
import { getSubjectTheme, SubjectId } from './gameSubjectTheme';

interface GameHeaderProps {
  subjectId: SubjectId;
  yearLabel: string;
  hexagramName: string;
  hexagramMeaning: string;
  revealed: boolean;
  onToggleReveal?: () => void;
}

/**
 * GameHeader
 * - Show current year/half label and I-Ching hexagram card.
 * - Hexagram card supports simple flip animation from hidden to revealed.
 */
const GameHeader: React.FC<GameHeaderProps> = ({
  subjectId,
  yearLabel,
  hexagramName,
  hexagramMeaning,
  revealed,
  onToggleReveal,
}) => {
  const theme = getSubjectTheme(subjectId);

  return (
    <header className="w-full flex flex-col items-center mb-4">
      <div className="text-xs tracking-[0.35em] uppercase text-slate-500">
        {yearLabel}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div
          className={[
            'h-6 w-6 rounded-full border text-xs font-semibold flex items-center justify-center',
            theme.borderColor,
            theme.softBg,
            theme.textColor,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {theme.indicatorLabel}
        </div>
        <h1 className="text-lg font-semibold text-slate-100">Strategic Year Overview</h1>
      </div>

      <motion.div
        className="mt-4"
        initial={false}
        animate={{ rotateY: revealed ? 0 : 180 }}
        transition={{ duration: 0.6 }}
      >
        <button
          type="button"
          onClick={onToggleReveal}
          className={[
            'w-64 h-28 rounded-2xl border bg-slate-900/80 px-4 py-3 flex flex-col justify-between shadow-lg backdrop-blur',
            theme.borderColor,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {revealed ? (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>I-Ching Hexagram</span>
                <span className={theme.primaryColor}>{hexagramName}</span>
              </div>
              <p className="text-[11px] text-slate-200 leading-snug mt-1">
                {hexagramMeaning}
              </p>
              <div className="text-[10px] text-slate-500 text-right mt-1">
                Click to hide omen
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-xs text-slate-400">
              <span className="mb-1">Hexagram is hidden</span>
              <span className={theme.primaryColor}>Tap to reveal omen</span>
            </div>
          )}
        </button>
      </motion.div>
    </header>
  );
};

export default GameHeader;


