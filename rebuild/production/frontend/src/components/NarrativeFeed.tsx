import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

type PhaseState = 'READING' | 'DECIDING' | 'RESOLVING';

interface NarrativeFeedProps {
  phase: PhaseState;
  fullText: string;
  totalSeconds: number;
  remainingSeconds: number;
  onShareSnippet?: (snippet: string) => void;
}

/**
 * NarrativeFeed
 * - Center narrative area with a top countdown bar and streaming text effect.
 * - Allows selecting a snippet and "sharing" it via callback to simulate share-to-chat.
 *
 * 文本流式输出说明：
 * - 内部使用简单的 setInterval，将 fullText 逐字符追加到 visibleText；
 * - phase 变化为 RESOLVING 时可以停止追加或展示最终文本。
 */
const NarrativeFeed: React.FC<NarrativeFeedProps> = ({
  phase,
  fullText,
  totalSeconds,
  remainingSeconds,
  onShareSnippet,
}) => {
  const [visibleText, setVisibleText] = useState('');
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // 重置流式文本
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setVisibleText('');

    if (phase === 'READING') {
      let index = 0;
      intervalRef.current = window.setInterval(() => {
        if (index > fullText.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return;
        }
        setVisibleText(fullText.slice(0, index));
        index += 1;
      }, 20);
    } else {
      // 非阅读阶段直接展示完整文本
      setVisibleText(fullText);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [phase, fullText]);

  const percent = Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100));
  const isCritical = remainingSeconds <= 10 && phase !== 'RESOLVING';

  const handleShareClick = () => {
    if (!onShareSnippet) return;
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    if (selectedText) {
      onShareSnippet(selectedText);
    }
  };

  const renderHighlightedText = () => {
    const tokens = visibleText.split(' ');
    return tokens.map((word, index) => {
      const isKeyTerm =
        /%/.test(word) || /GDP|inflation|interest|leverage|default/i.test(word);
      if (isKeyTerm) {
        return (
          <span
            key={`${word}-${index}`}
            className="inline-block mx-0.5 px-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/40"
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
  };

  return (
    <section className="h-full flex flex-col bg-[#0a0a0b] border border-slate-800 rounded-2xl px-5 py-4">
      {/* 倒计时条 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1">
            <Clock size={14} />
            {phase === 'READING' && <span>Reading phase</span>}
            {phase === 'DECIDING' && <span>Negotiation phase</span>}
            {phase === 'RESOLVING' && <span>Resolving...</span>}
          </span>
          <span className={isCritical ? 'text-red-400 font-semibold' : 'text-slate-400'}>
            {remainingSeconds}s
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
          <div
            className={[
              'h-full transition-all duration-300',
              isCritical ? 'bg-red-500' : 'bg-emerald-500',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto font-serif text-sm leading-7 text-slate-100">
        <p>{renderHighlightedText()}</p>
      </div>

      <div className="mt-3 flex justify-between items-center text-[11px] text-slate-500">
        <span>Drag to select a sentence.</span>
        <button
          type="button"
          onClick={handleShareClick}
          className="px-2 py-1 rounded-md border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200"
        >
          Share selection to private channel
        </button>
      </div>
    </section>
  );
};

export default NarrativeFeed;


