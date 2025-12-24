import React from 'react';
import { AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react';
import type { AssessmentCard } from '../types/turnResult';

interface AssessmentCardsProps {
  /** 风险卡片 */
  riskCard?: string | AssessmentCard;
  /** 机会卡片 */
  opportunityCard?: string | AssessmentCard;
  /** 效益卡片 */
  benefitCard?: string | AssessmentCard;
  /** 布局方向 */
  direction?: 'horizontal' | 'vertical';
  /** 紧凑模式 */
  compact?: boolean;
}

/**
 * AssessmentCards - 评估卡片组件（浅色玻璃态风格）
 * - 显示企业风险、机会、效益三项评估
 * - 支持字符串或结构化数据
 */
const AssessmentCards: React.FC<AssessmentCardsProps> = ({
  riskCard,
  opportunityCard,
  benefitCard,
  direction = 'vertical',
  compact = false,
}) => {
  // 解析卡片数据
  const parseCard = (card?: string | AssessmentCard): { title: string; summary: string; level?: string; details?: string[] } | null => {
    if (!card) return null;
    if (typeof card === 'string') {
      return { title: '', summary: card };
    }
    return card;
  };

  const risk = parseCard(riskCard);
  const opportunity = parseCard(opportunityCard);
  const benefit = parseCard(benefitCard);

  // 获取等级颜色
  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'high':
        return 'bg-rose-500';
      case 'medium':
        return 'bg-amber-500';
      case 'low':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-400';
    }
  };

  const renderCard = (
    data: { title: string; summary: string; level?: string; details?: string[] } | null,
    type: 'risk' | 'opportunity' | 'benefit'
  ) => {
    if (!data) return null;

    const configs = {
      risk: {
        icon: <AlertTriangle size={compact ? 14 : 16} />,
        label: '企业风险',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
        textColor: 'text-rose-600',
        iconColor: 'text-rose-500',
      },
      opportunity: {
        icon: <Lightbulb size={compact ? 14 : 16} />,
        label: '企业机会',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        textColor: 'text-emerald-600',
        iconColor: 'text-emerald-500',
      },
      benefit: {
        icon: <TrendingUp size={compact ? 14 : 16} />,
        label: '当前效益',
        bgColor: 'bg-sky-50',
        borderColor: 'border-sky-200',
        textColor: 'text-sky-600',
        iconColor: 'text-sky-500',
      },
    };

    const config = configs[type];

    return (
      <div
        className={`
          rounded-lg border shadow-sm ${config.bgColor} ${config.borderColor}
          ${compact ? 'p-3' : 'p-4'}
          ${direction === 'horizontal' ? 'flex-1' : 'w-full'}
        `}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className={config.iconColor}>{config.icon}</span>
          <span className={`text-xs font-semibold uppercase tracking-wider ${config.textColor}`}>
            {data.title || config.label}
          </span>
          {data.level && (
            <span className={`ml-auto w-2 h-2 rounded-full ${getLevelColor(data.level)}`} />
          )}
        </div>
        <p className={`text-sm text-slate-600 leading-relaxed ${compact ? 'line-clamp-2' : ''}`}>
          {data.summary}
        </p>
        {!compact && data.details && data.details.length > 0 && (
          <ul className="mt-2 space-y-1">
            {data.details.map((detail, idx) => (
              <li key={idx} className="text-xs text-slate-500 flex items-start gap-1">
                <span className="text-slate-400 mt-0.5">•</span>
                {detail}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const hasAnyCard = risk || opportunity || benefit;

  if (!hasAnyCard) {
    return (
      <div className="text-center text-slate-400 text-sm py-4">
        暂无评估数据
      </div>
    );
  }

  return (
    <div
      className={`
        ${direction === 'horizontal' ? 'flex gap-3' : 'flex flex-col gap-3'}
      `}
    >
      {renderCard(risk, 'risk')}
      {renderCard(opportunity, 'opportunity')}
      {renderCard(benefit, 'benefit')}
    </div>
  );
};

export default AssessmentCards;
