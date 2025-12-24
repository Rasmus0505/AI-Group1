import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Progress } from 'antd';

type PhaseState = 'READING' | 'DECIDING' | 'RESOLVING';

interface NarrativeFeedProps {
  phase: PhaseState;
  fullText: string;
  totalSeconds: number;
  remainingSeconds: number;
  onShareSnippet?: (snippet: string) => void;
}

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
    if (intervalRef.current) clearInterval(intervalRef.current);
    setVisibleText('');

    if (phase === 'READING') {
      let index = 0;
      intervalRef.current = window.setInterval(() => {
        if (index > fullText.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }
        setVisibleText(fullText.slice(0, index));
        index += 1;
      }, 20);
    } else {
      setVisibleText(fullText);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, fullText]);

  const percent = Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100));
  const isCritical = remainingSeconds <= 10 && phase !== 'RESOLVING';

  const handleShareClick = () => {
    if (!onShareSnippet) return;
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    if (selectedText) onShareSnippet(selectedText);
  };

  const phaseLabel = phase === 'READING' ? '阅读阶段' : phase === 'DECIDING' ? '决策阶段' : '结算中...';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 倒计时条 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={14} />
            {phaseLabel}
          </span>
          <span style={{ color: isCritical ? '#ef4444' : '#64748b', fontWeight: isCritical ? 600 : 400 }}>
            {remainingSeconds}s
          </span>
        </div>
        <Progress percent={percent} size="small" strokeColor={isCritical ? '#ef4444' : '#10b981'} showInfo={false} />
      </div>

      {/* 叙事内容 */}
      <div style={{ flex: 1, overflowY: 'auto', fontSize: 14, lineHeight: 1.8, color: '#374151' }}>
        <p style={{ margin: 0 }}>{visibleText}</p>
      </div>

      {/* 分享按钮 */}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#94a3b8' }}>
        <span>选中文字后可分享</span>
        <button
          type="button"
          onClick={handleShareClick}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#374151',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          分享选中内容
        </button>
      </div>
    </div>
  );
};

export default NarrativeFeed;
