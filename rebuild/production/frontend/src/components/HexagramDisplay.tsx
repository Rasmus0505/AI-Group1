import React from 'react';
import { Tag } from 'antd';
import type { TurnHexagram } from '../types/turnResult';

interface HexagramDisplayProps {
  /** 卦象数据 */
  hexagram: TurnHexagram;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 紧凑模式 */
  compact?: boolean;
  /** 是否显示动画 */
  animated?: boolean;
}

/**
 * HexagramDisplay - 周易卦象展示组件（浅色玻璃态风格）
 * - 显示卦名、六爻、象曰
 * - 支持吉/凶/中性状态
 * - 可选动画效果
 */
const HexagramDisplay: React.FC<HexagramDisplayProps> = ({
  hexagram,
  showDetails = true,
  compact = false,
  animated = false,
}) => {
  // 获取卦象颜色（浅色风格）
  const getOmenColor = () => {
    switch (hexagram.omen) {
      case 'positive':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-600',
          glow: 'shadow-amber-100',
          tag: 'gold',
          label: '吉',
          yaoColor: 'bg-amber-400',
        };
      case 'negative':
        return {
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          text: 'text-slate-600',
          glow: 'shadow-slate-100',
          tag: 'default',
          label: '凶',
          yaoColor: 'bg-slate-400',
        };
      default:
        return {
          bg: 'bg-sky-50',
          border: 'border-sky-200',
          text: 'text-sky-600',
          glow: 'shadow-sky-100',
          tag: 'blue',
          label: '中',
          yaoColor: 'bg-sky-400',
        };
    }
  };

  const colors = getOmenColor();

  // 渲染单个爻
  const renderYao = (type: 'yang' | 'yin', index: number) => {
    const isYang = type === 'yang';
    const delay = animated ? `${index * 150}ms` : '0ms';

    return (
      <div
        key={index}
        className={`
          flex justify-center gap-2 h-3
          ${animated ? 'animate-fade-in' : ''}
        `}
        style={{ animationDelay: delay }}
      >
        {isYang ? (
          // 阳爻：一条实线
          <div className={`w-full h-full rounded-sm ${colors.yaoColor}`} />
        ) : (
          // 阴爻：两条短线，中间有间隔
          <>
            <div className={`w-[45%] h-full rounded-sm ${colors.yaoColor}`} />
            <div className={`w-[45%] h-full rounded-sm ${colors.yaoColor}`} />
          </>
        )}
      </div>
    );
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colors.bg} ${colors.border} border`}>
        <div className="flex flex-col gap-0.5 w-6">
          {/* 从上到下显示（第6爻在上，第1爻在下） */}
          {[...hexagram.lines].reverse().map((line, idx) => (
            <div key={idx} className="flex justify-center gap-0.5 h-1">
              {line === 'yang' ? (
                <div className={`w-full h-full rounded-sm ${colors.yaoColor}`} />
              ) : (
                <>
                  <div className={`w-[40%] h-full rounded-sm ${colors.yaoColor}`} />
                  <div className={`w-[40%] h-full rounded-sm ${colors.yaoColor}`} />
                </>
              )}
            </div>
          ))}
        </div>
        <span className={`text-sm font-semibold ${colors.text}`}>{hexagram.name}</span>
        <Tag color={colors.tag as any} className="text-[10px] m-0">
          {colors.label}
        </Tag>
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-lg border p-4 shadow-sm
        ${colors.bg} ${colors.border}
        ${animated ? `shadow-lg ${colors.glow}` : ''}
      `}
    >
      {/* 头部：卦名和状态 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${colors.text}`}>
            {hexagram.name}
          </span>
          <Tag color={colors.tag as any}>{colors.label}</Tag>
        </div>
        {hexagram.yearlyTheme && (
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            年度主题
          </span>
        )}
      </div>

      {/* 卦象图形 */}
      <div className="flex justify-center mb-4">
        <div className="w-24 flex flex-col gap-1.5">
          {/* 从上到下显示（第6爻在上，第1爻在下） */}
          {[...hexagram.lines].reverse().map((line, idx) => renderYao(line, idx))}
        </div>
      </div>

      {/* 象曰/解释 */}
      {showDetails && hexagram.text && (
        <div className="text-center">
          <p className={`text-sm ${colors.text} leading-relaxed`}>
            {hexagram.text}
          </p>
        </div>
      )}

      {/* 年度叙事暗线 */}
      {showDetails && hexagram.yearlyTheme && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="text-[10px] text-slate-400 mb-1">年度叙事暗线</div>
          <p className="text-xs text-slate-500">{hexagram.yearlyTheme}</p>
        </div>
      )}
    </div>
  );
};

export default HexagramDisplay;
