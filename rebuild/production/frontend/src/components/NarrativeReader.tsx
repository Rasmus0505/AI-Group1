import React from 'react';
import { getSubjectTheme, SubjectId } from './gameSubjectTheme';

interface NarrativeSegment {
  id: string;
  text: string;
  relatedSubjectId?: SubjectId;
}

interface RiskCard {
  label: string;
  value: string;
  tone: 'risk' | 'opportunity' | 'effect';
}

interface NarrativeReaderProps {
  subjectId: SubjectId;
  segments: NarrativeSegment[];
  riskCard: RiskCard;
  opportunityCard: RiskCard;
  impactCard: RiskCard;
}

/**
 * NarrativeReader
 * - Show multi-branch narrative segments.
 * - If a segment is influenced by other subject, show colored label tag.
 * - Show three metric cards at bottom: risk, opportunity, effect.
 */
const NarrativeReader: React.FC<NarrativeReaderProps> = ({
  subjectId,
  segments,
  riskCard,
  opportunityCard,
  impactCard,
}) => {
  const theme = getSubjectTheme(subjectId);

  const renderSegment = (segment: NarrativeSegment) => {
    const isCrossInfluence =
      segment.relatedSubjectId && segment.relatedSubjectId !== subjectId;
    const relatedTheme = segment.relatedSubjectId
      ? getSubjectTheme(segment.relatedSubjectId)
      : null;

    return (
      <div key={segment.id} className="mb-3">
        {isCrossInfluence && relatedTheme && (
          <span
            className={[
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] mb-1 border',
              relatedTheme.softBg,
              relatedTheme.borderColor,
              relatedTheme.textColor,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            From subject {relatedTheme.indicatorLabel}
          </span>
        )}
        <p className="text-sm leading-7 text-slate-100">{segment.text}</p>
      </div>
    );
  };

  const renderCard = (card: RiskCard) => {
    const baseClass =
      'flex-1 px-3 py-2 rounded-xl border text-xs flex flex-col justify-between';
    const toneClass =
      card.tone === 'risk'
        ? 'border-red-500/60 bg-red-500/10 text-red-200'
        : card.tone === 'opportunity'
        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
        : 'border-sky-500/60 bg-sky-500/10 text-sky-200';

    return (
      <div key={card.label} className={[baseClass, toneClass].join(' ')}>
        <span className="text-[11px] uppercase tracking-widest opacity-80">
          {card.label}
        </span>
        <span className="mt-1 text-xs">{card.value}</span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-950/70 border border-slate-800/70 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-[0.3em]">
          Narrative engine
        </span>
        <span
          className={[
            'text-[10px] px-2 py-0.5 rounded-full border',
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

      <div className="flex-1 overflow-y-auto pr-2 mb-3">
        {segments.map(renderSegment)}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {renderCard(riskCard)}
        {renderCard(opportunityCard)}
        {renderCard(impactCard)}
      </div>
    </div>
  );
};

export default NarrativeReader;


