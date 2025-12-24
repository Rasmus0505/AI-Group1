import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

type YaoType = 'yin' | 'yang';

export interface DivinationOverlayProps {
  visible: boolean;
  lines: YaoType[]; // bottom-up order, length 6
  title?: string;
  onComplete?: () => void;
  onCancel?: () => void; // escape / manual abort
  onPauseEffects?: () => void; // e.g. pause global particles
  onResumeEffects?: () => void;
  appearDelayMs?: number; // delay before first yao
  stepDelayMs?: number; // delay between yao
  holdAfterCompleteMs?: number; // hold overlay before fade-out
  allowEscape?: boolean;
}

const DEFAULT_LINES: YaoType[] = ['yang', 'yin', 'yin', 'yang', 'yang', 'yin'];

const DivinationOverlay: React.FC<DivinationOverlayProps> = ({
  visible,
  lines = DEFAULT_LINES,
  title = '天命卜筮中...',
  onComplete,
  onCancel,
  onPauseEffects,
  onResumeEffects,
  appearDelayMs = 800,
  stepDelayMs = 1200,
  holdAfterCompleteMs = 1600,
  allowEscape = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [renderedLines, setRenderedLines] = useState<YaoType[]>([]);
  const abortRef = useRef(false);
  const escHandlerRef = useRef<(e: KeyboardEvent) => void>();

  const normalizedLines = useMemo(() => {
    // ensure bottom-up order and valid length
    if (Array.isArray(lines) && lines.length === 6) return lines;
    return DEFAULT_LINES;
  }, [lines]);

  useEffect(() => {
    abortRef.current = false;
    if (!visible) {
      setActive(false);
      setRenderedLines([]);
      onResumeEffects?.();
      return;
    }

    onPauseEffects?.();

    const run = async () => {
      setActive(true);
      setRenderedLines([]);
      await delay(appearDelayMs);
      for (let i = 0; i < normalizedLines.length; i += 1) {
        if (abortRef.current) return;
        setRenderedLines(prev => [...prev, normalizedLines[i]]);
        await delay(stepDelayMs);
      }
      await delay(holdAfterCompleteMs);
      if (abortRef.current) return;
      setActive(false);
      await delay(500);
      if (!abortRef.current && onComplete) onComplete();
      onResumeEffects?.();
    };

    run();

    return () => {
      abortRef.current = true;
      onResumeEffects?.();
    };
  }, [
    visible,
    normalizedLines,
    appearDelayMs,
    stepDelayMs,
    holdAfterCompleteMs,
    onComplete,
    onPauseEffects,
    onResumeEffects,
  ]);

  useEffect(() => {
    if (!allowEscape) return;
    escHandlerRef.current = e => {
      if (e.key === 'Escape') {
        abortRef.current = true;
        setActive(false);
        setRenderedLines([]);
        onResumeEffects?.();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', escHandlerRef.current);
    return () => {
      if (escHandlerRef.current) {
        window.removeEventListener('keydown', escHandlerRef.current);
      }
      abortRef.current = true;
    };
  }, [allowEscape, onCancel, onResumeEffects]);

  const content = (
    <div className={`divination-overlay ${active ? 'active' : ''}`} aria-hidden={!active}>
      <div className="ambient-background" />
      <div className="divination-content">
        <h2 className="divination-title">{title}</h2>
        <div ref={containerRef} className="hexagram-container">
          {renderedLines.map((line, idx) => (
            <div
              key={`${line}-${idx}`}
              className={`yao-line ${line} animate-in`}
              aria-label={line}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return content;
  return ReactDOM.createPortal(content, document.body);
};

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default DivinationOverlay;

