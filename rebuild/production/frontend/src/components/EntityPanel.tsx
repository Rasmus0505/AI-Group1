import React from 'react';
import { Progress, Tag, Tooltip } from 'antd';
import { 
  Coins, TrendingUp, TrendingDown, AlertTriangle, 
  Award, Eye, EyeOff 
} from 'lucide-react';
import type { TurnEntityPanel } from '../types/turnResult';

interface EntityPanelProps {
  /** 主体数据 */
  entity: TurnEntityPanel;
  /** 是否为当前玩家 */
  isCurrentPlayer?: boolean;
  /** 是否显示完整信息（战争迷雾） */
  showFullInfo?: boolean;
  /** 紧凑模式 */
  compact?: boolean;
}

/**
 * EntityPanel - 主体状态面板（浅色玻璃态风格）
 * - 显示主体的所有动态属性
 * - 支持战争迷雾（根据 intelConfidence 模糊显示）
 * - 显示被动收支和本回合变动
 * - 破产状态警告
 */
const EntityPanel: React.FC<EntityPanelProps> = ({
  entity,
  isCurrentPlayer = false,
  showFullInfo = true,
  compact = false,
}) => {
  // 根据情报置信度决定是否模糊显示
  const shouldBlur = !showFullInfo && (entity.intelConfidence ?? 1) < 0.5;
  const isLowConfidence = (entity.intelConfidence ?? 1) < 0.2;

  // 格式化数值（支持模糊显示）
  const formatValue = (value: number, isMonetary = false): string => {
    if (shouldBlur) {
      const min = Math.floor(value * 0.7);
      const max = Math.ceil(value * 1.3);
      if (isMonetary) {
        return `¥${min.toLocaleString()} ~ ¥${max.toLocaleString()}`;
      }
      return `${min} ~ ${max}`;
    }
    if (isLowConfidence && !showFullInfo) {
      return '???';
    }
    if (isMonetary) {
      return `¥${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  // 获取变动颜色
  const getDeltaColor = (delta: number): string => {
    if (delta > 0) return 'text-emerald-500';
    if (delta < 0) return 'text-rose-500';
    return 'text-slate-400';
  };

  // 获取变动图标
  const getDeltaIcon = (delta: number) => {
    if (delta > 0) return <TrendingUp size={12} />;
    if (delta < 0) return <TrendingDown size={12} />;
    return null;
  };

  // 计算净被动收支
  const netPassive = entity.passiveIncome - entity.passiveExpense;

  return (
    <div
      className={`
        rounded-lg border transition-all shadow-sm
        ${entity.broken 
          ? 'bg-rose-50 border-rose-200' 
          : isCurrentPlayer 
            ? 'bg-indigo-50 border-indigo-200' 
            : 'bg-white border-slate-200'
        }
        ${compact ? 'p-3' : 'p-4'}
      `}
    >
      {/* 头部：名称和状态 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`
              w-8 h-8 rounded-lg flex items-center justify-center
              text-sm font-bold
              ${entity.broken 
                ? 'bg-rose-100 text-rose-600' 
                : 'bg-slate-100 text-slate-600'
              }
            `}
            style={{ 
              backgroundColor: entity.accentColor ? `${entity.accentColor}20` : undefined,
              color: entity.accentColor || undefined,
            }}
          >
            {entity.id}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-700">
              {entity.name}
              {isCurrentPlayer && (
                <Tag color="blue" className="ml-2 text-[10px]">你</Tag>
              )}
            </div>
            {entity.symbol && (
              <span className="text-[10px] text-slate-400">{entity.symbol}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {entity.broken && (
            <Tag color="error" icon={<AlertTriangle size={12} />}>
              已破产
            </Tag>
          )}
          {entity.creditRating && (
            <Tag color="default">{entity.creditRating}</Tag>
          )}
          {!showFullInfo && (
            <Tooltip title={`情报置信度: ${Math.round((entity.intelConfidence ?? 0) * 100)}%`}>
              {shouldBlur ? (
                <EyeOff size={14} className="text-slate-400" />
              ) : (
                <Eye size={14} className="text-slate-500" />
              )}
            </Tooltip>
          )}
        </div>
      </div>

      {/* 破产原因 */}
      {entity.broken && entity.bankruptReason && (
        <div className="mb-3 p-2 rounded-lg bg-rose-50 border border-rose-200">
          <span className="text-xs text-rose-600">{entity.bankruptReason}</span>
        </div>
      )}

      {/* 现金余额（核心属性） */}
      <div className="mb-3 p-3 rounded-lg bg-gray-50 border border-slate-200">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Coins size={14} className="text-amber-500" />
            现金余额
          </span>
          {entity.delta?.cash !== undefined && entity.delta.cash !== 0 && (
            <span className={`flex items-center gap-0.5 text-xs ${getDeltaColor(entity.delta.cash)}`}>
              {getDeltaIcon(entity.delta.cash)}
              {entity.delta.cash > 0 ? '+' : ''}{formatValue(entity.delta.cash, true)}
            </span>
          )}
        </div>
        <div className={`text-xl font-bold ${shouldBlur ? 'blur-sm' : ''} text-slate-800`}>
          {formatValue(entity.cash, true)}
        </div>
      </div>

      {/* 被动收支 */}
      {!compact && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="text-[10px] text-emerald-600 mb-0.5">被动收入</div>
            <div className={`text-sm font-semibold text-emerald-600 ${shouldBlur ? 'blur-sm' : ''}`}>
              +{formatValue(entity.passiveIncome, true)}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
            <div className="text-[10px] text-rose-600 mb-0.5">被动支出</div>
            <div className={`text-sm font-semibold text-rose-600 ${shouldBlur ? 'blur-sm' : ''}`}>
              -{formatValue(entity.passiveExpense, true)}
            </div>
          </div>
        </div>
      )}

      {/* 净被动收支 */}
      <div className="mb-3 p-2 rounded-lg bg-gray-50 border border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">净被动收支</span>
          <span className={`text-sm font-semibold ${netPassive >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {netPassive >= 0 ? '+' : ''}{formatValue(netPassive, true)}/回合
          </span>
        </div>
      </div>

      {/* 动态属性 */}
      {entity.attributes && Object.keys(entity.attributes).length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">属性</div>
          {Object.entries(entity.attributes).map(([key, value]) => {
            const numValue = typeof value === 'number' ? value : 0;
            const delta = entity.delta?.[key];
            const isPercentage = key.includes('份额') || key.includes('率');
            const maxValue = isPercentage ? 100 : Math.max(100, numValue * 2);
            const percent = Math.min(100, (numValue / maxValue) * 100);

            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{key}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono ${shouldBlur ? 'blur-sm' : ''} text-slate-700`}>
                      {typeof value === 'number' ? formatValue(value) : value}
                      {isPercentage && '%'}
                    </span>
                    {delta !== undefined && delta !== 0 && (
                      <span className={`flex items-center gap-0.5 ${getDeltaColor(delta)}`}>
                        {getDeltaIcon(delta)}
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    )}
                  </div>
                </div>
                {typeof value === 'number' && (
                  <Progress
                    percent={percent}
                    size="small"
                    showInfo={false}
                    strokeColor={shouldBlur ? '#94a3b8' : '#6366f1'}
                    trailColor="rgba(226, 232, 240, 0.8)"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 本回合成就 */}
      {entity.achievementsUnlocked && entity.achievementsUnlocked.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-1 text-[10px] text-amber-500 mb-2">
            <Award size={12} />
            本回合成就
          </div>
          <div className="flex flex-wrap gap-1">
            {entity.achievementsUnlocked.map((ach, idx) => (
              <Tag key={idx} color="gold" className="text-[10px]">
                {ach}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityPanel;
